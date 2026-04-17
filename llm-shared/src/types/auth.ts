export interface User {
  id: string;
  username: string;
}

export interface JWTPayload {
  sub: string;
  username: string;
  iat: number;
  exp: number;
}
