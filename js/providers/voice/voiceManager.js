// Voice Manager - Entry gateway for all voice providers and FSM management
import { BrowserProvider } from './browserProvider.js';
import { IndianVoiceProvider } from './indianVoiceProvider.js';
import { FutureCloudProvider } from './futureCloudProvider.js';

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

export class VoiceManager {
    constructor(options = {}) {
        this.state = VoiceState.IDLE;
        this.provider = null;
        this.options = {
            rate: 0.92,
            pitch: 1.0,
            volume: 1.0,
            debug: true,
            ...options
        };

        // Playback state metrics
        this.originalText = '';
        this.spokenText = '';
        this.spokenSegments = [];
        this.totalWords = 0;
        this.currentWordIdx = 0;
        this.startTime = null;
        this.elapsedTimeBeforePause = 0;

        // Callbacks
        this.onStateChange = null;
        this.onBoundary = null;
        this.onError = null;
        this.onProgressUpdate = null;

        this.init();
    }

    debugLog(action, details = '') {
        if (this.options.debug) {
            console.log(`[VoiceManager] [${this.state}] -> ${action}`, details);
        }
    }

    transitionTo(newState) {
        const validStates = Object.values(VoiceState);
        if (!validStates.includes(newState)) {
            console.error(`[VoiceManager] Invalid state transition: ${newState}`);
            return;
        }

        const oldState = this.state;
        this.state = newState;
        this.debugLog(`Transitioned from ${oldState}`);

        if (this.onStateChange) {
            this.onStateChange(this.state, oldState);
        }
    }

    async init() {
        this.transitionTo(VoiceState.LOADING);
        
        try {
            // Priority 1/2: Indian Voice Provider
            const indianProv = new IndianVoiceProvider();
            await indianProv.init();
            const voices = await indianProv.loadVoices();
            const selected = indianProv.selectVoice(voices);

            if (selected) {
                this.provider = indianProv;
                this.transitionTo(VoiceState.READY);
                this.debugLog(`Selected Provider: ${this.provider.name} | Voice: ${selected.name}`);
                return;
            }

            // Priority 3: Fallback to General Browser en-GB
            const fallbackProv = new BrowserProvider();
            await fallbackProv.init();
            const fallbackVoices = await fallbackProv.loadVoices();
            const fallbackSelected = fallbackProv.selectVoice(fallbackVoices, ['en-GB']);

            if (fallbackSelected) {
                this.provider = fallbackProv;
                this.transitionTo(VoiceState.READY);
                this.debugLog(`Selected Fallback Provider: ${this.provider.name} (en-GB) | Voice: ${fallbackSelected.name}`);
                return;
            }

            // Priority 4: Fallback to General Browser en-US
            const fallbackSelectedUS = fallbackProv.selectVoice(fallbackVoices, ['en-US']);
            if (fallbackSelectedUS) {
                this.provider = fallbackProv;
                this.transitionTo(VoiceState.READY);
                this.debugLog(`Selected Fallback Provider: ${this.provider.name} (en-US) | Voice: ${fallbackSelectedUS.name}`);
                return;
            }

            // Silent Mode Fallback
            this.transitionTo(VoiceState.FAILED);
            this.debugLog('No suitable browser speech synthesis provider found.');

        } catch (err) {
            console.error('[VoiceManager] Initialization error:', err);
            this.transitionTo(VoiceState.FAILED);
            if (this.onError) this.onError(err.message || 'Initialization failed.');
        }
    }

    speak(text, pronunciationDict = {}) {
        if (this.state === VoiceState.FAILED || !this.provider) {
            this.transitionTo(VoiceState.FAILED);
            if (this.onError) this.onError('Speech provider unavailable.');
            return;
        }

        this.debugLog('Speak triggered.');

        this.originalText = text;
        this.currentWordIdx = 0;
        this.elapsedTimeBeforePause = 0;
        this.startTime = Date.now();

        // 1. Process Phonetic Text
        const words = text.split(/\s+/);
        this.totalWords = words.length;

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
        this.spokenSegments = words.map((word, idx) => {
            const clean = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").toLowerCase();
            const phonetic = pronunciationDict[clean];
            const spokenForm = phonetic ? word.toLowerCase().replace(clean, phonetic) : word;
            
            const start = currentSpokenCharOffset;
            const end = start + spokenForm.length;
            currentSpokenCharOffset = end + 1; // plus space

            return { origIndex: idx, word, start, end };
        });

        // 3. Delegate to active provider
        this.provider.speak(
            this.spokenText,
            this.options,
            (charIndex) => this.handleBoundary(charIndex),
            () => this.handleEnd(),
            (err) => this.handleError(err)
        );

        this.transitionTo(VoiceState.PLAYING);
    }

    pause() {
        if (this.state !== VoiceState.PLAYING || !this.provider) return;
        this.provider.pause();
        this.elapsedTimeBeforePause += Date.now() - this.startTime;
        this.transitionTo(VoiceState.PAUSED);
    }

    resume() {
        if (this.state !== VoiceState.PAUSED || !this.provider) return;
        this.startTime = Date.now();
        this.provider.resume();
        this.transitionTo(VoiceState.PLAYING);
    }

    stop() {
        if (!this.provider) return;
        this.provider.stop();
        this.currentWordIdx = 0;
        this.elapsedTimeBeforePause = 0;
        this.transitionTo(VoiceState.STOPPED);
        this.updateProgress();
    }

    handleBoundary(charIndex) {
        // Find segment matching charIndex
        const segment = this.spokenSegments.find(s => charIndex >= s.start && charIndex < s.end);
        if (segment) {
            this.currentWordIdx = segment.origIndex;
            if (this.onBoundary) {
                this.onBoundary(segment.origIndex, segment.word, charIndex);
            }
            this.updateProgress();
        }
    }

    handleEnd() {
        this.currentWordIdx = this.totalWords;
        this.transitionTo(VoiceState.COMPLETED);
        this.updateProgress();
    }

    handleError(errMsg) {
        this.transitionTo(VoiceState.FAILED);
        if (this.onError) this.onError(errMsg);
    }

    updateProgress() {
        if (this.onProgressUpdate) {
            const percent = this.totalWords > 0 ? Math.min(100, Math.round((this.currentWordIdx / this.totalWords) * 100)) : 0;
            const remaining = this.getEstimatedRemainingTime();
            this.onProgressUpdate(percent, remaining);
        }
    }

    getEstimatedRemainingTime() {
        if (this.state === VoiceState.COMPLETED || this.state === VoiceState.STOPPED) {
            return 0;
        }
        // Approximate speaking pace: 0.45 seconds per word at 0.92 rate
        const remainingWords = this.totalWords - this.currentWordIdx;
        return Math.max(0, Math.round(remainingWords * 0.45));
    }

    destroy() {
        if (this.provider) {
            this.provider.destroy();
        }
        this.transitionTo(VoiceState.IDLE);
    }
}
