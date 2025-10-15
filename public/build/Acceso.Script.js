// Code/Acceso.Script.ts — TypeScript (ESM) — Login vía backend (/api/login)
var _a, _b;
/** Normaliza el base de la API:
 * - Si no se define, usa el origin actual (http://localhost:3000 en local).
 * - Si viene sin protocolo (ej: "shopd-d-production.up.railway.app"), antepone "https://".
 */
function normalizeBase(raw) {
    const val = (raw !== null && raw !== void 0 ? raw : "").trim();
    if (!val)
        return window.location.origin;
    if (val.startsWith("http://") || val.startsWith("https://"))
        return val.replace(/\/+$/, "");
    return `https://${val.replace(/\/+$/, "")}`;
}
const API_BASE = ((_b = (_a = (window).__API_BASE__) === null || _a === void 0 ? void 0 : _a.trim) === null || _b === void 0 ? void 0 : _b.call(_a)) ||
    `${location.protocol}//${location.host}`;
// -------- Toasts --------
function ensureToastContainer() {
    let c = document.getElementById("toast-container");
    if (!c) {
        c = document.createElement("div");
        c.id = "toast-container";
        c.className = "toast-container position-fixed top-0 end-0 p-3";
        c.style.zIndex = "1080";
        document.body.appendChild(c);
    }
    return c;
}
function showToast(msg, type = "info") {
    var _a;
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
    const BT = (_a = window.bootstrap) === null || _a === void 0 ? void 0 : _a.Toast;
    BT ? new BT(el, { delay: 3000, autohide: true }).show()
        : (el.style.display = "block", setTimeout(() => el.remove(), 3500));
}
// -------- Pantalla de Acceso --------
export function mount({ container, signal }) {
    const form = container.querySelector('form#form');
    const username = container.querySelector('#username');
    const password = container.querySelector('#password');
    const submitBtn = (form === null || form === void 0 ? void 0 : form.querySelector('button[type="submit"]')) || null;
    if (!form || !username || !password) {
        console.warn("[acceso] faltan elementos");
        return;
    }
    // Seguridad visual
    password.type = "password";
    // Handler tipado como SubmitEvent (async permitido)
    const onSubmit = async (ev) => {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        ev.preventDefault();
        const u = username.value.trim();
        const p = password.value; // no trim
        if (!u || !p) {
            showToast("Usuario y contraseña son requeridos.", "danger");
            return;
        }
        try {
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerText = "Ingresando...";
            }
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
                        msg = (err === null || err === void 0 ? void 0 : err.error) || msg;
                    }
                    else {
                        const txt = await resp.text();
                        if (txt)
                            msg = txt;
                    }
                }
                catch ( /* noop */_j) { /* noop */ }
                showToast(msg || "Credenciales incorrectas.", "danger");
                return;
            }
            const data = await resp.json();
            // Guardar sesión en el cliente (como hace tu app.js / guards)
            sessionStorage.setItem('currentUserId', data.user.id);
            // Cache mínimo para navbar
            sessionStorage.setItem('currentUserCache', JSON.stringify({
                id: data.user.id,
                username: data.user.username,
                avatar: (_a = data.user.avatar) !== null && _a !== void 0 ? _a : null,
                role: (_b = data.user.role) !== null && _b !== void 0 ? _b : 'cliente',
                person: {
                    name: (_d = (_c = data.person) === null || _c === void 0 ? void 0 : _c.name) !== null && _d !== void 0 ? _d : '',
                    email: (_f = (_e = data.person) === null || _e === void 0 ? void 0 : _e.email) !== null && _f !== void 0 ? _f : ''
                },
                createdAt: (_g = data.user.createdAt) !== null && _g !== void 0 ? _g : ''
            }));
            showToast(`¡Bienvenido, ${((_h = data.person) === null || _h === void 0 ? void 0 : _h.name) || data.user.username}!`, "success");
            // Notificar a la app (navbar/perfil/inicio)
            window.dispatchEvent(new CustomEvent('user:updated'));
            // Redirigir al perfil
            location.hash = '/perfil';
            // Limpieza
            form.reset();
        }
        catch (err) {
            showToast((err === null || err === void 0 ? void 0 : err.message) || "No se pudo iniciar sesión.", "danger");
        }
        finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerText = "Iniciar Sesión";
            }
        }
    };
    // Listener sincrónico que llama al async
    form.addEventListener('submit', (ev) => {
        void onSubmit(ev);
    }, { signal });
}
export function unmount() { }
//# sourceMappingURL=Acceso.Script.js.map