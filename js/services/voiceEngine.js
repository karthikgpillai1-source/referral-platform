// Voice Engine - Standalone Speech Synthesis Module
// Finite State Machine: IDLE -> LOADING -> READY -> PLAYING -> PAUSED -> STOPPED -> COMPLETED -> FAILED

export const VoiceState = {
    IDLE: 'IDLE',
    LOADING: 'LOADING',
    READY: 'READY',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED',
    STOPPED: 'STOPPED',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED'
};

export class VoiceEngine {
    constructor(options = {}) {
        this.synth = window.speechSynthesis;
        this.state = VoiceState.IDLE;
        this.utterance = null;
        this.selectedVoice = null;
        this.spokenText = '';
        this.options = {
            rate: 0.92,
            pitch: 1.0,
            volume: 1.0,
            debug: true,
            ...options
        };

        // Callbacks
        this.onStateChange = null;
        this.onBoundary = null;
        this.onError = null;

        this.init();
    }

    debugLog(action, details = '') {
        if (this.options.debug) {
            console.log(`[VoiceEngine] [${this.state}] -> ${action}`, details);
        }
    }

    transitionTo(newState) {
        // Basic FSM rule verification
        const validStates = Object.values(VoiceState);
        if (!validStates.includes(newState)) {
            console.error(`[VoiceEngine] Invalid state transition: ${newState}`);
            return;
        }

        const oldState = this.state;
        this.state = newState;
        this.debugLog(`Transitioned from ${oldState}`);

        if (this.onStateChange) {
            this.onStateChange(this.state, oldState);
        }
    }

    init() {
        if (!this.synth) {
            this.transitionTo(VoiceState.FAILED);
            this.debugLog('Initialization Failed: speechSynthesis not supported.');
            return;
        }

        this.transitionTo(VoiceState.LOADING);
        this.loadVoices();

        if (this.synth.onvoiceschanged !== undefined) {
            this.synth.onvoiceschanged = () => {
                this.debugLog('Voices changed event fired.');
                this.loadVoices();
            };
        }

        // Global lifecycle hook to prevent speaking after page exit
        window.addEventListener('beforeunload', () => this.destroy());
        window.addEventListener('pagehide', () => this.destroy());
    }

    loadVoices() {
        if (!this.synth) return;
        const voices = this.synth.getVoices();
        if (voices.length === 0) {
            this.debugLog('No voices loaded yet. Retrying...');
            return;
        }

        // Voice selection priority: en-IN -> en-GB -> en-US -> first available
        const searchLanguages = ['en-IN', 'en-GB', 'en-US'];
        let foundVoice = null;

        for (const lang of searchLanguages) {
            const matches = voices.filter(v => 
                v.lang.toLowerCase().replace('_', '-').startsWith(lang.toLowerCase()) ||
                v.name.toLowerCase().includes(lang.split('-')[1].toLowerCase())
            );

            // Try natural/neural first
            foundVoice = matches.find(v => v.name.toLowerCase().includes('neural') || v.name.toLowerCase().includes('natural'));
            if (!foundVoice && matches.length > 0) {
                foundVoice = matches[0];
            }
            if (foundVoice) break;
        }

        if (!foundVoice && voices.length > 0) {
            foundVoice = voices[0];
        }

        this.selectedVoice = foundVoice;
        this.transitionTo(VoiceState.READY);
        this.debugLog('Ready with voice:', this.selectedVoice ? `${this.selectedVoice.name} (${this.selectedVoice.lang})` : 'System Default');
    }

