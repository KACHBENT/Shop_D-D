// Code/Registrousuario.Script.ts — ESM TypeScript (rol: cliente, backend, avatar OBLIGATORIO)

declare global { interface Window { bootstrap?: any; __API_BASE__?: string; } }

type ToastType = "success" | "danger" | "warning" | "info";

// === Config API base (usa window.__API_BASE__ si existe, si no el host actual) ===
const API_BASE: string =
  (window.__API_BASE__ && window.__API_BASE__!.trim()) ||
  `${location.protocol}//${location.host}`;

// === Tipos/estado ===
interface PersonForm {
  name: string;
  fatherLastname: string;
  motherLastname: string;
  email: string;
}
interface UserState {
  username: string;
  userImage: File | null;
  userImageDataUrl: string | null; // DataURL (OBLIGATORIO)
  userPassword: string;
  person: PersonForm;
}

const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const userState: UserState = {
  username: "",
  userImage: null,
  userImageDataUrl: null,
  userPassword: "",
  person: { name: "", fatherLastname: "", motherLastname: "", email: "" },
};

// === Toasts ===
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
  const BT = (window as any).bootstrap?.Toast;
  BT ? new BT(el, { delay: 3000, autohide: true }).show()
     : (el.style.display = "block", setTimeout(() => el.remove(), 3500));
}

// === Helpers de validación ===
function isImageDataURL(s: unknown): s is string {
  return (
    typeof s === "string" &&
    /^data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+$/.test(s)
  );
}
function validate(): string[] {
  const e: string[] = [];
  if (!userState.person.name.trim()) e.push("El nombre es requerido.");
  if (!userState.person.fatherLastname.trim()) e.push("El apellido paterno es requerido.");
  if (!userState.person.motherLastname.trim()) e.push("El apellido materno es requerido.");
  if (!userState.person.email.trim()) e.push("El correo es requerido.");
  else if (!emailRx.test(userState.person.email)) e.push("El correo no es válido.");
  if (!userState.username.trim()) e.push("El usuario es requerido.");
  if (userState.username.trim().length < 3) e.push("El usuario debe tener al menos 3 caracteres.");
  if (!userState.userPassword) e.push("La contraseña es requerida.");
  if (userState.userPassword.length < 4) e.push("La contraseña debe tener al menos 4 caracteres.");
  if (!userState.userImageDataUrl) e.push("El icono (avatar) de usuario es requerido.");
  else if (!isImageDataURL(userState.userImageDataUrl)) e.push("El icono debe ser un DataURL de imagen válido (data:image/...;base64,...)");
  else {
    // tamaño aproximado
    const approxBytes = Math.floor((userState.userImageDataUrl.length * 3) / 4);
    const MAX_BYTES = 15 * 1024 * 1024;
    if (approxBytes > MAX_BYTES) e.push("El icono excede el tamaño máximo permitido (15MB).");
  }
  return e;
}
function resetState(form: HTMLFormElement, preview: HTMLDivElement, fileInput: HTMLInputElement) {
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
      userPassword: userState.userPassword,      // DEMO (no hasheado)
      avatar: userState.userImageDataUrl,        // requerido y validado arriba
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
        if ((err as any)?.error) msg = (err as any).error;
      } else {
        const txt = await resp.text();
        if (txt) msg = txt;
      }
    } catch {}
    throw new Error(msg);
  }
  return resp.json(); // { person, user }
}

// === Mount / UI ===
export function mount({ container, signal }: { container: HTMLElement; signal: AbortSignal }) {
  const fileInput = container.querySelector<HTMLInputElement>("#insert-image-user");
  const preview = container.querySelector<HTMLDivElement>("#preview");
  const form = container.querySelector<HTMLFormElement>("form#form");
  const fakeButton = container.querySelector<HTMLButtonElement>(".insert-image-user");

  if (!fileInput || !preview || !form) {
    console.warn("[registro] faltan elementos");
    return;
  }
  if (fakeButton) fakeButton.type = "button";

  // Vista previa (avatar obligatorio)
  preview.style.display = "none";
  preview.innerHTML = "";
  fileInput.addEventListener(
    "change",
    (ev: Event) => {
      const inp = ev.currentTarget as HTMLInputElement;
      const file = inp.files?.[0] ?? null;
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
        const result = (e.target as FileReader).result as string;
        userState.userImageDataUrl = result;
        preview.style.display = "block";
        preview.innerHTML = `<img src="${result}" alt="Vista previa"
          style="max-width:180px;height:auto;border-radius:12px;display:block;box-shadow:0 4px 16px rgba(0,0,0,.2);" />`;
        showToast("Imagen cargada correctamente.", "success");
      };
      reader.readAsDataURL(file);
    },
    { signal }
  );

  // Mapeo inputs -> estado
  const handlers = new Map<string, (v: string) => void>([
    ["name", (v) => (userState.person.name = v.trim())],
    ["fatherlastname", (v) => (userState.person.fatherLastname = v.trim())],
    ["motherlastname", (v) => (userState.person.motherLastname = v.trim())],
    ["email", (v) => (userState.person.email = v.trim())],
    ["username", (v) => (userState.username = v.trim())],
    ["password", (v) => (userState.userPassword = v)],
  ]);
  container.addEventListener(
    "input",
    (ev: Event) => {
      const t = ev.target as HTMLInputElement;
      const h = t?.id && handlers.get(t.id);
      if (h) h(t.value);
    },
    { signal }
  );

  // Submit -> POST /api/users/register
  const submitBtn = form.querySelector<HTMLButtonElement>('button[type="submit"]') || null;
  form.addEventListener(
    "submit",
    async (ev: SubmitEvent) => {
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
      } catch (err: any) {
        showToast(err?.message || "No se pudo registrar", "danger");
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerText = "Registrarse";
        }
      }
    },
    { signal }
  );
}

export function unmount() { /* no-op */ }
