/** 5단계 API 명세의 공통 응답 봉투(envelope) 타입 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  error: null;
}

export interface ApiErrorResponse {
  success: false;
  data: null;
  error: {
    code: string;
    message: string;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
