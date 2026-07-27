import axios from 'axios';

let installed = false;

/**
 * One-time global axios interceptor that honors rate-limit backoff. On a 429 it waits for
 * the server-provided delay (Telegram's `parameters.retry_after`, or the `Retry-After`
 * header) and retries the request ONCE. Previously a Telegram 429 fell straight through to
 * a failed post and the next-minute cron retried with no backoff, deepening the flood limit.
 */
export function installRetryAfterInterceptor(): void {
  if (installed) return;
  installed = true;
  axios.interceptors.response.use(undefined, async (error: any) => {
    const cfg = error?.config;
    const status = error?.response?.status;
    if (!cfg || status !== 429 || cfg.__retried429) return Promise.reject(error);

    const retryAfter = Number(
      error?.response?.data?.parameters?.retry_after ??
      error?.response?.headers?.['retry-after'],
    );
    // Cap the wait so a hostile/huge value can't hang a request for minutes.
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 60) * 1000 : 1000;
    cfg.__retried429 = true;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    return axios(cfg);
  });
}
