// Detección automática del backend.
// Puedes forzar uno en tu HTML antes de los scripts:
// <script>window.__API_BASE__='https://shopd-d-production.up.railway.app'</script>
export const API_BASE: string =
  (typeof window !== 'undefined' && (window as any).__API_BASE__) ||
  (typeof location !== 'undefined' ? `${location.protocol}//${location.host}` : 'https://shopd-d-production.up.railway.app');

export const api = (path = '/'): string => {
  if (!path.startsWith('/')) path = `/${path}`;
  return `${API_BASE}${path}`;
};

// fetch con manejo de errores JSON/text. Devuelve null en 204.
export async function fetchJson<T = any>(url: string, opts: RequestInit = {}): Promise<T> {
  const resp = await fetch(url, opts);
  if (!resp.ok) {
    let msg = `HTTP ${resp.status}`;
    try {
      const ct = resp.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const j = await resp.json();
        if ((j as any)?.error) msg = (j as any).error;
      } else {
        const t = await resp.text();
        if (t) msg = t;
      }
    } catch {}
    throw new Error(msg);
  }
  if (resp.status === 204) return null as unknown as T;
  return resp.json();
}
