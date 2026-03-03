import { Module, forwardRef } from '@nestjs/common';
import { TableController } from './table.controller';
import { TableService } from './table.service';
import { PrismaModule } from '../prisma/prisma.module';
import { BusinessModule } from '../business/business.module';
import { ReservationModule } from '../reservation/reservation.module';

@Module({
  imports: [PrismaModule, BusinessModule, forwardRef(() => ReservationModule)],
  controllers: [TableController],
  providers: [TableService],
  exports: [TableService],
})
export class TableModule {}
