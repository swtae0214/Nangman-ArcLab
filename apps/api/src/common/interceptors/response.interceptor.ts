import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { ApiSuccessResponse } from '@nangman/shared-types';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/** 5단계 API 명세의 공통 성공 응답 봉투({ success, data, error })로 컨트롤러 반환값을 감싼다. */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiSuccessResponse<T>> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<ApiSuccessResponse<T>> {
    return next.handle().pipe(
      map((data) => ({
        success: true as const,
        data,
        error: null,
      })),
    );
  }
}
