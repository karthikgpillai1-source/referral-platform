import { DatabaseService } from '../services/supabase.js?v=3';
import { pronunciationDictionary } from '../services/pronunciationDictionary.js';
import { Utils } from '../utils.js';

let participant = null;
let currentStep = 1;
let chosenPledgeText = '';
let spokenPledgeText = '';
let wordsData = [];
let spokenSegments = [];
let utterance = null;
let synth = window.speechSynthesis;
let isReading = false;
let speechCompleted = false;

const PLEDGES = {
    1: "I pledge to lead a drug-free life, value my health, support others in making healthy choices, and contribute to building a safe, drug-free community.",
    2: "I solemnly swear to never use or distribute harmful substances, to protect my peers from substance abuse, and to actively advocate for wellness, safety, and awareness.",
    3: "I commit to raising awareness about the dangers of drugs, assisting those struggling with addiction, and maintaining a healthy mind and body to secure a brighter future."
};

document.addEventListener('DOMContentLoaded', async () => {
    const participantId = Utils.getQueryParam('id');
    if (!participantId) {
        Utils.showToast('Invalid participant ID. Redirecting to register...', 'error');
        setTimeout(() => window.location.href = 'register', 1500);
        return;
    }

    try {
        participant = await DatabaseService.getParticipantById(participantId);
        if (!participant) {
            Utils.showToast('Participant not found. Redirecting to register...', 'error');
            setTimeout(() => window.location.href = 'register', 1500);
            return;
        }

        determineStartStep();
        loadStep(currentStep);
    } catch (e) {
        console.error(e);
        Utils.showToast('Error loading participant details.', 'error');
    }

    // Error banner button bindings
    const replayErrBtn = document.getElementById('btn-replay-error');
    if (replayErrBtn) {
        replayErrBtn.addEventListener('click', () => {
            hideErrorBanner();
            restartReading();
        });
    }

    const retryErrBtn = document.getElementById('btn-retry-error');
    if (retryErrBtn) {
        retryErrBtn.addEventListener('click', () => {
            hideErrorBanner();
            setupUtterance();
            togglePlay();
        });
    }
});

function determineStartStep() {
    if (participant.pledge_3_completed) {
        currentStep = 3;
    } else if (participant.pledge_2_completed) {
        currentStep = 3;
    } else if (participant.pledge_1_completed) {
        currentStep = 2;
    } else {
        currentStep = 1;
    }
}

function loadStep(step) {
    currentStep = step;
    isReading = false;
    speechCompleted = false;
    
    if (synth) synth.cancel();
    hideErrorBanner();
    
    const chk = document.getElementById('pledge-chk');
    chk.checked = false;
    chk.setAttribute('disabled', 'true');
    
    const btn = document.getElementById('pledge-btn');
    btn.setAttribute('disabled', 'true');
    btn.textContent = step === 3 ? 'Accept Pledge & Generate Certificate 🎓' : 'Continue to Next Step ➡️';

    // Update Progress Indicator
    const progressFill = document.getElementById('progress-bar-fill');
    const stepLabel = document.getElementById('progress-step-lbl');
    const percentLabel = document.getElementById('progress-percent-lbl');
    
    const percent = Math.round((step / 3) * 100);
    if (progressFill) progressFill.style.width = `${percent}%`;
    if (stepLabel) stepLabel.textContent = `Step ${step} of 3`;
    if (percentLabel) percentLabel.textContent = `${percent}%`;

    // Personalized Name
    const fullName = participant.full_name.trim();
    let firstName = fullName.split(/\s+/)[0];
    firstName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();

    // Load Pledge Statement
    const basePledge = PLEDGES[step];
    chosenPledgeText = basePledge.replace(/^I\s+/, `I, ${firstName}, `);

    // Build Phonetic Speech text & highlight segments mapping
    const originalWords = chosenPledgeText.split(/\s+/);
    let spokenWords = [];
    spokenSegments = [];
    let currentSpokenCharOffset = 0;

    originalWords.forEach((word, idx) => {
        const cleanWord = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").toLowerCase();
        const phonetic = pronunciationDictionary[cleanWord];
        
        let spokenForm = word;
        if (phonetic) {
            const cleanIndex = word.toLowerCase().indexOf(cleanWord);
            const prefix = word.slice(0, cleanIndex);
            const suffix = word.slice(cleanIndex + cleanWord.length);
            spokenForm = prefix + phonetic + suffix;
        }

        const startSpoken = currentSpokenCharOffset;
        const endSpoken = startSpoken + spokenForm.length;
        
        spokenWords.push(spokenForm);
        
        spokenSegments.push({
            origIndex: idx,
            start: startSpoken,
            end: endSpoken
        });

        currentSpokenCharOffset = endSpoken + 1; // plus space
    });

    spokenPledgeText = spokenWords.join(' ');

    // Dynamic word wrapping for highlights in visual text container
    const textContainer = document.getElementById('pledge-text-container');
    wordsData = [];
    let currentOffset = 0;
    
    const spans = originalWords.map((word, idx) => {
        const start = chosenPledgeText.indexOf(word, currentOffset);
        const end = start + word.length;
        currentOffset = end;

        wordsData.push({
            index: idx,
            word: word,
            start: start,
            end: end
        });

        return `<span class="pledge-word" id="word-${idx}">${word}</span>`;
    });

    textContainer.innerHTML = spans.join(' ');

    // Show Main Card
    document.getElementById('pledge-loading-card').style.display = 'none';
    document.getElementById('pledge-main-card').style.display = 'block';

    // Setup speech synthesis utterance
    setupUtterance();

    // Bind controls
    setupControls();
}

