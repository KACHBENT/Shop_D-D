// Code/Auth.Script.ts — TypeScript (ESM, frontend)
// Provee: isAuthenticated (sync), getCurrentUser (async), login (async), logout (sync)
const API_BASE = window.__API_BASE__ || 'shopd-d-production.up.railway.app';
/* ======================
   Resolución de base URL de API
   - Si NO estás en :3000 (p.ej. :5501 Live Server), apunta a http://localhost:3000
   - Si ya estás en :3000 o no es localhost, usa rutas relativas ('')
====================== */
/* ======================
   Sesión (sessionStorage)
====================== */
const SS_SESSION = 'currentUserId';
export function getCurrentUserId() {
    return sessionStorage.getItem(SS_SESSION);
}
export function setCurrentUserId(id) {
    sessionStorage.setItem(SS_SESSION, id);
}
export function clearSession() {
    sessionStorage.removeItem(SS_SESSION);
}
/* ======================
   Helpers de API (fetch)
====================== */
async function apiLogin(username, password) {
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
            const j = await resp.json();
            if (j === null || j === void 0 ? void 0 : j.error)
                msg = j.error;
        }
        catch ( /* ignore */_a) { /* ignore */ }
        throw new Error(msg);
    }
    return resp.json();
}
async function apiGetUserWithPerson(userId) {
    const resp = await fetch(`${API_BASE}/api/users/${encodeURIComponent(userId)}`, {
        headers: { 'Accept': 'application/json' },
        mode: 'cors',
        credentials: 'omit'
    });
    if (resp.status === 404)
        return null;
    if (!resp.ok)
        throw new Error(`HTTP ${resp.status}`);
    return resp.json();
}
/* ======================
   API pública para la UI
====================== */
/**
 * Sincrónica: sólo verifica que exista un id en sessionStorage.
 * La validez real se confirma en getCurrentUser() contra el backend.
 */
export function isAuthenticated() {
    return !!getCurrentUserId();
}
/**
 * Asíncrona: obtiene { user, person } desde el backend usando el id de sesión.
 * Si el usuario ya no existe (404) o hay error, limpia sesión y devuelve null.
 */
export async function getCurrentUser() {
    const id = getCurrentUserId();
    if (!id)
        return null;
    try {
        const data = await apiGetUserWithPerson(id);
        if (!data) {
            clearSession();
            return null;
        }
        return data;
    }
    catch (e) {
        console.error('[getCurrentUser] error:', e);
        return null;
    }
}
/**
 * Login: hace POST /api/login. Si es correcto, guarda currentUserId,
 * emite 'user:updated' y retorna { user, person }.
 */
export async function login(username, password) {
    const { user, person } = await apiLogin(username, password);
    setCurrentUserId(user.id);
    // Notifica a la app (navbar, pantallas que escuchan 'user:updated')
    window.dispatchEvent(new CustomEvent('user:updated'));
    return { user, person };
}
/**
 * Logout: limpia la sesión y notifica a la UI.
 */
export function logout() {
    clearSession();
    window.dispatchEvent(new CustomEvent('user:updated'));
}
//# sourceMappingURL=Auth.Script.js.map