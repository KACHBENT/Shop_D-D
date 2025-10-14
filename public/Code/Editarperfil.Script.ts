// Code/EditarPerfil.Script.ts — TypeScript (ESM)
// Actualiza Persona y Usuario contra el backend (server.js) que guarda en db/store.json

declare global { interface Window { bootstrap?: any; } }
const API_BASE = (window as any).__API_BASE__ || 'http://localhost:3000';
type ToastType = "success" | "danger" | "warning" | "info";
const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SS_SESSION = 'currentUserId';

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
  const bg = { success:"bg-success text-white", danger:"bg-danger text-white", warning:"bg-warning", info:"bg-info" }[type];
  const el = document.createElement("div");
  el.className = `toast align-items-center border-0 mb-2 ${bg}`;
  el.setAttribute("role","alert"); el.setAttribute("aria-live","assertive"); el.setAttribute("aria-atomic","true");
  el.innerHTML = `<div class="d-flex"><div class="toast-body">${msg}</div>
    <button type="button" class="btn-close ${type==='warning'||type==='info'?'':'btn-close-white'} me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
  c.appendChild(el);
  const BT = window.bootstrap?.Toast;
  BT ? new BT(el, { delay: 3000, autohide: true }).show()
     : (el.style.display="block", setTimeout(()=>el.remove(), 3500));
}

// ---------- Helpers de red ----------
async function apiGet<T = any>(url: string): Promise<T> {
  const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!r.ok) throw new Error(await r.text().catch(()=>'Error '+r.status));
  return r.json();
}
async function apiPut<T = any>(url: string, body: any): Promise<T> {
  const r = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(await r.text().catch(()=>'Error '+r.status));
  return r.json();
}

function getCurrentUserId(): string | null {
  return sessionStorage.getItem(SS_SESSION);
}

function validate(fields: {
  name: string; father: string; mother: string; email: string;
  username: string; password: string;
}) {
  const errors: string[] = [];
  if (!fields.name.trim()) errors.push("El nombre es requerido.");
  if (!fields.father.trim()) errors.push("El apellido paterno es requerido.");
  if (!fields.mother.trim()) errors.push("El apellido materno es requerido.");
  if (!fields.email.trim()) errors.push("El correo es requerido.");
  else if (!emailRx.test(fields.email)) errors.push("El correo no es válido.");
  if (!fields.username.trim()) errors.push("El usuario es requerido.");
  if (!fields.password) errors.push("La contraseña es requerida.");
  return errors;
}

// ---------- Tipos mínimos que esperamos del backend ----------
type Role = 'cliente' | 'administrador' | 'proveedor';
interface DBUser {
  id: string;
  username: string;
  userPassword: string;
  personId: string;
  avatar: string | null;
  role: Role;
  createdAt: string;
}
interface DBPerson {
  id: string;
  name: string;
  fatherLastname: string;
  motherLastname: string;
  email: string;
  createdAt: string;
}

// ---------- Mount ----------
export function mount({ container, signal }: { container: HTMLElement; signal: AbortSignal }) {
  const form = container.querySelector<HTMLFormElement>('form#form');
  const fileInput = container.querySelector<HTMLInputElement>('#insert-image-user');
  const preview = container.querySelector<HTMLDivElement>('#preview');

  const inpName = container.querySelector<HTMLInputElement>('#name');
  const inpFather = container.querySelector<HTMLInputElement>('#fatherlastname');
  const inpMother = container.querySelector<HTMLInputElement>('#motherlastname');
  const inpEmail = container.querySelector<HTMLInputElement>('#email');
  const inpUsername = container.querySelector<HTMLInputElement>('#username');
  const inpPassword = container.querySelector<HTMLInputElement>('#password');

  if (!form || !inpName || !inpFather || !inpMother || !inpEmail || !inpUsername || !inpPassword || !fileInput || !preview) {
    console.warn("[editar-perfil] faltan elementos en el DOM");
    return;
  }
  inpPassword.type = "password";

  const uid = getCurrentUserId();
  if (!uid) { showToast('No hay sesión activa', 'danger'); location.hash = '/acceso'; return; }

  // Cargar datos actuales del backend
  let current: { user: DBUser; person: DBPerson };
  (async () => {
    try {
      const data = await apiGet<{ user: DBUser; person: DBPerson }>(`/api/users/${encodeURIComponent(uid)}`);

      current = data;

      // Precargar UI
      inpName.value = data.person.name;
      inpFather.value = data.person.fatherLastname;
      inpMother.value = data.person.motherLastname;
      inpEmail.value = data.person.email;
      inpUsername.value = data.user.username;
      inpPassword.value = data.user.userPassword; // DEMO: en prod NO precargar

      if (data.user.avatar) {
        preview.style.display = "block";
        preview.innerHTML = `<img src="${data.user.avatar}" alt="Vista previa"
          style="max-width:180px;height:auto;border-radius:12px;display:block;box-shadow:0 4px 16px rgba(0,0,0,.2);" />`;
      } else {
        preview.style.display = "none";
        preview.innerHTML = "";
      }
    } catch (e:any) {
      showToast(e?.message || 'No se pudo cargar el perfil', 'danger');
      location.hash = '/acceso';
    }
  })();

  // Cambiar avatar (opcional)
  fileInput.addEventListener('change', (ev: Event) => {
    const inp = ev.currentTarget as HTMLInputElement;
    const file = inp.files?.[0] ?? null;
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast("El archivo debe ser una imagen (jpg, png, webp...)", "warning");
      inp.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast("La imagen supera el tamaño máximo de 5MB.", "warning");
      inp.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      const result = (e.target as FileReader).result as string;
      preview.style.display = "block";
      preview.innerHTML = `<img src="${result}" alt="Vista previa"
        style="max-width:180px;height:auto;border-radius:12px;display:block;box-shadow:0 4px 16px rgba(0,0,0,.2);" />`;
      preview.dataset.newAvatar = result; // temporal para guardar al submit
      showToast("Nueva imagen cargada.", "success");
    };
    reader.readAsDataURL(file);
  }, { signal });

  // Guardar cambios: PUT /api/persons/:id + PUT /api/users/:id
  form.addEventListener('submit', async (ev: SubmitEvent) => {
    ev.preventDefault();

    const fields = {
      name: inpName.value,
      father: inpFather.value,
      mother: inpMother.value,
      email: inpEmail.value,
      username: inpUsername.value,
      password: inpPassword.value,
    };
    const errors = validate(fields);
    if (errors.length) { errors.forEach(m => showToast(m, "danger")); return; }

    try {
      // 1) Actualizar persona
      await apiPut(`${API_BASE}/api/persons/${encodeURIComponent(current.person.id)}`, {
        name: fields.name.trim(),
        fatherLastname: fields.father.trim(),
        motherLastname: fields.mother.trim(),
        email: fields.email.trim(),
      });

      // 2) Actualizar usuario
      const avatar = preview.dataset.newAvatar ?? current.user.avatar ?? null;
      await apiPut(`${API_BASE}/api/users/${encodeURIComponent(current.user.id)}`, {
        username: fields.username.trim(),
        userPassword: fields.password, // DEMO
        avatar
      });

      // Refrescar caches/navbar
      window.dispatchEvent(new CustomEvent('user:updated'));
      delete preview.dataset.newAvatar;

      // Opcional: volver a cargar para sincronizar UI
      try {
        const data = await apiGet<{ user: DBUser; person: DBPerson }>(`/api/users/${encodeURIComponent(uid)}`);
        current = data;
      } catch {}

      showToast("¡¡Datos actualizados correctamente!!", "success");

    } catch (err: any) {
      // Intenta leer JSON de error si viene del server
      let msg = err?.message || 'No se pudo actualizar';
      try {
        const o = JSON.parse(String(msg));
        msg = o?.error || msg;
      } catch {}
      showToast(msg, 'danger');
    }
  }, { signal });
}

export function unmount() { /* no-op */ }
