import { Module, forwardRef } from '@nestjs/common';
import { BusinessController } from './business.controller';
import { BusinessService } from './business.service';
import { PrismaModule } from '../prisma/prisma.module';
import { UploadModule } from 'src/lib/common/upload';
import { SubscriptionModule } from '../subscription/subscription.module';

@Module({
  imports: [PrismaModule, UploadModule, forwardRef(() => SubscriptionModule)],
  controllers: [BusinessController],
  providers: [BusinessService],
  exports: [BusinessService],
})
export class BusinessModule {}
