import { collectVisualSources } from '../rendering/SpriteAnimator.js';

export function resolveEvolutionVisualContract(evolutionVisuals = {}, evolution = null) {
    if (!evolution) return null;
    const transformId = evolution.transformId || null;
    const evolutionId = evolution.id || null;
    return (transformId && evolutionVisuals[transformId])
        || (evolutionId && evolutionVisuals[evolutionId])
        || null;
}

export function resolveHeroVisual(hero, game = null) {
    const config = hero?.config || hero;
    if (!config) return { id: 'missing', sprite: null, visual: null, portrait: null };

    const activeEvolution = game?.progression?.getHeroEvolution?.(config.id);
    const activeContract = resolveEvolutionVisualContract(game?.evolutionVisualDatabase || {}, activeEvolution);
    const storedVisual = config.evolutionVisual
        ? {
            id: config.activeEvolutionVisualId || activeEvolution?.transformId || activeEvolution?.id || `${config.id}_evolution`,
            sprite: config.evolutionSprite || config.evolutionVisual.portrait,
            visual: config.evolutionVisual
        }
        : null;
    const contract = activeContract || storedVisual;
    const visual = contract?.visual || config.visual || null;
    const sprite = contract?.sprite || visual?.portrait || config.sprite || null;

    return {
        id: contract?.id || activeEvolution?.transformId || activeEvolution?.id || 'base',
        sprite,
        visual,
        portrait: visual?.portrait || sprite
    };
}

export function pickHeroDisplaySprite(hero, game = null) {
    const resolved = resolveHeroVisual(hero, game);
    const visual = resolved.visual;
    return visual?.idle?.south
        || visual?.sprites?.south
        || visual?.portrait
        || resolved.sprite
        || hero?.sprite
        || null;
}

export function collectHeroVisualSources(heroes = [], game = null) {
    return [...new Set(heroes.flatMap((hero) => {
        const resolved = resolveHeroVisual(hero, game);
        return collectVisualSources(resolved.visual);
    }).filter(Boolean))];
}
