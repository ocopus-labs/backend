import { All, Controller, Req, Res, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { auth } from './auth';
import { toNodeHandler } from 'better-auth/node';
import { EmailService } from '../email/email.service';

@Controller('api/auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly emailService: EmailService) {}

  @All('*')
  async handleAuth(@Req() req: Request, @Res() res: Response) {
    const handler = toNodeHandler(auth);

    // capture response body by wrapping res.write/res.end
    const chunks: Buffer[] = [];
    const originalWrite = res.write.bind(res);
    const originalEnd = res.end.bind(res);

    // override write to capture
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (res as any).write = (chunk: any, ...args: any[]) => {
      try {
        if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      } catch (e) {
        // ignore
      }
      return originalWrite(chunk, ...args);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await new Promise<void>((resolve) => {
      (res as any).end = (chunk: any, ...args: any[]) => {
        try {
          if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        } catch (e) {
          // ignore
        }
        // restore original fns
        (res as any).write = originalWrite;
        (res as any).end = originalEnd;
        const result = originalEnd(chunk, ...args);
        resolve();
        return result;
      };

      try {
        handler(req, res);
      } catch (e) {
        // if handler throws synchronously, resolve so we don't hang
        resolve();
      }
    });

    // build captured body
    let bodyText = '';
    try {
      bodyText = Buffer.concat(chunks).toString('utf8');
    } catch (e) {
      // ignore
    }

    // Log request and response for diagnosis
    this.logger.log(`🔍 Auth request: ${req.method} ${req.url}`);
    this.logger.log(`📦 Captured response: ${bodyText.substring(0, 500)}...`);

    // try to parse JSON and react to events like signup or password reset
    try {
      if (!bodyText) {
        this.logger.warn('⚠️ No response body captured');
        return;
      }
      
      const parsed = JSON.parse(bodyText);
      this.logger.log(`✅ Parsed response: ${JSON.stringify(parsed).substring(0, 200)}`);

      // --- Detect user creation (signup) ---
      const user = parsed?.user ?? parsed?.data?.user ?? parsed?.data ?? parsed;
      const maybeEmail = user?.email || parsed?.email;
      const maybeName = user?.name || user?.displayName || user?.fullName || user?.firstName || user?.lastName;

      this.logger.log(`👤 Extracted - email: ${maybeEmail}, name: ${maybeName}`);
      this.logger.log(`🔎 URL check - contains sign-up/signup/register? ${/sign-up|signup|register|create/i.test(req.url || '')}`);

      if (req.method === 'POST' && /sign-up|signup|register|create/i.test(req.url || '') && maybeEmail) {
        this.logger.log(`✉️ 📧 SENDING WELCOME EMAIL to ${maybeEmail}`);
        this.emailService.sendWelcomeEmail(maybeEmail, maybeName || maybeEmail)
          .then((success) => {
            this.logger.log(`✅ Welcome email sent successfully: ${success}`);
          })
          .catch((err) => {
            this.logger.error(`❌ Failed to send welcome email: ${err?.message ?? err}`);
          });
      } else {
        this.logger.log(`⏭️ Skipping email - method: ${req.method}, url: ${req.url}, email: ${maybeEmail}`);
      }

      // --- Detect password reset token ---
      const resetToken = parsed?.resetToken ?? parsed?.data?.resetToken ?? parsed?.token;
      this.logger.log(`🔑 Reset token check - token: ${resetToken ? 'found' : 'not found'}, email: ${maybeEmail}`);
      
      if (req.method === 'POST' && /forgot|reset|password/i.test(req.url || '') && maybeEmail && resetToken) {
        this.logger.log(`✉️ 📧 SENDING PASSWORD RESET EMAIL to ${maybeEmail}`);
        this.emailService.sendPasswordResetEmail(maybeEmail, resetToken, maybeName || maybeEmail)
          .then((success) => {
            this.logger.log(`✅ Password reset email sent successfully: ${success}`);
          })
          .catch((err) => {
            this.logger.error(`❌ Failed to send reset email: ${err?.message ?? err}`);
          });
      }
    } catch (e) {
      this.logger.error(`❌ Error parsing auth response: ${e?.message ?? e}`);
    }
  }
}
