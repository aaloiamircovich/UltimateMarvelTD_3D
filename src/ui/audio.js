export class AudioManager {
  constructor(enabled) { this.enabled = enabled; }
  unlock() {
    try { this.context ||= new AudioContext(); if (this.context.state === 'suspended') this.context.resume().catch(() => {}); } catch { /* Audio is optional. */ }
  }
  play(type) {
    if (!this.enabled || !this.context || this.context.state !== 'running') return;
    const pitches = { deploy: 520, upgrade: 780, wave: 180, clear: 660, boss: 90, leak: 120, end: 440 };
    if (!pitches[type]) return;
    const osc = this.context.createOscillator(), gain = this.context.createGain(), now = this.context.currentTime;
    osc.type = type === 'boss' ? 'sawtooth' : 'sine';
    osc.frequency.setValueAtTime(pitches[type], now); osc.frequency.exponentialRampToValueAtTime(pitches[type] * 1.5, now + 0.17);
    gain.gain.setValueAtTime(0.035, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain); gain.connect(this.context.destination); osc.start(); osc.stop(now + 0.26);
  }
}
