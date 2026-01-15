import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { emailOTP, admin, openAPI } from 'better-auth/plugins';
import { PrismaClient } from '@prisma/client';
import type { MailService } from '../../modules/mail/mail.service';

export const createAuthConfig = (
  prisma: PrismaClient,
  mailService: MailService,
) => {
  if (!process.env.BETTER_AUTH_SECRET) {
    throw new Error('BETTER_AUTH_SECRET environment variable is not set');
  }

  return betterAuth({
    baseURL: process.env.AUTH_BASE_URL || 'http://localhost:3000',
    basePath: '/api/auth',
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: [
      process.env.AUTH_BASE_URL || 'http://localhost:3000',
      'http://localhost:5173',
    ],

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
      sendVerificationEmail: async ({ user, url }) => {
        try {
          await mailService.sendVerificationEmail(user.email, url);
        } catch (error) {
          // Log the error but don't fail registration
          // User can request a new verification email later
          console.error(
            `Failed to send verification email to ${user.email}:`,
            error instanceof Error ? error.message : error,
          );
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

          try {
            await mailService.send({
              to: email,
              subject,
              html,
              text: `Your OTP is: ${otp}`,
            });
          } catch (error) {
            // Log the error but don't fail the OTP request
            console.error(
              `Failed to send OTP email to ${email}:`,
              error instanceof Error ? error.message : error,
            );
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
};

// Export a type for the auth instance
export type AuthConfig = ReturnType<typeof createAuthConfig>;
