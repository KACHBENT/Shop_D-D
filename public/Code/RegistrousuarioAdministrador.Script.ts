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

declare global { interface Window { bootstrap?: any; } }

type ToastType = "success" | "danger" | "warning" | "info";
type Role = "cliente" | "administrador" | "proveedor";

interface PersonForm {
  name: string;
  fatherLastname: string;
  motherLastname: string;
  email: string;
}
interface UserState {
  username: string;
  userImage: File | null;
  userImageDataUrl: string | null; // DataURL
  userPassword: string;
  person: PersonForm;
  role: Role | "";
}
const API_BASE = (window as any).__API_BASE__ || 'http://localhost:3000';
const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const userState: UserState = {
  username: "",
  userImage: null,
  userImageDataUrl: null,
  userPassword: "",
  role: "",
  person: { name: "", fatherLastname: "", motherLastname: "", email: "" },
};

// ---------- Toasts ----------
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
  const bg = { success:"bg-success text-white", danger:"bg-danger text-white", warning:"bg-warning", info:"bg-info" }[type];
  el.className = `toast align-items-center border-0 mb-2 ${bg}`;
  el.setAttribute("role","alert"); el.setAttribute("aria-live","assertive"); el.setAttribute("aria-atomic","true");
  el.innerHTML = `<div class="d-flex"><div class="toast-body">${msg}</div>
    <button type="button" class="btn-close ${type==='warning'||type==='info'?'':'btn-close-white'} me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
  c.appendChild(el);
  const BT = window.bootstrap?.Toast;
  BT ? new BT(el, { delay: 3000, autohide: true }).show()
     : (el.style.display="block", setTimeout(() => el.remove(), 3500));
}

// ---------- Validación ----------
function validate(): string[] {
  const e: string[] = [];
  if (!userState.person.name.trim()) e.push("El nombre es requerido.");
  if (!userState.person.fatherLastname.trim()) e.push("El apellido paterno es requerido.");
  if (!userState.person.motherLastname.trim()) e.push("El apellido materno es requerido.");
  if (!userState.person.email.trim()) e.push("El correo es requerido.");
  else if (!emailRx.test(userState.person.email)) e.push("El correo no es válido.");
  if (!userState.username.trim()) e.push("El usuario es requerido.");
  if (!userState.userPassword) e.push("La contraseña es requerida.");
  if (!userState.userImageDataUrl) e.push("El icono de usuario es requerido.");
  if (!userState.role) e.push("El rol es requerido.");
  return e;
}

// ---------- Helpers ----------
function resetState(form: HTMLFormElement, preview: HTMLDivElement, roleSelect: HTMLSelectElement) {
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
      role: userState.role as Role,
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
      if (err?.error) msg = err.error;
    } catch {}
    throw new Error(msg);
  }
  return resp.json();
}

// ---------- Mount ----------
export function mount({ container, signal }: { container: HTMLElement; signal: AbortSignal }) {
  const fileInput  = container.querySelector<HTMLInputElement>("#insert-image-user");
  const preview    = container.querySelector<HTMLDivElement>("#preview");
  const form       = container.querySelector<HTMLFormElement>("form#form");
  const fakeButton = container.querySelector<HTMLButtonElement>(".insert-image-user");
  const roleSelect = container.querySelector<HTMLSelectElement>("#role");

  if (!fileInput || !preview || !form || !roleSelect) { console.warn("[registro-admin] faltan elementos"); return; }
  if (fakeButton) fakeButton.type = "button";

  // Vista previa
  preview.style.display = "none";
  preview.innerHTML = "";
  fileInput.addEventListener("change", (ev: Event) => {
    const inp = ev.currentTarget as HTMLInputElement;
    const file = inp.files?.[0] ?? null;
    if (!file) { preview.style.display="none"; preview.innerHTML=""; userState.userImage=null; userState.userImageDataUrl=null; return; }
    if (!file.type.startsWith("image/")) { showToast("Debe ser una imagen (jpg, png, webp...)", "warning"); inp.value=""; return; }
    if (file.size > 5*1024*1024) { showToast("La imagen supera 5MB", "warning"); inp.value=""; return; }
    userState.userImage = file;
    const reader = new FileReader();
    reader.onload = e => {
      const result = (e.target as FileReader).result as string;
      userState.userImageDataUrl = result;
      preview.style.display = "block";
      preview.innerHTML = `<img src="${result}" alt="Vista previa"
        style="max-width:180px;height:auto;border-radius:12px;display:block;box-shadow:0 4px 16px rgba(0,0,0,.2);" />`;
      showToast("Imagen cargada correctamente.", "success");
    };
    reader.readAsDataURL(file);
  }, { signal });

  // Map inputs
  const handlers = new Map<string, (v: string) => void>([
    ["name", (v) => (userState.person.name = v.trim())],
    ["fatherlastname", (v) => (userState.person.fatherLastname = v.trim())],
    ["motherlastname", (v) => (userState.person.motherLastname = v.trim())],
    ["email", (v) => (userState.person.email = v.trim())],
    ["username", (v) => (userState.username = v.trim())],
    ["password", (v) => (userState.userPassword = v)],
  ]);
  container.addEventListener("input", (ev: Event) => {
    const t = ev.target as HTMLInputElement;
    const h = t?.id && handlers.get(t.id);
    if (h) h(t.value);
  }, { signal });

  // Rol
  roleSelect.addEventListener("change", () => {
    const v = roleSelect.value as Role;
    userState.role = (v === "cliente" || v === "administrador" || v === "proveedor") ? v : "";
  }, { signal });

  // Submit -> POST /api/users/register
  const submitBtn = form.querySelector<HTMLButtonElement>('button[type="submit"]') || null;
  form.addEventListener("submit", async (ev: SubmitEvent) => {
    ev.preventDefault();

    const errors = validate();
    if (errors.length) { errors.forEach(m => showToast(m, "danger")); return; }

    try {
      if (submitBtn) { submitBtn.disabled = true; submitBtn.innerText = 'Registrando...'; }

      await apiRegister();

      showToast("¡¡Usuario (admin) registrado con éxito!!", "success");
      resetState(form, preview, roleSelect);

      // Notificar a otras vistas (listados/admin)
      window.dispatchEvent(new CustomEvent('db:changed'));

    } catch (err: any) {
      showToast(err?.message || 'No se pudo registrar', 'danger');
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = 'Registrar'; }
    }
  }, { signal });
}

export function unmount() {}
