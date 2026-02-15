import { Module, forwardRef } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { OrderGateway } from './order.gateway';
import { PrismaModule } from 'src/modules/prisma/prisma.module';
import { BusinessModule } from 'src/modules/business/business.module';
import { SubscriptionModule } from 'src/modules/subscription/subscription.module';
import { TableModule } from 'src/modules/table/table.module';
import { LoyaltyModule } from 'src/modules/loyalty/loyalty.module';
import { TaxModule } from 'src/modules/tax/tax.module';
import { InventoryModule } from 'src/modules/inventory/inventory.module';
import { MenuModule } from 'src/modules/menu/menu.module';

@Module({
  imports: [
    PrismaModule,
    BusinessModule,
    forwardRef(() => SubscriptionModule),
    TableModule,
    LoyaltyModule,
    TaxModule,
    InventoryModule,
    MenuModule,
  ],
  controllers: [OrderController],
  providers: [OrderService, OrderGateway],
  exports: [OrderService, OrderGateway],
})
export class OrderModule {}
