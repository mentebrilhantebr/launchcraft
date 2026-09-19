/**
 * Client-side auth helper (browser only)
 *
 * SEGURANÇA (Etapa 5): o access token é mantido APENAS em memória (variável de
 * módulo) — nunca em localStorage/sessionStorage. A sessão persiste através do
 * refresh token, que fica em cookie httpOnly (setado pelo backend). Ao carregar
 * a página chamamos /api/auth/refresh para reobter um access token em memória.
 *
 * @module lib/client/auth-client
 */

'use client';

/** Access token em memória (perdido ao recarregar — reobtido via refresh). */
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  role?: string;
  [key: string]: unknown;
}

/**
 * Faz login. Em caso de sucesso, guarda o access token em memória.
 */
export async function login(
  email: string,
  password: string
): Promise<{ user: AuthUser }> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || 'Falha ao fazer login');
  }
  accessToken = data.accessToken ?? null;
  return { user: data.user };
}

/**
 * Cria uma conta e já autentica (o backend retorna accessToken + cookie).
 */
export async function signup(
  name: string,
  email: string,
  password: string
): Promise<{ user: AuthUser }> {
  const res = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ name, email, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || 'Falha ao criar conta');
  }
  accessToken = data.accessToken ?? null;
  return { user: data.user };
}

/**
 * Tenta renovar o access token usando o refresh token (cookie httpOnly).
 * Retorna true se conseguiu.
 */
export async function refresh(): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) {
      accessToken = null;
      return false;
    }
    const data = await res.json();
    accessToken = data.accessToken ?? null;
    return accessToken !== null;
  } catch {
    accessToken = null;
    return false;
  }
}

/**
 * Encerra a sessão (limpa cookie no backend e token em memória).
 */
export async function logout(): Promise<void> {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
  } finally {
    accessToken = null;
  }
}

/**
 * fetch autenticado: injeta o Authorization: Bearer <token> e, em caso de 401,
 * tenta um refresh e repete a requisição UMA vez.
 */
export async function authFetch(
  input: string,
  init: RequestInit = {}
): Promise<Response> {
  const doFetch = () => {
    const headers = new Headers(init.headers);
    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }
    return fetch(input, { ...init, headers, credentials: 'include' });
  };

  let res = await doFetch();
  if (res.status === 401) {
    const ok = await refresh();
    if (ok) {
      res = await doFetch();
    }
  }
  return res;
}
