// Code/ProductoAgregar.Script.ts — ESM TypeScript (Agregar Producto)
// Requiere backend: POST /api/products  body: { name, price, stock, sku?, image?, category?, description? }

declare global { interface Window { bootstrap?: any; __API_BASE__?: string; } }

type ToastType = "success" | "danger" | "warning" | "info";

type NewProductPayload = {
  name: string;
  price: number;
  stock: number;
  sku?: string | null;
  image?: string | null;       // DataURL (opcional)
  category?: string | null;
  description?: string | null;
};

const API_BASE = window.__API_BASE__ || `${location.protocol}//${location.host}`;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

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
  BT ? new BT(el, { delay: 2800, autohide: true }).show()
     : (el.style.display = "block", setTimeout(() => el.remove(), 3200));
}

function parseNumber(v: string, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function validateFields(fields: {
  name: string; price: string; stock: string; category: string;
}): string[] {
  const errors: string[] = [];
  if (!fields.name.trim()) errors.push("El nombre del producto es requerido.");
  const price = parseNumber(fields.price, NaN);
  if (!Number.isFinite(price) || price < 0) errors.push("Precio inválido.");
  const stock = parseNumber(fields.stock, NaN);
  if (!Number.isInteger(stock) || stock < 0) errors.push("Stock inválido.");
  if (!fields.category) errors.push("Selecciona una categoría.");
  return errors;
}

function resetFormState(form: HTMLFormElement, preview: HTMLDivElement, fileInput: HTMLInputElement) {
  form.reset();
  fileInput.value = "";
  preview.style.display = "none";
  preview.innerHTML = "";
}

async function apiCreateProduct(payload: NewProductPayload) {
  const resp = await fetch(`${API_BASE}/api/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    let msg = `HTTP ${resp.status}`;
    try {
      const ct = resp.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const err = await resp.json();
        if (err?.error) msg = err.error;
      } else {
        const txt = await resp.text();
        if (txt) msg = txt;
      }
    } catch {}
    throw new Error(msg);
  }
  return resp.json();
}

export function mount({ container, signal }: { container: HTMLElement; signal: AbortSignal }) {
  const form = container.querySelector<HTMLFormElement>('#form');
  const fileInput = container.querySelector<HTMLInputElement>('#insert-image-product');
  const preview = container.querySelector<HTMLDivElement>('#preview');

  const inpName = container.querySelector<HTMLInputElement>('#name');
  const inpPrice = container.querySelector<HTMLInputElement>('#price');
  const inpStock = container.querySelector<HTMLInputElement>('#stock');
  const selCategory = container.querySelector<HTMLSelectElement>('#category');
  const inpDescription = container.querySelector<HTMLTextAreaElement>('#description');
  // Si luego agregas SKU en el HTML:
  const inpSku = container.querySelector<HTMLInputElement>('#sku');

  if (!form || !fileInput || !preview || !inpName || !inpPrice || !inpStock || !selCategory) {
    console.warn('[ProductoAgregar] faltan elementos obligatorios en el DOM.');
    return;
  }

  // Imagen (opcional) con preview
  preview.style.display = "none";
  preview.innerHTML = "";

  let imageDataUrl: string | null = null;

  fileInput.addEventListener('change', (ev: Event) => {
    const inp = ev.currentTarget as HTMLInputElement;
    const file = inp.files?.[0] ?? null;

    if (!file) {
      imageDataUrl = null;
      preview.style.display = "none";
      preview.innerHTML = "";
      return;
    }
    if (!file.type.startsWith('image/')) {
      showToast('Debe ser una imagen (jpg, png, webp...)', 'warning');
      inp.value = "";
      imageDataUrl = null;
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      showToast('La imagen supera 5MB', 'warning');
      inp.value = "";
      imageDataUrl = null;
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      imageDataUrl = String((e.target as FileReader).result || '');
      preview.style.display = "block";
      preview.innerHTML = `
        <img src="${imageDataUrl}" alt="Vista previa"
             style="max-width:180px;height:auto;border-radius:12px;display:block;box-shadow:0 4px 16px rgba(0,0,0,.2);" />
      `;
      showToast('Imagen cargada correctamente.', 'success');
    };
    reader.readAsDataURL(file);
  }, { signal });

  const submitBtn = form.querySelector<HTMLButtonElement>('button[type="submit"]') || null;

  form.addEventListener('submit', async (ev: SubmitEvent) => {
    ev.preventDefault();

    const fields = {
      name: inpName.value,
      price: inpPrice.value,
      stock: inpStock.value,
      category: selCategory.value || '',
    };
    const errs = validateFields(fields);
    if (errs.length) {
      errs.forEach(m => showToast(m, 'danger'));
      return;
    }

    const payload: NewProductPayload = {
      name: fields.name.trim(),
      price: parseNumber(fields.price, 0),
      stock: parseNumber(fields.stock, 0),
      sku: (inpSku?.value || '').trim() || null,
      image: imageDataUrl || null,
      category: fields.category || null,
      description: (inpDescription?.value || '').trim() || null,
    };

    try {
      if (submitBtn) { submitBtn.disabled = true; submitBtn.innerText = 'Guardando...'; }

      await apiCreateProduct(payload);

      showToast('Producto guardado correctamente.', 'success');
      resetFormState(form, preview, fileInput);
      imageDataUrl = null;

      // Notifica a la app por si hay listados que deben refrescarse
      window.dispatchEvent(new CustomEvent('db:changed'));
    } catch (err: any) {
      showToast(err?.message || 'No se pudo guardar el producto', 'danger');
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = 'Guardar producto'; }
    }
  }, { signal });
}

export function unmount() {
  // no-op (el router usa AbortSignal para limpiar listeners)
}
