import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import dotenv from 'dotenv';
import * as bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { toNodeHandler } from 'better-auth/node';
import { AuthService as BetterAuthService } from '@thallesp/nestjs-better-auth';

dotenv.config();

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  // Disable body parser for Better Auth
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });

  // Mount Better Auth handler directly at Express level
  // NestJS middleware forRoutes('/api/auth') doesn't match sub-paths in path-to-regexp v8+
  const betterAuthService = app.get(BetterAuthService);
  const authHandler = toNodeHandler(betterAuthService.instance as any);
  app.use('/api/auth', authHandler);

  // Apply raw body capture for webhook routes BEFORE any other middleware
  // This must be done first to capture the raw body for signature verification
  app.use(
    '/webhook/dodo',
    bodyParser.json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf.toString('utf8');
      },
    }),
  );

  // Apply JSON body parser for MCP endpoint
  app.use('/api/mcp', bodyParser.json());

  // General JSON body parser for all other API routes (5MB limit for base64 image uploads)
  app.use('/api', bodyParser.json({ limit: '5mb' }));
  app.use('/api', bodyParser.urlencoded({ extended: true, limit: '5mb' }));

  // Parse cookies for impersonation and other cookie-based features
  app.use(cookieParser());

  // Gzip/deflate compression for all responses
  app.use(
    compression({
      threshold: 1024, // Only compress responses > 1KB
    }),
  );

  // Set global API prefix (exclude Better Auth routes and webhook routes)
  app.setGlobalPrefix('api', {
    exclude: ['webhook/dodo'],
  });

  // Enable CORS for frontend
  app.enableCors({
    origin: (process.env.FRONTEND_URL || 'http://localhost:5173').split(','),
    credentials: true,
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`Server is running on port ${port}`);
}
bootstrap();
