// public/Code/Carrito.Script.ts — Carrito con LS + checkout a /api/tickets
import { isAuthenticated, getCurrentUser } from './Auth.Script.js';
const API_BASE = window.__API_BASE__ || `${location.protocol}//${location.host}`;
const LS_CART = 'cart';
const DEFAULT_IMG = '../Image/placeholder.webp';
/* =========================
   Utils
========================= */
function money(n) {
    return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}
function ensureToast() {
    let c = document.getElementById('toast-container');
    if (!c) {
        c = document.createElement('div');
        c.id = 'toast-container';
        c.className = 'toast-container position-fixed top-0 end-0 p-3';
        c.style.zIndex = '1080';
        document.body.appendChild(c);
    }
    return c;
}
function toast(msg, type = 'info') {
    var _a;
    const c = ensureToast();
    const el = document.createElement('div');
    const bg = {
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
    const BT = (_a = window.bootstrap) === null || _a === void 0 ? void 0 : _a.Toast;
    if (BT)
        new BT(el, { delay: 2400, autohide: true }).show();
    else {
        el.style.display = 'block';
        setTimeout(() => el.remove(), 2600);
    }
}
/* =========================
   Carrito (localStorage)
========================= */
function getCart() {
    try {
        return JSON.parse(localStorage.getItem(LS_CART) || '[]');
    }
    catch (_a) {
        return [];
    }
}
function saveCart(items) {
    localStorage.setItem(LS_CART, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('cart:changed'));
}
function setQty(id, qty) {
    const items = getCart();
    const i = items.findIndex(x => x.id === id);
    if (i === -1)
        return;
    items[i].qty = Math.max(1, Math.floor(qty || 1));
    saveCart(items);
}
function removeItem(id) {
    saveCart(getCart().filter(x => x.id !== id));
}
function clearCart() {
    saveCart([]);
}
/* =========================
   Render HTML
========================= */
function renderSkeleton() {
    return `
    <div class="card shadow-sm border-0 rounded-4 mb-3">
      <div class="card-body">
        <div class="skeleton" style="height:18px;width:180px;border-radius:6px;"></div>
        <div class="skeleton mt-3" style="height:80px;width:100%;border-radius:12px;"></div>
        <div class="skeleton mt-2" style="height:80px;width:100%;border-radius:12px;"></div>
      </div>
    </div>`;
}
function renderEmpty() {
    return `
    <div class="text-center text-muted py-5">
      <img src="../Image/Icons/shopping_cart.svg" width="48" height="48" class="opacity-75 mb-2" alt="">
      <p class="mb-2">Tu carrito está vacío.</p>
      <a class="btn btn-primary" href="#/compra" data-link>Ir a productos</a>
    </div>`;
}
function renderItemRow(it) {
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
function calcTotals(items) {
    const subtotal = items.reduce((s, x) => s + x.price * x.qty, 0);
    const total = subtotal; // sin impuestos/envío
    return { subtotal, total };
}
function renderCartPage(items) {
    if (!items.length)
        return renderEmpty();
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
    const pad = (n) => n.toString().padStart(2, '0');
    return `T-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}
async function postTicket(userId, items, notes = '') {
    // El API espera productIds; repetimos cada id según cantidad
    const productIds = [];
    items.forEach(it => { for (let i = 0; i < it.qty; i++)
        productIds.push(it.id); });
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
    return resp.json(); // { id, ...ticket }
}
/* =========================
   Componente principal
========================= */
export function mount({ container, signal }) {
    const root = container.querySelector('#carrito-page') || (() => {
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
        const btnClear = root.querySelector('#btn-clear');
        if (btnClear) {
            btnClear.addEventListener('click', () => {
                clearCart();
                toast('Carrito vacío', 'info');
                render();
            }, { signal });
        }
        // Checkout
        const btnCheckout = root.querySelector('#btn-checkout');
        if (btnCheckout) {
            btnCheckout.addEventListener('click', async () => {
                var _a;
                const items = getCart();
                if (!items.length) {
                    toast('Tu carrito está vacío', 'warning');
                    return;
                }
                if (!isAuthenticated()) {
                    toast('Inicia sesión para completar tu compra', 'warning');
                    location.hash = '/acceso';
                    return;
                }
                try {
                    const me = await getCurrentUser();
                    const userId = (_a = me === null || me === void 0 ? void 0 : me.user) === null || _a === void 0 ? void 0 : _a.id;
                    if (!userId) {
                        toast('No se pudo obtener el usuario de sesión', 'danger');
                        return;
                    }
                    const ticket = await postTicket(userId, items);
                    clearCart();
                    render();
                    toast(`Compra generada. Ticket: ${(ticket === null || ticket === void 0 ? void 0 : ticket.code) || (ticket === null || ticket === void 0 ? void 0 : ticket.id) || ''}`, 'success');
                    // opcional: navegar a una vista de tickets
                    // location.hash = `/ticket?id=${encodeURIComponent(ticket.id)}`;
                }
                catch (e) {
                    toast((e === null || e === void 0 ? void 0 : e.message) || 'No se pudo generar el ticket', 'danger');
                }
            }, { signal });
        }
        // Filas: qty +/- , input y remove
        root.querySelectorAll('.cart-row').forEach(row => {
            const id = row.getAttribute('data-id') || '';
            if (!id)
                return;
            const input = row.querySelector('.input-qty');
            const btnDec = row.querySelector('.btn-qty-dec');
            const btnInc = row.querySelector('.btn-qty-inc');
            const btnRem = row.querySelector('.btn-remove');
            if (btnDec)
                btnDec.addEventListener('click', () => {
                    const cur = Math.max(1, (Number((input === null || input === void 0 ? void 0 : input.value) || '1') || 1) - 1);
                    if (input)
                        input.value = String(cur);
                    setQty(id, cur);
                    render();
                }, { signal });
            if (btnInc)
                btnInc.addEventListener('click', () => {
                    const cur = Math.max(1, (Number((input === null || input === void 0 ? void 0 : input.value) || '1') || 1) + 1);
                    if (input)
                        input.value = String(cur);
                    setQty(id, cur);
                    render();
                }, { signal });
            if (input)
                input.addEventListener('change', () => {
                    const v = Math.max(1, Math.floor(Number(input.value) || 1));
                    input.value = String(v);
                    setQty(id, v);
                    render();
                }, { signal });
            if (btnRem)
                btnRem.addEventListener('click', () => {
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
export function unmount() { }
//# sourceMappingURL=Carrito.Script.js.map