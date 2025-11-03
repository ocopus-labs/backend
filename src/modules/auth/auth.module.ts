import { Module, OnModuleInit } from '@nestjs/common';
import { AuthModule as NestJSBetterAuthModule } from '@thallesp/nestjs-better-auth';
import { auth, setMailService } from '../../lib/auth/auth.config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { MailModule } from '../mail/mail.module';
import { MailService } from '../mail/mail.service';

@Module({
  imports: [
    NestJSBetterAuthModule.forRoot({
      auth,
      // Global AuthGuard is enabled by default
      // All routes are protected unless marked with @AllowAnonymous() or @OptionalAuth()
      disableGlobalAuthGuard: false,
      // Optionally disable automatic CORS for trusted origins
      // disableTrustedOriginsCors: false,
      // Optionally disable automatic body parser
      // disableBodyParser: false,
    }),
    MailModule,
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule implements OnModuleInit {
  constructor(private mailService: MailService) {}

  onModuleInit() {
    // Inject mail service into auth configuration
    setMailService(this.mailService);
  }
}
