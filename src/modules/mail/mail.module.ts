import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { MailController } from './mail.controller';
import { MailConfigService } from './mail-config.service';

@Module({
  controllers: [MailController],
  providers: [MailService, MailConfigService],
  exports: [MailService, MailConfigService],
})
export class MailModule {}
