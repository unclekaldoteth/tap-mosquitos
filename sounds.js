/* ============================================
   TAP THAT MOSQUITO - SOUND EFFECTS
   Using Web Audio API for procedural sounds
   ============================================ */

class SoundManager {
    constructor() {
        this.audioContext = null;
        this.isMuted = false;
        this.isInitialized = false;
    }

    async init() {
        if (this.isInitialized) return;

        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.isInitialized = true;
        } catch (e) {
            console.warn('Web Audio API not supported');
        }
    }

    // Resume audio context (needed after user interaction)
    async resume() {
        if (this.audioContext?.state === 'suspended') {
            await this.audioContext.resume();
        }
    }

    toggle() {
        this.isMuted = !this.isMuted;
        return this.isMuted;
    }

    // Splat sound - quick impact noise
    playSplat() {
        if (this.isMuted || !this.audioContext) return;
        this.resume();

        const ctx = this.audioContext;
        const now = ctx.currentTime;

        // Create noise for splat
        const bufferSize = ctx.sampleRate * 0.1;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        // Filter for punch
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, now);
        filter.frequency.exponentialRampToValueAtTime(200, now + 0.1);

        // Gain envelope
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        noise.start(now);
        noise.stop(now + 0.1);
    }

    // Combo sound - ascending tone
    playCombo(comboLevel) {
        if (this.isMuted || !this.audioContext) return;
        this.resume();

        const ctx = this.audioContext;
        const now = ctx.currentTime;

        // Higher pitch for higher combos
        const baseFreq = 400 + (comboLevel * 50);

        const osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(baseFreq, now);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.1);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.15);
    }

    // Buzzing ambient sound
    playBuzz() {
        if (this.isMuted || !this.audioContext) return;
        this.resume();

        const ctx = this.audioContext;
        const now = ctx.currentTime;

        // Low frequency oscillator for buzz
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, now);

        // Tremolo effect
        const tremolo = ctx.createOscillator();
        tremolo.frequency.setValueAtTime(20, now);

        const tremoloGain = ctx.createGain();
        tremoloGain.gain.setValueAtTime(0.05, now);

        tremolo.connect(tremoloGain);

        const mainGain = ctx.createGain();
        mainGain.gain.setValueAtTime(0.08, now);
        mainGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

        tremoloGain.connect(mainGain.gain);
        osc.connect(mainGain);
        mainGain.connect(ctx.destination);

        osc.start(now);
        tremolo.start(now);
        osc.stop(now + 0.3);
        tremolo.stop(now + 0.3);
    }

    // Game start sound
    playStart() {
        if (this.isMuted || !this.audioContext) return;
        this.resume();

        const ctx = this.audioContext;
        const now = ctx.currentTime;

        const notes = [523.25, 659.25, 783.99]; // C5, E5, G5

        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            osc.type = 'square';
            osc.frequency.setValueAtTime(freq, now + i * 0.1);

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.15, now + i * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.15);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now + i * 0.1);
            osc.stop(now + i * 0.1 + 0.15);
        });
    }

    // Game over sound
    playGameOver() {
        if (this.isMuted || !this.audioContext) return;
        this.resume();

        const ctx = this.audioContext;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.5);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.5);
    }

    // Timer warning beep
    playWarning() {
        if (this.isMuted || !this.audioContext) return;
        this.resume();

        const ctx = this.audioContext;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, now);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.1);
    }
}

export const soundManager = new SoundManager();
