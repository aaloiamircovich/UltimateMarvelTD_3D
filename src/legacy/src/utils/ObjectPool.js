export class ObjectPool {
    constructor(factory, reset = () => {}, maxSize = 256) {
        this.factory = factory;
        this.reset = reset;
        this.maxSize = maxSize;
        this.free = [];
        this.created = 0;
        this.reused = 0;
    }

    acquire(initialize = null) {
        const item = this.free.pop() || this.create();
        if (this.created > 0 && item.__poolUsed) this.reused++;
        item.__poolUsed = true;
        initialize?.(item);
        return item;
    }

    release(item) {
        if (!item || this.free.length >= this.maxSize) return false;
        this.reset(item);
        this.free.push(item);
        return true;
    }

    create() {
        this.created++;
        return this.factory();
    }

    getStats() {
        return { created: this.created, reused: this.reused, available: this.free.length };
    }
}
