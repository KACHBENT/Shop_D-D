// public/Code/Productos.Script.ts — Grid con filtros + modal de cantidad + carrito (LS)

import { isAuthenticated } from './Auth.Script.js';

type Product = {
  id: string;
  name: string;
  price: number;
  stock: number;
  sku?: string | null;
  image?: string | null;
  category?: string | null;
  description?: string | null;
  createdAt?: string;
};

type CartItem = { id: string; name: string; price: number; qty: number; image?: string | null };

const API_BASE: string = (window as any).__API_BASE__ || `${location.protocol}//${location.host}`;
const DEFAULT_IMG = '../Image/placeholder.webp';
const LS_CART = 'cart';

/* =========================
   Helpers
========================= */
function qs<T extends Element = Element>(root: ParentNode, sel: string): T | null {
  return root.querySelector(sel) as T | null;
}
function show(el: HTMLElement) { el.classList.remove('d-none'); }
function hide(el: HTMLElement) { el.classList.add('d-none'); }
function money(n: number) { return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }); }

function ensureToast(): HTMLElement {
  let c = document.getElementById('toast-container') as HTMLElement | null;
  if (!c) {
    c = document.createElement('div');
    c.id = 'toast-container';
    c.className = 'toast-container position-fixed top-0 end-0 p-3';
    (c.style as any).zIndex = '1080';
    document.body.appendChild(c);
  }
  return c;
}
function toast(msg: string, type: 'success' | 'danger' | 'warning' | 'info' = 'info') {
  const c = ensureToast();
  const el = document.createElement('div');
  const bg: Record<string, string> = {
    success: 'bg-success text-white',
    danger: 'bg-danger text-white',
    warning: 'bg-warning',
    info: 'bg-info',
  };
  el.className = `toast align-items-center border-0 mb-2 ${bg[type]}`;
  el.setAttribute('role', 'alert');
  el.setAttribute('aria-live', 'assertive');
  el.setAttribute('aria-atomic', 'true');
  el.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">${msg}</div>
      <button type="button" class="btn-close ${type === 'warning' || type === 'info' ? '' : 'btn-close-white'} me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>
  `;
  c.appendChild(el);
  const BT = (window as any).bootstrap?.Toast;
  if (BT) new BT(el, { delay: 2500, autohide: true }).show();
  else { (el.style as any).display = 'block'; setTimeout(() => el.remove(), 2800); }
}

/* =========================
   Carrito (localStorage)
========================= */
function getCart(): CartItem[] {
  try { return JSON.parse(localStorage.getItem(LS_CART) || '[]'); } catch { return []; }
}
function saveCart(items: CartItem[]) {
  localStorage.setItem(LS_CART, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent('cart:changed'));
}
function addToCart(p: Product, qty: number) {
  const items = getCart();
  const i = items.findIndex(x => x.id === p.id);
  if (i === -1) items.push({ id: p.id, name: p.name, price: p.price, qty, image: p.image || null });
  else items[i].qty = Math.max(1, items[i].qty + qty);
  saveCart(items);
}

/* =========================
   API
========================= */
async function fetchProducts(params: URLSearchParams): Promise<Product[]> {
  const url = `${API_BASE}/api/products?${params.toString()}`;
  const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json() as Promise<Product[]>;
}

/* =========================
   Modal de cantidad (reutilizable)
========================= */
function ensureQtyModal(): {
  el: HTMLElement,
  open: (product: Product, mode: 'add' | 'buy') => void
} {
  let maybe = document.getElementById('qtyModal') as HTMLElement | null;
  if (!maybe) {
    maybe = document.createElement('div');
    maybe.id = 'qtyModal';
    maybe.className = 'modal fade';
    maybe.setAttribute('tabindex', '-1');
    maybe.innerHTML = `
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content rounded-4">
          <div class="modal-header linea-contenedor">
            <h5 class="modal-title d-flex align-items-center gap-2">
              <img src="../Image/Icons/inventory2.svg" width="22" height="22" alt="" class="icon-head">
              <span id="qm-title">Producto</span>
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
          </div>
          <div class="modal-body">
            <div class="d-flex gap-3">
              <img id="qm-img" src="" alt="" style="width:96px;height:96px;object-fit:cover;border-radius:12px;">
              <div class="flex-grow-1">
                <p id="qm-desc" class="small text-muted mb-1"></p>
                <div class="d-flex justify-content-between">
                  <span id="qm-price" class="fw-semibold"></span>
                  <span id="qm-stock" class="badge text-bg-light"></span>
                </div>
              </div>
            </div>
            <div class="mt-3">
              <label class="form-label small">Cantidad</label>
              <input id="qm-qty" type="number" class="form-control" min="1" step="1" value="1">
            </div>
          </div>
          <div class="modal-footer">
            <button id="qm-add" type="button" class="btn btn-outline-primary">Añadir al carrito</button>
            <button id="qm-buy" type="button" class="btn btn-primary">Comprar ahora</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(maybe);
  }
  const root = maybe as HTMLElement;

  let current: Product | null = null;

  const title = root.querySelector<HTMLSpanElement>('#qm-title')!;
  const img   = root.querySelector<HTMLImageElement>('#qm-img')!;
  const desc  = root.querySelector<HTMLParagraphElement>('#qm-desc')!;
  const price = root.querySelector<HTMLSpanElement>('#qm-price')!;
  const stock = root.querySelector<HTMLSpanElement>('#qm-stock')!;
  const qty   = root.querySelector<HTMLInputElement>('#qm-qty')!;
  const btnAdd= root.querySelector<HTMLButtonElement>('#qm-add')!;
  const btnBuy= root.querySelector<HTMLButtonElement>('#qm-buy')!;

  const BT = (window as any).bootstrap?.Modal;
  let modalInst: any = BT ? new BT(root) : null;

  function open(product: Product, mode: 'add' | 'buy') {
    current = product;
    title.textContent = product.name;
    img.src = product.image || DEFAULT_IMG;
    img.alt = product.name;
    desc.textContent = product.description || '';
    price.textContent = money(product.price);
    stock.textContent = product.stock > 0 ? `Stock: ${product.stock}` : 'Agotado';

    qty.value = '1';
    qty.max = product.stock > 0 ? String(product.stock) : '1';
    btnAdd.disabled = product.stock <= 0;
    btnBuy.disabled = product.stock <= 0;
    btnBuy.dataset.mode = mode; // 'add' | 'buy'

    if (modalInst) modalInst.show();
    else root.style.display = 'block';
  }

  if (!(root as any).__bound) {
    btnAdd.addEventListener('click', () => {
      if (!current) return;
      const n = Math.max(1, Math.min(Number(qty.value) || 1, current.stock || 1));
      addToCart(current, n);
      toast('Producto añadido al carrito', 'success');
      if (modalInst) modalInst.hide(); else root.style.display = 'none';
    });

    btnBuy.addEventListener('click', () => {
      if (!current) return;
      const n = Math.max(1, Math.min(Number(qty.value) || 1, current.stock || 1));
      addToCart(current, n);
      if (modalInst) modalInst.hide(); else root.style.display = 'none';
      location.hash = '/carrito';
    });

    (root as any).__bound = true;
  }

  return { el: root, open };
}

