import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { ReportsService } from '../reports/reports.service';
import { EmailService } from '../email/email.service';
import { PaymentsService } from '../payments/payments.service';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private prisma: PrismaService,
    private reportsService: ReportsService,
    private emailService: EmailService,
    private paymentsService: PaymentsService,
  ) {}

  /**
   * Get all cases pending review
   */
  async getPendingCases(skip: number = 0, take: number = 20) {
    const [cases, total] = await Promise.all([
      this.prisma.case.findMany({
        where: {
          currentState: 'S6_REVISION_HUMANA',
        },
        skip,
        take,
        orderBy: { createdAt: 'asc' }, // Oldest first
        include: {
          evidence: {
            orderBy: { uploadedAt: 'desc' },
          },
          diagnosisHistory: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          payment: true,
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      }),
      this.prisma.case.count({
        where: { currentState: 'S6_REVISION_HUMANA' },
      }),
    ]);

    return {
      data: cases,
      meta: {
        total,
        skip,
        take,
      },
    };
  }

  /**
   * Get case details for review
   */
  async getCaseForReview(caseId: string) {
    const caseData = await this.prisma.case.findUnique({
      where: { id: caseId },
      include: {
        evidence: {
          orderBy: { uploadedAt: 'desc' },
        },
        diagnosisHistory: {
          orderBy: { createdAt: 'desc' },
        },
        payment: true,
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!caseData) {
      throw new NotFoundException(`Case with ID ${caseId} not found`);
    }

    return caseData;
  }

  /**
   * Update diagnosis with reviewer notes
   */
  async updateDiagnosis(caseId: string, reviewerNotes: string, updatedDiagnosis?: any) {
    const caseData = await this.prisma.case.findUnique({
      where: { id: caseId },
      include: {
        diagnosisHistory: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!caseData) {
      throw new NotFoundException(`Case with ID ${caseId} not found`);
    }

    // Get existing diagnosis or create new
    const existingDiagnosis = caseData.diagnosisHistory[0]?.diagnosisData || {};
    const finalDiagnosis = updatedDiagnosis || existingDiagnosis;

    // Add reviewer summary if provided
    if (reviewerNotes) {
      finalDiagnosis.summary = reviewerNotes;
      finalDiagnosis.reviewerName = 'Técnico revisor';
      finalDiagnosis.reviewedAt = new Date().toISOString();
    }

    // Create new diagnosis history entry
    await this.prisma.diagnosisHistory.create({
      data: {
        caseId,
        diagnosisData: finalDiagnosis as any,
        generatedBy: 'admin',
        visionAnalysisUsed: caseData.diagnosisHistory[0]?.visionAnalysisUsed || [],
      },
    });

    this.logger.log(`Diagnosis updated by admin for case ${caseId}`);

    return {
      success: true,
      diagnosis: finalDiagnosis,
    };
  }

  /**
   * Send report to user (generates DOCX, sends email, captures payment)
   */
  async sendReport(caseId: string, adminNotes?: string) {
    this.logger.log(`Sending report for case ${caseId}`);

    const caseData = await this.prisma.case.findUnique({
      where: { id: caseId },
      include: { payment: true },
    });

    if (!caseData) {
      throw new NotFoundException(`Case with ID ${caseId} not found`);
    }

    // 1. Generate DOCX report
    const reportBuffer = await this.reportsService.generateReport(
      caseId,
      adminNotes,
    );

    // 2. Upload to R2 for archival
    const { reportUrl, reportKey } = await this.reportsService.generateAndUploadReport(
      caseId,
      adminNotes,
    );

    // 3. Send email with attachment
    const emailResult = await this.emailService.sendReportEmail(
      caseId,
      reportBuffer,
      reportUrl,
    );

    // 4. Capture payment if exists and is authorized
    let paymentResult = null;
    if (caseData.payment && caseData.payment.status === 'authorized') {
      try {
        paymentResult = await this.paymentsService.capturePayment(caseId);
        this.logger.log(`Payment captured for case ${caseId}`);
      } catch (error) {
        this.logger.error(`Failed to capture payment: ${error.message}`);
      }
    }

    // 5. Update case state to S7_ENVIADO
    await this.prisma.case.update({
      where: { id: caseId },
      data: {
        currentState: 'S7_ENVIADO',
        reportUrl,
      },
    });

    this.logger.log(`Report sent successfully for case ${caseId}`);

    return {
      success: true,
      reportUrl,
      reportKey,
      emailSent: emailResult.success,
      paymentCaptured: paymentResult?.success || false,
    };
  }

  /**
   * Cancel case and refund payment
   */
  async cancelCase(caseId: string, reason?: string) {
    const caseData = await this.prisma.case.findUnique({
      where: { id: caseId },
      include: { payment: true },
    });

    if (!caseData) {
      throw new NotFoundException(`Case with ID ${caseId} not found`);
    }

    // Cancel payment if exists
    let paymentCancelled = false;
    if (caseData.payment && caseData.payment.status === 'authorized') {
      try {
        await this.paymentsService.cancelPayment(caseId, reason);
        paymentCancelled = true;
      } catch (error) {
        this.logger.error(`Failed to cancel payment: ${error.message}`);
      }
    }

    // Update case state to S8_CERRADO
    await this.prisma.case.update({
      where: { id: caseId },
      data: { currentState: 'S8_CERRADO' },
    });

    // Send notification email
    if (reason) {
      await this.emailService.sendStatusUpdateEmail(
        caseId,
        'Cancelado',
        `Tu expediente ha sido cancelado. Motivo: ${reason}`,
      );
    }

    this.logger.log(`Case ${caseId} cancelled`);

    return {
      success: true,
      paymentCancelled,
      reason,
    };
  }

  /**
   * Get dashboard statistics
   */
  async getDashboardStats() {
    const [
      totalCases,
      pendingReview,
      completedToday,
      totalRevenue,
    ] = await Promise.all([
      this.prisma.case.count(),
      this.prisma.case.count({
        where: { currentState: 'S6_REVISION_HUMANA' },
      }),
      this.prisma.case.count({
        where: {
          currentState: 'S7_ENVIADO',
          updatedAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      this.prisma.payment.aggregate({
        where: { status: 'captured' },
        _sum: { amount: true },
      }),
    ]);

    return {
      totalCases,
      pendingReview,
      completedToday,
      totalRevenue: (totalRevenue._sum.amount || 0) / 100, // Convert cents to euros
    };
  }
}
