export const TARGETING_PRIORITIES = ['Primero', 'Último', 'Fuerte', 'Débil', 'Rápido', 'Sigilo', 'Jefe'];

export const TARGETING_PRIORITY_COPY = {
    Primero: { key: 'first', label: '1ro', icon: 'fa-route', color: '#40c9ff', description: 'prioriza al enemigo mas avanzado' },
    Último: { key: 'last', label: 'Ult', icon: 'fa-backward', color: '#7bb6ff', description: 'limpia rezagados e invocaciones' },
    Fuerte: { key: 'strong', label: 'Fte', icon: 'fa-shield-alt', color: '#fca311', description: 'enfoca tanques y elites' },
    Débil: { key: 'weak', label: 'Deb', icon: 'fa-bolt', color: '#46d369', description: 'remata objetivos bajos' },
    Rápido: { key: 'fast', label: 'Rap', icon: 'fa-running', color: '#ff6b6b', description: 'corta corredores' },
    Sigilo: { key: 'stealth', label: 'Sig', icon: 'fa-eye', color: '#b388ff', description: 'busca infiltrados detectables' },
    Jefe: { key: 'boss', label: 'Jfe', icon: 'fa-skull', color: '#ffd166', description: 'prioriza jefes y amenaza alta' }
};

export function getNextTargetingPriority(current = 'Primero', direction = 1) {
    const index = TARGETING_PRIORITIES.indexOf(current);
    const safeIndex = index >= 0 ? index : 0;
    const offset = Number(direction || 1);
    const nextIndex = (safeIndex + offset + TARGETING_PRIORITIES.length) % TARGETING_PRIORITIES.length;
    return TARGETING_PRIORITIES[nextIndex];
}

export function buildTargetingControlState(current = 'Primero') {
    const priority = TARGETING_PRIORITIES.includes(current) ? current : 'Primero';
    const next = getNextTargetingPriority(priority);
    const copy = TARGETING_PRIORITY_COPY[priority];
    return {
        priority,
        next,
        key: copy.key,
        label: copy.label,
        icon: copy.icon,
        color: copy.color,
        description: copy.description,
        tooltip: `Objetivo: ${priority}; ${copy.description}. Click: ${next}.`,
        ariaLabel: `Cambiar prioridad de objetivo de ${priority} a ${next}`
    };
}
