import type { CurrentUser } from '@nangman/shared-types';
import { Controller, Get, Logger, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentUserId } from '../../common/decorators/current-user.decorator.js';
import { AuthGuard, SESSION_COOKIE } from '../../common/guards/auth.guard.js';
import { AuthService } from './auth.service.js';

const OAUTH_STATE_COOKIE = 'oauth_state';
const OAUTH_STATE_MAX_AGE_MS = 5 * 60 * 1000;
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 365;
const DEFAULT_WEB_ORIGIN = 'http://localhost:3000';

interface RequestWithCookies extends Request {
  cookies: Record<string, string>;
}

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * 로그인 쿠키에 Secure 속성(HTTPS에서만 저장/전송)을 붙일지 결정한다. 기본은 운영 환경이면
 * 무조건 켜지는 안전한 값이지만, 와이어가드처럼 이미 암호화된 사설망 안에서만 돌리는 내부
 * 테스트 배포에서는 HTTPS 없이도 로그인이 되게 COOKIE_SECURE=false로 명시적으로 끌 수 있다.
 * (일반 공개 인터넷에 이 값을 false로 두면 안 된다 — 그때는 COOKIE_SECURE를 아예 안 쓰거나
 * true로 둬서 HTTPS를 강제해야 한다.)
 */
function isSecureCookie(): boolean {
  // docker-compose는 .env에 값이 없어도 COOKIE_SECURE=""(빈 문자열)로 넘기기 때문에,
  // "설정 안 함"을 undefined가 아니라 true/false가 아닌 모든 값으로 판단해야 안전한
  // 기본값(isProduction())으로 제대로 떨어진다.
  if (process.env.COOKIE_SECURE === 'true') return true;
  if (process.env.COOKIE_SECURE === 'false') return false;
  return isProduction();
}

function webOrigin(): string {
  return process.env.WEB_ORIGIN ?? DEFAULT_WEB_ORIGIN;
}

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Get('github/login')
  login(@Res() res: Response): void {
    const state = this.authService.generateState();
    res.cookie(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isSecureCookie(),
      maxAge: OAUTH_STATE_MAX_AGE_MS,
    });
    res.redirect(this.authService.getAuthorizeUrl(state));
  }

  @Get('github/callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') githubError: string | undefined,
    @Req() req: RequestWithCookies,
    @Res() res: Response,
  ): Promise<void> {
    const expectedState = req.cookies?.[OAUTH_STATE_COOKIE];
    res.clearCookie(OAUTH_STATE_COOKIE);

    // GitHub 인증 화면에서 "Cancel"을 누르면 code 없이 error=access_denied로 돌아온다 —
    // 이건 위조 시도가 아니라 사용자의 정상적인 선택이라, 아래 state 불일치와는 다른 메시지를 보여준다.
    if (githubError) {
      res.redirect(`${webOrigin()}/?auth_error=access_denied`);
      return;
    }

    if (!code || !state || !expectedState || state !== expectedState) {
      res.redirect(`${webOrigin()}/?auth_error=invalid_state`);
      return;
    }

    try {
      const { userId } = await this.authService.completeLogin(code);
      res.cookie(SESSION_COOKIE, userId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: isSecureCookie(),
        signed: true,
        maxAge: SESSION_MAX_AGE_MS,
      });
      res.redirect(`${webOrigin()}/architectures`);
    } catch (error) {
      this.logger.error('GitHub 로그인 콜백 처리 실패', error instanceof Error ? error.stack : error);
      res.redirect(`${webOrigin()}/?auth_error=login_failed`);
    }
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUserId() userId: string): Promise<CurrentUser | null> {
    return this.authService.getCurrentUser(userId);
  }

  @Post('logout')
  logout(@Res() res: Response): void {
    res.clearCookie(SESSION_COOKIE);
    res.status(204).send();
  }
}
