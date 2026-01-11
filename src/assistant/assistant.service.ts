import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { PrismaService } from '../common/prisma.service';

interface FunctionCall {
  name: string;
  arguments: string;
}

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);
  private readonly openai: OpenAI;
  private readonly assistantId: string;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
    this.assistantId = this.configService.get<string>('OPENAI_ASSISTANT_ID');
  }

  /**
   * Create the CasaDiag Assistant (one-time setup)
   */
  async createAssistant(): Promise<string> {
    const assistant = await this.openai.beta.assistants.create({
      name: 'CasaDiag Technical Assistant',
      model: 'gpt-4o',
      description:
        'Asistente técnico en español para diagnóstico de patologías en viviendas',
      instructions: `Eres un asistente técnico especializado en diagnóstico de patologías en viviendas en España. Tu rol es:

1. RECOPILAR INFORMACIÓN de forma estructurada y empática
   - Adapta tu tono según el perfil del usuario:
     * Particular: cercano, didáctico, evita tecnicismos
     * Abogado: formal, preciso, orientado a documentación legal
     * Administrador: profesional, enfocado en gestión comunitaria

2. GUIAR AL USUARIO por estados (S0 → S8):
   - S1_CONTEXTO: Obtener descripción, ubicación, antigüedad del problema
   - S2_EVIDENCIAS: Solicitar 3-6 fotos claras, vídeos opcionales
   - S3_PREDIAGNOSTICO: Tras análisis, presentar hipótesis preliminares
   - S4_PACKS: Explicar opciones (orientación gratuita vs informe revisado)

3. EXTRAER DATOS ESTRUCTURADOS usando function calling:
   - Cuando detectes ubicación → update_resumen("ubicacion", valor)
   - Cuando detectes tipo de patología → update_resumen("tipoPatologia", valor)
   - Cuando detectes antigüedad → update_resumen("antiguedad", valor)
   - Cuando tengas contexto suficiente → advance_to_evidencias()
   - Cuando haya 3+ fotos subidas → suggest_advance_to_prediagnostico()

4. REGLAS IMPORTANTES:
   - Siempre en español de España
   - No diagnostiques definitivamente (solo orientaciones preliminares)
   - Recuerda que la revisión humana es obligatoria para informes pagados
   - No sustituyes una inspección presencial cuando sea necesaria
   - Sé claro sobre limitaciones: "orientación preliminar", "hipótesis probable"

5. EJEMPLOS DE PREGUNTAS GUIADAS:
   - "¿En qué zona de la vivienda está el problema? (cocina, baño, dormitorio...)"
   - "¿Desde cuándo notas estos síntomas?"
   - "¿Ha empeorado con el tiempo o se mantiene igual?"
   - "¿Hay antecedentes de reparaciones previas en esa zona?"

Mantén un equilibrio entre recopilar información técnica y no abrumar al usuario.`,
      tools: [
        {
          type: 'function',
          function: {
            name: 'update_resumen',
            description:
              'Actualiza un campo del resumen del caso con información detectada',
            parameters: {
              type: 'object',
              properties: {
                field: {
                  type: 'string',
                  enum: [
                    'tipoPatologia',
                    'ubicacion',
                    'antiguedad',
                    'descripcionUsuario',
                  ],
                  description: 'Campo a actualizar',
                },
                value: {
                  type: 'string',
                  description: 'Valor a guardar',
                },
              },
              required: ['field', 'value'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'advance_to_evidencias',
            description:
              'Avanzar al estado S2_EVIDENCIAS cuando se tiene contexto suficiente',
            parameters: {
              type: 'object',
              properties: {},
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'suggest_advance_to_prediagnostico',
            description:
              'Sugerir avanzar a prediagnóstico cuando hay evidencias suficientes (3+ fotos)',
            parameters: {
              type: 'object',
              properties: {},
            },
          },
        },
      ],
    });

    this.logger.log(`✅ Assistant created: ${assistant.id}`);
    return assistant.id;
  }

  /**
   * Create a Run and handle it to completion
   */
  async createRun(
    threadId: string,
    caseId: string,
  ): Promise<OpenAI.Beta.Threads.Messages.Message> {
    let run = await this.openai.beta.threads.runs.create(threadId, {
      assistant_id: this.assistantId,
    });

    this.logger.log(`Run created: ${run.id} for thread ${threadId}`);

    // Poll until completion
    while (
      run.status === 'queued' ||
      run.status === 'in_progress' ||
      run.status === 'requires_action'
    ) {
      await this.sleep(1000);

      run = await this.openai.beta.threads.runs.retrieve(threadId, run.id);

      if (run.status === 'requires_action') {
        const toolOutputs = await this.handleFunctionCalls(
          caseId,
          run.required_action.submit_tool_outputs.tool_calls,
        );

        run = await this.openai.beta.threads.runs.submitToolOutputs(
          threadId,
          run.id,
          { tool_outputs: toolOutputs },
        );
      }
    }

    if (run.status === 'failed') {
      this.logger.error(`Run failed: ${run.last_error?.message}`);
      throw new Error(`Run failed: ${run.last_error?.message}`);
    }

    // Get the assistant's latest message
    const messages = await this.openai.beta.threads.messages.list(threadId, {
      limit: 1,
      order: 'desc',
    });

    return messages.data[0];
  }

  /**
   * Handle function calls from the assistant
   */
  private async handleFunctionCalls(
    caseId: string,
    toolCalls: any[],
  ): Promise<any[]> {
    const outputs = [];

    for (const toolCall of toolCalls) {
      const functionName = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments);

      this.logger.log(
        `Function call: ${functionName} with args: ${JSON.stringify(args)}`,
      );

      let result;

      switch (functionName) {
        case 'update_resumen':
          result = await this.updateResumen(caseId, args.field, args.value);
          break;

        case 'advance_to_evidencias':
          result = await this.advanceToEvidencias(caseId);
          break;

        case 'suggest_advance_to_prediagnostico':
          result = await this.suggestPrediagnostico(caseId);
          break;

        default:
          result = { error: 'Unknown function' };
      }

      outputs.push({
        tool_call_id: toolCall.id,
        output: JSON.stringify(result),
      });
    }

    return outputs;
  }

  /**
   * Update resumen field
   */
  private async updateResumen(
    caseId: string,
    field: string,
    value: string,
  ): Promise<any> {
    try {
      // Get current case
      const caseData = await this.prisma.case.findUnique({
        where: { id: caseId },
      });

      if (!caseData) {
        return { success: false, error: 'Case not found' };
      }

      // Update the specific field in resumen JSON
      const currentResumen = (caseData.resumen as any) || {};
      currentResumen[field] = value;

      await this.prisma.case.update({
        where: { id: caseId },
        data: { resumen: currentResumen },
      });

      this.logger.log(`Updated resumen.${field} = ${value} for case ${caseId}`);

      return { success: true, field, value };
    } catch (error) {
      this.logger.error(`Error updating resumen: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Advance case to S2_EVIDENCIAS state
   */
  private async advanceToEvidencias(caseId: string): Promise<any> {
    try {
      await this.prisma.case.update({
        where: { id: caseId },
        data: { currentState: 'S2_EVIDENCIAS' },
      });

      this.logger.log(`Advanced case ${caseId} to S2_EVIDENCIAS`);

      return { success: true, newState: 'S2_EVIDENCIAS' };
    } catch (error) {
      this.logger.error(`Error advancing state: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Suggest advancing to prediagnostico
   */
  private async suggestPrediagnostico(caseId: string): Promise<any> {
    try {
      // Check if we have enough evidence
      const evidenceCount = await this.prisma.evidence.count({
        where: {
          caseId,
          type: 'photo',
        },
      });

      if (evidenceCount >= 3) {
        return {
          success: true,
          suggestion:
            'Hay suficientes evidencias. Sugerir al usuario generar el prediagnóstico.',
          evidenceCount,
        };
      }

      return {
        success: true,
        suggestion: 'Aún se necesitan más fotos (idealmente 3-6).',
        evidenceCount,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
