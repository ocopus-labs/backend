import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { PrismaModule } from 'src/modules/prisma/prisma.module';
import { BusinessModule } from 'src/modules/business/business.module';

@Module({
  imports: [PrismaModule, BusinessModule],
  controllers: [PaymentController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
