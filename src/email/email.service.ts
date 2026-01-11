import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend;
  private readonly fromEmail: string;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    this.fromEmail =
      this.configService.get<string>('RESEND_FROM_EMAIL') ||
      'informes@micasaverde.es';

    if (!apiKey) {
      this.logger.warn('RESEND_API_KEY not configured');
      this.resend = null;
    } else {
      this.resend = new Resend(apiKey);
      this.logger.log('✅ Email Service (Resend) initialized');
    }
  }

  /**
   * Send report email with DOCX attachment
   */
  async sendReportEmail(
    caseId: string,
    reportBuffer: Buffer,
    reportUrl?: string,
  ): Promise<{ success: boolean; messageId?: string }> {
    if (!this.resend) {
      this.logger.warn('Resend not configured, skipping email');
      return { success: false };
    }

    // Get case data
    const caseData = await this.prisma.case.findUnique({
      where: { id: caseId },
      include: {
        payment: true,
      },
    });

    if (!caseData || !caseData.email) {
      throw new Error('Case email not found');
    }

    const packName = this.getPackName(caseData.payment?.packId);

    // Send email
    try {
      const result = await this.resend.emails.send({
        from: `CasaDiag <${this.fromEmail}>`,
        to: caseData.email,
        subject: `Tu informe técnico está listo - Expediente ${caseId}`,
        html: this.buildEmailHtml(caseData, packName, caseId),
        attachments: [
          {
            filename: `informe-${caseId}.docx`,
            content: reportBuffer,
          },
        ],
      });

      this.logger.log(`Report email sent to ${caseData.email} for case ${caseId}`);

      return {
        success: true,
        messageId: result.data?.id,
      };
    } catch (error) {
      this.logger.error(`Failed to send email: ${error.message}`);
      throw error;
    }
  }

  /**
   * Build HTML email content
   */
  private buildEmailHtml(
    caseData: any,
    packName: string,
    caseId: string,
  ): string {
    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tu informe técnico está listo</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background-color: #3d8a7e;
      color: white;
      padding: 30px 20px;
      text-align: center;
      border-radius: 8px 8px 0 0;
    }
    .content {
      background-color: #ffffff;
      padding: 30px 20px;
      border: 1px solid #e0e0e0;
      border-top: none;
    }
    .footer {
      background-color: #f5f5f5;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #666;
      border-radius: 0 0 8px 8px;
    }
    .button {
      display: inline-block;
      background-color: #3d8a7e;
      color: white;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 6px;
      margin: 20px 0;
    }
    .info-box {
      background-color: #f9f9f9;
      border-left: 4px solid #3d8a7e;
      padding: 15px;
      margin: 20px 0;
    }
    h2 {
      color: #3d8a7e;
      margin-top: 0;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0;">✅ Tu informe técnico está listo</h1>
  </div>

  <div class="content">
    <h2>Hola ${caseData.fullName || 'Cliente'},</h2>

    <p>Tu informe técnico de diagnóstico ha sido completado y revisado por nuestro equipo.</p>

    <div class="info-box">
      <strong>Detalles del expediente:</strong><br>
      Expediente: <strong>${caseId}</strong><br>
      Pack contratado: <strong>${packName}</strong><br>
      Dirección: ${caseData.propertyAddress || 'No especificada'}
    </div>

    <p><strong>El informe está adjunto a este email</strong> en formato DOCX (Microsoft Word).</p>

    <h3>¿Qué incluye el informe?</h3>
    <ul>
      <li>Análisis técnico detallado de la patología</li>
      <li>Hipótesis sobre las causas probables</li>
      <li>Recomendaciones de próximos pasos</li>
      <li>Evaluación del nivel de riesgo</li>
      <li>Evidencias fotográficas analizadas</li>
    </ul>

    <p><strong>Importante:</strong> Este informe constituye una orientación técnica preliminar. Para cuestiones legales o intervenciones estructurales, se recomienda contratar una inspección presencial completa.</p>

    <p>Si tienes alguna duda sobre el informe, responde a este email y estaremos encantados de ayudarte.</p>

    <p>Gracias por confiar en CasaDiag.</p>

    <p>Saludos cordiales,<br>
    <strong>Equipo CasaDiag</strong></p>
  </div>

  <div class="footer">
    <p>Este email ha sido enviado a ${caseData.email}</p>
    <p>CasaDiag - Diagnóstico técnico de patologías en viviendas</p>
    <p><a href="https://patologias.micasaverde.es" style="color: #3d8a7e;">patologias.micasaverde.es</a></p>
  </div>
</body>
</html>
    `;
  }

  /**
   * Get pack name in Spanish
   */
  private getPackName(packId: string): string {
    const names = {
      orientacion: 'Orientación preliminar (gratuita)',
      informe: 'Informe técnico revisado',
      prioridad: 'Prioridad / Segunda opinión',
    };
    return names[packId] || 'No especificado';
  }

  /**
   * Send case status update email
   */
  async sendStatusUpdateEmail(
    caseId: string,
    status: string,
    message: string,
  ): Promise<{ success: boolean }> {
    if (!this.resend) {
      this.logger.warn('Resend not configured, skipping email');
      return { success: false };
    }

    const caseData = await this.prisma.case.findUnique({
      where: { id: caseId },
    });

    if (!caseData || !caseData.email) {
      return { success: false };
    }

    try {
      await this.resend.emails.send({
        from: `CasaDiag <${this.fromEmail}>`,
        to: caseData.email,
        subject: `Actualización de expediente ${caseId}`,
        html: `
          <h2>Actualización de tu expediente</h2>
          <p>Hola ${caseData.fullName || 'Cliente'},</p>
          <p>${message}</p>
          <p>Expediente: <strong>${caseId}</strong></p>
          <p>Estado actual: <strong>${status}</strong></p>
          <br>
          <p>Saludos,<br>Equipo CasaDiag</p>
        `,
      });

      this.logger.log(`Status update email sent for case ${caseId}`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to send status email: ${error.message}`);
      return { success: false };
    }
  }
}
