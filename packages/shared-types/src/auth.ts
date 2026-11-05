/** GitHub 로그인으로 생성/연결된 계정. apps/web이 /auth/me로 받는 "지금 로그인한 사람" 모양. */
export interface CurrentUser {
  id: string;
  username: string;
  email: string | null;
  avatarUrl: string | null;
}
