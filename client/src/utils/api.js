const TOKEN_KEY = 'challengeToken';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function tryFetchAPI(path, opts) {
  const c = new AbortController();
  const id = setTimeout(() => c.abort(), 5000);
  try {
    const r = await fetch(path, { ...opts, signal: c.signal });
    clearTimeout(id);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    clearTimeout(id);
    return null;
  }
}

export function authHeaders() {
  const t = getToken();
  return t
    ? { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

export async function login(username, password) {
  const r = await tryFetchAPI('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (r && r.ok) {
    setToken(r.token);
    return { success: true, user: r.user };
  }
  return { success: false, error: r ? r.error : 'Server error' };
}

export async function register(username, password) {
  const r = await tryFetchAPI('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (r && r.ok) {
    setToken(r.token);
    return { success: true, user: r.user };
  }
  return { success: false, error: r ? r.error : 'Server error' };
}

export function logout() {
  setToken(null);
}

export async function checkAuth() {
  const t = getToken();
  if (!t) return null;
  const r = await tryFetchAPI('/api/auth/me', {
    headers: { Authorization: 'Bearer ' + t }
  });
  if (r && r.ok) return r.user;
  setToken(null);
  return null;
}

export async function loadDefaults() {
  const r = await tryFetchAPI('/api/default-challenges');
  if (r && r.ok && r.data) return r.data;
  return null;
}

export async function loadUserChallenges() {
  const r = await tryFetchAPI('/api/user-challenges', { headers: authHeaders() });
  if (r && r.ok && r.data) return r.data;
  return null;
}

export async function loadProgress() {
  const r = await tryFetchAPI('/api/progress', { headers: authHeaders() });
  if (r && r.ok && r.data) return r.data;
  return {};
}

export async function saveProgress(data) {
  await tryFetchAPI('/api/progress', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ data })
  });
}

export async function saveDefaultsToServer(data) {
  await tryFetchAPI('/api/default-challenges', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ data })
  });
}

export async function saveUserChallenges(data) {
  await tryFetchAPI('/api/user-challenges', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ data })
  });
}
