// Simplified Pledge Journey Controller & Voice Service
import { DatabaseService } from '../services/supabase.js?v=4';
import { pronunciationDictionary } from '../services/pronunciationDictionary.js';
import { Utils } from '../utils.js';

let participant = null;
let currentStep = 1;
let chosenPledgeText = '';
let spokenPledgeText = '';
let spokenSegments = [];
let utterance = null;
const synth = window.speechSynthesis;
let isReading = false;
let selectedVoice = null;

// Sliced playback state variables to fallback from buggy native pause/resume
let lastBoundaryCharIndex = 0;
let currentUtteranceOffset = 0;
let isPaused = false;
let currentWordIndex = 0;
let currentCharIndex = 0;
let currentSentenceText = '';
let resumeWatchdog = null;

const PLEDGES = {
    1: "I pledge to lead a drug-free life, value my health, support others in making healthy choices, and contribute to building a safe, drug-free community.",
    2: "I solemnly swear to never use or distribute harmful substances, to protect my peers from substance abuse, and to actively advocate for wellness, safety, and awareness.",
    3: "I commit to raising awareness about the dangers of drugs, assisting those struggling with addiction, and maintaining a healthy mind and body to secure a brighter future."
};

document.addEventListener('DOMContentLoaded', async () => {
    const participantId = Utils.getQueryParam('id');
    const tempName = sessionStorage.getItem('temp_full_name');

    // Lifecycle cleanup to prevent speech from playing in background on exit
    window.addEventListener('beforeunload', () => {
        if (synth) synth.cancel();
    });
    window.addEventListener('pagehide', () => {
        if (synth) synth.cancel();
    });

    // Verify browser support for SpeechSynthesis
    if (!synth) {
        showVoiceFallbackNotice("Voice narration isn't available on this device. You can continue by reading the pledge.");
    }

    // Direct routing guard
    if (sessionStorage.getItem('pledges_completed') === 'true' && !participantId) {
        showRegistrationForm();
        return;
    }

    if (!participantId && !tempName) {
        Utils.showToast('Please enter your name first. Redirecting to start...', 'error');
        setTimeout(() => {
            const dest = window.location.pathname.endsWith('.html') ? 'register.html' : 'register';
            window.location.href = dest;
        }, 1500);
        return;
    }

    try {
        if (participantId) {
            participant = await DatabaseService.getParticipantById(participantId);
            if (!participant) {
                Utils.showToast('Participant not found. Redirecting...', 'error');
                setTimeout(() => window.location.href = 'register', 1500);
                return;
            }
            determineStartStep();
        } else {
            participant = { full_name: tempName };
            const savedStep = sessionStorage.getItem('current_pledge_step');
            currentStep = savedStep ? parseInt(savedStep, 10) : 1;
        }

        loadStep(currentStep);

    } catch (e) {
        console.error(e);
        Utils.showToast('Error loading pledge details.', 'error');
    }

    // Bind registration form submit
    const regForm = document.getElementById('post-pledge-registration-form');
    if (regForm) {
        regForm.addEventListener('submit', handlePostPledgeRegistration);
    }
});

function determineStartStep() {
    if (participant.pledge_3_completed || participant.pledge_2_completed) {
        currentStep = 3;
    } else if (participant.pledge_1_completed) {
        currentStep = 2;
    } else {
        currentStep = 1;
    }
}

