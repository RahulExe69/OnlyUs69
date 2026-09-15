// Web Audio API Ringtone & Audio Tone Synthesizer for OnlyUs Calling
// Zero external sound asset dependencies; 100% reliable in all browsers & WebViews

class SoundEffects {
  private ctx: AudioContext | null = null;
  private ringtoneInterval: any = null;
  private isRinging = false;

  private getAudioContext(): AudioContext | null {
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  // Play an outgoing ringing beep (US/UK style ring tone: 440Hz + 480Hz tone for 1.8s, then silence)
  startOutgoingRingtone() {
    if (this.isRinging) return;
    this.isRinging = true;

    const playCycle = () => {
      if (!this.isRinging) return;
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc1.frequency.setValueAtTime(440, now);
      osc2.frequency.setValueAtTime(480, now);

      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.06, now + 0.05);
      gainNode.gain.setValueAtTime(0.06, now + 1.6);
      gainNode.gain.linearRampToValueAtTime(0, now + 1.8);

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 1.8);
      osc2.stop(now + 1.8);
    };

    playCycle();
    this.ringtoneInterval = setInterval(playCycle, 3500);
  }

  // Play pleasant incoming ringtone (Two gentle melodic chords cycling)
  startIncomingRingtone() {
    if (this.isRinging) return;
    this.isRinging = true;

    // Vibration on supported mobile devices
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([400, 300, 400, 1000]);
      } catch {}
    }

    const notes = [
      { f: 523.25, time: 0 },    // C5
      { f: 659.25, time: 0.18 }, // E5
      { f: 783.99, time: 0.36 }, // G5
      { f: 1046.5, time: 0.54 }, // C6
    ];

    const playTune = () => {
      if (!this.isRinging) return;
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const baseNow = ctx.currentTime;
      notes.forEach(({ f, time }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, baseNow + time);

        gain.gain.setValueAtTime(0, baseNow + time);
        gain.gain.linearRampToValueAtTime(0.12, baseNow + time + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, baseNow + time + 0.38);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(baseNow + time);
        osc.stop(baseNow + time + 0.4);
      });

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate([400, 300, 400, 1000]);
        } catch {}
      }
    };

    playTune();
    this.ringtoneInterval = setInterval(playTune, 2800);
  }

  // Stop any active ringtone or vibrations
  stopRingtone() {
    this.isRinging = false;
    if (this.ringtoneInterval) {
      clearInterval(this.ringtoneInterval);
      this.ringtoneInterval = null;
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(0);
      } catch {}
    }
  }

  // Connected tone
  playConnectedTone() {
    this.stopRingtone();
    const ctx = this.getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  // End call tone (downward chime)
  playEndTone() {
    this.stopRingtone();
    const ctx = this.getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.linearRampToValueAtTime(220, now + 0.28);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.3);
  }
}

export const callAudio = new SoundEffects();
