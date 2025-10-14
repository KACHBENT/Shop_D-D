// Code/Registrousuario.Script.ts — ESM TypeScript (rol: cliente, backend, avatar OBLIGATORIO)
// === Config API base (usa window.__API_BASE__ si existe, si no el host actual) ===
const API_BASE = (window.__API_BASE__ && window.__API_BASE__.trim()) ||
    `${location.protocol}//${location.host}`;
const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const userState = {
    username: "",
    userImage: null,
    userImageDataUrl: null,
    userPassword: "",
    person: { name: "", fatherLastname: "", motherLastname: "", email: "" },
};
// === Toasts ===
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
// === Helpers de validación ===
function isImageDataURL(s) {
    return (typeof s === "string" &&
        /^data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+$/.test(s));
}
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
    if (userState.username.trim().length < 3)
        e.push("El usuario debe tener al menos 3 caracteres.");
    if (!userState.userPassword)
        e.push("La contraseña es requerida.");
    if (userState.userPassword.length < 4)
        e.push("La contraseña debe tener al menos 4 caracteres.");
    if (!userState.userImageDataUrl)
        e.push("El icono (avatar) de usuario es requerido.");
    else if (!isImageDataURL(userState.userImageDataUrl))
        e.push("El icono debe ser un DataURL de imagen válido (data:image/...;base64,...)");
    else {
        // tamaño aproximado
        const approxBytes = Math.floor((userState.userImageDataUrl.length * 3) / 4);
        const MAX_BYTES = 15 * 1024 * 1024;
        if (approxBytes > MAX_BYTES)
            e.push("El icono excede el tamaño máximo permitido (15MB).");
    }
    return e;
}
function resetState(form, preview, fileInput) {
    form.reset();
    fileInput.value = "";
    preview.style.display = "none";
    preview.innerHTML = "";
    Object.assign(userState, {
        username: "",
        userImage: null,
        userImageDataUrl: null,
        userPassword: "",
        person: { name: "", fatherLastname: "", motherLastname: "", email: "" },
    });
}
// === API ===
async function apiRegister() {
    const payload = {
        person: {
            name: userState.person.name.trim(),
            fatherLastname: userState.person.fatherLastname.trim(),
            motherLastname: userState.person.motherLastname.trim(),
            email: userState.person.email.trim(),
        },
        user: {
            username: userState.username.trim(),
            userPassword: userState.userPassword, // DEMO (no hasheado)
            avatar: userState.userImageDataUrl, // requerido y validado arriba
            role: "cliente",
        },
    };
    const resp = await fetch(`${API_BASE}/api/users/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
    });
    if (!resp.ok) {
        let msg = `HTTP ${resp.status}`;
        try {
            const contentType = resp.headers.get("content-type") || "";
            if (contentType.includes("application/json")) {
                const err = await resp.json();
                if (err === null || err === void 0 ? void 0 : err.error)
                    msg = err.error;
            }
            else {
                const txt = await resp.text();
                if (txt)
                    msg = txt;
            }
        }
        catch (_a) { }
        throw new Error(msg);
    }
    return resp.json(); // { person, user }
}
// === Mount / UI ===
export function mount({ container, signal }) {
    const fileInput = container.querySelector("#insert-image-user");
    const preview = container.querySelector("#preview");
    const form = container.querySelector("form#form");
    const fakeButton = container.querySelector(".insert-image-user");
    if (!fileInput || !preview || !form) {
        console.warn("[registro] faltan elementos");
        return;
    }
    if (fakeButton)
        fakeButton.type = "button";
    // Vista previa (avatar obligatorio)
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
        reader.onload = (e) => {
            const result = e.target.result;
            userState.userImageDataUrl = result;
            preview.style.display = "block";
            preview.innerHTML = `<img src="${result}" alt="Vista previa"
          style="max-width:180px;height:auto;border-radius:12px;display:block;box-shadow:0 4px 16px rgba(0,0,0,.2);" />`;
            showToast("Imagen cargada correctamente.", "success");
        };
        reader.readAsDataURL(file);
    }, { signal });
    // Mapeo inputs -> estado
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
    // Submit -> POST /api/users/register
    const submitBtn = form.querySelector('button[type="submit"]') || null;
    form.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const errors = validate();
        if (errors.length) {
            errors.forEach((m) => showToast(m, "danger"));
            return;
        }
        try {
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerText = "Registrando...";
            }
            await apiRegister();
            showToast("¡¡Usuario registrado con éxito!!", "success");
            resetState(form, preview, fileInput);
            window.dispatchEvent(new CustomEvent("db:changed"));
            // location.hash = '/acceso'; // si quieres redirigir
        }
        catch (err) {
            showToast((err === null || err === void 0 ? void 0 : err.message) || "No se pudo registrar", "danger");
        }
        finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerText = "Registrarse";
            }
        }
    }, { signal });
}
export function unmount() { }
//# sourceMappingURL=Registrousuario.Script.js.map