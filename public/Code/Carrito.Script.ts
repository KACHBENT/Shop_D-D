// public/Code/Carrito.Script.ts — Carrito con LS + checkout a /api/tickets
import { isAuthenticated, getCurrentUser } from './Auth.Script.js';

type CartItem = { id: string; name: string; price: number; qty: number; image?: string | null };

const API_BASE: string = (window as any).__API_BASE__ || `${location.protocol}//${location.host}`;
const LS_CART = 'cart';
const DEFAULT_IMG = '../Image/placeholder.webp';

/* =========================
   Utils
========================= */
function money(n: number) {
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}
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
  if (BT) new BT(el, { delay: 2400, autohide: true }).show();
  else { (el.style as any).display = 'block'; setTimeout(() => el.remove(), 2600); }
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
function setQty(id: string, qty: number) {
  const items = getCart();
  const i = items.findIndex(x => x.id === id);
  if (i === -1) return;
  items[i].qty = Math.max(1, Math.floor(qty || 1));
  saveCart(items);
}
function removeItem(id: string) {
  saveCart(getCart().filter(x => x.id !== id));
}
function clearCart() {
  saveCart([]);
}

/* =========================
   Render HTML
========================= */
function renderSkeleton(): string {
  return `
    <div class="card shadow-sm border-0 rounded-4 mb-3">
      <div class="card-body">
        <div class="skeleton" style="height:18px;width:180px;border-radius:6px;"></div>
        <div class="skeleton mt-3" style="height:80px;width:100%;border-radius:12px;"></div>
        <div class="skeleton mt-2" style="height:80px;width:100%;border-radius:12px;"></div>
      </div>
    </div>`;
}

function renderEmpty(): string {
  return `
    <div class="text-center text-muted py-5">
      <img src="../Image/Icons/shopping_cart.svg" width="48" height="48" class="opacity-75 mb-2" alt="">
      <p class="mb-2">Tu carrito está vacío.</p>
      <a class="btn btn-primary" href="#/compra" data-link>Ir a productos</a>
    </div>`;
}

function renderItemRow(it: CartItem): string {
  const img = it.image || DEFAULT_IMG;
  const line = it.price * it.qty;
  return `
    <div class="row align-items-center g-3 py-2 border-bottom cart-row" data-id="${it.id}">
      <div class="col-3 col-md-2">
        <img src="${img}" alt="${it.name}" class="rounded" style="width:72px;height:72px;object-fit:cover;">
      </div>
      <div class="col-9 col-md-4">
        <div class="fw-semibold">${it.name}</div>
        <div class="text-muted small">Precio: ${money(it.price)}</div>
      </div>
      <div class="col-6 col-md-3">
        <div class="input-group">
          <button class="btn btn-outline-secondary btn-qty-dec" type="button">−</button>
          <input type="number" class="form-control text-center input-qty" min="1" step="1" value="${it.qty}">
          <button class="btn btn-outline-secondary btn-qty-inc" type="button">＋</button>
        </div>
      </div>
      <div class="col-4 col-md-2 text-end">
        <div class="fw-semibold">${money(line)}</div>
      </div>
      <div class="col-2 col-md-1 text-end">
        <button class="btn btn-outline-danger btn-sm btn-remove" title="Quitar">&times;</button>
      </div>
    </div>`;
}

function calcTotals(items: CartItem[]) {
  const subtotal = items.reduce((s, x) => s + x.price * x.qty, 0);
  const total = subtotal; // sin impuestos/envío
  return { subtotal, total };
}

function renderCartPage(items: CartItem[]): string {
  if (!items.length) return renderEmpty();

  const rows = items.map(renderItemRow).join('');
  const { subtotal, total } = calcTotals(items);

  return `
  <div class="row g-3">
    <div class="col-lg-8">
      <div class="card shadow-sm border-0 rounded-4">
        <div class="card-header bg-white d-flex align-items-center gap-2">
          <img src="../Image/Icons/shopping_cart.svg" width="22" height="22" alt="" class="icon-head">
          <h6 class="mb-0">Tu carrito</h6>
        </div>
        <div class="card-body">
          ${rows}
          <div class="d-flex justify-content-between mt-3">
            <a href="#/compra" data-link class="btn btn-outline-secondary">Seguir comprando</a>
            <button id="btn-clear" class="btn btn-outline-danger">Vaciar carrito</button>
          </div>
        </div>
      </div>
    </div>

    <div class="col-lg-4">
      <div class="card shadow-sm border-0 rounded-4">
        <div class="card-header bg-white d-flex align-items-center gap-2">
          <img src="../Image/Icons/receipt_long_.svg" width="22" height="22" alt="" class="icon-head">
          <h6 class="mb-0">Resumen</h6>
        </div>
        <div class="card-body">
          <div class="d-flex justify-content-between">
            <span>Subtotal</span><strong id="sum-subtotal">${money(subtotal)}</strong>
          </div>
          <hr>
          <div class="d-flex justify-content-between fs-5">
            <span>Total</span><strong id="sum-total">${money(total)}</strong>
          </div>
          <div class="d-grid mt-3">
            <button id="btn-checkout" class="btn btn-primary">Generar compra</button>
          </div>
          <small class="text-muted d-block mt-2">Los precios están en MXN.</small>
        </div>
      </div>
    </div>
  </div>`;
}

