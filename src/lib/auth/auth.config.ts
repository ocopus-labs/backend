import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { emailOTP } from 'better-auth/plugins';
import { admin } from 'better-auth/plugins';
import { PrismaClient } from '@prisma/client';
import { openAPI } from "better-auth/plugins"
import type { MailService } from '../../modules/mail/mail.service';

const prisma = new PrismaClient();

// Export mail service instance for use in auth callbacks
let mailService: MailService;

export function setMailService(service: MailService) {
  mailService = service;
}

export const auth = betterAuth({
  baseURL: process.env.AUTH_BASE_URL || 'http://localhost:3000',
  basePath: '/api/auth',
  secret: process.env.BETTER_AUTH_SECRET || 'your-secret-key-change-in-production',
  
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    requireEmailVerification: true,
  },

  emailVerification: {
    sendVerificationEmail: async ({ user, url }, request) => {
      if (mailService) {
        await mailService.sendVerificationEmail(user.email, url);
      }
    },
  },

  // Enable hooks support for NestJS integration
  hooks: {},

  plugins: [
    openAPI(), 
    // Email OTP Plugin
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        if (mailService) {
          const subject =
            type === 'sign-in'
              ? 'Your Sign-In OTP'
              : type === 'email-verification'
                ? 'Verify Your Email'
                : 'Password Reset OTP';

          const html = `
            <h2>${subject}</h2>
            <p>Your OTP is: <strong>${otp}</strong></p>
            <p>This OTP will expire in 5 minutes.</p>
          `;

          await mailService.send({
            to: email,
            subject,
            html,
            text: `Your OTP is: ${otp}`,
          });
        }
      },
      otpLength: 6,
      expiresIn: 300, // 5 minutes
      overrideDefaultEmailVerification: false,
    }),

    // Admin Plugin with custom roles
    admin({
      defaultRole: 'staff',
      adminRoles: ['super_admin', 'franchise_admin'],
      defaultBanReason: 'No reason provided',
      defaultBanExpiresIn: undefined, // Permanent ban by default
      bannedUserMessage:
        'Your account has been banned. Please contact support for assistance.',
      impersonationSessionDuration: 60 * 60 * 1, // 1 hour
    }),
  ],

  // Advanced features
  advanced: {
    useSecureCookies: process.env.NODE_ENV === 'production',
  },

  // Session configuration
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update every 1 day
  },

  // Account linking
  socialProviders: {
    // Add social providers later if needed
  },
});
