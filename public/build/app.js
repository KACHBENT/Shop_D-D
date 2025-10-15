// Code/app.js — ESM, Router SPA + Guards + Navbar user (rutas absolutas + cache busting robusto)
import { isAuthenticated, getCurrentUser, logout } from './Auth.Script.js';

const main = /** @type {HTMLElement|null} */ (document.getElementById('app'));
if (!main) console.error('[app] No existe #app en el DOM.');

/* ============================
   Version busting (cache)
============================ */
let APP_VERSION = null;

async function getVersion() {
  if (APP_VERSION) return APP_VERSION;
  try {
    // versión en /version.json para que no dependa del lugar de app.js
    const res = await fetch('/version.json', { cache: 'no-store' });
    const data = await res.json();
    APP_VERSION = String(data.version || Date.now());
  } catch {
    const k = 'APP_VERSION';
    APP_VERSION = sessionStorage.getItem(k) || Date.now().toString();
    sessionStorage.setItem(k, APP_VERSION);
  }
  return APP_VERSION;
}

function toAbsolute(path) {
  if (/^https?:\/\//i.test(path)) return path;   // ya es absoluta
  if (path.startsWith('/')) return path;         // ya es root-absolute
  // fuerzo absoluta desde raíz pública
  return `/${path.replace(/^(\.\/|\.{2}\/)+/, '')}`;
}

async function withBust(url) {
  const v = await getVersion();
  const abs = toAbsolute(url);
  const sep = abs.includes('?') ? '&' : '?';
  return `${abs}${sep}v=${encodeURIComponent(v)}`;
}

/* ============================
   Rutas (HTML/CSS/JS por vista)
============================ */
const routes = {
  '/': {
    html: async () => {
      const url = await withBust('/Views/Inicio.html');
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) throw new Error('No se pudo cargar Inicio.html');
      return r.text();
    },
    css: ['/Styles/Compras.Styles.css'],
    js:  ['/Code/Inicio.Script.js'],
  },
  '/compra': {
    html: async () => {
      const url = await withBust('/Views/compra.html');
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) throw new Error('No se pudo cargar compra.html');
      return r.text();
    },
    css: ['/Styles/Compras.Styles.css'],
    js:  ['/Code/Productos.Script.js'], // <-- si tu archivo se llama diferente, ajusta
  },
  '/productos': {
    html: async () => {
      const url = await withBust('/Views/productos.html');
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) throw new Error('No se pudo cargar productos.html');
      return r.text();
    },
    css: ['/Styles/VistaProducto.Styles.css'],
    js:  ['/Code/VistaProducto.Script.js'],
  },
  '/carrito': {
    html: async () => {
      const url = await withBust('/Views/carrito.html');
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) throw new Error('No se pudo cargar carrito.html');
      return r.text();
    },
    css: ['/Styles/Carrito.Styles.css'],
    js:  ['/Code/Carrito.Script.js'],
  },
  '/acceso': {
    html: async () => {
      const url = await withBust('/Views/acceso.html');
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) throw new Error('No se pudo cargar acceso.html');
      return r.text();
    },
    css: ['/Styles/Acceso.Styles.css'],
    js:  ['/Code/Acceso.Script.js'],
  },
  '/registro-usuario': {
    html: async () => {
      const url = await withBust('/Views/registro-usuario.html');
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) throw new Error('No se pudo cargar registro-usuario.html');
      return r.text();
    },
    css: ['/Styles/Registrousuario.Styles.css'],
    js:  ['/Code/Registrousuario.Script.js'],
  },
  '/perfil': {
    html: async () => {
      const url = await withBust('/Views/perfil.html');
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) throw new Error('No se pudo cargar perfil.html');
      return r.text();
    },
    css: ['/Styles/Perfil.Styles.css'],
    js:  ['/Code/Perfil.Script.js'],
  },
  '/editar-perfil': {
    html: async () => {
      const url = await withBust('/Views/editar-perfil.html');
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) throw new Error('No se pudo cargar editar-perfil.html');
      return r.text();
    },
    css: ['/Styles/Registrousuario.Styles.css'],
    js:  ['/Code/Editarperfil.Script.js'],
  },
  '/registro-usuario-admin': {
    html: async () => {
      const url = await withBust('/Views/registro-usuario-admin.html');
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) throw new Error('No se pudo cargar registro-usuario-admin.html');
      return r.text();
    },
    css: ['/Styles/Registrousuario.Styles.css'],
    js:  ['/Code/RegistrousuarioAdministrador.Script.js'],
  },
  '/registrar-producto': {
    html: async () => {
      const url = await withBust('/Views/registro-producto.html');
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) throw new Error('No se pudo cargar registro-producto.html');
      return r.text();
    },
    css: ['/Styles/Registroproducto.Styles.css'],
    js:  ['/Code/Registroproducto.Script.js'],
  },
};

/* ============================
   Estado actual
============================ */
let current = {
  route: null,
  styles: /** @type HTMLLinkElement[] */([]),
  scripts: /** @type HTMLScriptElement[] */([]),
  module: /** @type any */(null),
  aborter: /** @type AbortController|null */(null),
};

