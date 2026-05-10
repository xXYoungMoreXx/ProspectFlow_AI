const API_BASE = '/api/v1';

interface RequestOptions extends RequestInit {
  token?: string | null;
}

class ApiError extends Error {
  constructor(
    public status: number,
    public errors: Array<{ code: string; message: string; field?: string; requestId?: string }>,
  ) {
    super(errors[0]?.message || 'API Error');
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { token, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...fetchOptions,
    headers,
  });

  const body = await response.json();

  if (!response.ok) {
    throw new ApiError(response.status, body.errors || [{ code: 'UNKNOWN', message: 'Unknown error' }]);
  }

  return body;
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ data: { accessToken: string; refreshToken: string } }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    refresh: (refreshToken: string) =>
      request<{ data: { accessToken: string; refreshToken: string } }>('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      }),
    register: (data: any) =>
      request<{ meta: any }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    verifyEmail: (token: string) =>
      request<{ meta: any }>('/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ token }),
      }),
    resendVerification: (email: string) =>
      request<{ meta: any }>('/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
    forgotPassword: (email: string) =>
      request<{ meta: any }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
    resetPassword: (data: any) =>
      request<{ meta: any }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  agents: {
    list: (token: string) =>
      request<{ data: any[]; meta: any }>('/agents', { token }),
    getById: (id: string, token: string) =>
      request<{ data: any; meta: any }>(`/agents/${id}`, { token }),
    create: (data: any, token: string) =>
      request<{ data: any; meta: any }>('/agents', { method: 'POST', body: JSON.stringify(data), token }),
  },

  leads: {
    list: (token: string, params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<{ data: any[]; meta: any }>(`/leads${qs}`, { token });
    },
    getById: (id: string, token: string) =>
      request<{ data: any; meta: any }>(`/leads/${id}`, { token }),
    create: (data: any, token: string) =>
      request<{ data: any; meta: any }>('/leads', { method: 'POST', body: JSON.stringify(data), token }),
    update: (id: string, data: any, token: string) =>
      request<{ data: any; meta: any }>(`/leads/${id}`, { method: 'PATCH', body: JSON.stringify(data), token }),
  },

  deals: {
    list: (token: string) =>
      request<{ data: any[]; meta: any }>('/deals', { token }),
    getById: (id: string, token: string) =>
      request<{ data: any; meta: any }>(`/deals/${id}`, { token }),
  },

  projects: {
    list: (token: string) =>
      request<{ data: any[]; meta: any }>('/projects', { token }),
    getById: (id: string, token: string) =>
      request<{ data: any; meta: any }>(`/projects/${id}`, { token }),
  },

  hitl: {
    pending: (token: string) =>
      request<{ data: any[]; meta: any }>('/hitl/pending', { token }),
    approve: (id: string, note: string, token: string) =>
      request<{ data: any; meta: any }>(`/hitl/${id}/approve`, { method: 'POST', body: JSON.stringify({ note }), token }),
    reject: (id: string, note: string, token: string) =>
      request<{ data: any; meta: any }>(`/hitl/${id}/reject`, { method: 'POST', body: JSON.stringify({ note }), token }),
  },
};

export { ApiError };
