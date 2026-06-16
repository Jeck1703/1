const rawApiUrl = import.meta.env.VITE_API_URL?.trim();
const API_BASE = rawApiUrl ? `${rawApiUrl.replace(/\/$/, '')}/api` : '/api';

function getToken() {
  return localStorage.getItem('token');
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(authHeaders() as any),
      ...((options.headers as any) || {}),
    } as HeadersInit,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const AuthAPI = {
  register: (data: any) => api<{ token: string; user: any }>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data: any) => api<{ token: string; user: any }>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  me: () => api<{ user: any }>('/auth/me'),
};

export const ProductsAPI = {
  list: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([,v]) => v != null).map(([k,v]) => [k, String(v)])).toString() : '';
    return api<any[]>('/products' + qs);
  },
  get: (id: number | string) => api<any>(`/products/${id}`),
  create: (data: any) => api<any>('/products', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number | string, data: any) => api<any>(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: number | string) => api<{ok: boolean}>(`/products/${id}`, { method: 'DELETE' }),
};

export const OrdersAPI = {
  create: (data: any) => api<any>('/orders', { method: 'POST', body: JSON.stringify(data) }),
  my: () => api<any[]>('/orders/my'),
  all: () => api<any[]>('/orders'),
  updateStatus: (id: number, status: string) => api<any>(`/orders/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
};

export const ContactAPI = {
  send: (data: any) => api<{ok: boolean; message: string}>('/contact', { method: 'POST', body: JSON.stringify(data) }),
};
