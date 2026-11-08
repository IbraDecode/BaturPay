/**
 * Modul: CLI — HTTP client
 * Powered by Ibra X 3.1 Sovereign Execution Engine
 * Author: Ibra Ramdan <ibradecode@gmail.com>
 */
export interface ApiClientOptions {
  baseUrl: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

export interface ApiErrorBody {
  error?: { code?: string; message?: string; details?: unknown };
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async request<T>(
    method: string,
    path: string,
    options: { body?: unknown; headers?: Record<string, string> } = {},
  ): Promise<T> {
    const headers: Record<string, string> = { accept: 'application/json', ...options.headers };
    if (this.apiKey) headers.authorization = `Bearer ${this.apiKey}`;
    if (options.body !== undefined) headers['content-type'] = 'application/json';

    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    const text = await response.text();
    const parsed = text.length > 0 ? (JSON.parse(text) as unknown) : null;

    if (!response.ok) {
      const errBody = parsed as ApiErrorBody | null;
      const code = errBody?.error?.code ?? `HTTP_${response.status}`;
      const message = errBody?.error?.message ?? response.statusText;
      throw new Error(`${code}: ${message}`);
    }
    return parsed as T;
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  post<T>(path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
    return this.request<T>('POST', path, { body, headers });
  }
}
