import { ValidationPipe, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // structured JSON-логи в проде собираются драйвером Docker / Loki
    logger: ['log', 'warn', 'error'],
    rawBody: true, // нужен для проверки подписи платёжных webhook-ов
    bodyParser: true,
  });

  app.use(helmet());
  app.use(cookieParser());

  // CORS только для разрешённых доменов
  const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  app.setGlobalPrefix('api', { exclude: ['health', 'health/live', 'health/ready'] });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // отбрасываем неизвестные поля
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  // Graceful shutdown: дорабатываем in-flight запросы, закрываем пулы
  app.enableShutdownHooks();

  const port = Number(process.env.PORT) || 4000;
  await app.listen(port, '0.0.0.0');
  Logger.log(`outpills API запущен на :${port}`, 'Bootstrap');
}

bootstrap();
