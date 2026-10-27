import { getSpriteFrame } from './ImageCache.js';

export const DIRECTIONS = [
    'east',
    'south-east',
    'south',
    'south-west',
    'west',
    'north-west',
    'north',
    'north-east'
];

export class SpriteAnimator {
    constructor(config = {}) {
        this.config = config;
        this.state = 'idle';
        this.moving = false;
        this.facing = config.defaultDirection || 'south';
        this.frameIndex = 0;
        this.elapsed = 0;

        collectVisualSources(config).forEach((source) => getSpriteFrame(source));
    }

    faceVector(dx, dy) {
        this.facing = directionFromVector(dx, dy, this.facing);
    }

    playAttack() {
        if (!this.getDirectionalFrames(this.config.attack).length) return;
        this.state = 'attack';
        this.frameIndex = 0;
        this.elapsed = 0;
    }

    setMoving(moving) {
        this.moving = Boolean(moving);
        if (this.state === 'attack') return;
        this.state = this.moving && this.getDirectionalFrames(this.config.walk).length ? 'walk' : 'idle';
    }

    update(dt) {
        if (this.state === 'walk') {
            const frames = this.getDirectionalFrames(this.config.walk);
            if (!frames.length) {
                this.state = 'idle';
                this.frameIndex = 0;
                this.elapsed = 0;
                return;
            }

            const fps = this.config.walk?.fps || 8;
            this.advanceFrames(dt, fps, frames.length, true);
            return;
        }

        if (this.state !== 'attack') return;

        const attack = this.config.attack;
        const frames = this.getDirectionalFrames(attack);
        const fps = attack?.fps || 12;
        if (!frames.length) {
            this.state = this.moving && this.getDirectionalFrames(this.config.walk).length ? 'walk' : 'idle';
            this.frameIndex = 0;
            this.elapsed = 0;
            return;
        }

        this.advanceFrames(dt, fps, frames.length, Boolean(attack?.loop));
    }

    advanceFrames(dt, fps, frameCount, loop) {
        const frameDuration = 1 / fps;
        this.elapsed += dt;

        while (this.elapsed >= frameDuration) {
            this.elapsed -= frameDuration;
            this.frameIndex++;

            if (this.frameIndex >= frameCount) {
                if (loop) this.frameIndex = 0;
                else {
                    this.state = this.moving && this.getDirectionalFrames(this.config.walk).length ? 'walk' : 'idle';
                    this.frameIndex = 0;
                    break;
                }
            }
        }
    }

    getCurrentSource() {
        if (this.state === 'attack') {
            const frames = this.getDirectionalFrames(this.config.attack);
            if (frames.length) return frames[this.frameIndex] || frames[0];
        }

        if (this.state === 'walk') {
            const frames = this.getDirectionalFrames(this.config.walk);
            if (frames.length) return frames[this.frameIndex] || frames[0];
        }

        const idle = this.config.idle || {};
        return idle[this.facing] || idle.south || Object.values(idle)[0] || null;
    }

    getDirectionalFrames(animation = null) {
        if (!animation) return [];
        if (Array.isArray(animation.frames)) return animation.frames;
        if (Array.isArray(animation)) return animation;

        const frames = animation.frames || animation.directions || {};
        if (!frames || Array.isArray(frames)) return Array.isArray(frames) ? frames : [];
        return frames[this.facing]
            || frames[directionToCardinal(this.facing)]
            || frames.south
            || Object.values(frames).find((value) => Array.isArray(value))
            || [];
    }

    render(ctx, x, y) {
        const { image, frame } = getSpriteFrame(this.getCurrentSource());
        if (!image?.complete || image.naturalWidth <= 0) return false;

        const size = this.config.size || 96;
        const anchor = this.config.anchor || { x: 0.5, y: 0.5 };
        const previousSmoothing = ctx.imageSmoothingEnabled;
        const previousQuality = ctx.imageSmoothingQuality;
        ctx.imageSmoothingEnabled = !ctx.__pixelArtCrisp;
        ctx.imageSmoothingQuality = ctx.__pixelArtCrisp ? 'low' : 'high';
        if (frame) {
            ctx.drawImage(image, frame.x, frame.y, frame.width, frame.height, x - size * anchor.x, y - size * anchor.y, size, size);
        } else {
            ctx.drawImage(image, x - size * anchor.x, y - size * anchor.y, size, size);
        }
        ctx.imageSmoothingEnabled = previousSmoothing;
        ctx.imageSmoothingQuality = previousQuality;
        return true;
    }
}

export function directionFromVector(dx, dy, fallback = 'south') {
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) return fallback;

    const angle = Math.atan2(dy, dx);
    const index = Math.round(angle / (Math.PI / 4));
    return DIRECTIONS[(index + 8) % 8];
}

export function collectVisualSources(config = {}) {
    const flattenFrames = (animation = null) => {
        if (!animation) return [];
        if (Array.isArray(animation)) return animation;
        if (Array.isArray(animation.frames)) return animation.frames;
        const frames = animation.frames || animation.directions || {};
        return Object.values(frames).flat().filter(Boolean);
    };

    return [
        config.portrait,
        ...Object.values(config.idle || {}),
        ...flattenFrames(config.walk),
        ...flattenFrames(config.attack)
    ].filter(Boolean);
}

function directionToCardinal(direction) {
    if (direction?.includes('north')) return 'north';
    if (direction?.includes('south')) return 'south';
    if (direction?.includes('east')) return 'east';
    if (direction?.includes('west')) return 'west';
    return direction || 'south';
}
