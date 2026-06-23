// ── Token management ────────────────────────────────────────────────
const TOKEN_KEY = 'sistum-auth-token';
const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export function getApiBaseUrl() {
  return API_BASE_URL;
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// ── Core fetch helper ───────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };

  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  // Session expired – clear stale token
  if (res.status === 401) {
    clearToken();
  }

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }

  return data;
}

// ── Auth API ────────────────────────────────────────────────────────

/** Register a new account; stores the JWT and returns the user object. */
export async function apiRegister(name, email, password) {
  const data = await apiFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
  setToken(data.token);
  return data.user;
}

/** Log in with email + password; stores the JWT and returns the user. */
export async function apiLogin(email, password) {
  const data = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setToken(data.token);
  return data.user;
}

/**
 * Fetch the currently authenticated user.
 * Returns null (instead of throwing) when there is no token or it expired.
 */
export async function apiGetMe() {
  if (!getToken()) return null;

  try {
    const data = await apiFetch('/api/auth/me');
    return data.user;
  } catch {
    return null;
  }
}

/** Request a password-reset code. Returns data (includes code in dev mode). */
export async function apiForgotPassword(email) {
  return apiFetch('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

/** Reset password using the emailed code. */
export async function apiResetPassword(email, code, newPassword) {
  return apiFetch('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ email, code, newPassword }),
  });
}

/** Log out – simply removes the stored token (no server call needed). */
export async function apiLogout() {
  clearToken();
}

/** Quick check whether a JWT is stored locally. */
export function hasAuthToken() {
  return !!getToken();
}

// ── User / Profile API ─────────────────────────────────────────────

/** Save user profile and goals together. */
export async function apiSaveProfile(profile, goals) {
  const data = await apiFetch('/api/user/profile', {
    method: 'PUT',
    body: JSON.stringify({ profile, goals }),
  });
  return data.user;
}

/** Save only the calorie / macro goals. */
export async function apiSaveGoals(goals) {
  const data = await apiFetch('/api/user/goals', {
    method: 'PUT',
    body: JSON.stringify({ goals }),
  });
  return data.user;
}

/** Save AI-assistant settings (model, prompts, etc.). */
export async function apiSaveAiSettings(settings) {
  const data = await apiFetch('/api/user/ai-settings', {
    method: 'PUT',
    body: JSON.stringify({ settings }),
  });
  return data.user;
}

// ── Daily Log API ───────────────────────────────────────────────────

/** Fetch logs for a date range. Returns a date-keyed object. */
export async function apiGetLogs(from, to) {
  const params = new URLSearchParams({ from, to });
  const data = await apiFetch(`/api/logs?${params}`);
  return data.logs;
}

/** Fetch the full log for a single date (YYYY-MM-DD). */
export async function apiGetDayLog(date) {
  return apiFetch(`/api/logs/${date}`);
}

/** Add a meal entry to a given date's log. */
export async function apiAddMeal(date, meal) {
  return apiFetch(`/api/logs/${date}/meals`, {
    method: 'POST',
    body: JSON.stringify({ meal }),
  });
}

/** Remove a meal entry by its id from a given date's log. */
export async function apiRemoveMeal(date, mealId) {
  return apiFetch(`/api/logs/${date}/meals/${mealId}`, {
    method: 'DELETE',
  });
}
