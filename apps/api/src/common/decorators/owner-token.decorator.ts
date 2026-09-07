import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestWithOwnerToken } from '../guards/anonymous-session.guard.js';

/** AnonymousSessionGuard가 request에 실어둔 ownerToken을 컨트롤러 파라미터로 꺼낸다. */
export const OwnerToken = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<RequestWithOwnerToken>();
  return request.ownerToken;
});
