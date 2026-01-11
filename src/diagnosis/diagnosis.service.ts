import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { OpenAIService } from '../common/openai.service';

interface DiagnosisData {
  pathologyType: string;
  severity: number; // 1-10
  hypotheses: string[];
  probableCauses: string[];
  nextSteps: string[];
  riskLevel: 'bajo' | 'medio' | 'alto';
  additionalEvidenceSuggested?: string[];
  confidenceScore: number; // 1-10
  summary?: string;
}

@Injectable()
export class DiagnosisService {
  private readonly logger = new Logger(DiagnosisService.name);

  constructor(
    private prisma: PrismaService,
    private openaiService: OpenAIService,
  ) {}

  /**
   * Trigger re-evaluation and generate prediagnostico
   */
  async generateDiagnosis(caseId: string): Promise<any> {
    this.logger.log(`Starting diagnosis generation for case ${caseId}`);

    // 1. Get case with all evidence
    const caseData = await this.prisma.case.findUnique({
      where: { id: caseId },
      include: {
        evidence: {
          where: { type: 'photo' },
          orderBy: { createdAt: 'asc' },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 20, // Last 20 messages for context
        },
      },
    });

    if (!caseData) {
      throw new Error('Case not found');
    }

    // 2. Collect Vision analyses from evidence
    const visionAnalyses = [];
    for (const evidence of caseData.evidence) {
      if (evidence.visionAnalysis) {
        visionAnalyses.push({
          filename: evidence.filename,
          analysis: evidence.visionAnalysis,
        });
      }
    }

    // 3. Build context for diagnosis
    const context = this.buildDiagnosisContext(
      caseData,
      visionAnalyses,
    );

    // 4. Get diagnosis from GPT
    const diagnosisPrompt = this.buildDiagnosisPrompt(
      context,
      visionAnalyses,
    );
    const diagnosisText = await this.openaiService.generateDiagnosis(
      diagnosisPrompt,
    );

    // 5. Parse structured diagnosis
    const structuredDiagnosis = this.parseStructuredDiagnosis(diagnosisText);

    // 6. Save to DiagnosisHistory
    const diagnosisHistory = await this.prisma.diagnosisHistory.create({
      data: {
        caseId,
        diagnosisData: structuredDiagnosis as any,
        visionAnalysisUsed: visionAnalyses as any,
        generatedBy: 'system',
      },
    });

    // 7. Update case state to S3_PREDIAGNOSTICO
    await this.prisma.case.update({
      where: { id: caseId },
      data: { currentState: 'S3_PREDIAGNOSTICO' },
    });

    this.logger.log(`Diagnosis generated for case ${caseId}`);

    return {
      diagnosisId: diagnosisHistory.id,
      diagnosis: structuredDiagnosis,
      visionAnalysesUsed: visionAnalyses.length,
    };
  }

  /**
   * Build context from case data
   */
  private buildDiagnosisContext(caseData: any, visionAnalyses: any[]): any {
    const resumen = caseData.resumen || {};
    const userMessages = caseData.messages
      .filter((m) => m.role === 'user')
      .map((m) => m.content)
      .join('\n');

    return {
      userProfile: caseData.userProfile,
      propertyAddress: caseData.propertyAddress,
      resumen,
      userMessages,
      evidenceCount: {
        photos: caseData.evidence.filter((e) => e.type === 'photo').length,
        videos: caseData.evidence.filter((e) => e.type === 'video').length,
      },
      hasVisionAnalysis: visionAnalyses.length > 0,
    };
  }

  /**
   * Build diagnosis prompt for GPT
   */
  private buildDiagnosisPrompt(context: any, visionAnalyses: any[]): string {
    const visionSummary =
      visionAnalyses.length > 0
        ? visionAnalyses
            .map((v, i) => {
              const analysis = v.analysis;
              return `
Foto ${i + 1} (${v.filename}):
- Tipo de patología detectada: ${analysis.pathologyType || 'No especificado'}
- Confianza: ${analysis.confidence || 0}/10
- Síntomas visuales: ${(analysis.visualSymptoms || []).join(', ')}
- Elementos afectados: ${(analysis.affectedElements || []).join(', ')}
- Observaciones: ${(analysis.technicalObservations || []).join('. ')}
`;
            })
            .join('\n')
        : 'No hay análisis de visión disponibles.';

    return `Eres un técnico especializado en diagnóstico de patologías en viviendas en España.

CONTEXTO DEL CASO:
- Perfil del usuario: ${context.userProfile}
- Dirección: ${context.propertyAddress || 'No especificada'}
- Información del resumen: ${JSON.stringify(context.resumen, null, 2)}
- Evidencias: ${context.evidenceCount.photos} fotos, ${context.evidenceCount.videos} vídeos

MENSAJES DEL USUARIO:
${context.userMessages}

ANÁLISIS DE VISIÓN (IA):
${visionSummary}

TAREA:
Genera un prediagnóstico técnico en formato JSON con la siguiente estructura:

{
  "pathologyType": "tipo_de_patologia_detectada",
  "severity": 1-10,
  "hypotheses": ["hipótesis 1", "hipótesis 2", "hipótesis 3"],
  "probableCauses": ["causa probable 1", "causa probable 2", ...],
  "nextSteps": ["paso recomendado 1", "paso recomendado 2", ...],
  "riskLevel": "bajo" | "medio" | "alto",
  "additionalEvidenceSuggested": ["evidencia adicional que sería útil"],
  "confidenceScore": 1-10,
  "summary": "resumen breve del diagnóstico"
}

IMPORTANTE:
- Usa español técnico pero comprensible
- Sé prudente: esto es una orientación preliminar, no un diagnóstico definitivo
- Recomienda inspección presencial si hay riesgo estructural o incertidumbre
- Basa tus hipótesis en los datos de visión AI y la descripción del usuario
- Si hay contradicciones entre visión y descripción, menciónalas

Responde SOLO con el JSON, sin texto adicional.`;
  }

  /**
   * Parse structured diagnosis from GPT response
   */
  private parseStructuredDiagnosis(text: string): DiagnosisData {
    try {
      // Try to extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate and set defaults
      return {
        pathologyType: parsed.pathologyType || 'no_especificado',
        severity: Math.min(10, Math.max(1, parsed.severity || 5)),
        hypotheses: Array.isArray(parsed.hypotheses)
          ? parsed.hypotheses
          : [],
        probableCauses: Array.isArray(parsed.probableCauses)
          ? parsed.probableCauses
          : [],
        nextSteps: Array.isArray(parsed.nextSteps) ? parsed.nextSteps : [],
        riskLevel: ['bajo', 'medio', 'alto'].includes(parsed.riskLevel)
          ? parsed.riskLevel
          : 'medio',
        additionalEvidenceSuggested: Array.isArray(
          parsed.additionalEvidenceSuggested,
        )
          ? parsed.additionalEvidenceSuggested
          : [],
        confidenceScore: Math.min(
          10,
          Math.max(1, parsed.confidenceScore || 5),
        ),
        summary: parsed.summary || '',
      };
    } catch (error) {
      this.logger.error(`Failed to parse diagnosis JSON: ${error.message}`);

      // Return fallback diagnosis
      return {
        pathologyType: 'error_analisis',
        severity: 5,
        hypotheses: [
          'No se pudo generar diagnóstico automático',
          'Se requiere revisión manual',
        ],
        probableCauses: ['Análisis pendiente'],
        nextSteps: ['Contactar con técnico para inspección presencial'],
        riskLevel: 'medio',
        confidenceScore: 1,
        summary: 'Error en generación automática de diagnóstico',
      };
    }
  }
}
