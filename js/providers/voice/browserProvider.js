// Browser SpeechSynthesis Voice Provider
export class BrowserProvider {
    constructor() {
        this.synth = window.speechSynthesis;
        this.utterance = null;
        this.selectedVoice = null;
        this.name = 'Browser Speech Provider';
    }

    async init() {
        if (!this.synth) {
            throw new Error('SpeechSynthesis not supported by this browser.');
        }
        await this.loadVoices();
    }

    async loadVoices() {
        if (!this.synth) return [];
        const voices = this.synth.getVoices();
        return voices;
    }

    selectVoice(voices, preferredLanguages = ['en-GB', 'en-US']) {
        let foundVoice = null;
        for (const lang of preferredLanguages) {
            const matches = voices.filter(v => 
                v.lang.toLowerCase().replace('_', '-').startsWith(lang.toLowerCase())
            );
            
            // Prefer natural/neural voices if present
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
        return this.selectedVoice;
    }

    speak(text, options = {}, onBoundary, onEnd, onError) {
        this.stop();

        try {
            this.utterance = new SpeechSynthesisUtterance(text);
            this.utterance.rate = options.rate || 0.92;
            this.utterance.pitch = options.pitch || 1.0;
            this.utterance.volume = options.volume || 1.0;

            if (this.selectedVoice) {
                this.utterance.voice = this.selectedVoice;
            }

            // Prevent garbage collection
            window.activeUtterances = window.activeUtterances || [];
            window.activeUtterances.push(this.utterance);

            this.utterance.onboundary = (e) => {
                if (e.name === 'word' && onBoundary) {
                    onBoundary(e.charIndex);
                }
            };

            this.utterance.onend = () => {
                this.cleanup();
                if (onEnd) onEnd();
            };

            this.utterance.onerror = (e) => {
                this.cleanup();
                if (e.error === 'interrupted' || e.error === 'canceled') {
                    // Manual cancel, don't bubble up as error
                    return;
                }
                if (onError) onError(e.message || e.error || 'Playback error');
            };

            this.synth.speak(this.utterance);

        } catch (err) {
            if (onError) onError(err.message || 'Utterance initialization failed');
        }
    }

    pause() {
        if (this.synth) this.synth.pause();
    }

    resume() {
        if (this.synth) this.synth.resume();
    }

    stop() {
        if (this.synth) {
            this.synth.cancel();
        }
        this.cleanup();
    }

    cleanup() {
        if (this.utterance) {
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
    }
}
