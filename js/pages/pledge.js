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
    setupUtterance();

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

function setupUtterance() {
    if (!synth) return;

    synth.cancel();

    utterance = new SpeechSynthesisUtterance(spokenPledgeText);
    utterance.rate = 0.92;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Prevent SpeechSynthesis garbage collection mid-speech
    window.activeUtterance = utterance;

    // Voice Selection Priority
    const voices = synth.getVoices();
    setIndianVoice(voices);
    if (synth.onvoiceschanged !== undefined) {
        synth.onvoiceschanged = () => {
            setIndianVoice(synth.getVoices());
        };
    }

    utterance.onboundary = handleSpeechBoundary;
    utterance.onend = handleSpeechEnd;
    utterance.onerror = (e) => {
        cleanupUtterance();
        stopVisualizer();
        clearWordHighlights();
        
        if (e.error === 'not-allowed') {
            showSpeechInfoMessage('Voice narration is available. Press Play to listen.');
        } else if (e.error !== 'interrupted' && e.error !== 'canceled') {
            // Non-blocking fallback for other real errors
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
        newPlay.textContent = '▶ Play';
        newPlay.addEventListener('click', togglePlay);
    }

    const stopBtn = document.getElementById('btn-stop-voice');
    if (stopBtn) {
        const newStop = stopBtn.cloneNode(true);
        stopBtn.parentNode.replaceChild(newStop, stopBtn);
        newStop.addEventListener('click', stopReading);
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
    updatePlayButtonText('⏸ Pause');
    startVisualizer();
    synth.speak(utterance);
}

function togglePlay() {
    if (!synth || !utterance) return;

    if (isReading) {
        synth.pause();
        isReading = false;
        updatePlayButtonText('▶ Resume');
        stopVisualizer();
    } else {
        if (synth.paused) {
            synth.resume();
        } else {
            synth.speak(utterance);
        }
        isReading = true;
        updatePlayButtonText('⏸ Pause');
        startVisualizer();
    }
}

function stopReading() {
    if (!synth) return;
    synth.cancel();
    cleanupUtterance();
    isReading = false;
    updatePlayButtonText('▶ Play');
    stopVisualizer();
    clearWordHighlights();
    setupUtterance(); // Reinitialize for play again
}

function handleSpeechBoundary(event) {
    if (event.name !== 'word') return;
    const charIndex = event.charIndex;
    const active = spokenSegments.find(s => charIndex >= s.start && charIndex < s.end);

    if (active) {
        clearWordHighlights();
        const activeSpan = document.getElementById(`word-${active.origIndex}`);
        if (activeSpan) activeSpan.classList.add('active');
    }
}

function handleSpeechEnd() {
    cleanupUtterance();
    isReading = false;
    updatePlayButtonText('▶ Play');
    stopVisualizer();
    clearWordHighlights();
}

function cleanupUtterance() {
    if (utterance) {
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

function updatePlayButtonText(text) {
    const playBtn = document.getElementById('btn-play-voice');
    if (playBtn) playBtn.textContent = text;
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
