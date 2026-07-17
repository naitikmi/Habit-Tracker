const TOKEN_KEY = 'challengeToken';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function tryFetchAPI(path, opts, timeoutMs = 15000) {
  const c = new AbortController();
  const id = setTimeout(() => c.abort(), timeoutMs);
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

// Free-tier hosting (Render) spins the server down after ~15min idle and can take
// 30-60s to wake back up on the next request. Auth requests get a longer timeout
// than the default so that cold start doesn't look like a failure.
const COLD_START_TIMEOUT_MS = 45000;

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
  }, COLD_START_TIMEOUT_MS);
  if (r && r.ok) {
    setToken(r.token);
    return { success: true, user: r.user };
  }
  if (r) return { success: false, error: r.error };
  return { success: false, error: "Couldn't reach the server — it may be waking up (can take up to a minute on first use). Please try again shortly.", isConnectionIssue: true };
}

export async function register(username, email, password) {
  const r = await tryFetchAPI('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password })
  }, COLD_START_TIMEOUT_MS);
  if (r && r.ok) {
    setToken(r.token);
    return { success: true, user: r.user };
  }
  if (r) return { success: false, error: r.error };
  return { success: false, error: "Couldn't reach the server — it may be waking up (can take up to a minute on first use). Please try again shortly.", isConnectionIssue: true };
}

export function logout() {
  setToken(null);
}

function decodeJwtPayload(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64).split('').map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('')
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// Restores a session instantly from the stored JWT itself, with no network round
// trip — the token already carries username/role, so login state doesn't need to
// wait on (or depend on the success of) a server request. Clears the token only if
// it's missing/malformed or genuinely expired per its own `exp` claim.
export function getCachedUser() {
  const t = getToken();
  if (!t) return null;
  const payload = decodeJwtPayload(t);
  if (!payload || (payload.exp && payload.exp * 1000 < Date.now())) {
    setToken(null);
    return null;
  }
  return { username: payload.username, role: payload.role, email: '', profilePicture: '' };
}

// Background profile refresh (real email/avatar, since the token doesn't carry those).
// Returns: the full user object on success, `null` if the server explicitly rejected
// the token (401 — genuinely logged out), or `undefined` if it simply couldn't be
// reached in time (e.g. Render cold start) — callers should keep the existing
// session in that case rather than treating it as a logout.
export async function refreshProfile() {
  const t = getToken();
  if (!t) return null;
  try {
    const c = new AbortController();
    const id = setTimeout(() => c.abort(), COLD_START_TIMEOUT_MS);
    const r = await fetch('/api/auth/me', { headers: { Authorization: 'Bearer ' + t }, signal: c.signal });
    clearTimeout(id);
    if (r.status === 401) {
      setToken(null);
      return null;
    }
    if (r.ok) {
      const data = await r.json();
      if (data && data.ok) return data.user;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

// Load defaults — server returns { challenges: [...], nextChallengeId }
// We merge with active challenge selection
export async function loadDefaults() {
  const r = await tryFetchAPI('/api/challenges/default');
  if (r && r.ok && r.data) {
    const result = r.data;
    result.activeChallengeId = null; // will be set by loadActiveChallenge
    return result;
  }
  return null;
}

export async function loadUserChallenges() {
  const r = await tryFetchAPI('/api/challenges/user', { headers: authHeaders() });
  if (r && r.ok && r.data) {
    const result = r.data;
    result.activeChallengeId = null;
    return result;
  }
  return null;
}

export async function loadActiveChallenge() {
  const r = await tryFetchAPI('/api/challenges/active', { headers: authHeaders() });
  if (r && r.ok && r.data) return r.data;
  return null;
}

export async function saveActiveChallenge(challengeId, source) {
  await tryFetchAPI('/api/challenges/active', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ challengeId, source })
  });
}

export async function loadChallengeHistory() {
  const r = await tryFetchAPI('/api/challenges/history', { headers: authHeaders() });
  if (r && r.ok && r.data) return r.data;
  return [];
}

export async function loadFollowedChallenge() {
  const r = await tryFetchAPI('/api/challenges/follow', { headers: authHeaders() });
  if (r && r.ok && r.data) return r.data;
  return null;
}

export async function saveFollowedChallenge(challengeId, source) {
  await tryFetchAPI('/api/challenges/follow', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ challengeId, source })
  });
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
  await tryFetchAPI('/api/challenges/default', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ data })
  });
}

export async function saveUserChallenges(data) {
  await tryFetchAPI('/api/challenges/user', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ data })
  });
}

export async function updateProfile(data) {
  const r = await tryFetchAPI('/api/auth/profile', {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(data)
  });
  return r && r.ok ? r.user : null;
}

export async function changePassword(currentPassword, newPassword) {
  const r = await tryFetchAPI('/api/auth/password', {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ currentPassword, newPassword })
  });
  if (r && r.ok) return { success: true };
  return { success: false, error: r ? r.error : 'Server error' };
}

// Groups API
export async function loadGroups() {
  const r = await tryFetchAPI('/api/groups', { headers: authHeaders() });
  if (r && r.ok && r.data) return r.data;
  return [];
}

export async function createGroup(name, memberIds) {
  const r = await tryFetchAPI('/api/groups', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ name, memberIds })
  });
  return r && r.ok ? r.data : null;
}

export async function getGroup(id) {
  const r = await tryFetchAPI('/api/groups/' + id, { headers: authHeaders() });
  if (r && r.ok && r.data) return r.data;
  return null;
}

export async function addGroupMembers(id, memberIds) {
  const r = await tryFetchAPI('/api/groups/' + id + '/members', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ memberIds })
  });
  return r && r.ok ? r.data : null;
}

export async function removeGroupMember(id, userId) {
  const r = await tryFetchAPI('/api/groups/' + id + '/members/' + userId, {
    method: 'DELETE',
    headers: authHeaders()
  });
  return r && r.ok ? r.data : null;
}

export async function getGroupChallenge(id) {
  const r = await tryFetchAPI('/api/groups/' + id + '/challenge', { headers: authHeaders() });
  if (r && r.ok) return r.data;
  return null;
}

export async function saveGroupChallenge(id, data) {
  const r = await tryFetchAPI('/api/groups/' + id + '/challenge', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data)
  });
  return r && r.ok ? r.data : null;
}

export async function sendGroupMessage(id, text) {
  const r = await tryFetchAPI('/api/groups/' + id + '/messages', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ text })
  });
  if (r && r.ok && r.data) return r.data;
  return null;
}

export async function loadGroupMessages(id) {
  const r = await tryFetchAPI('/api/groups/' + id + '/messages', { headers: authHeaders() });
  if (r && r.ok && r.data) return r.data;
  return [];
}

export async function deleteGroup(id) {
  const r = await tryFetchAPI('/api/groups/' + id, {
    method: 'DELETE',
    headers: authHeaders()
  });
  return r && r.ok;
}

export async function loadDiscoverableGroups() {
  const r = await tryFetchAPI('/api/groups/discover/all', { headers: authHeaders() });
  if (r && r.ok && r.data) return r.data;
  return [];
}

export async function joinGroup(id) {
  const r = await tryFetchAPI('/api/groups/' + id + '/join', {
    method: 'POST',
    headers: authHeaders()
  });
  if (r && r.ok && r.data) return r.data;
  return null;
}

export async function leaveGroup(id) {
  const r = await tryFetchAPI('/api/groups/' + id + '/leave', {
    method: 'POST',
    headers: authHeaders()
  });
  if (r && r.ok && r.data) return r.data;
  return null;
}