function loadStep(step) {
    currentStep = step;
    if (!Utils.getQueryParam('id')) {
        sessionStorage.setItem('current_pledge_step', step.toString());
    }

    stopReading();
    hideSpeechInfoMessage();

    // Reset offsets
    currentUtteranceOffset = 0;
    lastBoundaryCharIndex = 0;
    isPaused = false;
    isReading = false;
    currentWordIndex = 0;
    currentCharIndex = 0;
    currentSentenceText = '';
    if (resumeWatchdog) {
        clearTimeout(resumeWatchdog);
        resumeWatchdog = null;
    }

    // Reset Checkbox & Continue button states
    const chk = document.getElementById('pledge-chk');
    if (chk) {
        chk.checked = false;
        chk.removeAttribute('disabled'); // Checkbox is immediately available!
    }

    const btn = document.getElementById('pledge-btn');
    if (btn) {
        btn.setAttribute('disabled', 'true');
        btn.textContent = step === 3 ? 'Accept Pledge & Claim Certificate 🎓' : 'Continue to Next Step ➡️';
    }

    // Update Progress Indicator
    const percent = Math.round((step / 3) * 100);
    const progressFill = document.getElementById('progress-bar-fill');
    const stepLabel = document.getElementById('progress-step-lbl');
    const percentLabel = document.getElementById('progress-percent-lbl');
    
    if (progressFill) progressFill.style.width = `${percent}%`;
    if (stepLabel) stepLabel.textContent = `Step ${step} of 3`;
    if (percentLabel) percentLabel.textContent = `${percent}%`;

    // Personalize Name
    const fullName = participant.full_name.trim();
    let firstName = fullName.split(/\s+/)[0];
    firstName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();

    // Prepare Text
    const basePledge = PLEDGES[step];
    chosenPledgeText = basePledge.replace(/^I\s+/, `I, ${firstName}, `);

    // Build spoken text & highlights segments mapping
    const words = chosenPledgeText.split(/\s+/);
    let spokenWords = [];
    spokenSegments = [];
    let currentSpokenCharOffset = 0;

    words.forEach((word, idx) => {
        const clean = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").toLowerCase();
        const phonetic = pronunciationDictionary[clean];
        const spokenForm = phonetic ? word.toLowerCase().replace(clean, phonetic) : word;

        const start = currentSpokenCharOffset;
        const end = start + spokenForm.length;
        
        spokenWords.push(spokenForm);
        spokenSegments.push({
            origIndex: idx,
            start,
            end
        });

        currentSpokenCharOffset = end + 1; // plus space
    });

    spokenPledgeText = spokenWords.join(' ');

    // Inject visual word spans
    const textContainer = document.getElementById('pledge-text-container');
    if (textContainer) {
        textContainer.innerHTML = words.map((w, idx) => `<span class="pledge-word" id="word-${idx}">${w}</span>`).join(' ');
    }

    // Setup speech synthesis
    setupUtterance(spokenPledgeText);

    // Bind controls
    setupControls();

    // Show main card
    document.getElementById('pledge-loading-card').style.display = 'none';
    document.getElementById('pledge-main-card').style.display = 'block';

    // Autoplay attempt (fails silently if blocked)
    setTimeout(() => {
        if (synth && utterance) {
            trySpeak();
        }
    }, 100);
}

function setupUtterance(textSlice) {
    if (!synth) return;

    synth.cancel();
    if (synth.paused) {
        synth.resume();
    }

    utterance = new SpeechSynthesisUtterance(textSlice);
    utterance.rate = 0.92;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Prevent SpeechSynthesis garbage collection mid-speech
    window.activeUtterance = utterance;

    // Voice Selection Priority
    if (selectedVoice) {
        utterance.voice = selectedVoice;
    } else {
        const voices = synth.getVoices();
        setIndianVoice(voices);
    }

    if (synth.onvoiceschanged !== undefined) {
        synth.onvoiceschanged = () => {
            if (!selectedVoice) setIndianVoice(synth.getVoices());
        };
    }

    utterance.onstart = (event) => {
        console.log(`[Pledge Speech Event - start] speaking: ${synth.speaking}, paused: ${synth.paused}`);
        startVisualizer();
    };

    utterance.onpause = (event) => {
        console.log(`[Pledge Speech Event - pause] speaking: ${synth.speaking}, paused: ${synth.paused}`);
        stopVisualizer();
        updateUIState('paused');
    };

    utterance.onresume = (event) => {
        console.log(`[Pledge Speech Event - resume] speaking: ${synth.speaking}, paused: ${synth.paused}`);
        if (resumeWatchdog) {
            console.log("[Pledge Speech] Watchdog cleared by onresume event.");
            clearTimeout(resumeWatchdog);
            resumeWatchdog = null;
        }
        startVisualizer();
        updateUIState('speaking');
    };

    utterance.onend = (event) => {
        console.log(`[Pledge Speech Event - end] speaking: ${synth.speaking}, paused: ${synth.paused}`);
        handleSpeechEnd();
    };

    utterance.onboundary = handleSpeechBoundary;
    
    utterance.onerror = (e) => {
        console.error(`[Pledge Speech Event - error] error: ${e.error}, speaking: ${synth.speaking}, paused: ${synth.paused}`);
        cleanupUtterance();
        stopVisualizer();
        clearWordHighlights();
        updateUIState('stopped');
        
        if (e.error === 'not-allowed') {
            showSpeechInfoMessage('Voice narration is available. Press Play to listen.');
        } else if (e.error !== 'interrupted' && e.error !== 'canceled') {
            showSpeechInfoMessage("Voice narration isn't available on this device. You can continue by reading the pledge.");
        }
    };
}

