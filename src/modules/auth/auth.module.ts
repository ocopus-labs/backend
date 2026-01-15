import { Module } from '@nestjs/common';
import { AuthModule as NestJSBetterAuthModule } from '@thallesp/nestjs-better-auth';
import { createAuthConfig } from '../../lib/auth/auth.config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { MailModule } from '../mail/mail.module';
import { MailService } from '../mail/mail.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [
    PrismaModule,
    MailModule,
    NestJSBetterAuthModule.forRootAsync({
      imports: [PrismaModule, MailModule],
      useFactory: (prisma: PrismaService, mailService: MailService) => ({
        auth: createAuthConfig(prisma, mailService),
      }),
      inject: [PrismaService, MailService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule { }
