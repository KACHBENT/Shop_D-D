// Code/Perfil.Script.ts — TypeScript (ESM)
// Muestra datos del usuario autenticado consultando al backend vía Auth.Script.getCurrentUser()

import { getCurrentUser } from './Auth.Script.js';

type ProfileEls = {
  avatar?: HTMLImageElement | null;
  name?: HTMLElement | null;
  username1?: HTMLElement | null;
  username2?: HTMLElement | null;
  email?: HTMLElement | null;
  created?: HTMLElement | null;
  role?: HTMLElement | null;
};

const DEFAULT_AVATAR = '../Image/Icons/user.svg';

function formatDateISOToLong(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
}

function pickEls(container: HTMLElement): ProfileEls {
  return {
    avatar: container.querySelector<HTMLImageElement>('#profile-avatar'),
    name: container.querySelector<HTMLElement>('#profile-name'),
    username1: container.querySelector<HTMLElement>('#profile-username'),
    username2: container.querySelector<HTMLElement>('#profile-username-2'),
    email: container.querySelector<HTMLElement>('#profile-email'),
    created: container.querySelector<HTMLElement>('#profile-createdAt'),
    role: container.querySelector<HTMLElement>('#profile-role'),
  };
}

function renderEmpty(els: ProfileEls) {
  if (els.avatar) { els.avatar.src = DEFAULT_AVATAR; els.avatar.alt = 'usuario'; }
  if (els.name) els.name.textContent = '—';
  if (els.username1) els.username1.textContent = '—';
  if (els.username2) els.username2.textContent = '—';
  if (els.email) els.email.textContent = '—';
  if (els.created) els.created.textContent = '—';
  if (els.role) els.role.textContent = '—';
}

async function render(els: ProfileEls) {
  const me = await getCurrentUser(); // { user, person } | null
  if (!me) {
    // si no hay sesión (o backend falla), manda a login
    renderEmpty(els);
    location.hash = '/acceso';
    return;
  }
  const { user, person } = me;

  if (els.avatar) { els.avatar.src = user.avatar || DEFAULT_AVATAR; els.avatar.alt = user.username; }
  if (els.name) els.name.textContent = person.name || user.username;
  if (els.username1) els.username1.textContent = user.username;
  if (els.username2) els.username2.textContent = user.username;
  if (els.email) els.email.textContent = person.email || '—';
  if (els.created) els.created.textContent = formatDateISOToLong(user.createdAt);
  if (els.role) els.role.textContent = (user.role || 'cliente').toUpperCase();
}

export function mount({ container, signal }: { container: HTMLElement; signal: AbortSignal }) {
  const els = pickEls(container);

  // primer pintado (async)
  void render(els);

  // re-render al actualizar el usuario (login/logout/editar)
  const onUpdated = () => { void render(els); };
  window.addEventListener('user:updated', onUpdated as EventListener, { signal });
}

export function unmount() { /* no-op (AbortSignal limpia listeners) */ }
