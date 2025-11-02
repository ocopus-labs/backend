import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import dotenv from 'dotenv';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
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
