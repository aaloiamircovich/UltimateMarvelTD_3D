const imageCache = new Map();
const ASSET_VERSION = 'evolution-enemy-sprites-20260812';

function versionAssetSource(source) {
    if (!source?.startsWith?.('assets/images/')) return source;
    return `${source}${source.includes('?') ? '&' : '?'}v=${ASSET_VERSION}`;
}

export function getCachedImage(source) {
    if (!source || typeof Image === 'undefined') return null;

    const versionedSource = versionAssetSource(source);
    if (!imageCache.has(versionedSource)) {
        const image = new Image();
        image.decoding = 'async';
        image.src = versionedSource;
        imageCache.set(versionedSource, image);
    }

    return imageCache.get(versionedSource);
}

export function getSpriteFrame(source) {
    const atlas = globalThis.__MARVEL_TD_ATLAS__;
    const frame = atlas?.frames?.[source];
    if (frame) return { image: getCachedImage(atlas.image), frame };
    return { image: getCachedImage(source), frame: null };
}

export async function preloadImages(sources) {
    const atlas = globalThis.__MARVEL_TD_ATLAS__;
    const uniqueSources = [...new Set(sources.filter(Boolean).map((source) => atlas?.frames?.[source] ? atlas.image : source))];
    const images = uniqueSources.map((source) => getCachedImage(source)).filter(Boolean);

    await Promise.all(images.map((image) => {
        if (image.complete) return Promise.resolve();

        return new Promise((resolve) => {
            const finish = () => resolve();
            image.addEventListener('load', finish, { once: true });
            image.addEventListener('error', finish, { once: true });
        });
    }));
}
