import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { emailOTP, admin, openAPI, twoFactor } from 'better-auth/plugins';
import { PrismaClient } from '@prisma/client';
import { Logger } from '@nestjs/common';
import type { MailService } from '../../modules/mail/mail.service';

const logger = new Logger('AuthConfig');
import {
  dodopayments,
  checkout,
  portal,
  webhooks,
  usage,
} from '@dodopayments/better-auth';
import DodoPayments from 'dodopayments';

// Initialize Dodo Payments client
const dodoPaymentsClient = process.env.DODO_PAYMENTS_API_KEY
  ? new DodoPayments({
      bearerToken: process.env.DODO_PAYMENTS_API_KEY,
      environment:
        process.env.NODE_ENV === 'production' ? 'live_mode' : 'test_mode',
    })
  : null;

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
      process.env.FRONTEND_URL || 'http://localhost:5173',
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
          await mailService.sendVerificationEmail(user.email, {
            userName: user.name || user.email.split('@')[0],
            verificationUrl: url,
          });
        } catch (error) {
          // Log the error but don't fail registration
          // User can request a new verification email later
          logger.error(
            `Failed to send verification email to ${user.email}: ${error instanceof Error ? error.message : error}`,
          );
        }
      },
    },

    // Send welcome email when a new user is created
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            try {
              const frontendUrl =
                process.env.FRONTEND_URL || 'http://localhost:5173';
              await mailService.sendWelcomeEmail(user.email, {
                userName: user.name || user.email.split('@')[0],
                dashboardUrl: `${frontendUrl}/dashboard`,
              });
            } catch (error) {
              logger.error(
                `Failed to send welcome email to ${user.email}: ${error instanceof Error ? error.message : error}`,
              );
            }
          },
        },
      },
    },

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
            logger.error(
              `Failed to send OTP email to ${email}: ${error instanceof Error ? error.message : error}`,
            );
          }
        },
        otpLength: 6,
        expiresIn: 300, // 5 minutes
        overrideDefaultEmailVerification: true,
      }),

      // Admin Plugin with custom roles
      admin({
        defaultRole: 'user',
        adminRoles: ['admin'],
        defaultBanReason: 'No reason provided',
        defaultBanExpiresIn: undefined, // Permanent ban by default
        bannedUserMessage:
          'Your account has been banned. Please contact support for assistance.',
        impersonationSessionDuration: 60 * 60 * 1, // 1 hour
      }),

      // Two-Factor Authentication
      twoFactor({
        issuer: 'POS Platform',
        backupCodes: {
          length: 10,
          characterSet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
        },
      }),

      // Dodo Payments Plugin (only if API key is configured)
      ...(dodoPaymentsClient
        ? [
            dodopayments({
              client: dodoPaymentsClient,
              createCustomerOnSignUp: true,
              use: [
                checkout({
                  products: [
                    // Add your product IDs and slugs here
                    // { productId: 'pdt_xxxxx', slug: 'premium-plan' },
                  ],
                  successUrl: '/dashboard/billing/success',
                  authenticatedUsersOnly: true,
                }),
                portal(),
                webhooks({
                  webhookKey: process.env.DODO_WEBHOOK_SECRET || '',
                  onPayload: async (_payload) => {
                    // Webhook processing handled by DodoWebhookController
                  },
                }),
                usage(),
              ],
            }),
          ]
        : []),
    ],

    // Advanced features
    advanced: {
      useSecureCookies: process.env.NODE_ENV === 'production',
      crossSubDomainCookies: {
        enabled: !!process.env.COOKIE_DOMAIN,
        domain: process.env.COOKIE_DOMAIN,
      },
      cookies: {
        session_token: {
          attributes: {
            sameSite: 'none' as const,
            secure: true,
          },
        },
      },
    },

    // Session configuration
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // Update every 1 day
    },

    // Account linking
    socialProviders: {
      google: {
        prompt: 'select_account',
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      },
      // Add social providers later if needed
    },
  });
};

// Export a type for the auth instance
export type AuthConfig = ReturnType<typeof createAuthConfig>;