    speak(text, pronunciationDict = {}) {
        if (!this.synth) {
            this.transitionTo(VoiceState.FAILED);
            if (this.onError) this.onError('Speech synthesis not supported.');
            return;
        }

        this.debugLog('Speak called.', { textLength: text.length });

        // Clean up previous playback immediately
        this.stop();

        // 1. Process Phonetic Text
        const words = text.split(/\s+/);
        const spokenWords = words.map(word => {
            const clean = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").toLowerCase();
            const phonetic = pronunciationDict[clean];
            if (phonetic) {
                const cleanIdx = word.toLowerCase().indexOf(clean);
                const prefix = word.slice(0, cleanIdx);
                const suffix = word.slice(cleanIdx + clean.length);
                return prefix + phonetic + suffix;
            }
            return word;
        });
        this.spokenText = spokenWords.join(' ');

        // 2. Build Spoken Segments for Highlight Matching
        let currentSpokenCharOffset = 0;
        const spokenSegments = words.map((word, idx) => {
            const clean = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").toLowerCase();
            const phonetic = pronunciationDict[clean];
            const spokenForm = phonetic ? word.toLowerCase().replace(clean, phonetic) : word;
            
            const start = currentSpokenCharOffset;
            const end = start + spokenForm.length;
            currentSpokenCharOffset = end + 1; // plus space

            return { origIndex: idx, word, start, end };
        });

        // 3. Create Utterance
        try {
            this.utterance = new SpeechSynthesisUtterance(this.spokenText);
            this.utterance.rate = this.options.rate;
            this.utterance.pitch = this.options.pitch;
            this.utterance.volume = this.options.volume;

            if (this.selectedVoice) {
                this.utterance.voice = this.selectedVoice;
            }

            // Garbage collection protection
            window.activeUtterances = window.activeUtterances || [];
            window.activeUtterances.push(this.utterance);

            // Bind listeners
            this.utterance.onstart = () => {
                this.transitionTo(VoiceState.PLAYING);
            };

            this.utterance.onboundary = (event) => {
                if (event.name !== 'word') return;
                const charIndex = event.charIndex;
                const segment = spokenSegments.find(s => charIndex >= s.start && charIndex < s.end);
                
                if (segment && this.onBoundary) {
                    this.onBoundary(segment.origIndex, segment.word, charIndex);
                }
            };

            this.utterance.onend = () => {
                this.cleanupUtterance();
                this.transitionTo(VoiceState.COMPLETED);
            };

            this.utterance.onerror = (e) => {
                this.cleanupUtterance();
                if (e.error === 'interrupted' || e.error === 'canceled') {
                    this.transitionTo(VoiceState.STOPPED);
                } else {
                    console.error('[VoiceEngine] Playback error:', e);
                    this.transitionTo(VoiceState.FAILED);
                    if (this.onError) this.onError(e.message || e.error || 'Speech failed');
                }
            };

            // Trigger speak
            this.synth.speak(this.utterance);

        } catch (err) {
            console.error('[VoiceEngine] Failed to initialize SpeechSynthesisUtterance:', err);
            this.transitionTo(VoiceState.FAILED);
            if (this.onError) this.onError(err.message || 'Initialization error');
        }
    }

    pause() {
        if (!this.synth || this.state !== VoiceState.PLAYING) return;
        this.synth.pause();
        this.transitionTo(VoiceState.PAUSED);
    }

    resume() {
        if (!this.synth || this.state !== VoiceState.PAUSED) return;
        this.synth.resume();
        this.transitionTo(VoiceState.PLAYING);
    }

    stop() {
        if (!this.synth) return;
        this.synth.cancel();
        this.cleanupUtterance();
        this.transitionTo(VoiceState.STOPPED);
    }

    cleanupUtterance() {
        if (this.utterance) {
            this.utterance.onstart = null;
            this.utterance.onboundary = null;
            this.utterance.onend = null;
            this.utterance.onerror = null;

            if (window.activeUtterances) {
                window.activeUtterances = window.activeUtterances.filter(u => u !== this.utterance);
            }
            this.utterance = null;
        }
    }

    destroy() {
        this.stop();
        if (this.synth) {
            this.synth.onvoiceschanged = null;
        }
        this.transitionTo(VoiceState.IDLE);
    }
}
