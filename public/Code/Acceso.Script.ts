// Code/Acceso.Script.ts — TypeScript (ESM) — Login vía backend (/api/login)

declare global { interface Window { bootstrap?: any; __API_BASE__?: string; } }

type ToastType = "success" | "danger" | "warning" | "info";

/** Normaliza el base de la API:
 * - Si no se define, usa el origin actual (http://localhost:3000 en local).
 * - Si viene sin protocolo (ej: "shopd-d-production.up.railway.app"), antepone "https://".
 */
function normalizeBase(raw?: string): string {
  const val = (raw ?? "").trim();
  if (!val) return window.location.origin;
  if (val.startsWith("http://") || val.startsWith("https://")) return val.replace(/\/+$/, "");
  return `https://${val.replace(/\/+$/, "")}`;
}

const API_BASE = normalizeBase((window as any).__API_BASE__ || "shopd-d-production.up.railway.app");

// -------- Toasts --------
function ensureToastContainer(): HTMLDivElement {
  let c = document.getElementById("toast-container") as HTMLDivElement | null;
  if (!c) {
    c = document.createElement("div");
    c.id = "toast-container";
    c.className = "toast-container position-fixed top-0 end-0 p-3";
    c.style.zIndex = "1080";
    document.body.appendChild(c);
  }
  return c;
}

function showToast(msg: string, type: ToastType = "info") {
  const c = ensureToastContainer();
  const el = document.createElement("div");
  const bg = {
    success: "bg-success text-white",
    danger: "bg-danger text-white",
    warning: "bg-warning",
    info: "bg-info",
  }[type];
  el.className = `toast align-items-center border-0 mb-2 ${bg}`;
  el.setAttribute("role", "alert");
  el.setAttribute("aria-live", "assertive");
  el.setAttribute("aria-atomic", "true");
  el.innerHTML = `<div class="d-flex"><div class="toast-body">${msg}</div>
    <button type="button" class="btn-close ${type === "warning" || type === "info" ? "" : "btn-close-white"} me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
  c.appendChild(el);
  const BT = window.bootstrap?.Toast;
  BT ? new BT(el, { delay: 3000, autohide: true }).show()
     : (el.style.display = "block", setTimeout(() => el.remove(), 3500));
}

// -------- Pantalla de Acceso --------
export function mount({ container, signal }: { container: HTMLElement; signal: AbortSignal }) {
  const form = container.querySelector<HTMLFormElement>('form#form');
  const username = container.querySelector<HTMLInputElement>('#username');
  const password = container.querySelector<HTMLInputElement>('#password');
  const submitBtn = form?.querySelector<HTMLButtonElement>('button[type="submit"]') || null;

  if (!form || !username || !password) {
    console.warn("[acceso] faltan elementos");
    return;
  }

  // Seguridad visual
  password.type = "password";

  // Handler tipado como SubmitEvent (async permitido)
  const onSubmit = async (ev: SubmitEvent) => {
    ev.preventDefault();

    const u = username.value.trim();
    const p = password.value; // no trim

    if (!u || !p) {
      showToast("Usuario y contraseña son requeridos.", "danger");
      return;
    }

    try {
      if (submitBtn) { submitBtn.disabled = true; submitBtn.innerText = "Ingresando..."; }

      // ---- LOGIN contra backend ----
      const resp = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ username: u, password: p }),
      });

      if (!resp.ok) {
        let msg = `HTTP ${resp.status}`;
        try {
          const ct = resp.headers.get('content-type') || '';
          if (ct.includes('application/json')) {
            const err = await resp.json();
            msg = err?.error || msg;
          } else {
            const txt = await resp.text();
            if (txt) msg = txt;
          }
        } catch { /* noop */ }
        showToast(msg || "Credenciales incorrectas.", "danger");
        return;
      }

      const data: {
        user: {
          id: string;
          username: string;
          userPassword: string;
          personId: string;
          avatar?: string | null;
          role?: string;
          createdAt?: string;
        },
        person: { name?: string; email?: string }
      } = await resp.json();

      // Guardar sesión en el cliente (como hace tu app.js / guards)
      sessionStorage.setItem('currentUserId', data.user.id);

      // Cache mínimo para navbar
      sessionStorage.setItem('currentUserCache', JSON.stringify({
        id: data.user.id,
        username: data.user.username,
        avatar: data.user.avatar ?? null,
        role: data.user.role ?? 'cliente',
        person: {
          name: data.person?.name ?? '',
          email: data.person?.email ?? ''
        },
        createdAt: data.user.createdAt ?? ''
      }));

      showToast(`¡Bienvenido, ${data.person?.name || data.user.username}!`, "success");

      // Notificar a la app (navbar/perfil/inicio)
      window.dispatchEvent(new CustomEvent('user:updated'));

      // Redirigir al perfil
      location.hash = '/perfil';

      // Limpieza
      form.reset();

    } catch (err: any) {
      showToast(err?.message || "No se pudo iniciar sesión.", "danger");
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = "Iniciar Sesión"; }
    }
  };

  // Listener sincrónico que llama al async
  form.addEventListener('submit', (ev: Event) => {
    void onSubmit(ev as SubmitEvent);
  }, { signal });
}

export function unmount() { /* no-op */ }
