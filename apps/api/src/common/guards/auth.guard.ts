import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

export const SESSION_COOKIE = 'archlab_session';

export interface RequestWithUserId extends Request {
  signedCookies: Record<string, string | false>;
  userId: string;
}

/**
 * GitHub 로그인 후 발급한 서명된 세션 쿠키(archlab_session)를 검사한다. main.ts에서
 * cookieParser(COOKIE_SECRET)로 서명을 걸어뒀기 때문에, 위조되거나 서명이 안 맞는 쿠키는
 * req.signedCookies에 아예 안 실린다 — 여기서는 그 값이 있는지만 보면 된다.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUserId>();
    const userId = request.signedCookies[SESSION_COOKIE];
    if (!userId) {
      throw new UnauthorizedException('로그인이 필요합니다.');
    }
    request.userId = userId;
    return true;
  }
}
