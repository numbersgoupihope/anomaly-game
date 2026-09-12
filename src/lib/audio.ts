const BASE_DETUNE_CENTS = 4;
const MAX_DETUNE_CENTS = 45;
const DRONE_GAIN = 0.05;

function distortionCurve(amount: number) {
  const samples = 256;
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((3 + amount) * x * 20 * (Math.PI / 180)) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private droneGain: GainNode | null = null;
  private oscA: OscillatorNode | null = null;
  private oscB: OscillatorNode | null = null;
  private tension = 0;
  enabled = false;

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new Ctx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.6;
      this.masterGain.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  async enable() {
    const ctx = this.ensureContext();
    if (ctx.state === "suspended") await ctx.resume();
    if (this.enabled) return;
    this.enabled = true;

    const droneGain = ctx.createGain();
    droneGain.gain.value = 0;
    droneGain.connect(this.masterGain!);
    droneGain.gain.linearRampToValueAtTime(DRONE_GAIN, ctx.currentTime + 1.5);
    this.droneGain = droneGain;

    const oscA = ctx.createOscillator();
    oscA.type = "sine";
    oscA.frequency.value = 55;
    oscA.connect(droneGain);
    oscA.start();

    const oscB = ctx.createOscillator();
    oscB.type = "sine";
    oscB.frequency.value = 55;
    oscB.detune.value = BASE_DETUNE_CENTS;
    oscB.connect(droneGain);
    oscB.start();

    this.oscA = oscA;
    this.oscB = oscB;
  }

  disable() {
    if (!this.enabled || !this.ctx) return;
    this.enabled = false;
    const ctx = this.ctx;
    const droneGain = this.droneGain;
    const oscA = this.oscA;
    const oscB = this.oscB;
    if (droneGain) {
      droneGain.gain.cancelScheduledValues(ctx.currentTime);
      droneGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
    }
    setTimeout(() => {
      oscA?.stop();
      oscB?.stop();
    }, 450);
    this.droneGain = null;
    this.oscA = null;
    this.oscB = null;
  }

  /** t in [0, 1] — 0 is calm, 1 is the last seconds of the timer. */
  setTension(t: number) {
    this.tension = Math.max(0, Math.min(1, t));
    if (!this.enabled || !this.ctx || !this.oscB) return;
    const cents =
      BASE_DETUNE_CENTS + (MAX_DETUNE_CENTS - BASE_DETUNE_CENTS) * this.tension;
    this.oscB.detune.linearRampToValueAtTime(cents, this.ctx.currentTime + 0.8);
  }

  playCorrect() {
    const ctx = this.ensureContext();
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(this.masterGain!);

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(880, ctx.currentTime + 0.25);
    osc.connect(gain);

    gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.05);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);

    osc.start();
    osc.stop(ctx.currentTime + 0.55);
  }

  playIncorrect() {
    const ctx = this.ensureContext();
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(this.masterGain!);

    const shaper = ctx.createWaveShaper();
    shaper.curve = distortionCurve(28) as Float32Array<ArrayBuffer>;
    shaper.connect(gain);

    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(140, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(70, ctx.currentTime + 0.4);
    osc.connect(shaper);

    gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.03);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.45);

    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  }
}

let instance: AudioEngine | null = null;

export function getAudioEngine(): AudioEngine {
  if (!instance) instance = new AudioEngine();
  return instance;
}
