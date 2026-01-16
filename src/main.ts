import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import dotenv from 'dotenv';
import * as bodyParser from 'body-parser';

dotenv.config();

async function bootstrap() {
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

  // Set global API prefix (exclude Better Auth routes and webhook routes)
  app.setGlobalPrefix('api', {
    exclude: ['webhook/dodo'],
  });

  // Enable CORS for frontend
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  });

  await app
    .listen(process.env.PORT ?? 3000)
    .then(() =>
      console.log(`Server is running on port ${process.env.PORT ?? 3000}`),
    )
    .catch((err) => {
      console.error('Error starting server:', err);
    });
}
bootstrap();
