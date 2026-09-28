function envValue(name) {
  const value = process.env[name];
  if (value !== undefined && value !== '') {
    return value.replace(/\/$/, '');
  }
  return null;
}

export function getApiBase() {
  const fromEnv = envValue('REACT_APP_API_URL');
  if (fromEnv) return fromEnv;

  const { protocol, hostname } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3000';
  }

  // UI is on :80; API/WebSocket stay on :3000 (empty port means 80/443).
  return `${protocol}//${hostname}:3000`;
}

export function getWsUrl() {
  const fromEnv = envValue('REACT_APP_WS_URL');
  if (fromEnv) return fromEnv;
  return getApiBase().replace(/^http/, 'ws');
}

export function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('userEmail');
}

export function markSessionExpired() {
  sessionStorage.setItem('sessionExpired', '1');
}

export function consumeSessionExpiredMessage() {
  const expired = sessionStorage.getItem('sessionExpired') === '1';
  if (expired) {
    sessionStorage.removeItem('sessionExpired');
  }
  return expired;
}

export function isAuthError(message) {
  return typeof message === 'string' && /token/i.test(message);
}

export function isTokenExpired(token) {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload.exp === 'number' && Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
}

export function authHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    Authorization: `jwt ${token}`,
  };
}
