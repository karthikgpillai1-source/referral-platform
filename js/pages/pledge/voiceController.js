// Voice Controller - Integrates UI buttons with VoiceEngine events
import { VoiceState } from '../../services/voiceEngine.js';

export class VoiceController {
    constructor(voiceEngine, uiController) {
        this.engine = voiceEngine;
        this.ui = uiController;

        this.playBtn = document.getElementById('btn-play-voice');
        this.stopBtn = document.getElementById('btn-stop-voice');
        this.restartBtn = document.getElementById('btn-restart-voice');

        this.setupEngineCallbacks();
    }

    setupEngineCallbacks() {
        this.engine.onStateChange = (state, oldState) => {
            this.handleStateChange(state, oldState);
        };

        this.engine.onBoundary = (wordIndex, word) => {
            this.ui.highlightWord(wordIndex);
        };

        this.engine.onError = (errMsg) => {
            this.ui.showErrorBanner(`⚠️ Voice narration is unavailable: ${errMsg}`);
        };
    }

    handleStateChange(state) {
        switch (state) {
            case VoiceState.PLAYING:
                if (this.playBtn) this.playBtn.textContent = '⏸ Pause Narration';
                this.ui.startVisualizer();
                break;
            case VoiceState.PAUSED:
                if (this.playBtn) this.playBtn.textContent = '🔊 Resume Narration';
                this.ui.stopVisualizer();
                break;
            case VoiceState.STOPPED:
            case VoiceState.COMPLETED:
                if (this.playBtn) this.playBtn.textContent = '🔊 Play Narration';
                this.ui.stopVisualizer();
                this.ui.resetHighlight();
                break;
            case VoiceState.READY:
                this.ui.setVoiceDiagnostics(
                    this.engine.selectedVoice 
                        ? `Current Voice: ${this.engine.selectedVoice.name} (${this.engine.selectedVoice.lang})` 
                        : 'Current Voice: System Default'
                );
                break;
            case VoiceState.FAILED:
                this.ui.setVoiceDiagnostics('Current Voice: Narration unavailable');
                this.ui.showErrorBanner('⚠️ Voice narration is unavailable on this device. You can continue by reading the pledge yourself.');
                break;
        }
    }

    bindControls(pledgeText, pronunciationDict) {
        // Re-bind controls safely by cloning elements
        if (this.playBtn) {
            const newBtn = this.playBtn.cloneNode(true);
            this.playBtn.parentNode.replaceChild(newBtn, this.playBtn);
            this.playBtn = newBtn;
            this.playBtn.addEventListener('click', () => this.togglePlay(pledgeText, pronunciationDict));
        }

        if (this.stopBtn) {
            const newBtn = this.stopBtn.cloneNode(true);
            this.stopBtn.parentNode.replaceChild(newBtn, this.stopBtn);
            this.stopBtn = newBtn;
            this.stopBtn.addEventListener('click', () => this.engine.stop());
        }

        if (this.restartBtn) {
            const newBtn = this.restartBtn.cloneNode(true);
            this.restartBtn.parentNode.replaceChild(newBtn, this.restartBtn);
            this.restartBtn = newBtn;
            this.restartBtn.addEventListener('click', () => this.restart(pledgeText, pronunciationDict));
        }
    }

    togglePlay(pledgeText, pronunciationDict) {
        if (this.engine.state === VoiceState.PLAYING) {
            this.engine.pause();
        } else if (this.engine.state === VoiceState.PAUSED) {
            this.engine.resume();
        } else {
            this.engine.speak(pledgeText, pronunciationDict);
        }
    }

    restart(pledgeText, pronunciationDict) {
        this.engine.stop();
        this.engine.speak(pledgeText, pronunciationDict);
    }
}