function setIndianVoice(voices) {
    if (!utterance || voices.length === 0) return;

    const priorities = ['en-IN', 'en-GB', 'en-US'];
    let matched = null;

    for (const lang of priorities) {
        matched = voices.find(v => v.lang.toLowerCase().replace('_', '-').startsWith(lang.toLowerCase()));
        if (matched) break;
    }

    if (!matched) matched = voices[0];
    selectedVoice = matched;
    utterance.voice = matched;
}

function setupControls() {
    const playBtn = document.getElementById('btn-play-voice');
    if (playBtn) {
        const newPlay = playBtn.cloneNode(true);
        playBtn.parentNode.replaceChild(newPlay, playBtn);
        newPlay.addEventListener('click', startPlay);
    }

    const pauseBtn = document.getElementById('btn-pause-voice');
    if (pauseBtn) {
        const newPause = pauseBtn.cloneNode(true);
        pauseBtn.parentNode.replaceChild(newPause, pauseBtn);
        newPause.addEventListener('click', pausePlay);
    }

    const resumeBtn = document.getElementById('btn-resume-voice');
    if (resumeBtn) {
        const newResume = resumeBtn.cloneNode(true);
        resumeBtn.parentNode.replaceChild(newResume, resumeBtn);
        newResume.addEventListener('click', resumePlay);
    }

    const stopBtn = document.getElementById('btn-stop-voice');
    if (stopBtn) {
        const newStop = stopBtn.cloneNode(true);
        stopBtn.parentNode.replaceChild(newStop, stopBtn);
        newStop.addEventListener('click', stopReading);
    }

    const restartBtn = document.getElementById('btn-restart-voice');
    if (restartBtn) {
        const newRestart = restartBtn.cloneNode(true);
        restartBtn.parentNode.replaceChild(newRestart, restartBtn);
        newRestart.addEventListener('click', restartPlay);
    }

    const chk = document.getElementById('pledge-chk');
    if (chk) {
        const newChk = chk.cloneNode(true);
        chk.parentNode.replaceChild(newChk, chk);
        newChk.addEventListener('change', handleCheckboxToggle);
    }

    const pledgeBtn = document.getElementById('pledge-btn');
    if (pledgeBtn) {
        const newBtn = pledgeBtn.cloneNode(true);
        pledgeBtn.parentNode.replaceChild(newBtn, pledgeBtn);
        newBtn.addEventListener('click', handleContinueClick);
    }
}

function trySpeak() {
    if (!synth || !utterance) return;
    isReading = true;
    isPaused = false;
    updateUIState('speaking');
    startVisualizer();
    synth.speak(utterance);
}

function startPlay() {
    console.log("[Pledge Speech] Play clicked. Starting narration.");
    if (!synth) return;
    stopReading(); // Reset state to ensure clean play
    setupUtterance(spokenPledgeText);
    isReading = true;
    isPaused = false;
    updateUIState('speaking');
    startVisualizer();
    synth.speak(utterance);
}