/* ============================
   Navbar: usuario (ASYNC)
============================ */
function renderGuestMenu(menuEl) {
  if (!menuEl) return;
  menuEl.innerHTML = `
    <a class="dropdown-item" href="#/acceso" data-link>Iniciar sesión</a>
  `;
}
function renderUserMenu(menuEl) {
  if (!menuEl) return;
  menuEl.innerHTML = `
    <a class="dropdown-item" href="#/perfil" data-link>Perfil</a>
    <div class="dropdown-divider"></div>
    <a class="dropdown-item text-danger" href="#/logout" data-link>Cerrar sesión</a>
  `;
}
function applyAuthGuards() {
  document.querySelectorAll('a[data-auth="required"]').forEach(a => {
    a.addEventListener('click', (e) => {
      if (!isAuthenticated()) {
        e.preventDefault();
        location.hash = '/acceso';
      }
    }, { once: true });
  });
}
async function updateNavbarUser() {
  const dropdown = document.querySelector('#userDropdown');
  const menuEl   = document.querySelector('#userMenu');
  if (!dropdown) return;

  const img = dropdown.querySelector('img');
  const nameSpan = dropdown.querySelector('span');

  try {
    const me = await getCurrentUser();
    if (me && me.user) {
      if (nameSpan) nameSpan.textContent = me.person?.name || me.user.username;
      if (img) {
        img.setAttribute('src', me.user.avatar || '/Image/Icons/user.svg');
        img.setAttribute('alt', me.user.username);
      }
      renderUserMenu(menuEl);
    } else {
      if (nameSpan) nameSpan.textContent = 'Invitado';
      if (img) {
        img.setAttribute('src', '/Image/Icons/users.svg');
        img.setAttribute('alt', 'Invitado');
      }
      renderGuestMenu(menuEl);
    }
  } catch {
    if (nameSpan) nameSpan.textContent = 'Invitado';
    if (img) {
      img.setAttribute('src', '/Image/Icons/users.svg');
      img.setAttribute('alt', 'Invitado');
    }
    renderGuestMenu(menuEl);
  }
  applyAuthGuards();
}

/* ============================
   Limpieza al cambiar de ruta
============================ */
async function cleanup() {
  try { await current.module?.unmount?.(); } catch (e) { console.warn('unmount()', e); }
  current.styles.forEach(el => el.remove());
  current.scripts.forEach(el => el.remove());
  current = { route: null, styles: [], scripts: [], module: null, aborter: null };
}

/* ============================
   Router
============================ */
function parseRoute() {
  const raw = (location.hash || '').replace(/^#/, '') || '/';
  return routes[raw] ? raw : '/';
}
const protectedRoutes = new Set([
  '/perfil',
  '/editar-perfil',
  '/compra',
  '/carrito',
  '/registrar-producto',
]);

function isLogoutRoute(path) {
  return path === '/logout' || path === '#/logout' || location.hash === '#/logout';
}

async function loadRoute(path) {
  if (!main) return;

  if (isLogoutRoute(path)) {
    logout();
    void updateNavbarUser();
    location.hash = '/acceso';
    return;
  }

  const route = routes[path] ? path : '/';

  if (protectedRoutes.has(route) && !isAuthenticated()) {
    location.hash = '/acceso';
    return;
  }

  if (current.aborter) current.aborter.abort();
  const aborter = new AbortController();

  await cleanup();

  try {
    const html = await routes[route].html();

    const styles = [];
    for (const href of routes[route].css) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = await withBust(href);
      link.dataset.pageAsset = route;
      document.head.appendChild(link);
      styles.push(link);
    }

    main.innerHTML = html;
    main.focus();

    let mod = null;
    for (const src of routes[route].js) {
      mod = await import(await withBust(src));
    }

    current = { route, styles, scripts: [], module: mod, aborter };
    if (mod?.mount) {
      await mod.mount({ container: main, signal: aborter.signal });
    }

    void updateNavbarUser();

  } catch (e) {
    if (e.name === 'AbortError') return;
    console.error(e);
    main.innerHTML = `<p style="color:#fecaca">Error: ${e.message}</p>`;
  }
}

/* ============================
   Navegación
============================ */
function route() { loadRoute(parseRoute()); }

window.addEventListener('hashchange', route);
window.addEventListener('DOMContentLoaded', () => {
  if (isLogoutRoute(location.hash.replace(/^#/, ''))) {
    logout();
    void updateNavbarUser();
    location.hash = '/acceso';
    return;
  }
  void updateNavbarUser();
  route();
});

document.addEventListener('click', e => {
  const a = e.target && (/** @type HTMLElement */(e.target)).closest?.('a[data-link]');
  if (!a) return;
  e.preventDefault();
  const href = a.getAttribute('href') || '#/';
  if (href.startsWith('#')) {
    location.hash = href.replace(/^#/, '');
  } else {
    location.hash = href;
  }
});

window.addEventListener('user:updated', () => { void updateNavbarUser(); });
window.addEventListener('db:changed',   () => { void updateNavbarUser(); });

Object.assign(window, { __router: { loadRoute, parseRoute, updateNavbarUser } });
