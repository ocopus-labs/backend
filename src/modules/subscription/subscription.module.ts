import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { PlanService } from './plan.service';
import { UsageTrackingService } from './usage-tracking.service';
import { DodoService } from './dodo/dodo.service';
import { DodoWebhookController } from './dodo/dodo-webhook.controller';
import { SubscriptionGuard } from './guards/subscription.guard';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [SubscriptionController, DodoWebhookController],
  providers: [
    SubscriptionService,
    PlanService,
    UsageTrackingService,
    DodoService,
    SubscriptionGuard,
  ],
  exports: [
    SubscriptionService,
    PlanService,
    UsageTrackingService,
    SubscriptionGuard,
    DodoService,
  ],
})
export class SubscriptionModule {}
