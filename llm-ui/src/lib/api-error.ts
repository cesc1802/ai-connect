// Typed transport error thrown by the HTTP client on any non-2xx response.
// Mirrors the backend error envelope `{ code, message, issues? }`
// (see llm-http/api_docs.md). React/UI layers narrow on `instanceof ApiError`
// to render banners and branch on `status` / `code`.

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly issues?: unknown[],
  ) {
    super(message);
    this.name = "ApiError";
  }
}
