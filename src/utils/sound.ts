// Synthesized audio effects and procedural lo-fi background music engine using Web Audio API

export interface LoFiTrack {
  id: string;
  title: string;
  mood: string;
  bpm: number;
  description: string;
}

export const LOFI_TRACKS: LoFiTrack[] = [
  {
    id: 'coffee-pencils',
    title: 'Coffee & Pencils',
    mood: 'Warm Rhodes & Vinyl Hiss',
    bpm: 72,
    description: 'Soulful jazz chords with gentle vinyl warmth, ideal for deep numerical focus.',
  },
  {
    id: 'midnight-rain',
    title: 'Midnight Rain',
    mood: 'Moody Minor 9ths & Rain Taps',
    bpm: 68,
    description: 'Reflective minor keys with mellow rimshots and subtle ambient textures.',
  },
  {
    id: 'kyoto-zen',
    title: 'Kyoto Zen',
    mood: 'Ambient Pentatonic Bells & Sub',
    bpm: 64,
    description: 'Serene modal chords and deep warm sub-bass for mindful, stress-free solving.',
  },
  {
    id: 'sunset-tokyo',
    title: 'Sunset Tokyo',
    mood: 'Neo-Soul Chillhop Groove',
    bpm: 76,
    description: 'Relaxed groove with lush 7th chords and smooth lo-fi rhythm.',
  },
];

// Frequencies for chord notes (Hz)
const NOTE_FREQS: Record<string, number> = {
  // Octave 1 & 2 (Bass)
  Bb1: 58.27, C2: 65.41, D2: 73.42, Eb2: 77.78, E2: 82.41, F2: 87.31, G2: 98.0, A2: 110.0, Bb2: 116.54, B2: 123.47,
  // Octave 3 (Mid roots & tenor)
  C3: 130.81, D3: 146.83, Eb3: 155.56, E3: 164.81, F3: 174.61, G3: 196.0, A3: 220.0, Bb3: 233.08, B3: 246.94,
  // Octave 4 (Main Rhodes voicing)
  C4: 261.63, 'C#4': 277.18, D4: 293.66, Eb4: 311.13, E4: 329.63, F4: 349.23, 'F#4': 369.99, G4: 392.0,
  Ab4: 415.3, A4: 440.0, Bb4: 466.16, B4: 493.88,
  // Octave 5 (Overtones & accents)
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0, B5: 987.77,
};

interface TrackChordProgression {
  bpm: number;
  chords: Array<{
    bass: string;
    keys: string[];
  }>;
}

const CHORD_PROGRESSIONS: Record<string, TrackChordProgression> = {
  'coffee-pencils': {
    bpm: 72,
    chords: [
      { bass: 'C2', keys: ['C3', 'E3', 'G3', 'B3', 'E4'] }, // Cmaj7
      { bass: 'A2', keys: ['A2', 'G3', 'C4', 'E4', 'B4'] }, // Am9
      { bass: 'D2', keys: ['D3', 'F3', 'A3', 'C4', 'F4'] }, // Dm7
      { bass: 'G2', keys: ['G2', 'F3', 'B3', 'E4', 'A4'] }, // G13
    ],
  },
  'midnight-rain': {
    bpm: 68,
    chords: [
      { bass: 'D2', keys: ['D3', 'F3', 'A3', 'C4', 'E4'] }, // Dm9
      { bass: 'G2', keys: ['G2', 'F3', 'Bb3', 'D4', 'G4'] }, // Gm7
      { bass: 'Bb2', keys: ['Bb2', 'F3', 'A3', 'D4', 'F4'] }, // Bbmaj7
      { bass: 'A2', keys: ['A2', 'G3', 'C#4', 'F4', 'Bb4'] }, // A7alt
    ],
  },
  'kyoto-zen': {
    bpm: 64,
    chords: [
      { bass: 'F2', keys: ['F2', 'C3', 'A3', 'C4', 'E4', 'G4'] }, // Fmaj9
      { bass: 'E2', keys: ['E2', 'B2', 'G3', 'C4', 'E4'] }, // Cmaj7/E
      { bass: 'D2', keys: ['D2', 'A2', 'F3', 'C4', 'D4'] }, // Dm7
      { bass: 'Bb1', keys: ['Bb1', 'F2', 'D3', 'A3', 'C4'] }, // Bbmaj9
    ],
  },
  'sunset-tokyo': {
    bpm: 76,
    chords: [
      { bass: 'Eb2', keys: ['Eb2', 'Bb2', 'G3', 'D4', 'F4'] }, // Ebmaj7
      { bass: 'C2', keys: ['C2', 'G2', 'Eb3', 'Bb3', 'D4'] }, // Cm7
      { bass: 'F2', keys: ['F2', 'C3', 'Ab4', 'Eb4', 'G4'] }, // Fm9
      { bass: 'Bb2', keys: ['Bb2', 'F3', 'Ab4', 'C4', 'D4'] }, // Bb9
    ],
  },
};

