import { Controller, Get, Post, Patch, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { AdminService } from './admin.service';

@ApiTags('admin')
@Controller('api/admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard/stats')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved' })
  async getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  @Get('cases/pending')
  @ApiOperation({ summary: 'Get all cases pending review' })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Pending cases retrieved' })
  async getPendingCases(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.adminService.getPendingCases(
      skip ? parseInt(skip) : 0,
      take ? parseInt(take) : 20,
    );
  }

  @Get('cases/:caseId/review')
  @ApiOperation({ summary: 'Get case details for review' })
  @ApiResponse({ status: 200, description: 'Case details retrieved' })
  async getCaseForReview(@Param('caseId') caseId: string) {
    return this.adminService.getCaseForReview(caseId);
  }

  @Patch('cases/:caseId/diagnosis')
  @ApiOperation({ summary: 'Update diagnosis with reviewer notes' })
  @ApiResponse({ status: 200, description: 'Diagnosis updated' })
  async updateDiagnosis(
    @Param('caseId') caseId: string,
    @Body() body: { reviewerNotes: string; updatedDiagnosis?: any },
  ) {
    return this.adminService.updateDiagnosis(
      caseId,
      body.reviewerNotes,
      body.updatedDiagnosis,
    );
  }

  @Post('cases/:caseId/send-report')
  @ApiOperation({
    summary: 'Send report to user (generates DOCX, sends email, captures payment)',
  })
  @ApiResponse({ status: 200, description: 'Report sent successfully' })
  async sendReport(
    @Param('caseId') caseId: string,
    @Body() body: { adminNotes?: string },
  ) {
    return this.adminService.sendReport(caseId, body.adminNotes);
  }

  @Post('cases/:caseId/cancel')
  @ApiOperation({ summary: 'Cancel case and refund payment' })
  @ApiResponse({ status: 200, description: 'Case cancelled' })
  async cancelCase(
    @Param('caseId') caseId: string,
    @Body() body: { reason?: string },
  ) {
    return this.adminService.cancelCase(caseId, body.reason);
  }
}
