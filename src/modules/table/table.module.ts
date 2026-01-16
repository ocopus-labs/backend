import { Module } from '@nestjs/common';
import { TableController } from './table.controller';
import { TableService } from './table.service';
import { PrismaModule } from '../prisma/prisma.module';
import { BusinessModule } from '../business/business.module';

@Module({
  imports: [PrismaModule, BusinessModule],
  controllers: [TableController],
  providers: [TableService],
  exports: [TableService],
})
export class TableModule {}