function setupUtterance() {
    if (!synth) {
        showErrorBanner();
        return;
    }

    synth.cancel();

    utterance = new SpeechSynthesisUtterance(spokenPledgeText);
    utterance.rate = 0.92;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    setIndianVoice();
    if (synth.onvoiceschanged !== undefined) {
        synth.onvoiceschanged = setIndianVoice;
    }

    utterance.onboundary = handleSpeechBoundary;
    utterance.onend = handleSpeechEnd;
    utterance.onerror = (e) => {
        console.error('Speech synthesis error:', e);
        stopVisualizer();
        showErrorBanner();
    };
}

function setIndianVoice() {
    if (!utterance || !synth) return;
    const voices = synth.getVoices();
    const diagVoice = document.getElementById('diagnostic-voice');
    
    let selectedVoice = null;
    
    // Priority 1: en-IN voices
    const inVoices = voices.filter(v => 
        v.lang === 'en-IN' || 
        v.lang.toLowerCase().replace('_', '-').startsWith('en-in') ||
        v.name.toLowerCase().includes('india') ||
        v.name.toLowerCase().includes('indian')
    );
    
    // Prefer Neural Indian voices
    selectedVoice = inVoices.find(v => v.name.toLowerCase().includes('neural') || v.name.toLowerCase().includes('natural'));
    
    if (!selectedVoice && inVoices.length > 0) {
        selectedVoice = inVoices[0];
    }
    
    // Priority 2: en-GB fallback
    if (!selectedVoice) {
        selectedVoice = voices.find(v => v.lang.toLowerCase().replace('_', '-').startsWith('en-gb'));
    }
    
    // Priority 3: en-US fallback
    if (!selectedVoice) {
        selectedVoice = voices.find(v => v.lang.toLowerCase().replace('_', '-').startsWith('en-us'));
    }
    
    // Absolute fallback
    if (!selectedVoice && voices.length > 0) {
        selectedVoice = voices[0];
    }

    if (selectedVoice) {
        utterance.voice = selectedVoice;
        if (diagVoice) {
            diagVoice.textContent = `Current Voice: ${selectedVoice.name} (${selectedVoice.lang})`;
        }
    } else {
        if (diagVoice) {
            diagVoice.textContent = `Current Voice: System Default`;
        }
    }
}

function setupControls() {
    // Play button
    const playBtn = document.getElementById('btn-play-voice');
    const newPlayBtn = playBtn.cloneNode(true);
    playBtn.parentNode.replaceChild(newPlayBtn, playBtn);
    newPlayBtn.textContent = '🔊 Play Narration';
    newPlayBtn.addEventListener('click', togglePlay);

    // Restart button
    const restartBtn = document.getElementById('btn-restart-voice');
    const newRestartBtn = restartBtn.cloneNode(true);
    restartBtn.parentNode.replaceChild(newRestartBtn, restartBtn);
    newRestartBtn.addEventListener('click', restartReading);

    // Checkbox toggle
    const chk = document.getElementById('pledge-chk');
    const newChk = chk.cloneNode(true);
    chk.parentNode.replaceChild(newChk, chk);
    newChk.addEventListener('change', handleCheckboxToggle);

    // Continue action button
    const btn = document.getElementById('pledge-btn');
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener('click', handleContinueClick);
}