/* =========================
   UI: Cards y Skeleton
========================= */
function productCard(p: Product): string {
  const img = p.image || DEFAULT_IMG;
  const cat = p.category ? `<span class="badge text-bg-light">${p.category}</span>` : '';
  const stockBadge = p.stock > 0
    ? `<span class="badge bg-success badge-stock">En stock: ${p.stock}</span>`
    : `<span class="badge bg-secondary badge-stock">Agotado</span>`;
  const disabled = p.stock <= 0 ? 'disabled' : '';

  return `
    <div class="col-12 col-sm-6 col-lg-4 col-xl-3">
      <div class="card product-card h-100">
        <img src="${img}" alt="${p.name}" class="product-thumb">
        <div class="card-body d-flex flex-column">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <h6 class="product-title mb-0">${p.name}</h6>
            ${cat}
          </div>
          <p class="text-muted small flex-grow-1">${p.description ? p.description : ''}</p>
          <div class="d-flex justify-content-between align-items-center">
            <span class="product-price">${money(p.price)}</span>
            ${stockBadge}
          </div>
          <div class="d-grid gap-2 mt-3">
            <button class="btn btn-outline-primary btn-add" data-id="${p.id}" ${disabled}>Añadir al carrito</button>
            <button class="btn btn-primary btn-buy" data-id="${p.id}" ${disabled}>Comprar ahora</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderSkeleton(grid: HTMLElement, n = 8) {
  grid.innerHTML = Array.from({ length: n }).map(() => `
    <div class="col-12 col-sm-6 col-lg-4 col-xl-3">
      <div class="card product-card h-100">
        <div class="skeleton" style="width:100%;aspect-ratio:1/1;"></div>
        <div class="card-body">
          <div class="skeleton" style="height:18px;width:70%;border-radius:6px;"></div>
          <div class="skeleton mt-2" style="height:12px;width:100%;border-radius:6px;"></div>
          <div class="skeleton mt-1" style="height:12px;width:80%;border-radius:6px;"></div>
          <div class="d-flex justify-content-between align-items-center mt-3">
            <div class="skeleton" style="height:18px;width:90px;border-radius:6px;"></div>
            <div class="skeleton" style="height:18px;width:80px;border-radius:6px;"></div>
          </div>
          <div class="skeleton mt-3" style="height:38px;width:100%;border-radius:10px;"></div>
          <div class="skeleton mt-2" style="height:38px;width:100%;border-radius:10px;"></div>
        </div>
      </div>
    </div>
  `).join('');
}

/* =========================
   Mount / Unmount
========================= */
export function mount({ container, signal }: { container: HTMLElement; signal: AbortSignal }) {
  const page      = qs<HTMLElement>(container, '#productos-page');
  if (!page) return;

  const form      = qs<HTMLFormElement>(page, '#filters')!;
  const grid      = qs<HTMLElement>(page, '#grid')!;
  const state     = qs<HTMLElement>(page, '#state')!;
  const q         = qs<HTMLInputElement>(page, '#q')!;
  const category  = qs<HTMLSelectElement>(page, '#category')!;
  const minPrice  = qs<HTMLInputElement>(page, '#minPrice')!;
  const maxPrice  = qs<HTMLInputElement>(page, '#maxPrice')!;

  const modal = ensureQtyModal();

  async function load() {
    hide(state);
    renderSkeleton(grid);

    const params = new URLSearchParams();
    if (q.value.trim())   params.set('q', q.value.trim());
    if (category.value)   params.set('category', category.value);
    if (minPrice.value)   params.set('minPrice', minPrice.value);
    if (maxPrice.value)   params.set('maxPrice', maxPrice.value);

    try {
      const items = await fetchProducts(params);
      if (!items.length) {
        grid.innerHTML = '';
        show(state);
        return;
      }
      grid.innerHTML = items.map(productCard).join('');
    } catch (err: any) {
      grid.innerHTML = '';
      state.innerHTML = `
        <div class="text-danger">
          <p class="mb-1 fw-semibold">No se pudieron cargar los productos.</p>
          <code class="small">${err?.message || 'Error de red'}</code>
        </div>`;
      show(state);
    }
  }

  void load();

  // Filtros
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    void load();
  }, { signal });

  q.addEventListener('input', () => {
    if ((q as any).__t) clearTimeout((q as any).__t);
    (q as any).__t = setTimeout(() => void load(), 300);
  }, { signal });

  // Delegación de eventos en el grid
  grid.addEventListener('click', async (ev) => {
    const btn = (ev.target as HTMLElement).closest('button');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    if (!id) return;

    // necesitamos el producto actual renderizado: lo pedimos con filtros vacíos y lo buscamos
    try {
      const list = await fetchProducts(new URLSearchParams());
      const p = list.find(x => x.id === id);
      if (!p) return;

      if (btn.classList.contains('btn-view')) {
        // Navega a la vista de detalle
        location.hash = `/producto?id=${encodeURIComponent(p.id)}`;
        return;
      }

      // Guard de auth para Add/Buy
      if (!isAuthenticated()) {
        location.hash = '/acceso';
        return;
      }

      if (btn.classList.contains('btn-add')) {
        modal.open(p, 'add');
      } else if (btn.classList.contains('btn-buy')) {
        modal.open(p, 'buy');
      }
    } catch (e) {
      console.warn(e);
      toast('No se pudo recuperar el producto', 'danger');
    }
  }, { signal });
}

export function unmount() { /* no-op */ }
