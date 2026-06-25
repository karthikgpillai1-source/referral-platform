import { DatabaseService } from '../services/supabase.js?v=4';
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
    const tempName = sessionStorage.getItem('temp_full_name');

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
            // Loading an existing participant (e.g. from admin panel or resume link)
            participant = await DatabaseService.getParticipantById(participantId);
            if (!participant) {
                Utils.showToast('Participant not found. Redirecting...', 'error');
                setTimeout(() => window.location.href = 'register', 1500);
                return;
            }
            determineStartStep();
        } else {
            // Pre-registration workflow (client-side pledges first)
            participant = { full_name: tempName };
            currentStep = 1;
        }

        loadStep(currentStep);
    } catch (e) {
        console.error(e);
        Utils.showToast('Error loading pledge details.', 'error');
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

    // Bind post-pledge registration form submission
    const regForm = document.getElementById('post-pledge-registration-form');
    if (regForm) {
        regForm.addEventListener('submit', handlePostPledgeRegistration);
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
    btn.textContent = step === 3 ? 'Accept Pledge & Claim Certificate 🎓' : 'Continue to Next Step ➡️';

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
    
    const inVoices = voices.filter(v => 
        v.lang === 'en-IN' || 
        v.lang.toLowerCase().replace('_', '-').startsWith('en-in') ||
        v.name.toLowerCase().includes('india') ||
        v.name.toLowerCase().includes('indian')
    );
    
    selectedVoice = inVoices.find(v => v.name.toLowerCase().includes('neural') || v.name.toLowerCase().includes('natural'));
    
    if (!selectedVoice && inVoices.length > 0) {
        selectedVoice = inVoices[0];
    }
    
    if (!selectedVoice) {
        selectedVoice = voices.find(v => v.lang.toLowerCase().replace('_', '-').startsWith('en-gb'));
    }
    
    if (!selectedVoice) {
        selectedVoice = voices.find(v => v.lang.toLowerCase().replace('_', '-').startsWith('en-us'));
    }
    
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
    const playBtn = document.getElementById('btn-play-voice');
    const newPlayBtn = playBtn.cloneNode(true);
    playBtn.parentNode.replaceChild(newPlayBtn, playBtn);
    newPlayBtn.textContent = '🔊 Play Narration';
    newPlayBtn.addEventListener('click', togglePlay);

    const restartBtn = document.getElementById('btn-restart-voice');
    const newRestartBtn = restartBtn.cloneNode(true);
    restartBtn.parentNode.replaceChild(newRestartBtn, restartBtn);
    newRestartBtn.addEventListener('click', restartReading);

    const chk = document.getElementById('pledge-chk');
    const newChk = chk.cloneNode(true);
    chk.parentNode.replaceChild(newChk, chk);
    newChk.addEventListener('change', handleCheckboxToggle);

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
    if (e.target.checked && speechCompleted) {
        btn.removeAttribute('disabled');
    } else {
        btn.setAttribute('disabled', 'true');
    }
}

async function handleContinueClick() {
    // If not registered yet (temp_full_name mode)
    if (!Utils.getQueryParam('id')) {
        if (currentStep < 3) {
            Utils.showToast(`Step ${currentStep} completed successfully!`, 'success');
            loadStep(currentStep + 1);
        } else {
            // All pledges accepted, now show registration view
            if (synth) synth.cancel();
            document.getElementById('pledge-main-card').style.display = 'none';
            document.getElementById('pledge-registration-card').style.display = 'block';
            document.getElementById('reg-name').value = sessionStorage.getItem('temp_full_name') || '';
        }
    } else {
        // Resume workflow (from DB participant ID)
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
}

// Indian Mobile Number Validator and Standardizer
function standardizeIndianPhone(phone) {
    const clean = phone.replace(/[\s-()]/g, '');
    const match = clean.match(/^(?:\+?91|0)?([6-9]\d{9})$/);
    if (!match) return null;
    return '+91' + match[1];
}

// Handle Post-Pledge Registration form submission
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
        // Create participant data with dummy values for Friend nominations to satisfy DB constraint
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

        // 1. Insert participant in database
        const newPart = await DatabaseService.registerParticipant(participantData);

        // 2. Complete all pledge steps in database to trigger certificate issue
        await DatabaseService.completePledgeStep(newPart.id, 1, PLEDGES[1]);
        await DatabaseService.completePledgeStep(newPart.id, 2, PLEDGES[2]);
        const result = await DatabaseService.completePledgeStep(newPart.id, 3, PLEDGES[3]);

        Utils.showLoading(false);
        Utils.showToast('Registration complete! Generating your certificate...', 'success');

        // Clear temporary session storage items
        sessionStorage.removeItem('temp_full_name');
        sessionStorage.removeItem('referred_by');

        setTimeout(() => {
            window.location.href = `verify?id=${result.certificate.certificate_id}`;
        }, 1200);

    } catch (err) {
        Utils.showLoading(false);
        console.error(err);
        Utils.showToast(err.message || 'Registration failed. Please try again.', 'error');
    }
}
