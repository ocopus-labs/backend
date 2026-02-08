import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/modules/prisma/prisma.module';
import { OrderModule } from 'src/modules/order/order.module';
import { MenuModule } from 'src/modules/menu/menu.module';
import { TableModule } from 'src/modules/table/table.module';
import { InventoryModule } from 'src/modules/inventory/inventory.module';
import { PaymentModule } from 'src/modules/payment/payment.module';
import { AnalyticsModule } from 'src/modules/analytics/analytics.module';
import { TeamModule } from 'src/modules/team/team.module';
import { ExpenseModule } from 'src/modules/expense/expense.module';
import { SearchModule } from 'src/modules/search';
import { BusinessModule } from 'src/modules/business/business.module';
import { McpController } from './mcp.controller';
import { McpService } from './mcp.service';
import { ApiKeyController } from './api-key.controller';
import { ApiKeyService } from './api-key.service';

@Module({
  imports: [
    PrismaModule,
    OrderModule,
    MenuModule,
    TableModule,
    InventoryModule,
    PaymentModule,
    AnalyticsModule,
    TeamModule,
    ExpenseModule,
    SearchModule,
    BusinessModule,
  ],
  controllers: [McpController, ApiKeyController],
  providers: [McpService, ApiKeyService],
  exports: [McpService, ApiKeyService],
})
export class McpModule {}
