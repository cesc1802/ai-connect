export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export class NetworkError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class ParseError extends Error {
  constructor(message: string, readonly issues?: unknown) {
    super(message);
    this.name = 'ParseError';
  }
}

export class AuthError extends ApiError {
  constructor(message = 'Unauthorized', body?: unknown) {
    super(401, message, body);
    this.name = 'AuthError';
  }
}