function togglePlay() {
    if (!synth || !utterance) {
        showErrorBanner();
        return;
    }

    if (isReading) {
        synth.pause();
        isReading = false;
        document.getElementById('btn-play-voice').textContent = '🔊 Resume Narration';
        stopVisualizer();
    } else {
        if (synth.paused) {
            synth.resume();
        } else {
            synth.speak(utterance);
        }
        isReading = true;
        document.getElementById('btn-play-voice').textContent = '⏸ Pause Narration';
        startVisualizer();
    }
}

function restartReading() {
    if (!synth) return;
    synth.cancel();
    isReading = false;
    document.getElementById('btn-play-voice').textContent = '🔊 Play Narration';
    stopVisualizer();
    clearWordHighlights();
    togglePlay();
}

function handleSpeechBoundary(event) {
    if (event.name !== 'word') return;
    const charIndex = event.charIndex;
    
    // Find active segment mapping based on spoken character index
    const activeSegment = spokenSegments.find(s => charIndex >= s.start && charIndex < s.end);

    if (activeSegment) {
        clearWordHighlights();
        const activeSpan = document.getElementById(`word-${activeSegment.origIndex}`);
        if (activeSpan) {
            activeSpan.classList.add('active');
        }
    }
}

function handleSpeechEnd() {
    isReading = false;
    speechCompleted = true;
    document.getElementById('btn-play-voice').textContent = '🔊 Play Narration';
    stopVisualizer();
    clearWordHighlights();

    // Enable Checkbox after successful narration
    const chk = document.getElementById('pledge-chk');
    if (chk) chk.removeAttribute('disabled');
    Utils.showToast(`Pledge Statement ${currentStep} complete. Please check the box.`, 'info');
}

function clearWordHighlights() {
    document.querySelectorAll('.pledge-word').forEach(span => span.classList.remove('active'));
}

function startVisualizer() {
    document.querySelectorAll('.visualizer-node').forEach(node => node.classList.add('active'));
}

function stopVisualizer() {
    document.querySelectorAll('.visualizer-node').forEach(node => node.classList.remove('active'));
}

function showErrorBanner() {
    const errorContainer = document.getElementById('speech-error-container');
    if (errorContainer) {
        errorContainer.style.display = 'block';
    }
    
    // Disable checkbox and button
    const chk = document.getElementById('pledge-chk');
    if (chk) {
        chk.checked = false;
        chk.setAttribute('disabled', 'true');
    }
    const btn = document.getElementById('pledge-btn');
    if (btn) btn.setAttribute('disabled', 'true');
}

function hideErrorBanner() {
    const errorContainer = document.getElementById('speech-error-container');
    if (errorContainer) {
        errorContainer.style.display = 'none';
    }
}

function handleCheckboxToggle(e) {
    const btn = document.getElementById('pledge-btn');
    // Can only continue if checkbox is checked and speech completed successfully
    if (e.target.checked && speechCompleted) {
        btn.removeAttribute('disabled');
    } else {
        btn.setAttribute('disabled', 'true');
    }
}

async function handleContinueClick() {
    const btn = document.getElementById('pledge-btn');
    btn.setAttribute('disabled', 'true');
    Utils.showLoading(true);

    try {
        const result = await DatabaseService.completePledgeStep(participant.id, currentStep, chosenPledgeText);
        Utils.showLoading(false);

        if (currentStep < 3) {
            Utils.showToast(`Step ${currentStep} completed successfully!`, 'success');
            loadStep(currentStep + 1);
        } else {
            Utils.showToast('All pledges accepted! Generating certificate...', 'success');
            setTimeout(() => {
                window.location.href = `verify?id=${result.certificate.certificate_id}`;
            }, 1200);
        }
    } catch (e) {
        Utils.showLoading(false);
        console.error(e);
        Utils.showToast('Failed to save progress. Please try again.', 'error');
        btn.removeAttribute('disabled');
    }
}
