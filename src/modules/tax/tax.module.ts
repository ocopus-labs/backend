import { Module } from '@nestjs/common';
import { TaxController } from './tax.controller';
import { TaxService } from './tax.service';
import { TaxExportService } from './tax-export.service';
import { PrismaModule } from 'src/modules/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TaxController],
  providers: [TaxService, TaxExportService],
  exports: [TaxService, TaxExportService],
})
export class TaxModule {}
