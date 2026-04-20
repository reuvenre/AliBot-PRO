import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import type {
  User,
  AuthResponse,
  CredentialSet,
  CredentialSetInput,
  Campaign,
  CampaignInput,
  AliProduct,
  AliCategory,
  Post,
  PostPreview,
  PostTemplate,
  EarningsSummary,
  Earning,
  Channel,
  CreateChannelInput,
  UpdateChannelInput,
  PaginatedResponse,
  ApiError,
} from '@/types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ─── Axios instance ──────────────────────────────────────────────────────────

const http: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // sends HttpOnly refresh-token cookie automatically
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
});

// ─── Access-token management (in-memory, never localStorage) ─────────────────

let accessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

// ─── Request interceptor: inject Bearer token ────────────────────────────────

http.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// ─── Response interceptor: silent token refresh on 401 ──────────────────────

let refreshing = false;
let queue: Array<{ resolve: (t: string) => void; reject: (e: unknown) => void }> = [];

http.interceptors.response.use(
  (res) => res,
  async (err: AxiosError<ApiError>) => {
    const original = err.config as AxiosRequestConfig & { _retry?: boolean };

    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;

      if (refreshing) {
        return new Promise((resolve, reject) => {
          queue.push({ resolve, reject });
        }).then((token) => {
          original.headers = { ...original.headers, Authorization: `Bearer ${token}` };
          return http(original);
        });
      }

      refreshing = true;
      try {
        const { data } = await axios.post<AuthResponse>(
          `${BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        );
        accessToken = data.access_token;
        queue.forEach((q) => q.resolve(accessToken!));
        queue = [];
        original.headers = { ...original.headers, Authorization: `Bearer ${accessToken}` };
        return http(original);
      } catch (refreshErr) {
        queue.forEach((q) => q.reject(refreshErr));
        queue = [];
        accessToken = null;
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshErr);
      } finally {
        refreshing = false;
      }
    }

    return Promise.reject(err);
  }
);

// ─── Helper ───────────────────────────────────────────────────────────────────

const extract = <T>(res: { data: T }) => res.data;

// ─── Auth API ────────────────────────────────────────────────────────────────

export const authApi = {
  login: (email: string, password: string) =>
    http.post<AuthResponse>('/auth/login', { email, password }).then(extract),

  register: (email: string, password: string) =>
    http.post<AuthResponse>('/auth/register', { email, password }).then(extract),

  logout: () => http.post('/auth/logout').then(extract),

  me: () => http.get<User>('/auth/me').then(extract),

  refresh: () => http.post<AuthResponse>('/auth/refresh').then(extract),

  forgotPassword: (email: string) =>
    http.post<{ message: string; reset_url?: string }>('/auth/forgot-password', { email }).then(extract),

  resetPassword: (token: string, password: string) =>
    http.post<{ message: string }>('/auth/reset-password', { token, password }).then(extract),

  changePassword: (currentPassword: string, newPassword: string) =>
    http.post<{ message: string }>('/auth/change-password', { currentPassword, newPassword }).then(extract),
};

// ─── Credentials API ─────────────────────────────────────────────────────────

export const credentialsApi = {
  get: () => http.get<CredentialSet>('/credentials').then(extract),

  upsert: (data: CredentialSetInput) =>
    http.put<CredentialSet>('/credentials', data).then(extract),

  verify: () => http.post<{ aliexpress: boolean; telegram: boolean; openai: boolean }>('/credentials/verify').then(extract),
};

// ─── Campaigns API ───────────────────────────────────────────────────────────

export const campaignsApi = {
  list: (params?: { page?: number; limit?: number; status?: string }) =>
    http.get<PaginatedResponse<Campaign>>('/campaigns', { params }).then(extract),

  get: (id: string) => http.get<Campaign>(`/campaigns/${id}`).then(extract),

  create: (data: CampaignInput) =>
    http.post<Campaign>('/campaigns', data).then(extract),

  update: (id: string, data: Partial<CampaignInput>) =>
    http.patch<Campaign>(`/campaigns/${id}`, data).then(extract),

  delete: (id: string) => http.delete(`/campaigns/${id}`).then(extract),

  pause: (id: string) => http.post<Campaign>(`/campaigns/${id}/pause`).then(extract),

  resume: (id: string) => http.post<Campaign>(`/campaigns/${id}/resume`).then(extract),

  runNow: (id: string) => http.post<{ queued: boolean; jobId: string }>(`/campaigns/${id}/run`).then(extract),

  posts: (id: string, params?: { page?: number; limit?: number }) =>
    http.get<PaginatedResponse<Post>>(`/campaigns/${id}/posts`, { params }).then(extract),
};

// ─── Products API ─────────────────────────────────────────────────────────────

export const productsApi = {
  search: (params: {
    keyword: string;
    category_id?: string;
    min_price?: number;
    max_price?: number;
    min_discount?: number;
    sort?: string;
    page?: number;
    limit?: number;
  }) => http.get<PaginatedResponse<AliProduct>>('/products/search', { params }).then(extract),

  featured: (params?: {
    category_id?: string;
    sort?: 'best_selling' | 'most_discounted';
    page?: number;
    limit?: number;
  }) => http.get<PaginatedResponse<AliProduct>>('/products/featured', { params }).then(extract),

  promotional: (params?: {
    category_id?: string;
    page?: number;
    limit?: number;
  }) => http.get<PaginatedResponse<AliProduct>>('/products/promotional', { params }).then(extract),

  refreshPrice: (productId: string) =>
    http.get<AliProduct | null>(`/products/${productId}/refresh-price`).then(extract),

  categories: () => http.get<AliCategory[]>('/products/categories').then(extract),

  affiliateLink: (product_id: string) =>
    http.post<{ url: string }>('/products/affiliate-link', { product_id }).then(extract),
};

// ─── Posts API ───────────────────────────────────────────────────────────────

export const postsApi = {
  preview: (product_id: string, language?: string, custom_product?: Partial<AliProduct>, template?: string) =>
    http.post<PostPreview>('/posts/preview', { product_id, language, custom_product, template }).then(extract),

  quickPost: (data: { product_id: string; text?: string; channel_override?: string; product_image?: string; affiliate_url?: string }) =>
    http.post<Post>('/posts/quick', data).then(extract),

  list: (params?: { page?: number; limit?: number; status?: string; campaign_id?: string }) =>
    http.get<PaginatedResponse<Post>>('/posts', { params }).then(extract),

  retry: (id: string) => http.post<Post>(`/posts/${id}/retry`).then(extract),

  schedulePost: (data: { product_id: string; scheduled_at: string; text?: string; channel_override?: string; product_image?: string; affiliate_url?: string }) =>
    http.post<Post>('/posts/schedule', data).then(extract),
};

// ─── Earnings API ────────────────────────────────────────────────────────────

export const earningsApi = {
  summary: (params?: { period?: '7d' | '30d' | '90d' | 'all' }) =>
    http.get<EarningsSummary>('/earnings/summary', { params }).then(extract),

  list: (params?: { page?: number; limit?: number; status?: string }) =>
    http.get<PaginatedResponse<Earning>>('/earnings', { params }).then(extract),

  sync: () => http.post<{ synced: number }>('/earnings/sync').then(extract),
};

// ─── Channels API ────────────────────────────────────────────────────────────

export const channelsApi = {
  list: () => http.get<Channel[]>('/channels').then(extract),

  create: (data: CreateChannelInput) =>
    http.post<Channel>('/channels', data).then(extract),

  update: (id: string, data: UpdateChannelInput) =>
    http.patch<Channel>(`/channels/${id}`, data).then(extract),

  delete: (id: string) => http.delete(`/channels/${id}`).then(extract),

  test: (id: string) =>
    http.post<{ ok: boolean; error?: string }>(`/channels/${id}/test`).then(extract),
};

// ─── Templates API ──────────────────────────────────────────────────────────

export const templatesApi = {
  list: () => http.get<PostTemplate[]>('/templates').then(extract),

  create: (data: { name: string; content: string; icon?: string }) =>
    http.post<PostTemplate>('/templates', data).then(extract),

  update: (id: string, data: { name?: string; content?: string; icon?: string }) =>
    http.patch<PostTemplate>(`/templates/${id}`, data).then(extract),

  remove: (id: string) => http.delete(`/templates/${id}`).then(extract),
};

// ─── Exchange Rate API ───────────────────────────────────────────────────────

export const ratesApi = {
  get: () => http.get<{ USD_ILS: number; USD_EUR: number; updated_at: string }>('/rates').then(extract),
};

export default http;
