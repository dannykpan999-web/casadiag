import { Module } from '@nestjs/common';
import { DiagnosisService } from './diagnosis.service';
import { PrismaService } from '../common/prisma.service';
import { OpenAIService } from '../common/openai.service';

@Module({
  providers: [DiagnosisService, PrismaService, OpenAIService],
  exports: [DiagnosisService],
})
export class DiagnosisModule {}