function pausePlay() {
    console.log("[Pledge Speech] Pause clicked.");
    if (!synth) return;
    isReading = false;
    isPaused = true;
    updateUIState('paused');
    stopVisualizer();
    
    console.log(`[Pledge Speech] Before calling native pause. speaking: ${synth.speaking}, paused: ${synth.paused}`);
    synth.pause();
    console.log(`[Pledge Speech] After calling native pause. speaking: ${synth.speaking}, paused: ${synth.paused}`);
}

function resumePlay() {
    console.log("[Pledge Speech] Resume clicked.");
    if (!synth) return;
    
    isReading = true;
    isPaused = false;
    updateUIState('speaking');
    startVisualizer();

    // Set up watchdog timer to detect native resume failure.
    if (resumeWatchdog) clearTimeout(resumeWatchdog);
    resumeWatchdog = setTimeout(() => {
        console.warn("[Pledge Speech] Watchdog fired: Native resume failed or timed out. Activating fallback resume...");
        triggerFallbackResume();
    }, 800);

    console.log(`[Pledge Speech] Before calling native resume. speaking: ${synth.speaking}, paused: ${synth.paused}`);
    synth.resume();
    console.log(`[Pledge Speech] After calling native resume. speaking: ${synth.speaking}, paused: ${synth.paused}`);
}

function triggerFallbackResume() {
    console.log(`[Pledge Speech Fallback Triggered] Attempting to resume from word index: ${currentWordIndex}`);
    if (resumeWatchdog) {
        clearTimeout(resumeWatchdog);
        resumeWatchdog = null;
    }
    
    // Cancel the current stuck utterance
    synth.cancel();
    if (synth.paused) {
        synth.resume(); // Ensure we reset the paused state in the browser engine
    }

    // Determine the character offset of the last spoken word
    const startSegment = spokenSegments.find(s => s.origIndex === currentWordIndex);
    const startChar = startSegment ? startSegment.start : 0;
    currentUtteranceOffset = startChar;

    const textSlice = spokenPledgeText.substring(currentUtteranceOffset);
    console.log(`[Pledge Speech Fallback] Text slice: "${textSlice}"`);
    if (!textSlice.trim()) {
        handleSpeechEnd();
        return;
    }

    // Set up a new utterance with the remaining text
    setupUtterance(textSlice);

    isReading = true;
    isPaused = false;
    updateUIState('speaking');
    startVisualizer();

    synth.speak(utterance);
    console.log(`[Pledge Speech Fallback] Speaking started. speaking: ${synth.speaking}, paused: ${synth.paused}`);
}

function stopReading() {
    console.log("[Pledge Speech] Stop clicked.");
    if (resumeWatchdog) {
        clearTimeout(resumeWatchdog);
        resumeWatchdog = null;
    }
    if (!synth) return;
    synth.cancel();
    if (synth.paused) {
        synth.resume();
    }
    cleanupUtterance();
    isReading = false;
    isPaused = false;
    currentUtteranceOffset = 0;
    lastBoundaryCharIndex = 0;
    currentWordIndex = 0;
    currentCharIndex = 0;
    currentSentenceText = '';
    updateUIState('stopped');
    stopVisualizer();
    clearWordHighlights();
    setupUtterance(spokenPledgeText); // Reinitialize
}

function restartPlay() {
    console.log("[Pledge Speech] Restart clicked.");
    stopReading();
    startPlay();
}

