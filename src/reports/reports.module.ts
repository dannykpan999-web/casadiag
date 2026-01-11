import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { PrismaService } from '../common/prisma.service';
import { R2Service } from '../common/r2.service';

@Module({
  providers: [ReportsService, PrismaService, R2Service],
  exports: [ReportsService],
})
export class ReportsModule {}
