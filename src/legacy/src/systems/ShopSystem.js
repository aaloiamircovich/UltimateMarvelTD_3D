export const HERO_RARITY_WEIGHTS = {
    Common: 48,
    Rare: 30,
    Epic: 15,
    Legendary: 6,
    Mythic: 2,
    Secret: 1
};

export const HERO_BOX_BASE_COST = 500;
export const HERO_BOX_COST_GROWTH = 1.12;

export function getHeroBoxCost(shopState = {}) {
    return Math.max(HERO_BOX_BASE_COST, Math.ceil(Number(shopState.heroBoxCost) || HERO_BOX_BASE_COST));
}

export function getItemShopPowerScore(item = {}) {
    const tierScore = (Number(item.tier) || 1) * 100000;
    const priceScore = Number(item.price) || 0;
    const effectScore = Object.values(item.effects || {}).reduce((total, value) => {
        if (typeof value === 'number') return total + Math.abs(value) * 1000;
        if (typeof value === 'boolean') return total + (value ? 250 : 0);
        return total;
    }, 0);
    return tierScore + priceScore + effectScore;
}

export function sortItemsWeakestFirst(items = []) {
    return [...items].sort((a, b) => (
        getItemShopPowerScore(a) - getItemShopPowerScore(b)
        || (a.price || 0) - (b.price || 0)
        || String(a.name || a.id).localeCompare(String(b.name || b.id))
    ));
}

export class ShopSystem {
    constructor(game, progression) {
        this.game = game;
        this.progression = progression;
    }

    getProgressiveQueue() {
        return sortItemsWeakestFirst(Object.values(this.game.itemDatabase || {}))
            .filter((item) => !this.progression.hasItem(item.id));
    }

    getShowcase() {
        return this.getProgressiveQueue().slice(0, 3).map((item) => ({
            item,
            purchased: false
        }));
    }

    getRotation() {
        return this.getShowcase();
    }

    purchaseItem(itemId) {
        const item = this.game.itemDatabase[itemId];
        const visibleIds = new Set(this.getShowcase().map((slot) => slot.item.id));
        if (!item || !visibleIds.has(itemId) || this.progression.hasItem(itemId)) {
            return { ok: false, reason: 'Objeto no disponible' };
        }
        if (!this.progression.spendCredits(item.price)) return { ok: false, reason: 'Creditos insuficientes' };
        this.progression.addOwnedItem(itemId);
        this.progression.save();
        return { ok: true, item };
    }

    recruitHero() {
        const shop = this.progression.state.shop;
        const cost = getHeroBoxCost(shop);
        const pool = Object.values(this.game.heroDatabase)
            .filter((hero) => hero.visual)
            .filter((hero) => !this.progression.state.unlockedHeroIds.includes(hero.id));
        if (pool.length === 0) return { ok: false, reason: 'Ya tienes todos los héroes' };
        if (!this.progression.state.settings.adminMode && this.progression.getCredits() < cost) return { ok: false, reason: 'Creditos insuficientes' };

        const guaranteed = shop.heroPity >= 4;
        const candidates = guaranteed ? pool.filter((hero) => hero.rarity !== 'Common') : pool;
        const weighted = (candidates.length ? candidates : pool)
            .flatMap((hero) => Array(HERO_RARITY_WEIGHTS[hero.rarity] || HERO_RARITY_WEIGHTS.Rare).fill(hero));
        const hero = this.game.random.pick(weighted);
        this.progression.spendCredits(cost);
        this.progression.unlockHero(hero.id);
        this.game.assetPreloader?.preloadHeroes([hero]);
        shop.heroPity = hero.rarity === 'Common' ? shop.heroPity + 1 : 0;
        shop.heroBoxCost = Math.ceil(cost * HERO_BOX_COST_GROWTH);
        this.progression.save();
        return { ok: true, hero, guaranteed, cost, nextCost: shop.heroBoxCost };
    }
}
