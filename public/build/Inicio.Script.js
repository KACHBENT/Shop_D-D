// Code/Inicio.Script.ts — TypeScript (ESM)
import { getCurrentUser } from './Auth.Script.js';
const DEFAULT_AVATAR = '../Image/Icons/users.svg';
function formatDateISOToLong(iso) {
    if (!iso)
        return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
        ? '—'
        : d.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
}
function pickEls(container) {
    return {
        avatar: container.querySelector('#profile-avatar'),
        name: container.querySelector('#profile-name'),
        username1: container.querySelector('#profile-username'),
        username2: container.querySelector('#profile-username-2'),
        email: container.querySelector('#profile-email'),
        created: container.querySelector('#profile-createdAt'),
        role: container.querySelector('#profile-role'),
    };
}
function renderEmpty(els) {
    if (els.avatar) {
        els.avatar.src = DEFAULT_AVATAR;
        els.avatar.alt = 'usuario';
    }
    if (els.name)
        els.name.textContent = '—';
    if (els.username1)
        els.username1.textContent = '—';
    if (els.username2)
        els.username2.textContent = '—';
    if (els.email)
        els.email.textContent = '—';
    if (els.created)
        els.created.textContent = '—';
    if (els.role)
        els.role.textContent = '—';
}
async function render(els) {
    try {
        const me = await getCurrentUser();
        if (!me) {
            renderEmpty(els);
            return;
        }
        const { user, person } = me;
        if (els.avatar) {
            els.avatar.src = user.avatar || DEFAULT_AVATAR;
            els.avatar.alt = user.username || 'usuario';
        }
        if (els.name)
            els.name.textContent = (person === null || person === void 0 ? void 0 : person.name) || user.username || '—';
        if (els.username1)
            els.username1.textContent = user.username || '—';
        if (els.username2)
            els.username2.textContent = user.username || '—';
        if (els.email)
            els.email.textContent = (person === null || person === void 0 ? void 0 : person.email) || '—';
        if (els.created)
            els.created.textContent = formatDateISOToLong(user.createdAt);
        if (els.role)
            els.role.textContent = (user.role || 'cliente').toUpperCase();
    }
    catch (_a) {
        renderEmpty(els);
    }
}
export function mount({ container, signal }) {
    const els = pickEls(container);
    void render(els);
    const onUpdated = () => { void render(els); };
    window.addEventListener('user:updated', onUpdated, { signal });
}
export function unmount() {
    // no-op: los listeners se limpian con AbortSignal
}
//# sourceMappingURL=Inicio.Script.js.map