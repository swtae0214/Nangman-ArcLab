import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { ResponseInterceptor } from './common/interceptors/response.interceptor.js';

const DEFAULT_API_PORT = 4000;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  // 로그인 세션 쿠키(archlab_session)를 서명해서, 클라이언트가 임의의 user id 값으로
  // 쿠키를 조작해 다른 계정인 척 할 수 없게 한다 (req.signedCookies에서 서명 검증까지 끝난 값만 나온다).
  app.use(cookieParser(process.env.COOKIE_SECRET));
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  });

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  const port = Number(process.env.API_PORT ?? DEFAULT_API_PORT);
  await app.listen(port);
}
await bootstrap();
