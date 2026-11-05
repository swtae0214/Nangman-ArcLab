import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestWithUserId } from '../guards/auth.guard.js';

/** AuthGuard가 request에 실어둔 userId를 컨트롤러 파라미터로 꺼낸다. */
export const CurrentUserId = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<RequestWithUserId>();
  return request.userId;
});