/**
 * Triggers subtle haptic vibration triggers for mobile devices
 */
export const triggerHaptic = (pattern: number | number[] = 15) => {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {}
};

class SoundEngine {
  private ctx: AudioContext | null = null;
  public enabled = true;
  public volume = 0.8; // SFX volume: 0.0 to 1.0

  // BGM Engine properties
  public bgmPlaying = false;
  public bgmVolume = 0.45; // BGM volume: 0.0 to 1.0
  public currentTrackIndex = 0;
  public tracks = LOFI_TRACKS;

  private bgmMasterGain: GainNode | null = null;
  private bgmFilterNode: BiquadFilterNode | null = null;
  private vinylNode: AudioBufferSourceNode | null = null;
  private vinylGain: GainNode | null = null;
  private schedulerTimer: number | null = null;
  private currentBeat = 0;
  private currentChordIndex = 0;
  private listeners: Set<() => void> = new Set();

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => {
      try {
        l();
      } catch {}
    });
  }

  public toggleSound(): boolean {
    this.enabled = !this.enabled;
    triggerHaptic(this.enabled ? [15, 30, 15] : 20);
    this.notify();
    return this.enabled;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.volume === 0) {
      this.enabled = false;
    } else {
      this.enabled = true;
    }
    this.notify();
  }

  public setBgmVolume(vol: number) {
    this.bgmVolume = Math.max(0, Math.min(1, vol));
    if (this.bgmMasterGain && this.ctx) {
      this.bgmMasterGain.gain.setValueAtTime(this.bgmPlaying ? this.bgmVolume : 0, this.ctx.currentTime);
    }
    this.notify();
  }

  public get currentTrack(): LoFiTrack {
    return this.tracks[this.currentTrackIndex] || this.tracks[0];
  }

  public toggleBgm(): boolean {
    triggerHaptic(15);
    if (this.bgmPlaying) {
      this.stopBgm();
      return false;
    } else {
      this.startBgm();
      return true;
    }
  }

  public startBgm() {
    const ctx = this.getContext();
    if (!ctx) return;

    if (this.bgmPlaying) return;
    this.bgmPlaying = true;

    // Ensure Master BGM Bus
    if (!this.bgmMasterGain) {
      this.bgmMasterGain = ctx.createGain();
      this.bgmFilterNode = ctx.createBiquadFilter();
      this.bgmFilterNode.type = 'lowpass';
      this.bgmFilterNode.frequency.setValueAtTime(3200, ctx.currentTime); // Soft vintage lo-fi ceiling
      this.bgmFilterNode.connect(ctx.destination);
      this.bgmMasterGain.connect(this.bgmFilterNode);
    }

    // Smooth fade in
    this.bgmMasterGain.gain.cancelScheduledValues(ctx.currentTime);
    this.bgmMasterGain.gain.setValueAtTime(0, ctx.currentTime);
    this.bgmMasterGain.gain.linearRampToValueAtTime(this.bgmVolume, ctx.currentTime + 0.6);

    // Start background vinyl hiss & crackle
    this.startVinylCrackle(ctx);

    // Reset loop markers and schedule step loop
    this.currentBeat = 0;
    this.currentChordIndex = 0;
    this.scheduleNextBeat();

    this.notify();
  }

  public stopBgm() {
    if (!this.bgmPlaying) return;
    this.bgmPlaying = false;

    if (this.schedulerTimer !== null) {
      window.clearTimeout(this.schedulerTimer);
      this.schedulerTimer = null;
    }

    if (this.bgmMasterGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.bgmMasterGain.gain.cancelScheduledValues(now);
      this.bgmMasterGain.gain.setValueAtTime(this.bgmMasterGain.gain.value, now);
      this.bgmMasterGain.gain.linearRampToValueAtTime(0.0001, now + 0.4);
    }

    this.stopVinylCrackle();
    this.notify();
  }

  public nextTrack() {
    this.currentTrackIndex = (this.currentTrackIndex + 1) % this.tracks.length;
    this.restartCurrentTrack();
  }

  public prevTrack() {
    this.currentTrackIndex = (this.currentTrackIndex - 1 + this.tracks.length) % this.tracks.length;
    this.restartCurrentTrack();
  }

  public setTrack(index: number) {
    if (index >= 0 && index < this.tracks.length) {
      this.currentTrackIndex = index;
      this.restartCurrentTrack();
    }
  }

  private restartCurrentTrack() {
    if (this.bgmPlaying) {
      if (this.schedulerTimer !== null) {
        window.clearTimeout(this.schedulerTimer);
        this.schedulerTimer = null;
      }
      this.currentBeat = 0;
      this.currentChordIndex = 0;
      this.scheduleNextBeat();
    }
    this.notify();
  }

  /**
   * Procedural vinyl crackle & warm tape hiss texture generator
   */
  private startVinylCrackle(ctx: AudioContext) {
    try {
      this.stopVinylCrackle();
      // Generate 3 seconds of looped vinyl crackle
      const bufferSize = ctx.sampleRate * 3;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);

      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        // Pink noise filter approximation
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        let pink = b0 + b1 + b2 + white * 0.5362;
        // Occasional vinyl micro-crackles
        if (Math.random() < 0.002) {
          pink += (Math.random() - 0.5) * 4.5;
        }
        data[i] = pink * 0.035;
      }

      this.vinylNode = ctx.createBufferSource();
      this.vinylNode.buffer = buffer;
      this.vinylNode.loop = true;

      const vinylFilter = ctx.createBiquadFilter();
      vinylFilter.type = 'bandpass';
      vinylFilter.frequency.setValueAtTime(1200, ctx.currentTime);
      vinylFilter.Q.setValueAtTime(0.8, ctx.currentTime);

      this.vinylGain = ctx.createGain();
      this.vinylGain.gain.setValueAtTime(0.08, ctx.currentTime);

      this.vinylNode.connect(vinylFilter);
      vinylFilter.connect(this.vinylGain);
      if (this.bgmMasterGain) {
        this.vinylGain.connect(this.bgmMasterGain);
      }
      this.vinylNode.start();
    } catch {}
  }

  private stopVinylCrackle() {
    try {
      if (this.vinylNode) {
        this.vinylNode.stop();
        this.vinylNode.disconnect();
        this.vinylNode = null;
      }
    } catch {}
  }

  /**
   * Loop scheduler for chords, sub bass, and gentle lo-fi drum beats
   */
  private scheduleNextBeat() {
    if (!this.bgmPlaying) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const track = this.currentTrack;
    const prog = CHORD_PROGRESSIONS[track.id] || CHORD_PROGRESSIONS['coffee-pencils'];
    const secondsPerBeat = 60 / prog.bpm;

    const chord = prog.chords[this.currentChordIndex];

    // Trigger chord & sub on beat 0 of each 4-beat bar
    if (this.currentBeat === 0) {
      this.playLofiChord(ctx, chord.keys, secondsPerBeat * 3.8);
      this.playSubBass(ctx, chord.bass, secondsPerBeat * 3.2);
    }

    // Trigger soft drums
    if (this.currentBeat === 0) {
      // Warm Lo-Fi Kick on beat 1
      this.playLofiKick(ctx);
    } else if (this.currentBeat === 2) {
      // Gentle Rimshot / Brush Snare on beat 3
      this.playLofiRimshot(ctx);
    }

    // Subtle soft hi-hat on offbeats
    this.playLofiHiHat(ctx, secondsPerBeat);

    // Advance beat and chord indices
    this.currentBeat = (this.currentBeat + 1) % 4;
    if (this.currentBeat === 0) {
      this.currentChordIndex = (this.currentChordIndex + 1) % prog.chords.length;
    }

    // Schedule next beat
    this.schedulerTimer = window.setTimeout(() => {
      this.scheduleNextBeat();
    }, secondsPerBeat * 1000);
  }

  /**
   * Plays lush, warm, tape-chorused electric piano keys
   */
  private playLofiChord(ctx: AudioContext, noteNames: string[], duration: number) {
    const masterGain = this.bgmMasterGain;
    if (!masterGain) return;
    const now = ctx.currentTime;

    noteNames.forEach((noteName, idx) => {
      const freq = NOTE_FREQS[noteName];
      if (!freq) return;

      try {
        // Dual oscillator for rich, gentle tape chorusing
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const chordGain = ctx.createGain();

        // Warm lowpass filter per note
        const noteFilter = ctx.createBiquadFilter();
        noteFilter.type = 'lowpass';
        noteFilter.frequency.setValueAtTime(1400, now);
        noteFilter.frequency.exponentialRampToValueAtTime(800, now + duration);

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(freq, now);

        osc2.type = 'triangle';
        // Gentle micro-detune (+1.8 cents) for analog tape wow & flutter
        osc2.frequency.setValueAtTime(freq * 1.0018, now);

        // Dynamic humanized velocity
        const baseVel = 0.055 / Math.sqrt(noteNames.length);
        const stagger = idx * 0.025; // Slight strum stagger
        const startTime = now + stagger;

        chordGain.gain.setValueAtTime(0.0001, startTime);
        chordGain.gain.linearRampToValueAtTime(baseVel, startTime + 0.04);
        chordGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

        osc1.connect(noteFilter);
        osc2.connect(noteFilter);
        noteFilter.connect(chordGain);
        chordGain.connect(masterGain);

        osc1.start(startTime);
        osc2.start(startTime);
        osc1.stop(startTime + duration + 0.1);
        osc2.stop(startTime + duration + 0.1);
      } catch {}
    });
  }

  /**
   * Warm sub-bass note underpinning the chord progression
   */
  private playSubBass(ctx: AudioContext, noteName: string, duration: number) {
    const masterGain = this.bgmMasterGain;
    if (!masterGain) return;
    const freq = NOTE_FREQS[noteName];
    if (!freq) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(now);
      osc.stop(now + duration + 0.1);
    } catch {}
  }

  /**
   * Soft, pillowy lo-fi kick drum with fast pitch drop
   */
  private playLofiKick(ctx: AudioContext) {
    const masterGain = this.bgmMasterGain;
    if (!masterGain) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.exponentialRampToValueAtTime(42, now + 0.09);

      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(now);
      osc.stop(now + 0.19);
    } catch {}
  }

  /**
   * Delicate acoustic rimshot / brush snare
   */
  private playLofiRimshot(ctx: AudioContext) {
    const masterGain = this.bgmMasterGain;
    if (!masterGain) return;
    try {
      const now = ctx.currentTime;
      // Filtered noise burst
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.4;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1900, now);
      filter.Q.setValueAtTime(1.5, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain);

      noise.start(now);
      noise.stop(now + 0.08);
    } catch {}
  }

  /**
   * Soft lo-fi hi-hat on eighth notes
   */
  private playLofiHiHat(ctx: AudioContext, secondsPerBeat: number) {
    const masterGain = this.bgmMasterGain;
    if (!masterGain) return;
    try {
      const now = ctx.currentTime + secondsPerBeat * 0.5; // Offbeat
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.03, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.2;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(5000, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.02, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain);

      noise.start(now);
      noise.stop(now + 0.03);
    } catch {}
  }

  // ==================== SFX Sound Effects ====================

  /**
   * Subtle wooden click sound when selecting a cell
   */
  public playSelect() {
    const ctx = this.getContext();
    if (!ctx || !this.enabled) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(820, ctx.currentTime + 0.035);

      const targetGain = 0.045 * this.volume;
      gain.gain.setValueAtTime(targetGain, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.035);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.04);
    } catch {}
  }

  /**
   * Distinct resonant dual-tone success chime when placing a verified number
   */
  public playCorrect() {
    const ctx = this.getContext();
    if (!ctx || !this.enabled) return;
    try {
      const now = ctx.currentTime;
      // Primary chime
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.08); // A5

      const targetGain1 = 0.1 * this.volume;
      gain1.gain.setValueAtTime(targetGain1, now);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.23);

      // Harmony overtone
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1174.66, now + 0.04); // D6
      const targetGain2 = 0.05 * this.volume;
      gain2.gain.setValueAtTime(targetGain2, now + 0.04);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.04);
      osc2.stop(now + 0.27);
    } catch {}
  }

  /**
   * Distinct descending low sawtooth error buzzer when placing an incorrect number
   */
  public playError() {
    const ctx = this.getContext();
    if (!ctx || !this.enabled) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.linearRampToValueAtTime(130, now + 0.22);

      const targetGain = 0.09 * this.volume;
      gain.gain.setValueAtTime(targetGain, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } catch {}
  }

  /**
   * Victorious arpeggio chime upon completing the puzzle
   */
  public playVictory() {
    const ctx = this.getContext();
    if (!ctx || !this.enabled) return;
    try {
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const now = ctx.currentTime + idx * 0.085;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        const targetGain = 0.1 * this.volume;
        gain.gain.setValueAtTime(targetGain, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.36);
      });
    } catch {}
  }
}

export const soundEngine = new SoundEngine();
