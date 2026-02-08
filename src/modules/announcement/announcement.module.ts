import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/modules/prisma/prisma.module';
import {
  AdminAnnouncementController,
  UserAnnouncementController,
} from './announcement.controller';
import { AnnouncementService } from './announcement.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdminAnnouncementController, UserAnnouncementController],
  providers: [AnnouncementService],
  exports: [AnnouncementService],
})
export class AnnouncementModule {}
