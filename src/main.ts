import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import dotenv from 'dotenv';
import * as bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import compression from 'compression';

dotenv.config();

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  // Disable body parser for Better Auth
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });

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

  // Parse cookies for impersonation and other cookie-based features
  app.use(cookieParser());

  // Gzip/deflate compression for all responses
  app.use(compression({
    threshold: 1024, // Only compress responses > 1KB
  }));

  // Set global API prefix (exclude Better Auth routes and webhook routes)
  app.setGlobalPrefix('api', {
    exclude: ['webhook/dodo'],
  });

  // Enable CORS for frontend
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`Server is running on port ${port}`);
}
bootstrap();
