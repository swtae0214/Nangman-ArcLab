import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

export const OWNER_TOKEN_COOKIE = 'owner_token';
const OWNER_TOKEN_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 365;

export interface RequestWithOwnerToken extends Request {
  cookies: Record<string, string>;
  ownerToken: string;
}

/**
 * 4/5단계 설계의 "익명 세션" 인증. owner_token 쿠키가 없으면 새로 발급해 httpOnly
 * 쿠키로 내려주고, 있으면 그대로 request.ownerToken 에 실어 컨트롤러/서비스가 쓰게 한다.
 * 로그인 없이도 "내가 만든 아키텍처"를 구분할 수 있게 하는 최소한의 장치.
 */
@Injectable()
export class AnonymousSessionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithOwnerToken>();
    const response = context.switchToHttp().getResponse<Response>();

    const existingToken = request.cookies?.[OWNER_TOKEN_COOKIE];
    const ownerToken = existingToken ?? randomUUID();

    if (!existingToken) {
      response.cookie(OWNER_TOKEN_COOKIE, ownerToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: OWNER_TOKEN_MAX_AGE_MS,
      });
    }

    request.ownerToken = ownerToken;
    return true;
  }
}
