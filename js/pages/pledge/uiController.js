// UI Controller - Purely DOM manipulation and rendering

export class UIController {
    constructor() {
        this.textContainer = document.getElementById('pledge-text-container');
        this.chk = document.getElementById('pledge-chk');
        this.btn = document.getElementById('pledge-btn');
        this.progressFill = document.getElementById('progress-bar-fill');
        this.stepLabel = document.getElementById('progress-step-lbl');
        this.percentLabel = document.getElementById('progress-percent-lbl');
        this.errorContainer = document.getElementById('speech-error-container');
        this.errorSpan = this.errorContainer ? this.errorContainer.querySelector('span') : null;
        this.diagVoice = document.getElementById('diagnostic-voice');
        
        this.loadingCard = document.getElementById('pledge-loading-card');
        this.mainCard = document.getElementById('pledge-main-card');
        this.regCard = document.getElementById('pledge-registration-card');
        this.regNameInput = document.getElementById('reg-name');

        // Playback Metrics
        this.playbackMetrics = document.getElementById('playback-metrics');
        this.playbackProgress = document.getElementById('playback-progress');
        this.playbackRemaining = document.getElementById('playback-remaining');

        // Developer Debug Panel Elements
        this.debugPanel = document.getElementById('developer-debug-panel');
        this.debugProvider = document.getElementById('debug-provider');
        this.debugVoice = document.getElementById('debug-voice');
        this.debugState = document.getElementById('debug-state');
        this.debugRemaining = document.getElementById('debug-remaining');
        this.debugHighlight = document.getElementById('debug-highlight');
        this.debugLength = document.getElementById('debug-length');

        this.initDebugVisibility();
    }

    initDebugVisibility() {
        const params = new URLSearchParams(window.location.search);
        if (params.get('debug') === 'true' && this.debugPanel) {
            this.debugPanel.style.display = 'block';
        }
    }

    renderPledgeText(chosenPledgeText) {
        if (!this.textContainer) return;
        const words = chosenPledgeText.split(/\s+/);
        const spans = words.map((word, idx) => {
            return `<span class="pledge-word" id="word-${idx}">${word}</span>`;
        });
        this.textContainer.innerHTML = spans.join(' ');

        if (this.debugLength) {
            this.debugLength.textContent = `${words.length} words`;
        }
    }

    highlightWord(wordIndex, wordText = '') {
        this.resetHighlight();
        const activeSpan = document.getElementById(`word-${wordIndex}`);
        if (activeSpan) {
            activeSpan.classList.add('active');
        }

        if (this.debugHighlight) {
            this.debugHighlight.textContent = wordText ? `${wordIndex}: "${wordText}"` : `${wordIndex}`;
        }
    }

    resetHighlight() {
        document.querySelectorAll('.pledge-word').forEach(span => span.classList.remove('active'));
        if (this.debugHighlight) {
            this.debugHighlight.textContent = 'None';
        }
    }

    updateProgress(step) {
        const percent = Math.round((step / 3) * 100);
        if (this.progressFill) this.progressFill.style.width = `${percent}%`;
        if (this.stepLabel) this.stepLabel.textContent = `Step ${step} of 3`;
        if (this.percentLabel) this.percentLabel.textContent = `${percent}%`;
    }

    setCheckboxState(checked, disabled = false) {
        if (!this.chk) return;
        this.chk.checked = checked;
        if (disabled) {
            this.chk.setAttribute('disabled', 'true');
        } else {
            this.chk.removeAttribute('disabled');
        }
    }

    setContinueButton(text, disabled) {
        if (!this.btn) return;
        this.btn.textContent = text;
        if (disabled) {
            this.btn.setAttribute('disabled', 'true');
        } else {
            this.btn.removeAttribute('disabled');
        }
    }

    showErrorBanner(message) {
        if (this.errorContainer) {
            if (this.errorSpan && message) {
                this.errorSpan.textContent = message;
            }
            this.errorContainer.style.display = 'block';
        }
    }

    hideErrorBanner() {
        if (this.errorContainer) {
            this.errorContainer.style.display = 'none';
        }
    }

    startVisualizer() {
        document.querySelectorAll('.visualizer-node').forEach(node => node.classList.add('active'));
    }

    stopVisualizer() {
        document.querySelectorAll('.visualizer-node').forEach(node => node.classList.remove('active'));
    }

    setVoiceDiagnostics(text) {
        if (this.diagVoice) {
            this.diagVoice.textContent = text;
        }
    }

    updatePlaybackMetrics(progressPercent, remainingSeconds) {
        if (this.playbackMetrics) {
            this.playbackMetrics.style.display = 'block';
        }
        if (this.playbackProgress) {
            this.playbackProgress.textContent = `${progressPercent}%`;
        }
        if (this.playbackRemaining) {
            this.playbackRemaining.textContent = `${remainingSeconds}s`;
        }

        // Also update Debug Panel if visible
        if (this.debugRemaining) {
            this.debugRemaining.textContent = `${remainingSeconds}s`;
        }
    }

    updateDebugPanel(data = {}) {
        if (data.provider && this.debugProvider) this.debugProvider.textContent = data.provider;
        if (data.voice && this.debugVoice) this.debugVoice.textContent = data.voice;
        if (data.state && this.debugState) this.debugState.textContent = data.state;
    }

    showRegistrationForm(name) {
        if (this.loadingCard) this.loadingCard.style.display = 'none';
        if (this.mainCard) this.mainCard.style.display = 'none';
        if (this.regCard) this.regCard.style.display = 'block';
        if (this.regNameInput) this.regNameInput.value = name || '';
    }

    showPledgeMainCard() {
        if (this.loadingCard) this.loadingCard.style.display = 'none';
        if (this.regCard) this.regCard.style.display = 'none';
        if (this.mainCard) this.mainCard.style.display = 'block';
    }

    showLoadingState() {
        if (this.mainCard) this.mainCard.style.display = 'none';
        if (this.regCard) this.regCard.style.display = 'none';
        if (this.loadingCard) this.loadingCard.style.display = 'block';
    }
}
