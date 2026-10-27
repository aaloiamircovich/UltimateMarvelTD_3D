export class ResourceManager {
    constructor(gameInstance, initialLives = 20, initialCredits = 650) {
        this.game = gameInstance;
        this.reset(initialLives, initialCredits);
    }

    reset(initialLives = 20, initialCredits = 650) {
        this.maxLives = initialLives;
        this.lives = initialLives;
        this.credits = initialCredits;
        this.infiniteCredits = false;
    }

    setInfiniteCredits(enabled) {
        this.infiniteCredits = Boolean(enabled);
        if (this.infiniteCredits) this.credits = Number.POSITIVE_INFINITY;
        else if (!Number.isFinite(this.credits)) this.credits = 650;
    }

    addCredits(amount) {
        if (this.infiniteCredits) {
            this.credits = Number.POSITIVE_INFINITY;
            return;
        }
        if (Number.isFinite(amount) && amount > 0) {
            this.credits += amount;
            this.persistCredits();
        }
    }

    removeCredits(amount) {
        if (this.infiniteCredits && Number.isFinite(amount) && amount > 0) {
            this.credits = Number.POSITIVE_INFINITY;
            return true;
        }
        if (Number.isFinite(amount) && amount > 0 && this.credits >= amount) {
            this.credits -= amount;
            this.persistCredits();
            return true;
        }
        return false;
    }

    persistCredits() {
        if (!Number.isFinite(this.credits)) return;
        this.game?.progression?.syncCreditsFromResource?.(this.credits);
    }

    removeLife(amount = 1) {
        if (!Number.isFinite(amount) || amount <= 0 || this.lives <= 0) return;

        this.lives = Math.max(0, this.lives - amount);
        if (this.lives <= 0 && this.game && typeof this.game.gameOver === 'function') {
            this.game.gameOver();
        }
    }
}
