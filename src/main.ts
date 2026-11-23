import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger, BadRequestException, INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { Express } from 'express';

export function configureApp(app: INestApplication) {
  // Enable CORS for frontend communication
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      process.env.FRONTEND_URL || '',
    ].filter(Boolean),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // Global exception filter for unified error format
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global response interceptor for unified success format
  app.useGlobalInterceptors(new ResponseTransformInterceptor());

  // Global DTO validation pipe with formatted nested error extraction
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: (errors) => {
        const formatErrors = (errs: any[]): string[] => {
          const messages: string[] = [];
          for (const err of errs) {
            if (err.constraints) {
              messages.push(...(Object.values(err.constraints) as string[]));
            }
            if (err.children && err.children.length > 0) {
              messages.push(...formatErrors(err.children));
            }
          }
          return messages;
        };
        const errorMessages = formatErrors(errors);
        return new BadRequestException({
          message: errorMessages,
          error: 'Validation failed',
        });
      },
    }),
  );

  // Swagger OpenAPI Documentation
  const config = new DocumentBuilder()
    .setTitle('JoraIQ.AI API')
    .setDescription(
      'REST API Documentation for JoraIQ.AI Quiz-Based Learning & Analytics Platform',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
}

// Local standalone server bootstrap (runs on npm run start:dev / start:prod)
async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  configureApp(app);

  const port = process.env.PORT || 4000;
  await app.listen(port);
  logger.log(`Server is running on: http://localhost:${port}`);
}

// Only listen on port if NOT running in Vercel serverless environment
if (!process.env.VERCEL) {
  bootstrap();
}

// Serverless handler for Vercel
let cachedServer: Express;
export default async function handler(req: any, res: any) {
  if (!cachedServer) {
    const server = express();
    const app = await NestFactory.create(AppModule, new ExpressAdapter(server));
    configureApp(app);
    await app.init();
    cachedServer = server;
  }
  return cachedServer(req, res);
}
