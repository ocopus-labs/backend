import { Module } from '@nestjs/common';
import { CustomerOrderController } from './customer-order.controller';
import { CustomerOrderService } from './customer-order.service';
import { PrismaModule } from 'src/modules/prisma/prisma.module';
import { OrderModule } from 'src/modules/order/order.module';
import { QrModule } from 'src/modules/qr/qr.module';
import { SubscriptionModule } from 'src/modules/subscription/subscription.module';
import { TaxModule } from 'src/modules/tax/tax.module';

@Module({
  imports: [PrismaModule, OrderModule, QrModule, SubscriptionModule, TaxModule],
  controllers: [CustomerOrderController],
  providers: [CustomerOrderService],
  exports: [CustomerOrderService],
})
export class CustomerOrderModule {}
