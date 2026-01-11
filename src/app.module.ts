import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './common/prisma.service';
import { CasesModule } from './cases/cases.module';
import { EvidenceModule } from './evidence/evidence.module';
import { MessagesModule } from './messages/messages.module';
import { AssistantModule } from './assistant/assistant.module';
import { DiagnosisModule } from './diagnosis/diagnosis.module';
import { PaymentsModule } from './payments/payments.module';
import { ReportsModule } from './reports/reports.module';
import { EmailModule } from './email/email.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    CasesModule,
    EvidenceModule,
    MessagesModule,
    AssistantModule,
    DiagnosisModule,
    PaymentsModule,
    ReportsModule,
    EmailModule,
    AdminModule,
  ],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
