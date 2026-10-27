export class RandomSource {
    constructor(seed = Date.now()) {
        this.initialSeed = RandomSource.normalizeSeed(seed);
        this.state = this.initialSeed;
    }

    static normalizeSeed(seed) {
        if (typeof seed === 'number' && Number.isFinite(seed)) return seed >>> 0 || 1;

        const text = String(seed);
        let hash = 2166136261;
        for (let index = 0; index < text.length; index++) {
            hash ^= text.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0 || 1;
    }

    next() {
        this.state += 0x6d2b79f5;
        let value = this.state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    }

    chance(probability) {
        return this.next() < Math.max(0, Math.min(1, probability));
    }

    pick(values) {
        if (!values?.length) return undefined;
        return values[Math.floor(this.next() * values.length)];
    }

    reset() {
        this.state = this.initialSeed;
    }
}
