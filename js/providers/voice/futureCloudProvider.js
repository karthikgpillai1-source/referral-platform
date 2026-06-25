// Future Cloud Provider - Stub template for Cloud TTS APIs (Azure, Google Cloud, ElevenLabs)
export class FutureCloudProvider {
    constructor() {
        this.name = 'Cloud Voice Provider (Mock)';
        this.selectedVoice = { name: 'Azure Indian English (Neural)', lang: 'en-IN (Cloud)' };
        this.audio = null;
        this.isPlaying = false;
    }

    async init() {
        // Here we would check internet connection or check API keys/auth
        console.log('[FutureCloudProvider] Mock provider initialized.');
    }

    async loadVoices() {
        return [this.selectedVoice];
    }

    selectVoice() {
        return this.selectedVoice;
    }

    speak(text, options = {}, onBoundary, onEnd, onError) {
        this.stop();
        this.isPlaying = true;

        console.log(`[FutureCloudProvider] Speaking: "${text.substring(0, 40)}..."`);

        // Mock progress boundary updates using a simple timer
        let wordIndex = 0;
        const words = text.split(/\s+/);
        let charOffset = 0;

        this.timer = setInterval(() => {
            if (wordIndex < words.length) {
                if (onBoundary) onBoundary(charOffset);
                charOffset += words[wordIndex].length + 1;
                wordIndex++;
            } else {
                this.stop();
                if (onEnd) onEnd();
            }
        }, 300); // 300ms per word
    }

    pause() {
        this.isPlaying = false;
        if (this.timer) clearInterval(this.timer);
    }

    resume() {
        this.isPlaying = true;
    }

    stop() {
        this.isPlaying = false;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    destroy() {
        this.stop();
    }
}
