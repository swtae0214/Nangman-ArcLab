import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { ApiErrorResponse } from '@nangman/shared-types';
import type { Response } from 'express';

interface NestErrorBody {
  message?: string | string[];
}

const INTERNAL_SERVER_ERROR_STATUS: number = HttpStatus.INTERNAL_SERVER_ERROR;

/** 모든 예외를 5단계 API 명세의 공통 에러 응답 봉투({ success:false, error })로 변환한다. */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status: number = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const { code, message } = this.resolve(exception, status);

    if (status >= INTERNAL_SERVER_ERROR_STATUS) {
      this.logger.error(message, exception instanceof Error ? exception.stack : undefined);
    }

    const body: ApiErrorResponse = { success: false, data: null, error: { code, message } };
    response.status(status).json(body);
  }

  private resolve(exception: unknown, status: number): { code: string; message: string } {
    if (exception instanceof HttpException) {
      const raw = exception.getResponse();
      if (typeof raw === 'string') {
        return { code: HttpStatus[status] ?? 'ERROR', message: raw };
      }
      const body = raw as NestErrorBody;
      const message = Array.isArray(body.message) ? body.message.join(', ') : (body.message ?? exception.message);
      return { code: HttpStatus[status] ?? 'ERROR', message };
    }
    return { code: 'INTERNAL_SERVER_ERROR', message: '알 수 없는 서버 오류가 발생했습니다.' };
  }
}
