const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const api = {
  async get(endpoint: string) {
    const res = await fetch(`${API_URL}${endpoint}`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Request failed');
    return res.json();
  },

  async post(endpoint: string, data?: any) {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: data ? JSON.stringify(data) : undefined,
    });
    if (!res.ok) throw new Error('Request failed');
    return res.json();
  },

  async put(endpoint: string, data?: any) {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: data ? JSON.stringify(data) : undefined,
    });
    if (!res.ok) throw new Error('Request failed');
    return res.json();
  },

  async delete(endpoint: string) {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Request failed');
    return res.json();
  },
};
