export type SoundCueType =
  | 'NIGHTFALL'
  | 'DAWN_ROOSTER'
  | 'WOLF_HOWL'
  | 'GAVEL'
  | 'HUNTER_SHOT'
  | 'VICTORY'
  | 'CLICK';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;

  private getContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  public play(cue: SoundCueType): void {
    const ctx = this.getContext();
    if (!ctx) return;

    switch (cue) {
      case 'NIGHTFALL':
        this.playNightfallChimes(ctx);
        break;
      case 'DAWN_ROOSTER':
        this.playDawnRooster(ctx);
        break;
      case 'WOLF_HOWL':
        this.playWolfHowl(ctx);
        break;
      case 'GAVEL':
        this.playGavelHit(ctx);
        break;
      case 'HUNTER_SHOT':
        this.playHunterShot(ctx);
        break;
      case 'VICTORY':
        this.playVictoryFanfare(ctx);
        break;
      case 'CLICK':
        this.playClick(ctx);
        break;
    }
  }

  private playNightfallChimes(ctx: AudioContext): void {
    const now = ctx.currentTime;
    const notes = [523.25, 392.0, 311.13, 261.63]; // C5, G4, Eb4, C4 (C minor)
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.22);

      gain.gain.setValueAtTime(0.001, now + idx * 0.22);
      gain.gain.exponentialRampToValueAtTime(0.12, now + idx * 0.22 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.22 + 1.4);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.22);
      osc.stop(now + idx * 0.22 + 1.45);
    });
  }

  private playDawnRooster(ctx: AudioContext): void {
    const now = ctx.currentTime;
    // Rooster crow motif: 4 notes with a bright rising glissando on the 4th
    const pattern = [
      { freq: 587.33, start: 0.0, dur: 0.14 },
      { freq: 659.25, start: 0.16, dur: 0.14 },
      { freq: 783.99, start: 0.32, dur: 0.16 },
      { freq: 880.0, endFreq: 1046.5, start: 0.5, dur: 0.65 },
    ];

    pattern.forEach((step) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(step.freq, now + step.start);
      if (step.endFreq) {
        osc.frequency.exponentialRampToValueAtTime(
          step.endFreq,
          now + step.start + 0.2
        );
        osc.frequency.exponentialRampToValueAtTime(
          step.freq * 0.85,
          now + step.start + step.dur
        );
      }

      gain.gain.setValueAtTime(0.001, now + step.start);
      gain.gain.exponentialRampToValueAtTime(0.14, now + step.start + 0.03);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + step.start + step.dur
      );

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + step.start);
      osc.stop(now + step.start + step.dur + 0.05);
    });
  }

  private playWolfHowl(ctx: AudioContext): void {
    const now = ctx.currentTime + 0.3;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(650, now);

    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(460, now + 0.55);
    osc.frequency.setValueAtTime(460, now + 0.85);
    osc.frequency.exponentialRampToValueAtTime(290, now + 1.85);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.9);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 1.95);
  }

  private playGavelHit(ctx: AudioContext): void {
    const now = ctx.currentTime;
    [0, 0.22].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(160, now + offset);
      osc.frequency.exponentialRampToValueAtTime(48, now + offset + 0.14);

      gain.gain.setValueAtTime(0.22, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.16);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.18);
    });
  }

  private playHunterShot(ctx: AudioContext): void {
    const now = ctx.currentTime;
    // Noise burst + sub impact
    const bufferSize = ctx.sampleRate * 0.35;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.07));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(900, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
  }

  private playVictoryFanfare(ctx: AudioContext): void {
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.14);

      gain.gain.setValueAtTime(0.001, now + i * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.14, now + i * 0.14 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.14 + 0.8);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.14);
      osc.stop(now + i * 0.14 + 0.85);
    });
  }

  private playClick(ctx: AudioContext): void {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.04);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.045);
  }
}

export const soundEngine = new SoundEngine();
