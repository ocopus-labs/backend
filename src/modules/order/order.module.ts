import { Module, forwardRef } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { OrderGateway } from './order.gateway';
import { PrismaModule } from 'src/modules/prisma/prisma.module';
import { BusinessModule } from 'src/modules/business/business.module';
import { SubscriptionModule } from 'src/modules/subscription/subscription.module';

@Module({
  imports: [PrismaModule, BusinessModule, forwardRef(() => SubscriptionModule)],
  controllers: [OrderController],
  providers: [OrderService, OrderGateway],
  exports: [OrderService, OrderGateway],
})
export class OrderModule {}
