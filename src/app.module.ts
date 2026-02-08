import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RolesGuard, BusinessAccessGuard, HttpCacheInterceptor } from './lib/common';
import { PrismaModule } from './modules/prisma/prisma.module';
import { MailModule } from './modules/mail/mail.module';
import { AuthModule } from './modules/auth/auth.module';
import { BusinessModule } from './modules/business/business.module';
import { MenuModule } from './modules/menu/menu.module';
import { OrderModule } from './modules/order/order.module';
import { PaymentModule } from './modules/payment/payment.module';
import { TableModule } from './modules/table/table.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { ExpenseModule } from './modules/expense/expense.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { TeamModule } from './modules/team/team.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';
import { AdminModule } from './modules/admin/admin.module';
import { AnnouncementModule } from './modules/announcement/announcement.module';
import { CustomerModule } from './modules/customer';
import { LoyaltyModule } from './modules/loyalty';
import { SearchModule } from './modules/search';
import { McpModule } from './modules/mcp';
import { TaxModule } from './modules/tax';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      cache: true,
    }),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 3,
      },
      {
        name: 'medium',
        ttl: 10000,
        limit: 20,
      },
      {
        name: 'long',
        ttl: 60000,
        limit: 100,
      },
    ]),
    CacheModule.register({
      isGlobal: true,
      ttl: 60_000, // Default 60s TTL (in ms)
      max: 500,    // Max items in cache
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    MailModule,
    AuthModule,
    BusinessModule,
    MenuModule,
    OrderModule,
    PaymentModule,
    TableModule,
    InventoryModule,
    ExpenseModule,
    AnalyticsModule,
    CustomerModule,
    LoyaltyModule,
    TeamModule,
    SubscriptionModule,
    AdminModule,
    AnnouncementModule,
    SearchModule,
    McpModule,
    TaxModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: BusinessAccessGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpCacheInterceptor,
    },
  ],
})
export class AppModule {}
