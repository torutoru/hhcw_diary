export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export const badRequest = (msg: string) => new HttpError(400, msg);
export const unauthorized = (msg = '로그인이 필요해요.') => new HttpError(401, msg);
export const forbidden = (msg = '권한이 없어요.') => new HttpError(403, msg);
export const notFound = (msg = '찾을 수 없어요.') => new HttpError(404, msg);
export const conflict = (msg: string) => new HttpError(409, msg);
