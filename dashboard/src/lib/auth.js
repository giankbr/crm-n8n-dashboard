const TOKEN_KEY = "dashboard_auth_token";
const ROLE_KEY = "dashboard_auth_role";
const USERNAME_KEY = "dashboard_auth_username";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function getRole() {
  return localStorage.getItem(ROLE_KEY) || "";
}

export function getUsername() {
  return localStorage.getItem(USERNAME_KEY) || "";
}

export function saveAuth({ token, user }) {
  localStorage.setItem(TOKEN_KEY, token || "");
  localStorage.setItem(ROLE_KEY, user?.role || "");
  localStorage.setItem(USERNAME_KEY, user?.username || "");
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(USERNAME_KEY);
}

export async function api(path, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`/api${path}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    const text = await response.text();
    if (response.status === 401) {
      clearAuth();
    }
    throw new Error(text || `Request failed: ${response.status}`);
  }
  return response.json();
}
