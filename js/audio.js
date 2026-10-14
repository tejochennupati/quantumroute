/**
 * QUANTUMROUTE: AUDIO EMERGENCY BROADCAST & SIREN SYNTHESIZER
 * Pure Web Audio API & SpeechSynthesis implementation. Zero external mp3 dependencies.
 */

class QuantumAudioEngine {
    constructor() {
        this.ctx = null;
        this.isSirenPlaying = false;
        this.sirenOsc = null;
        this.sirenGain = null;
        this.modulator = null;
    }

    initContext() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.ctx = new AudioContext();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    /**
     * Synthesize Emergency Dual-Tone Siren using Frequency Modulation
     */
    playEmergencySiren(durationMs = 4000) {
        try {
            this.initContext();
            if (!this.ctx) return;

            // Stop any existing siren
            this.stopSiren();

            const now = this.ctx.currentTime;

            // Carrier oscillator (Main audible tone)
            const carrier = this.ctx.createOscillator();
            carrier.type = 'sawtooth';
            carrier.frequency.setValueAtTime(750, now);

            // Modulating oscillator (Warble LFO)
            const mod = this.ctx.createOscillator();
            mod.type = 'sine';
            mod.frequency.setValueAtTime(2.5, now); // 2.5 Hz warble rate

            // Modulator Gain (Depth of pitch shift)
            const modGain = this.ctx.createGain();
            modGain.gain.setValueAtTime(250, now); // Shifts frequency between 500Hz and 1000Hz

            mod.connect(modGain);
            modGain.connect(carrier.frequency);

            // Master Gain Envelope
            const masterGain = this.ctx.createGain();
            masterGain.gain.setValueAtTime(0.01, now);
            masterGain.gain.exponentialRampToValueAtTime(0.3, now + 0.2);
            masterGain.gain.setValueAtTime(0.3, now + (durationMs / 1000) - 0.4);
            masterGain.gain.exponentialRampToValueAtTime(0.001, now + (durationMs / 1000));

            carrier.connect(masterGain);
            masterGain.connect(this.ctx.destination);

            mod.start(now);
            carrier.start(now);

            this.sirenOsc = carrier;
            this.sirenGain = masterGain;
            this.modulator = mod;
            this.isSirenPlaying = true;

            setTimeout(() => {
                this.stopSiren();
            }, durationMs);

        } catch (err) {
            console.warn('Audio siren fallback error:', err);
        }
    }

    stopSiren() {
        try {
            if (this.sirenOsc) {
                this.sirenOsc.stop();
                this.sirenOsc.disconnect();
                this.sirenOsc = null;
            }
            if (this.modulator) {
                this.modulator.stop();
                this.modulator.disconnect();
                this.modulator = null;
            }
            this.isSirenPlaying = false;
        } catch (e) {}
    }

    /**
     * Play tactical UI chime for confirms / clicks
     */
    playBeep(freq = 880, duration = 0.15) {
        try {
            this.initContext();
            if (!this.ctx) return;

            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const now = this.ctx.currentTime;

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now);

            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + duration);
        } catch (e) {}
    }

    /**
     * Vocal Speech Directive using Web Speech API
     */
    speakDirective(text) {
        try {
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.rate = 1.05;
                utterance.pitch = 1.0;
                utterance.volume = 1.0;
                window.speechSynthesis.speak(utterance);
            }
        } catch (e) {
            console.warn('Speech synthesis unsupported:', e);
        }
    }

    /**
     * Full Audio Alert Routine: Siren followed by Voice Directive
     */
    triggerCommandAudioBroadcast(directiveText = "Command Emergency Directive: All units proceed to designated relief vectors.") {
        this.playEmergencySiren(2500);
        setTimeout(() => {
            this.speakDirective(directiveText);
        }, 2200);
    }
}

const audioEngine = new QuantumAudioEngine();