/* =========================
   Ticket API
========================= */
function makeTicketCode() {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `T-${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
}

async function postTicket(userId: string, items: CartItem[], notes = '') {
  // El API espera productIds; repetimos cada id según cantidad
  const productIds: string[] = [];
  items.forEach(it => { for (let i = 0; i < it.qty; i++) productIds.push(it.id); });

  const payload = {
    code: makeTicketCode(),
    userId,
    productIds,
    status: 'pendiente',
    notes
  };

  const resp = await fetch(`${API_BASE}/api/tickets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!resp.ok) {
    let msg = `HTTP ${resp.status}`;
    try {
      const ct = resp.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const err = await resp.json();
        if (err?.error) msg = err.error;
      } else {
        const txt = await resp.text(); if (txt) msg = txt;
      }
    } catch {}
    throw new Error(msg);
  }
  return resp.json(); // { id, ...ticket }
}

/* =========================
   Componente principal
========================= */
export function mount({ container, signal }: { container: HTMLElement; signal: AbortSignal }) {
  const root = container.querySelector<HTMLElement>('#carrito-page') || (() => {
    const s = document.createElement('section');
    s.id = 'carrito-page';
    container.appendChild(s);
    return s;
  })();

  // Render inicial
  root.innerHTML = renderSkeleton();
  const render = () => { root.innerHTML = renderCartPage(getCart()); bind(); };

  // Vincular eventos (delegación)
  const bind = () => {
    // Vaciar
    const btnClear = root.querySelector<HTMLButtonElement>('#btn-clear');
    if (btnClear) {
      btnClear.addEventListener('click', () => {
        clearCart();
        toast('Carrito vacío', 'info');
        render();
      }, { signal });
    }

    // Checkout
    const btnCheckout = root.querySelector<HTMLButtonElement>('#btn-checkout');
    if (btnCheckout) {
      btnCheckout.addEventListener('click', async () => {
        const items = getCart();
        if (!items.length) { toast('Tu carrito está vacío', 'warning'); return; }

        if (!isAuthenticated()) {
          toast('Inicia sesión para completar tu compra', 'warning');
          location.hash = '/acceso';
          return;
        }

        try {
          const me = await getCurrentUser();
          const userId = me?.user?.id;
          if (!userId) {
            toast('No se pudo obtener el usuario de sesión', 'danger');
            return;
          }
          const ticket = await postTicket(userId, items);
          clearCart();
          render();
          toast(`Compra generada. Ticket: ${ticket?.code || ticket?.id || ''}`, 'success');
          // opcional: navegar a una vista de tickets
          // location.hash = `/ticket?id=${encodeURIComponent(ticket.id)}`;
        } catch (e: any) {
          toast(e?.message || 'No se pudo generar el ticket', 'danger');
        }
      }, { signal });
    }

    // Filas: qty +/- , input y remove
    root.querySelectorAll<HTMLElement>('.cart-row').forEach(row => {
      const id = row.getAttribute('data-id') || '';
      if (!id) return;

      const input = row.querySelector<HTMLInputElement>('.input-qty');
      const btnDec = row.querySelector<HTMLButtonElement>('.btn-qty-dec');
      const btnInc = row.querySelector<HTMLButtonElement>('.btn-qty-inc');
      const btnRem = row.querySelector<HTMLButtonElement>('.btn-remove');

      if (btnDec) btnDec.addEventListener('click', () => {
        const cur = Math.max(1, (Number(input?.value || '1') || 1) - 1);
        if (input) input.value = String(cur);
        setQty(id, cur);
        render();
      }, { signal });

      if (btnInc) btnInc.addEventListener('click', () => {
        const cur = Math.max(1, (Number(input?.value || '1') || 1) + 1);
        if (input) input.value = String(cur);
        setQty(id, cur);
        render();
      }, { signal });

      if (input) input.addEventListener('change', () => {
        const v = Math.max(1, Math.floor(Number(input.value) || 1));
        input.value = String(v);
        setQty(id, v);
        render();
      }, { signal });

      if (btnRem) btnRem.addEventListener('click', () => {
        removeItem(id);
        toast('Producto eliminado', 'info');
        render();
      }, { signal });
    });
  };

  // Primer render
  render();

  // Re-render si otro módulo cambia el carrito
  const onCartChanged = () => render();
  window.addEventListener('cart:changed', onCartChanged, { signal });
}

export function unmount() { /* no-op: listeners usan AbortSignal */ }
