import { Module } from '@nestjs/common';
import { TeamController } from './team.controller';
import { TeamService } from './team.service';
import { PrismaModule } from '../prisma/prisma.module';
import { BusinessModule } from '../business/business.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [PrismaModule, BusinessModule, SubscriptionModule, MailModule],
  controllers: [TeamController],
  providers: [TeamService],
  exports: [TeamService],
})
export class TeamModule {}
