import { randomUUID } from 'node:crypto';
import type { CurrentUser } from '@nangman/shared-types';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_SCOPE = 'read:user user:email';
const DEFAULT_WEB_ORIGIN = 'http://localhost:3000';

interface GithubAccessTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GithubProfileResponse {
  id: number;
  login: string;
  email: string | null;
  avatar_url: string;
}

interface GithubEmailResponse {
  email: string;
  primary: boolean;
  verified: boolean;
}

function webOrigin(): string {
  return process.env.WEB_ORIGIN ?? DEFAULT_WEB_ORIGIN;
}

/** GitHub 쪽에 등록한 Authorization callback URL과 반드시 똑같아야 한다. */
function callbackUrl(): string {
  return `${webOrigin()}/api/backend/auth/github/callback`;
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  getAuthorizeUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID ?? '',
      redirect_uri: callbackUrl(),
      scope: GITHUB_SCOPE,
      state,
    });
    return `${GITHUB_AUTHORIZE_URL}?${params.toString()}`;
  }

  /**
   * authorization code를 GitHub 프로필로 바꾸고, 계정을 만들거나 찾는다. 반환하는 userId를
   * 세션 쿠키로 내려주면 로그인이 끝난다.
   *
   * (예전엔 여기서 "GitHub 로그인 도입 전 익명 세션의 아키텍처를 가져오기(claim)"도 같이 했었다.
   * 로그인이 필수가 된 뒤로는 모든 아키텍처가 생성 시점부터 userId를 가지고 태어나서 그 전환
   * 시나리오 자체가 다시는 안 생긴다 — 있었던 과거 데이터는 한 번 수동으로 옮겨서 끝냈고, 이제
   * 이 메서드는 다시 단순해졌다.)
   */
  async completeLogin(code: string): Promise<{ userId: string }> {
    const accessToken = await this.exchangeCodeForAccessToken(code);
    const profile = await this.fetchGithubProfile(accessToken);
    const email = profile.email ?? (await this.fetchPrimaryEmail(accessToken));

    const user = await this.prisma.user.upsert({
      where: { githubId: String(profile.id) },
      create: {
        githubId: String(profile.id),
        username: profile.login,
        email,
        avatarUrl: profile.avatar_url,
      },
      update: {
        username: profile.login,
        email,
        avatarUrl: profile.avatar_url,
      },
    });

    return { userId: user.id };
  }

  async getCurrentUser(userId: string): Promise<CurrentUser | null> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;
    return { id: user.id, username: user.username, email: user.email, avatarUrl: user.avatarUrl };
  }

  generateState(): string {
    return randomUUID();
  }

  private async exchangeCodeForAccessToken(code: string): Promise<string> {
    const response = await fetch(GITHUB_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: callbackUrl(),
      }),
    });
    const body = (await response.json()) as GithubAccessTokenResponse;
    if (!body.access_token) {
      throw new InternalServerErrorException(body.error_description ?? 'GitHub 토큰 교환에 실패했습니다.');
    }
    return body.access_token;
  }

  private async fetchGithubProfile(accessToken: string): Promise<GithubProfileResponse> {
    const response = await fetch(`${GITHUB_API_BASE}/user`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github+json' },
    });
    if (!response.ok) {
      throw new InternalServerErrorException('GitHub 프로필 조회에 실패했습니다.');
    }
    return (await response.json()) as GithubProfileResponse;
  }

  /** 프로필의 email이 null이면(공개 이메일 비공개 설정) user:email 스코프로 이메일 목록에서 primary를 찾는다. */
  private async fetchPrimaryEmail(accessToken: string): Promise<string | null> {
    const response = await fetch(`${GITHUB_API_BASE}/user/emails`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github+json' },
    });
    if (!response.ok) return null;
    const emails = (await response.json()) as GithubEmailResponse[];
    return emails.find((entry) => entry.primary && entry.verified)?.email ?? emails[0]?.email ?? null;
  }
}
