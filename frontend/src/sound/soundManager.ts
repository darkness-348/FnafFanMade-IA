class SoundManager {
  private ctx: AudioContext | null = null;
  private buffers: Map<string, AudioBuffer> = new Map();
  private ambientSource: AudioBufferSourceNode | null = null;
  private isMuted: boolean = false;
  private volume: number = 0.8;

  constructor() {
    // Lazy init on first user interaction
  }

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public async preloadSounds(sounds: string[]) {
    this.initContext();
    for (const s of sounds) {
      if (!this.buffers.has(s)) {
        try {
          const res = await fetch(`/assets/audio/${s}`);
          if (res.ok) {
            const arrayBuffer = await res.arrayBuffer();
            if (this.ctx) {
              const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
              this.buffers.set(s, audioBuffer);
            }
          }
        } catch (e) {
          console.warn(`[SoundManager] Could not load ${s}:`, e);
        }
      }
    }
  }

  public async playSound(soundName: string, options?: { pan?: number; loop?: boolean; volume?: number }): Promise<AudioBufferSourceNode | null> {
    if (this.isMuted) return null;
    this.initContext();
    if (!this.ctx) return null;

    let buffer = this.buffers.get(soundName);
    if (!buffer) {
      try {
        const res = await fetch(`/assets/audio/${soundName}`);
        if (!res.ok) return null;
        const arrayBuf = await res.arrayBuffer();
        buffer = await this.ctx.decodeAudioData(arrayBuf);
        this.buffers.set(soundName, buffer);
      } catch (err) {
        console.warn(`Failed to play sound: ${soundName}`, err);
        return null;
      }
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = !!options?.loop;

    const gainNode = this.ctx.createGain();
    const finalVolume = (options?.volume ?? 1.0) * this.volume;
    gainNode.gain.setValueAtTime(finalVolume, this.ctx.currentTime);

    // Stereo panning if requested
    if (options?.pan !== undefined && typeof this.ctx.createStereoPanner === 'function') {
      const panner = this.ctx.createStereoPanner();
      panner.pan.setValueAtTime(Math.max(-1, Math.min(1, options.pan)), this.ctx.currentTime);
      source.connect(panner);
      panner.connect(gainNode);
    } else {
      source.connect(gainNode);
    }

    gainNode.connect(this.ctx.destination);
    source.start(0);
    return source;
  }

  public playSpecialAudio(soundName: string = 'audio01.wav', pan: number = 0.0) {
    return this.playSound(soundName, { pan, volume: 1.0 });
  }

  public startAmbience() {
    if (this.ambientSource) return;
    this.playSound('ambiance2.wav', { loop: true, volume: 0.35 }).then((src) => {
      this.ambientSource = src;
    });
  }

  public stopAmbience() {
    if (this.ambientSource) {
      try {
        this.ambientSource.stop();
      } catch (e) {}
      this.ambientSource = null;
    }
  }

  public playJumpscare(soundName: string = 'fnaf6scream.wav') {
    this.stopAmbience();
    this.playSound(soundName, { volume: 1.2 });
  }

  public playShock() {
    this.playSound('shock.wav', { volume: 1.0 });
  }

  public playCameraFlip() {
    this.playSound('camera.wav', { volume: 0.8 });
  }

  public playBlockThud(pan: number = 0.0) {
    this.playSound('blockb.wav', { pan, volume: 1.1 });
  }

  public playDoorThud() {
    this.playSound('doorFX.wav', { volume: 0.9 });
  }

  public playVentBang() {
    this.playSound('ventbang.wav', { volume: 0.9 });
  }

  public playBlip() {
    this.playSound('blip.wav', { volume: 0.6 });
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopAmbience();
    }
    return this.isMuted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }
}

export const soundManager = new SoundManager();

