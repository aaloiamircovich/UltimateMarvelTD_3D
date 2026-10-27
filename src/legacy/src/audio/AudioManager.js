const CUES = {
    repulsor: { frequency: 520, endFrequency: 220, duration: 0.09, type: 'sawtooth', volume: 0.035 },
    arc: { frequency: 180, endFrequency: 920, duration: 0.24, type: 'sawtooth', volume: 0.055 },
    web: { frequency: 760, endFrequency: 320, duration: 0.08, type: 'triangle', volume: 0.025 },
    shield: { frequency: 230, endFrequency: 150, duration: 0.13, type: 'square', volume: 0.025 },
    thunder: { frequency: 95, endFrequency: 42, duration: 0.38, type: 'sawtooth', volume: 0.065 },
    portal: { frequency: 340, endFrequency: 680, duration: 0.28, type: 'sine', volume: 0.04 },
    gamma: { frequency: 82, endFrequency: 42, duration: 0.34, type: 'square', volume: 0.065 },
    taser: { frequency: 880, endFrequency: 260, duration: 0.12, type: 'sawtooth', volume: 0.035 },
    arrow: { frequency: 720, endFrequency: 180, duration: 0.07, type: 'triangle', volume: 0.022 },
    vibranium: { frequency: 190, endFrequency: 620, duration: 0.16, type: 'sine', volume: 0.042 },
    density: { frequency: 410, endFrequency: 110, duration: 0.2, type: 'sawtooth', volume: 0.04 },
    redwing: { frequency: 640, endFrequency: 510, duration: 0.08, type: 'square', volume: 0.024 },
    binary: { frequency: 240, endFrequency: 980, duration: 0.3, type: 'sawtooth', volume: 0.052 },
    blaster: { frequency: 680, endFrequency: 240, duration: 0.08, type: 'square', volume: 0.025 },
    roots: { frequency: 130, endFrequency: 75, duration: 0.24, type: 'triangle', volume: 0.04 },
    cosmicBlade: { frequency: 520, endFrequency: 160, duration: 0.1, type: 'sawtooth', volume: 0.033 },
    cosmic: { frequency: 310, endFrequency: 860, duration: 0.22, type: 'sine', volume: 0.045 },
    radar: { frequency: 190, endFrequency: 760, duration: 0.2, type: 'sine', volume: 0.035 },
    counter: { frequency: 460, endFrequency: 170, duration: 0.09, type: 'square', volume: 0.03 },
    moon: { frequency: 270, endFrequency: 540, duration: 0.2, type: 'triangle', volume: 0.032 },
    blood: { frequency: 130, endFrequency: 70, duration: 0.18, type: 'sawtooth', volume: 0.035 },
    chain: { frequency: 210, endFrequency: 105, duration: 0.14, type: 'square', volume: 0.04 },
    penance: { frequency: 95, endFrequency: 640, duration: 0.34, type: 'sawtooth', volume: 0.052 },
    impact: { frequency: 88, endFrequency: 44, duration: 0.22, type: 'square', volume: 0.055 },
    claws: { frequency: 760, endFrequency: 180, duration: 0.1, type: 'sawtooth', volume: 0.035 },
    telekinesis: { frequency: 280, endFrequency: 620, duration: 0.2, type: 'sine', volume: 0.038 },
    phoenix: { frequency: 170, endFrequency: 920, duration: 0.36, type: 'sawtooth', volume: 0.052 },
    optic: { frequency: 640, endFrequency: 260, duration: 0.12, type: 'square', volume: 0.035 },
    weather: { frequency: 110, endFrequency: 440, duration: 0.28, type: 'triangle', volume: 0.04 },
    luck: { frequency: 520, endFrequency: 810, duration: 0.11, type: 'triangle', volume: 0.03 },
    hex: { frequency: 220, endFrequency: 690, duration: 0.24, type: 'sine', volume: 0.042 },
    pym: { frequency: 850, endFrequency: 120, duration: 0.16, type: 'square', volume: 0.036 },
    boss: { frequency: 120, endFrequency: 45, duration: 0.52, type: 'sawtooth', volume: 0.07 },
    ui: { frequency: 420, endFrequency: 520, duration: 0.05, type: 'sine', volume: 0.025 },
    confirm: { frequency: 440, endFrequency: 780, duration: 0.12, type: 'triangle', volume: 0.035 },
    warning: { frequency: 210, endFrequency: 150, duration: 0.18, type: 'square', volume: 0.028 },
    wave: { frequency: 260, endFrequency: 620, duration: 0.2, type: 'sawtooth', volume: 0.04 },
    reward: { frequency: 520, endFrequency: 880, duration: 0.16, type: 'triangle', volume: 0.035 },
    victory: { frequency: 330, endFrequency: 990, duration: 0.45, type: 'triangle', volume: 0.05 }
};

