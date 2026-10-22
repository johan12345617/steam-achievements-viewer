export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export function normalizeApiBase(input: string): string {
  let url: URL;
  try { url = new URL(input.trim()); }
  catch { throw new Error('Enter a complete API URL, such as https://your-server.example/api.'); }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('The API URL cannot include credentials, query parameters, or a fragment.');
  }
  const host = url.hostname.toLowerCase();
  const ipv4 = host.split('.').map(Number);
  const isIpv4 = /^\d+\.\d+\.\d+\.\d+$/.test(host) && ipv4.every(part => Number.isInteger(part) && part >= 0 && part <= 255);
  const local = host === 'localhost' || host === '127.0.0.1' || host === '[::1]' ||
    (isIpv4 && (ipv4[0] === 10 || (ipv4[0] === 192 && ipv4[1] === 168) ||
      (ipv4[0] === 172 && ipv4[1] >= 16 && ipv4[1] <= 31)));
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) {
    throw new Error('Use HTTPS for a hosted API. HTTP is allowed only for local network testing.');
  }
  const path = url.pathname.replace(/\/+$/, '') || '/api';
  return `${url.origin}${path}`;
}

export type ApiClient = ReturnType<typeof createApiClient>;

export function createApiClient(
  base: string,
  getToken: () => string | null = () => null,
  fetcher: typeof fetch = fetch,
  onUnauthorized?: (rejectedToken: string) => void,
) {
  const apiBase = normalizeApiBase(base);
  async function request<T>(path: string, method: string, body?: unknown): Promise<T> {
    if (!path.startsWith('/') || path.startsWith('//') || /[?#]/.test(path.split('?')[0]) || path.includes('://')) {
      throw new Error('API requests must use a relative endpoint.');
    }
    const target = new URL(`${apiBase}${path}`);
    if (target.origin !== new URL(apiBase).origin || !target.pathname.startsWith(`${new URL(apiBase).pathname}/`)) {
      throw new Error('API requests must stay on the configured server.');
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    const token = getToken();
    try {
      const response = await fetcher(target.toString(), {
        method,
        headers: {
          Accept: 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
        // Native sessions are explicit bearer credentials, never browser cookies.
        credentials: 'omit',
        redirect: 'error',
      });
      const text = await response.text();
      let data: unknown;
      try { data = text ? JSON.parse(text) : null; }
      catch {
        throw new ApiError('The server returned an unexpected response. Check the API URL in Settings.', response.status);
      }
      if (!response.ok) {
        if (response.status === 401 && token) onUnauthorized?.(token);
        const detail = data && typeof data === 'object' && 'message' in data ? (data as { message: unknown }).message : null;
        const message = typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.join('. ') : null;
        throw new ApiError(
          response.status === 404 && path.startsWith('/auth/mobile/')
            ? 'This server needs the mobile login update. Deploy the updated backend, or select your local server in Settings.'
            : message || `The server could not complete this request (${response.status}).`,
          response.status,
        );
      }
      return data as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (controller.signal.aborted) throw new Error('The server took too long to respond. It may be starting up; try again.');
      throw new Error('Cannot reach the server. Check your connection and the API URL in Settings.');
    } finally { clearTimeout(timeout); }
  }
  return {
    get: <T>(path: string) => request<T>(path, 'GET'),
    post: <T>(path: string, body?: unknown) => request<T>(path, 'POST', body),
    delete: <T>(path: string) => request<T>(path, 'DELETE'),
  };
}
