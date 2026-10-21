export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, details?: unknown) => new ApiError(400, 'BAD_REQUEST', message, details);
export const unauthorized = (message = 'Authentication required') => new ApiError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'Not allowed') => new ApiError(403, 'FORBIDDEN', message);
export const notFound = (what = 'Resource') => new ApiError(404, 'NOT_FOUND', `${what} not found`);
export const conflict = (message: string) => new ApiError(409, 'CONFLICT', message);
export const unprocessable = (code: string, message: string) => new ApiError(422, code, message);
export const unavailable = (message: string) => new ApiError(503, 'UNAVAILABLE', message);