const THEME_TONES = {
    'new-york': [82.41, 123.47],
    avengers: [98, 146.83],
    wakanda: [110, 164.81],
    sanctum: [73.42, 146.83],
    'x-mansion': [87.31, 130.81],
    knowhere: [65.41, 130.81],
    latveria: [77.78, 116.54],
    asgard: [98, 196],
    'dark-dimension': [61.74, 123.47],
    'savage-land': [73.42, 110],
    'the-raft': [82.41, 164.81]
};

const MUSIC_TRACKS = [
    { id: 'ambient', title: 'Ambiente del mapa', src: '' },
    { id: 'marvel-opening-theme', title: 'Marvel Opening Theme', src: 'assets/audio/music/marvel-opening-theme.mp3' },
    { id: 'the-avengers-theme-song', title: 'The Avengers - Theme Song', src: 'assets/audio/music/the-avengers-theme-song.mp3' },
    { id: 'avengers-age-of-ultron-extended-theme', title: 'Avengers Age Of Ultron Extended Theme', src: 'assets/audio/music/avengers-age-of-ultron-extended-theme.mp3' },
    { id: 'avengers-doomsday-epic-version', title: 'Avengers Doomsday - Epic Version', src: 'assets/audio/music/avengers-doomsday-epic-version.mp3' },
    { id: 'divided-we-fall-civil-war', title: 'Divided We Fall - Civil War', src: 'assets/audio/music/divided-we-fall-civil-war.mp3' },
    { id: 'acdc-shoot-to-thrill-iron-man-2', title: 'AC/DC - Shoot To Thrill', src: 'assets/audio/music/acdc-shoot-to-thrill-iron-man-2.mp3' },
    { id: 'i-am-iron-man-john-debney', title: 'I Am Iron Man - John Debney', src: 'assets/audio/music/i-am-iron-man-john-debney.mp3' },
    { id: 'iron-man-2012-remaster', title: 'Iron Man - 2012 Remaster', src: 'assets/audio/music/iron-man-2012-remaster.mp3' },
    { id: 'doctor-strange-main-theme', title: 'Doctor Strange - Main Theme', src: 'assets/audio/music/doctor-strange-main-theme.mp3' },
    { id: 'xmen-first-class-theme', title: 'X-Men: First Class - First Class', src: 'assets/audio/music/xmen-first-class-theme.mp3' },
    { id: 'xmen-97-extended-theme', title: 'X-Men 97 Extended Theme', src: 'assets/audio/music/xmen-97-extended-theme.mp3' },
    { id: 'sakaar-chase-thor-ragnarok', title: 'Sakaar Chase - Thor Ragnarok', src: 'assets/audio/music/sakaar-chase-thor-ragnarok.mp3' },
    { id: 'spiderman-homecoming-suite', title: 'Spider-Man: Homecoming Suite', src: 'assets/audio/music/spiderman-homecoming-suite.mp3' }
];

export class AudioManager {
    constructor() {
        this.enabled = true;
        this.context = null;
        this.masterVolume = 0.7;
        this.musicVolume = 0.25;
        this.sfxVolume = 0.75;
        this.themeId = 'new-york';
        this.musicTrackId = 'ambient';
        this.musicLoop = false;
        this.nodes = null;
        this.ambient = [];
        this.musicElement = null;
    }

    setEnabled(enabled) {
        const next = Boolean(enabled);
        if (this.enabled === next) {
            this.applyVolumes();
            return;
        }
        this.enabled = next;
        if (!this.enabled) this.stopMusic();
        else this.startMusic();
        this.applyVolumes();
    }

    setBusVolume(bus, value) {
        const normalized = clampVolume(value);
        if (bus === 'master') this.masterVolume = normalized;
        if (bus === 'music') this.musicVolume = normalized;
        if (bus === 'sfx') this.sfxVolume = normalized;
        this.applyVolumes();
        return normalized;
    }

    getBusVolume(bus) {
        return bus === 'music' ? this.musicVolume : bus === 'sfx' ? this.sfxVolume : this.masterVolume;
    }

    setTheme(themeId) {
        this.themeId = THEME_TONES[themeId] ? themeId : 'new-york';
        if (this.musicTrackId === 'ambient' && this.context) this.startAmbient();
    }

    setMusicTrack(trackId) {
        const track = getMusicTrack(trackId);
        if (this.musicTrackId === track.id) {
            this.applyVolumes();
            return this.musicTrackId;
        }
        this.musicTrackId = track.id;
        this.stopMusic();
        this.startMusic();
        return this.musicTrackId;
    }

