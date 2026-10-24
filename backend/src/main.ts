import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { rejectEncodedBodies } from './reject-encoded-bodies';
import * as helmet from 'helmet';
import { join } from 'path';
import * as fs from 'fs';

async function bootstrap() {
  // Create required directories BEFORE NestFactory (TypeORM opens the DB file on module init)
  const uploadsDir = join(process.cwd(), 'uploads');
  const dataDir = join(process.cwd(), 'data');
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });

  const isDev = process.env.NODE_ENV !== 'production';
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: isDev
      ? ['error', 'warn', 'log', 'debug', 'verbose']
      : ['error', 'warn'],
  });

  // Security
  // Nest registers its body parsers when the app initializes, so this runs before them.
  app.use(rejectEncodedBodies);
  app.use((helmet as any).default ? (helmet as any).default() : (helmet as any)());

  // CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:4200',
    credentials: true,
  });

  // Serve uploaded files as static assets
  app.useStaticAssets(uploadsDir, { prefix: '/uploads' });

  // Global API prefix
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Steam Achievements backend running on http://localhost:${port}/api`);
}

bootstrap();