function handleSpeechBoundary(event) {
    if (resumeWatchdog) {
        console.log("[Pledge Speech] Watchdog cleared by onboundary event.");
        clearTimeout(resumeWatchdog);
        resumeWatchdog = null;
    }
    if (event.name !== 'word') return;
    
    // Global index aligns characters back to original full text
    const globalCharIndex = currentUtteranceOffset + event.charIndex;
    const active = spokenSegments.find(s => globalCharIndex >= s.start && globalCharIndex < s.end);

    if (active) {
        clearWordHighlights();
        const activeSpan = document.getElementById(`word-${active.origIndex}`);
        if (activeSpan) activeSpan.classList.add('active');
        
        lastBoundaryCharIndex = active.start;
        currentCharIndex = globalCharIndex;
        currentWordIndex = active.origIndex;
        
        currentSentenceText = getSentenceContainingChar(chosenPledgeText, currentCharIndex);
        
        console.log(`[Pledge Speech Event - boundary] word: "${spokenPledgeText.substring(active.start, active.end)}", ` +
                    `globalCharIndex: ${globalCharIndex}, currentWordIndex: ${currentWordIndex}, sentence: "${currentSentenceText}"`);
    }
}

function handleSpeechEnd() {
    cleanupUtterance();
    isReading = false;
    updateUIState('stopped');
    stopVisualizer();
    clearWordHighlights();
}

