// Code/Inicio.Script.ts — TypeScript (ESM)


import { getCurrentUser } from './Auth.Script.js';

type Els = {
  avatar?: HTMLImageElement | null;
  name?: HTMLElement | null;
  username1?: HTMLElement | null;
  username2?: HTMLElement | null;
  email?: HTMLElement | null;
  created?: HTMLElement | null;
  role?: HTMLElement | null;
};

const DEFAULT_AVATAR = '../Image/Icons/users.svg';

function formatDateISOToLong(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
}

function pickEls(container: HTMLElement): Els {
  return {
    avatar: container.querySelector<HTMLImageElement>('#profile-avatar'),
    name: container.querySelector<HTMLElement>('#profile-name'),
    username1: container.querySelector<HTMLElement>('#profile-username'),
    username2: container.querySelector<HTMLElement>('#profile-username-2'),
    email: container.querySelector<HTMLElement>('#profile-email'),
    created: container.querySelector<HTMLElement>('#profile-createdAt'),
    role: container.querySelector<HTMLElement>('#profile-role'), // opcional en tu HTML
  };
}

function renderEmpty(els: Els) {
  if (els.avatar) { els.avatar.src = DEFAULT_AVATAR; els.avatar.alt = 'usuario'; }
  if (els.name) els.name.textContent = '—';
  if (els.username1) els.username1.textContent = '—';
  if (els.username2) els.username2.textContent = '—';
  if (els.email) els.email.textContent = '—';
  if (els.created) els.created.textContent = '—';
  if (els.role) els.role.textContent = '—';
}

async function render(els: Els) {
  try {
    const me = await getCurrentUser(); 
    if (!me) {
      renderEmpty(els);
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
  } catch {

    renderEmpty(els);
  }
}

export function mount({ container, signal }: { container: HTMLElement; signal: AbortSignal }) {
  const els = pickEls(container);

  void render(els);

  const onUpdated = () => { void render(els); };
  window.addEventListener('user:updated', onUpdated as EventListener, { signal });
}

export function unmount() {

}
