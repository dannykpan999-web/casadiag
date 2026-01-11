import { Module } from '@nestjs/common';
import { AssistantService } from './assistant.service';
import { PrismaService } from '../common/prisma.service';

@Module({
  providers: [AssistantService, PrismaService],
  exports: [AssistantService],
})
export class AssistantModule {}
