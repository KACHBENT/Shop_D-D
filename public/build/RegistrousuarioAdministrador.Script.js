// Code/RegistrousuarioAdministrador.Script.ts — ESM TypeScript (roles + backend)
/*
  Requiere endpoint en el servidor:
  POST /api/users/register
  body: {
    person: { name, fatherLastname, motherLastname, email },
    user:   { username, userPassword, avatar, role }
  }
  -> 200/201: { person, user }
     409 si username/email duplicados, etc.
*/
const API_BASE = window.__API_BASE__ || 'http://localhost:3000';
const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const userState = {
    username: "",
    userImage: null,
    userImageDataUrl: null,
    userPassword: "",
    role: "",
    person: { name: "", fatherLastname: "", motherLastname: "", email: "" },
};
// ---------- Toasts ----------
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
    const bg = { success: "bg-success text-white", danger: "bg-danger text-white", warning: "bg-warning", info: "bg-info" }[type];
    el.className = `toast align-items-center border-0 mb-2 ${bg}`;
    el.setAttribute("role", "alert");
    el.setAttribute("aria-live", "assertive");
    el.setAttribute("aria-atomic", "true");
    el.innerHTML = `<div class="d-flex"><div class="toast-body">${msg}</div>
    <button type="button" class="btn-close ${type === 'warning' || type === 'info' ? '' : 'btn-close-white'} me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
    c.appendChild(el);
    const BT = (_a = window.bootstrap) === null || _a === void 0 ? void 0 : _a.Toast;
    BT ? new BT(el, { delay: 3000, autohide: true }).show()
        : (el.style.display = "block", setTimeout(() => el.remove(), 3500));
}
// ---------- Validación ----------
function validate() {
    const e = [];
    if (!userState.person.name.trim())
        e.push("El nombre es requerido.");
    if (!userState.person.fatherLastname.trim())
        e.push("El apellido paterno es requerido.");
    if (!userState.person.motherLastname.trim())
        e.push("El apellido materno es requerido.");
    if (!userState.person.email.trim())
        e.push("El correo es requerido.");
    else if (!emailRx.test(userState.person.email))
        e.push("El correo no es válido.");
    if (!userState.username.trim())
        e.push("El usuario es requerido.");
    if (!userState.userPassword)
        e.push("La contraseña es requerida.");
    if (!userState.userImageDataUrl)
        e.push("El icono de usuario es requerido.");
    if (!userState.role)
        e.push("El rol es requerido.");
    return e;
}
// ---------- Helpers ----------
function resetState(form, preview, roleSelect) {
    form.reset();
    roleSelect.value = "";
    preview.style.display = "none";
    preview.innerHTML = "";
    Object.assign(userState, {
        username: "",
        userImage: null,
        userImageDataUrl: null,
        userPassword: "",
        role: "",
        person: { name: "", fatherLastname: "", motherLastname: "", email: "" },
    });
}
async function apiRegister() {
    const payload = {
        person: {
            name: userState.person.name,
            fatherLastname: userState.person.fatherLastname,
            motherLastname: userState.person.motherLastname,
            email: userState.person.email,
        },
        user: {
            username: userState.username,
            userPassword: userState.userPassword,
            avatar: userState.userImageDataUrl, // DataURL
            role: userState.role,
        }
    };
    const resp = await fetch(`${API_BASE}/api/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!resp.ok) {
        let msg = `HTTP ${resp.status}`;
        try {
            const err = await resp.json();
            if (err === null || err === void 0 ? void 0 : err.error)
                msg = err.error;
        }
        catch (_a) { }
        throw new Error(msg);
    }
    return resp.json();
}
// ---------- Mount ----------
export function mount({ container, signal }) {
    const fileInput = container.querySelector("#insert-image-user");
    const preview = container.querySelector("#preview");
    const form = container.querySelector("form#form");
    const fakeButton = container.querySelector(".insert-image-user");
    const roleSelect = container.querySelector("#role");
    if (!fileInput || !preview || !form || !roleSelect) {
        console.warn("[registro-admin] faltan elementos");
        return;
    }
    if (fakeButton)
        fakeButton.type = "button";
    // Vista previa
    preview.style.display = "none";
    preview.innerHTML = "";
    fileInput.addEventListener("change", (ev) => {
        var _a, _b;
        const inp = ev.currentTarget;
        const file = (_b = (_a = inp.files) === null || _a === void 0 ? void 0 : _a[0]) !== null && _b !== void 0 ? _b : null;
        if (!file) {
            preview.style.display = "none";
            preview.innerHTML = "";
            userState.userImage = null;
            userState.userImageDataUrl = null;
            return;
        }
        if (!file.type.startsWith("image/")) {
            showToast("Debe ser una imagen (jpg, png, webp...)", "warning");
            inp.value = "";
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            showToast("La imagen supera 5MB", "warning");
            inp.value = "";
            return;
        }
        userState.userImage = file;
        const reader = new FileReader();
        reader.onload = e => {
            const result = e.target.result;
            userState.userImageDataUrl = result;
            preview.style.display = "block";
            preview.innerHTML = `<img src="${result}" alt="Vista previa"
        style="max-width:180px;height:auto;border-radius:12px;display:block;box-shadow:0 4px 16px rgba(0,0,0,.2);" />`;
            showToast("Imagen cargada correctamente.", "success");
        };
        reader.readAsDataURL(file);
    }, { signal });
    // Map inputs
    const handlers = new Map([
        ["name", (v) => (userState.person.name = v.trim())],
        ["fatherlastname", (v) => (userState.person.fatherLastname = v.trim())],
        ["motherlastname", (v) => (userState.person.motherLastname = v.trim())],
        ["email", (v) => (userState.person.email = v.trim())],
        ["username", (v) => (userState.username = v.trim())],
        ["password", (v) => (userState.userPassword = v)],
    ]);
    container.addEventListener("input", (ev) => {
        const t = ev.target;
        const h = (t === null || t === void 0 ? void 0 : t.id) && handlers.get(t.id);
        if (h)
            h(t.value);
    }, { signal });
    // Rol
    roleSelect.addEventListener("change", () => {
        const v = roleSelect.value;
        userState.role = (v === "cliente" || v === "administrador" || v === "proveedor") ? v : "";
    }, { signal });
    // Submit -> POST /api/users/register
    const submitBtn = form.querySelector('button[type="submit"]') || null;
    form.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const errors = validate();
        if (errors.length) {
            errors.forEach(m => showToast(m, "danger"));
            return;
        }
        try {
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerText = 'Registrando...';
            }
            await apiRegister();
            showToast("¡¡Usuario (admin) registrado con éxito!!", "success");
            resetState(form, preview, roleSelect);
            // Notificar a otras vistas (listados/admin)
            window.dispatchEvent(new CustomEvent('db:changed'));
        }
        catch (err) {
            showToast((err === null || err === void 0 ? void 0 : err.message) || 'No se pudo registrar', 'danger');
        }
        finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerText = 'Registrar';
            }
        }
    }, { signal });
}
export function unmount() { }
//# sourceMappingURL=RegistrousuarioAdministrador.Script.js.map