    setMusicLoop(enabled) {
        this.musicLoop = Boolean(enabled);
        if (this.musicElement) this.musicElement.loop = this.musicLoop;
        return this.musicLoop;
    }

    unlock() {
        if (!this.enabled || !this.ensureContext()) return false;
        if (this.context.state === 'suspended') this.context.resume();
        this.startMusic();
        return true;
    }

    play(cueName) {
        if (!this.enabled || !this.ensureContext()) return false;
        const cue = CUES[cueName];
        if (!cue) return false;
        if (this.context.state === 'suspended') this.context.resume();

        const now = this.context.currentTime;
        const oscillator = this.context.createOscillator();
        const gain = this.context.createGain();
        oscillator.type = cue.type;
        oscillator.frequency.setValueAtTime(cue.frequency, now);
        oscillator.frequency.exponentialRampToValueAtTime(cue.endFrequency, now + cue.duration);
        gain.gain.setValueAtTime(cue.volume, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + cue.duration);
        oscillator.connect(gain);
        gain.connect(this.nodes.sfx);
        oscillator.start(now);
        oscillator.stop(now + cue.duration);
        return true;
    }

    ensureContext() {
        if (this.context) return true;
        const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!AudioContextClass) return false;
        this.context = new AudioContextClass();
        const master = this.context.createGain();
        const music = this.context.createGain();
        const sfx = this.context.createGain();
        music.connect(master);
        sfx.connect(master);
        master.connect(this.context.destination);
        this.nodes = { master, music, sfx };
        this.applyVolumes();
        return true;
    }

    applyVolumes() {
        if (!this.nodes || !this.context) return;
        const now = this.context.currentTime;
        this.nodes.master.gain.setTargetAtTime(this.enabled ? this.masterVolume : 0, now, 0.03);
        this.nodes.music.gain.setTargetAtTime(this.musicVolume, now, 0.03);
        this.nodes.sfx.gain.setTargetAtTime(this.sfxVolume, now, 0.03);
        if (this.musicElement) this.musicElement.volume = this.enabled ? this.masterVolume * this.musicVolume : 0;
    }

    startMusic() {
        if (!this.enabled) return false;
        if (this.musicTrackId === 'ambient') {
            if (!this.context) return false;
            this.startAmbient();
            return true;
        }
        this.stopAmbient();
        return this.startTrackElement();
    }

    startTrackElement() {
        const track = getMusicTrack(this.musicTrackId);
        if (!track.src || typeof Audio === 'undefined') return false;
        if (!this.musicElement) {
            this.musicElement = new Audio();
            this.musicElement.preload = 'metadata';
            this.musicElement.addEventListener('ended', () => this.handleTrackEnded());
        }
        if (!this.musicElement.src.endsWith(track.src)) {
            this.musicElement.src = track.src;
            this.musicElement.currentTime = 0;
        }
        this.musicElement.loop = this.musicLoop;
        this.applyVolumes();
        const playPromise = this.musicElement.play?.();
        playPromise?.catch?.(() => {});
        return true;
    }

    handleTrackEnded() {
        if (this.musicLoop || this.musicTrackId === 'ambient') return;
        const tracks = MUSIC_TRACKS.filter((track) => track.src);
        const currentIndex = tracks.findIndex((track) => track.id === this.musicTrackId);
        const nextTrack = tracks[(currentIndex + 1 + tracks.length) % tracks.length] || tracks[0];
        this.musicTrackId = nextTrack.id;
        this.startTrackElement();
    }

    startAmbient() {
        if (!this.enabled || !this.context || !this.nodes) return;
        this.stopTrackElement();
        this.stopAmbient();
        const tones = THEME_TONES[this.themeId] || THEME_TONES['new-york'];
        this.ambient = tones.map((frequency, index) => {
            const oscillator = this.context.createOscillator();
            const gain = this.context.createGain();
            oscillator.type = index === 0 ? 'sine' : 'triangle';
            oscillator.frequency.value = frequency;
            gain.gain.value = index === 0 ? 0.018 : 0.009;
            oscillator.connect(gain);
            gain.connect(this.nodes.music);
            oscillator.start();
            return { oscillator, gain };
        });
    }

    stopAmbient() {
        this.ambient.forEach(({ oscillator }) => {
            try { oscillator.stop(); } catch { /* Already stopped. */ }
        });
        this.ambient = [];
    }

    stopTrackElement() {
        if (!this.musicElement) return;
        this.musicElement.pause?.();
    }

    stopMusic() {
        this.stopAmbient();
        this.stopTrackElement();
    }
}

function clampVolume(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
}

function getMusicTrack(trackId) {
    return MUSIC_TRACKS.find((track) => track.id === trackId) || MUSIC_TRACKS[0];
}

export { CUES, THEME_TONES, MUSIC_TRACKS, getMusicTrack };
