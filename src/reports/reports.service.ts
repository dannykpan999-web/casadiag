import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { R2Service } from '../common/r2.service';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private prisma: PrismaService,
    private r2Service: R2Service,
  ) {}

  /**
   * Generate DOCX report for a case
   */
  async generateReport(caseId: string, adminNotes?: string): Promise<Buffer> {
    this.logger.log(`Generating report for case ${caseId}`);

    // 1. Get case data with all relations
    const caseData = await this.prisma.case.findUnique({
      where: { id: caseId },
      include: {
        evidence: {
          orderBy: { uploadedAt: 'asc' },
        },
        diagnosisHistory: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        payment: true,
      },
    });

    if (!caseData) {
      throw new NotFoundException(`Case with ID ${caseId} not found`);
    }

    // 2. Load template
    const templatePath = path.join(
      __dirname,
      '../../templates/informe-template.docx',
    );

    if (!fs.existsSync(templatePath)) {
      throw new Error('Template file not found. Please create the template first.');
    }

    const content = fs.readFileSync(templatePath, 'binary');
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    // 3. Prepare data for template
    const diagnosis = caseData.diagnosisHistory[0]?.diagnosisData || {};
    const resumen = (caseData.resumen as any) || {};

    const templateData = {
      expedienteId: caseData.id,
      fecha: new Date().toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      perfil: this.translateProfile(caseData.userProfile),
      nombreCompleto: caseData.fullName || 'No especificado',
      email: caseData.email || 'No especificado',
      telefono: caseData.phone || 'No especificado',
      direccionPropiedad: caseData.propertyAddress || 'No especificada',
      ubicacion: resumen.ubicacion || 'No especificada',
      antiguedad: resumen.antiguedad || 'No especificada',
      descripcion: resumen.descripcionUsuario || 'Sin descripción',
      tipoPatologia: diagnosis.pathologyType || 'No determinado',
      nivelSeveridad: diagnosis.severity || 'N/A',
      nivelRiesgo: diagnosis.riskLevel || 'No evaluado',
      puntuacionConfianza: diagnosis.confidenceScore || 'N/A',
      hipotesis: diagnosis.hypotheses || [],
      posiblesCausas: diagnosis.probableCauses || [],
      proximosPasos: diagnosis.nextSteps || [],
      evidenciaAdicional:
        diagnosis.additionalEvidenceSuggested?.join(', ') || 'Ninguna',
      evidencias:
        caseData.evidence.map((e) => ({
          nombre: e.filename,
          tipo: this.translateEvidenceType(e.type),
          tamano: this.formatFileSize(e.fileSize),
          fecha: new Date(e.uploadedAt).toLocaleDateString('es-ES'),
        })) || [],
      conclusiones:
        diagnosis.summary || adminNotes || 'Pendiente de revisión humana',
      revisorNombre: adminNotes ? 'Técnico revisor' : 'Pendiente',
      fechaRevision: adminNotes
        ? new Date().toLocaleDateString('es-ES')
        : 'Pendiente',
      notasRevisor: adminNotes || '',
    };

    // 4. Render document
    try {
      doc.setData(templateData);
      doc.render();
    } catch (error) {
      this.logger.error(`Error rendering template: ${error.message}`);
      throw new Error(`Failed to render report: ${error.message}`);
    }

    // 5. Generate buffer
    const buffer = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });

    this.logger.log(`Report generated for case ${caseId}: ${buffer.length} bytes`);

    return buffer;
  }

  /**
   * Generate and upload report to R2
   */
  async generateAndUploadReport(
    caseId: string,
    adminNotes?: string,
  ): Promise<{ reportUrl: string; reportKey: string }> {
    // Generate DOCX
    const reportBuffer = await this.generateReport(caseId, adminNotes);

    // Upload to R2
    const timestamp = Date.now();
    const reportKey = `reports/${caseId}/informe-${timestamp}.docx`;

    const { url } = await this.r2Service.uploadFile(
      reportKey,
      reportBuffer,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );

    this.logger.log(`Report uploaded to R2: ${reportKey}`);

    return {
      reportUrl: url,
      reportKey,
    };
  }

  /**
   * Helper: Translate user profile to Spanish
   */
  private translateProfile(profile: string): string {
    const translations = {
      particular: 'Particular',
      abogado: 'Abogado',
      administrador: 'Administrador de fincas',
    };
    return translations[profile] || profile;
  }

  /**
   * Helper: Translate evidence type to Spanish
   */
  private translateEvidenceType(type: string): string {
    const translations = {
      photo: 'Fotografía',
      video: 'Vídeo',
      audio: 'Audio',
      document: 'Documento',
    };
    return translations[type] || type;
  }

  /**
   * Helper: Format file size
   */
  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
