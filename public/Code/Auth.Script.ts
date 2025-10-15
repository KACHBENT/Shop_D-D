// Code/Auth.Script.ts — TypeScript (ESM, frontend)
// Provee: isAuthenticated (sync), getCurrentUser (async), login (async), logout (sync)
const API_BASE =
  (window).__API_BASE__?.trim?.() ||
  `${location.protocol}//${location.host}`;

export type Role = 'cliente' | 'administrador' | 'proveedor';

export interface DBUser {
  id: string;
  username: string;
  userPassword: string;   // DEMO: en claro (en prod: hash)
  personId: string;
  avatar: string | null;
  role?: Role;
  createdAt: string;      // ISO
}

export interface DBPerson {
  id: string;
  name: string;
  fatherLastname: string;
  motherLastname: string;
  email: string;
  createdAt: string;      // ISO
}

export interface UserWithPerson {
  user: DBUser;
  person: DBPerson;
}
/* ======================
   Resolución de base URL de API
   - Si NO estás en :3000 (p.ej. :5501 Live Server), apunta a http://localhost:3000
   - Si ya estás en :3000 o no es localhost, usa rutas relativas ('')
====================== */


/* ======================
   Sesión (sessionStorage)
====================== */
const SS_SESSION = 'currentUserId';

export function getCurrentUserId(): string | null {
  return sessionStorage.getItem(SS_SESSION);
}
export function setCurrentUserId(id: string): void {
  sessionStorage.setItem(SS_SESSION, id);
}
export function clearSession(): void {
  sessionStorage.removeItem(SS_SESSION);
}

/* ======================
   Helpers de API (fetch)
====================== */
async function apiLogin(username: string, password: string): Promise<UserWithPerson> {
  const resp = await fetch(`${API_BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ username, password }),
    mode: 'cors',
    credentials: 'omit'
  });

  if (!resp.ok) {
    let msg = `HTTP ${resp.status}`;
    try {
      const j = await resp.json() as { error?: string };
      if (j?.error) msg = j.error;
    } catch { /* ignore */ }
    throw new Error(msg);
  }

  return resp.json() as Promise<UserWithPerson>;
}

async function apiGetUserWithPerson(userId: string): Promise<UserWithPerson | null> {
  const resp = await fetch(`${API_BASE}/api/users/${encodeURIComponent(userId)}`, {
    headers: { 'Accept': 'application/json' },
    mode: 'cors',
    credentials: 'omit'
  });

  if (resp.status === 404) return null;
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

  return resp.json() as Promise<UserWithPerson>;
}

/* ======================
   API pública para la UI
====================== */

/**
 * Sincrónica: sólo verifica que exista un id en sessionStorage.
 * La validez real se confirma en getCurrentUser() contra el backend.
 */
export function isAuthenticated(): boolean {
  return !!getCurrentUserId();
}

/**
 * Asíncrona: obtiene { user, person } desde el backend usando el id de sesión.
 * Si el usuario ya no existe (404) o hay error, limpia sesión y devuelve null.
 */
export async function getCurrentUser(): Promise<UserWithPerson | null> {
  const id = getCurrentUserId();
  if (!id) return null;

  try {
    const data = await apiGetUserWithPerson(id);
    if (!data) {
      clearSession();
      return null;
    }
    return data;
  } catch (e) {
    console.error('[getCurrentUser] error:', e);
    return null;
  }
}

/**
 * Login: hace POST /api/login. Si es correcto, guarda currentUserId,
 * emite 'user:updated' y retorna { user, person }.
 */
export async function login(username: string, password: string): Promise<UserWithPerson> {
  const { user, person } = await apiLogin(username, password);
  setCurrentUserId(user.id);
  // Notifica a la app (navbar, pantallas que escuchan 'user:updated')
  window.dispatchEvent(new CustomEvent('user:updated'));
  return { user, person };
}

/**
 * Logout: limpia la sesión y notifica a la UI.
 */
export function logout(): void {
  clearSession();
  window.dispatchEvent(new CustomEvent('user:updated'));
}
