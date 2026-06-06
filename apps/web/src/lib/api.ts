import { useAuthStore } from "./stores/auth-store";

const API_BASE = "/api/v1";

interface RequestOptions extends RequestInit {
  token?: string | null;
}

class ApiError extends Error {
  constructor(
    public status: number,
    public errors: Array<{
      code: string;
      message: string;
      field?: string;
      requestId?: string;
    }>,
  ) {
    super(errors[0]?.message || "API Error");
    this.name = "ApiError";
  }
}

// Single fetch without retry — used internally for auth endpoints to avoid loops.
async function rawRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { token, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (token) headers["Authorization"] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}${path}`, {
    ...fetchOptions,
    headers,
  });

  const body = await response.json();

  if (!response.ok) {
    throw new ApiError(
      response.status,
      body.errors || [{ code: "UNKNOWN", message: "Unknown error" }],
    );
  }

  return body;
}

// On 401: try one silent token refresh then retry; on failure, logout.
async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  try {
    return await rawRequest<T>(path, options);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      const { refreshToken, updateToken, logout } = useAuthStore.getState();
      if (refreshToken) {
        try {
          const refreshed = await rawRequest<{
            data: { accessToken: string; refreshToken: string };
          }>("/auth/refresh", {
            method: "POST",
            body: JSON.stringify({ refreshToken }),
          });
          updateToken(refreshed.data.accessToken, refreshed.data.refreshToken);
          return await rawRequest<T>(path, {
            ...options,
            token: refreshed.data.accessToken,
          });
        } catch {
          logout();
        }
      } else {
        logout();
      }
    }
    throw err;
  }
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ data: { accessToken: string; refreshToken: string } }>(
        "/auth/login",
        {
          method: "POST",
          body: JSON.stringify({ email, password }),
        },
      ),
    devLogin: (email: string, password: string) =>
      request<{ data: { accessToken: string; refreshToken: string } }>(
        "/auth/dev-login",
        {
          method: "POST",
          body: JSON.stringify({ email, password }),
        },
      ),
    refresh: (refreshToken: string) =>
      request<{ data: { accessToken: string; refreshToken: string } }>(
        "/auth/refresh",
        {
          method: "POST",
          body: JSON.stringify({ refreshToken }),
        },
      ),
    register: (data: any) =>
      request<{ meta: any }>("/auth/register", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    verifyEmail: (token: string) =>
      request<{ meta: any }>("/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({ token }),
      }),
    resendVerification: (email: string) =>
      request<{ meta: any }>("/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email }),
      }),
    forgotPassword: (email: string) =>
      request<{ meta: any }>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      }),
    resetPassword: (data: any) =>
      request<{ meta: any }>("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  agents: {
    list: (token: string) =>
      request<{ data: any[]; meta: any }>("/agents", { token }),
    getById: (id: string, token: string) =>
      request<{ data: any; meta: any }>(`/agents/${id}`, { token }),
    create: (data: any, token: string) =>
      request<{ data: any; meta: any }>("/agents", {
        method: "POST",
        body: JSON.stringify(data),
        token,
      }),
    update: (id: string, data: any, token: string) =>
      request<{ data: any; meta: any }>(`/agents/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
        token,
      }),
  },

  leads: {
    list: (token: string, params?: Record<string, string>) => {
      const qs = params ? "?" + new URLSearchParams(params).toString() : "";
      return request<{ data: any[]; meta: any }>(`/leads${qs}`, { token });
    },
    getById: (id: string, token: string) =>
      request<{ data: any; meta: any }>(`/leads/${id}`, { token }),
    create: (data: any, token: string) =>
      request<{ data: any; meta: any }>("/leads", {
        method: "POST",
        body: JSON.stringify(data),
        token,
      }),
    update: (id: string, data: any, token: string) =>
      request<{ data: any; meta: any }>(`/leads/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
        token,
      }),
  },

  deals: {
    list: (token: string) =>
      request<{ data: any[]; meta: any }>("/deals", { token }),
    getById: (id: string, token: string) =>
      request<{ data: any; meta: any }>(`/deals/${id}`, { token }),
  },

  projects: {
    list: (token: string) =>
      request<{ data: any[]; meta: any }>("/projects", { token }),
    getById: (id: string, token: string) =>
      request<{ data: any; meta: any }>(`/projects/${id}`, { token }),
  },

  briefings: {
    list: (token: string) =>
      request<{ data: any[]; meta: any }>("/briefings", { token }),
    getById: (id: string, token: string) =>
      request<{ data: any; meta: any }>(`/briefings/${id}`, { token }),
    extract: (id: string, token: string) =>
      request<{ data: { briefingId: string; status: string } }>(
        `/briefings/${id}/extract`,
        { method: "POST", body: JSON.stringify({}), token },
      ),
    approve: (id: string, token: string) =>
      request<{ data: any }>(`/briefings/${id}/approve`, {
        method: "PATCH",
        body: JSON.stringify({}),
        token,
      }),
  },

  prospecting: {
    searchMaps: (
      data: {
        categories: string[];
        region: { city: string; state: string; radiusKm: number };
        minScore?: number;
        limit?: number;
      },
      token: string,
    ) =>
      request<{ data: any; meta: any }>("/prospecting/search-maps", {
        method: "POST",
        body: JSON.stringify(data),
        token,
      }),
    previewMaps: (
      params: {
        categories: string[];
        city: string;
        state: string;
        radiusKm: number;
      },
      token: string,
    ) => {
      const qs = new URLSearchParams({
        categories: params.categories.join(","),
        city: params.city,
        state: params.state,
        radiusKm: String(params.radiusKm),
      });
      return request<{
        data: {
          places: Array<{
            placeId: string;
            name: string;
            address: string;
            phone: string | null;
            website: string | null;
            rating: number | null;
            reviewsCount: number | null;
            types: string[];
            mapsUrl: string;
          }>;
        };
        meta: { total: number; city: string; state: string; radiusKm: number };
      }>(`/prospecting/search-maps-preview?${qs.toString()}`, { token });
    },
    queue: (token: string) =>
      request<{ data: { leads: any[] }; meta: any }>("/prospecting/queue", {
        token,
      }),
    getConfig: (token: string) =>
      request<{ data: any }>("/prospecting/config", { token }),
    updateConfig: (data: any, token: string) =>
      request<{ data: any }>("/prospecting/config", {
        method: "PATCH",
        body: JSON.stringify(data),
        token,
      }),
  },

  hitl: {
    pending: (token: string) =>
      request<{ data: any[]; meta: any }>("/hitl/pending", { token }),
    approve: (id: string, note: string, token: string) =>
      request<{ data: any; meta: any }>(`/hitl/${id}/approve`, {
        method: "POST",
        body: JSON.stringify({ note }),
        token,
      }),
    reject: (id: string, note: string, token: string) =>
      request<{ data: any; meta: any }>(`/hitl/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ note }),
        token,
      }),
  },

  settings: {
    list: (token: string) => request<{ data: any[] }>("/settings", { token }),
    listByCategory: (category: string, token: string) =>
      request<{ data: any[] }>(`/settings/${category}`, { token }),
    upsert: (settings: any[], token: string) =>
      request<{ data: any }>("/settings", {
        method: "PUT",
        body: JSON.stringify({ settings }),
        token,
      }),
    delete: (key: string, token: string) =>
      request<{ data: any }>(`/settings/${key}`, {
        method: "DELETE",
        token,
      }),
    testConnection: (category: string, token: string) =>
      request<{ data: { success: boolean; message: string } }>(
        "/settings/test-connection",
        {
          method: "POST",
          body: JSON.stringify({ category }),
          token,
        },
      ),
  },

  costs: {
    dashboard: (period: "day" | "week" | "month", token: string) =>
      request<{
        data: {
          period: string;
          since: string;
          totalCostUsd: number;
          totalTokens: number;
          byAgent: Array<{
            agentId: string;
            provider: string;
            totalTokens: number;
            costUsd: number;
            requests: number;
          }>;
        };
      }>(`/costs/dashboard?period=${period}`, { token }),
  },

  ollama: {
    status: (token: string) =>
      request<{ data: any }>("/settings/ollama/status", { token }),
    models: (token: string) =>
      request<{ data: any[] }>("/settings/ollama/models", { token }),
    delete: (name: string, token: string) =>
      request<{ data: any }>(
        `/settings/ollama/models/${encodeURIComponent(name)}`,
        {
          method: "DELETE",
          token,
        },
      ),
  },
};

export { ApiError };
