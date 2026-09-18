const API = (() => {
  const BASE = (window.API_BASE_URL || localStorage.getItem('maretravel_api_base') || '/api').replace(/\/$/, '');
  let token = localStorage.getItem('maretravel_token') || null;

  async function request(method, path, body) {
    const res = await fetch(BASE + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401) {
      localStorage.removeItem('maretravel_token');
      token = null;
      if (!path.startsWith('/auth/login')) window.location.reload();
      throw new Error('Sesión expirada');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.error || `Error ${res.status}`);
    }
    return res.json();
  }

  return {
    setToken(t) { token = t; localStorage.setItem('maretravel_token', t); },
    getToken: () => token,
    login: (username, password) => request('POST', '/auth/login', { username, password }),
    me: () => request('GET', '/auth/me'),
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    patch: (path, body) => request('PATCH', path, body),
    del: (path) => request('DELETE', path),
  };
})();