function cleanupUtterance() {
    if (utterance) {
        utterance.onstart = null;
        utterance.onpause = null;
        utterance.onresume = null;
        utterance.onboundary = null;
        utterance.onend = null;
        utterance.onerror = null;
        utterance = null;
    }
    window.activeUtterance = null;
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

function updateUIState(state) {
    console.log(`[Pledge Speech State Change] New state: ${state}. Browser speaking: ${synth ? synth.speaking : false}, paused: ${synth ? synth.paused : false}`);
    const playBtn = document.getElementById('btn-play-voice');
    const pauseBtn = document.getElementById('btn-pause-voice');
    const resumeBtn = document.getElementById('btn-resume-voice');
    const stopBtn = document.getElementById('btn-stop-voice');
    const restartBtn = document.getElementById('btn-restart-voice');

    if (!playBtn || !pauseBtn || !resumeBtn || !stopBtn || !restartBtn) return;

    if (state === 'speaking') {
        playBtn.style.display = 'none';
        pauseBtn.style.display = 'inline-block';
        resumeBtn.style.display = 'none';
        stopBtn.style.display = 'inline-block';
        restartBtn.style.display = 'inline-block';
    } else if (state === 'paused') {
        playBtn.style.display = 'none';
        pauseBtn.style.display = 'none';
        resumeBtn.style.display = 'inline-block';
        stopBtn.style.display = 'inline-block';
        restartBtn.style.display = 'inline-block';
    } else { // 'stopped'
        playBtn.style.display = 'inline-block';
        pauseBtn.style.display = 'none';
        resumeBtn.style.display = 'none';
        stopBtn.style.display = 'none';
        restartBtn.style.display = 'none';
    }
}

function getSentenceContainingChar(text, charIndex) {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    let offset = 0;
    for (const sentence of sentences) {
        const start = offset;
        const end = offset + sentence.length;
        if (charIndex >= start && charIndex <= end) {
            return sentence.trim();
        }
        offset = end;
    }
    return text;
}

function showVoiceFallbackNotice(msg) {
    const section = document.getElementById('voice-controls-section');
    if (section) section.style.display = 'none';
    showSpeechInfoMessage(msg);
}

function showSpeechInfoMessage(msg) {
    const container = document.getElementById('speech-info-msg');
    if (container) {
        container.textContent = msg;
        container.style.display = 'block';
    }
}

function hideSpeechInfoMessage() {
    const container = document.getElementById('speech-info-msg');
    if (container) container.style.display = 'none';
}

function handleCheckboxToggle(e) {
    const btn = document.getElementById('pledge-btn');
    if (btn) {
        if (e.target.checked) {
            btn.removeAttribute('disabled');
        } else {
            btn.setAttribute('disabled', 'true');
        }
    }
}

async function handleContinueClick() {
    const participantId = Utils.getQueryParam('id');

    if (!participantId) {
        if (currentStep < 3) {
            Utils.showToast(`Step ${currentStep} completed successfully!`, 'success');
            loadStep(currentStep + 1);
        } else {
            if (synth) synth.cancel();
            sessionStorage.setItem('pledges_completed', 'true');
            showRegistrationForm();
        }
    } else {
        const btn = document.getElementById('pledge-btn');
        if (btn) btn.setAttribute('disabled', 'true');
        Utils.showLoading(true);

        try {
            const result = await DatabaseService.completePledgeStep(participant.id, currentStep, chosenPledgeText);
            Utils.showLoading(false);

            if (currentStep < 3) {
                Utils.showToast(`Step ${currentStep} completed successfully!`, 'success');
                loadStep(currentStep + 1);
            } else {
                Utils.showToast('All pledges accepted! Generating certificate...', 'success');
                sessionStorage.removeItem('current_pledge_step');
                sessionStorage.removeItem('pledges_completed');
                setTimeout(() => {
                    const dest = window.location.pathname.endsWith('.html') ? `verify.html?id=${result.certificate.certificate_id}` : `verify?id=${result.certificate.certificate_id}`;
                    window.location.href = dest;
                }, 1200);
            }
        } catch (e) {
            Utils.showLoading(false);
            console.error(e);
            Utils.showToast('Failed to save progress. Please try again.', 'error');
            if (btn) btn.removeAttribute('disabled');
        }
    }
}

function showRegistrationForm() {
    document.getElementById('pledge-loading-card').style.display = 'none';
    document.getElementById('pledge-main-card').style.display = 'none';
    document.getElementById('pledge-registration-card').style.display = 'block';
    
    const regName = document.getElementById('reg-name');
    if (regName) regName.value = sessionStorage.getItem('temp_full_name') || '';
}

// Indian Mobile Number Validator and Standardizer
function standardizeIndianPhone(phone) {
    const clean = phone.replace(/[\s-()]/g, '');
    const match = clean.match(/^(?:\+?91|0)?([6-9]\d{9})$/);
    if (!match) return null;
    return '+91' + match[1];
}

async function handlePostPledgeRegistration(e) {
    e.preventDefault();

    const fullName = document.getElementById('reg-name').value.trim();
    const whatsappInput = document.getElementById('reg-whatsapp').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const college = document.getElementById('reg-college').value.trim();
    const referredBy = sessionStorage.getItem('referred_by');

    const whatsapp = standardizeIndianPhone(whatsappInput);
    if (!whatsapp) {
        Utils.showToast('Please enter a valid 10-digit Indian WhatsApp number.', 'error');
        return;
    }

    if (!Utils.validateEmail(email)) {
        Utils.showToast('Please enter a valid email address.', 'error');
        return;
    }

    Utils.showLoading(true);

    try {
        const participantData = {
            fullName,
            whatsappNumber: whatsapp,
            email,
            college,
            referredBy: referredBy || null,
            friend1Name: 'N/A',
            friend1Whatsapp: '+910000000000',
            friend2Name: 'N/A',
            friend2Whatsapp: '+910000000000',
            friend3Name: null,
            friend3Whatsapp: null
        };

        // 1. Register participant
        const newPart = await DatabaseService.registerParticipant(participantData);

        // 2. Complete all pledge steps in DB
        await DatabaseService.completePledgeStep(newPart.id, 1, PLEDGES[1]);
        await DatabaseService.completePledgeStep(newPart.id, 2, PLEDGES[2]);
        const result = await DatabaseService.completePledgeStep(newPart.id, 3, PLEDGES[3]);

        Utils.showLoading(false);
        Utils.showToast('Registration complete! Generating your certificate...', 'success');

        // Clear local session storage
        sessionStorage.removeItem('temp_full_name');
        sessionStorage.removeItem('referred_by');
        sessionStorage.removeItem('current_pledge_step');
        sessionStorage.removeItem('pledges_completed');

        setTimeout(() => {
            const dest = window.location.pathname.endsWith('.html') ? `verify.html?id=${result.certificate.certificate_id}` : `verify?id=${result.certificate.certificate_id}`;
            window.location.href = dest;
        }, 1200);

    } catch (err) {
        Utils.showLoading(false);
        console.error(err);
        Utils.showToast(err.message || 'Registration failed. Please try again.', 'error');
    }
}
