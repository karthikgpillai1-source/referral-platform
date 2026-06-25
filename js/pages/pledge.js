// Pledge Orchestrator - Main entry point linking all isolated controllers
import { VoiceManager } from '../providers/voice/voiceManager.js';
import { SessionController } from './pledge/sessionController.js';
import { PledgeController, PLEDGES } from './pledge/pledgeController.js';
import { UIController } from './pledge/uiController.js';
import { VoiceController } from './pledge/voiceController.js';
import { NavigationController } from './pledge/navigationController.js';
import { pronunciationDictionary } from '../services/pronunciationDictionary.js';
import { Utils } from '../utils.js';

const DEBUG = false; // Set to false to disable all debug logs for production

function debugLog(section, details) {
    if (DEBUG) {
        console.log(`[Pledge Orchestrator] [${section}]`, details);
    }
}

let pledgeCtrl, uiCtrl, voiceEng, voiceCtrl, navCtrl;
let currentStep = 1;
let currentPledgeText = '';

document.addEventListener('DOMContentLoaded', async () => {
    debugLog('Init', 'Initializing components...');

    // Instantiate Controllers
    pledgeCtrl = new PledgeController();
    uiCtrl = new UIController();
    voiceEng = new VoiceManager({ debug: DEBUG });
    voiceCtrl = new VoiceController(voiceEng, uiCtrl);
    navCtrl = new NavigationController(pledgeCtrl, uiCtrl, SessionController);

    const participantId = SessionController.getParticipantId();
    const tempName = SessionController.getTempName();

    // Verify Route Guard
    if (!navCtrl.verifyRouteGuard(participantId, tempName)) {
        return;
    }

    // Check if pre-registration pledges are already completed
    const pledgesDone = SessionController.getPledgesCompleted();
    if (pledgesDone && !participantId) {
        debugLog('Route', 'Pledges already completed. Directly showing registration.');
        uiCtrl.showRegistrationForm(tempName);
        bindRegistrationForm();
        return;
    }

    try {
        uiCtrl.showLoadingState();

        // Load participant information
        const participant = await pledgeCtrl.loadParticipant(participantId, tempName);
        if (!participant) {
            Utils.showToast('Failed to load participant details.', 'error');
            return;
        }

        // Determine step position
        if (participantId) {
            currentStep = pledgeCtrl.determineStartStep();
        } else {
            currentStep = SessionController.getCurrentStep();
        }

        debugLog('StartStep', { currentStep });
        loadStep(currentStep);

    } catch (err) {
        console.error('[Orchestrator] Initialization error:', err);
        Utils.showToast('An error occurred loading the page.', 'error');
    }

    // Bind registration form
    bindRegistrationForm();
});

function loadStep(step) {
    currentStep = step;
    if (!SessionController.getParticipantId()) {
        SessionController.setCurrentStep(step);
    }

    // 1. Reset state
    voiceEng.stop();
    uiCtrl.hideErrorBanner();
    uiCtrl.resetHighlight();
    uiCtrl.setCheckboxState(false, false);
    
    const continueBtnText = step === 3 ? 'Accept Pledge & Claim Certificate 🎓' : 'Continue to Next Step ➡️';
    uiCtrl.setContinueButton(continueBtnText, true);
    uiCtrl.updateProgress(step);

    // 2. Load text
    currentPledgeText = pledgeCtrl.getPledgeText(step);
    uiCtrl.renderPledgeText(currentPledgeText);

    // 3. Bind controls and auto-play (if supported)
    voiceCtrl.bindControls(currentPledgeText, pronunciationDictionary);
    uiCtrl.showPledgeMainCard();

    // Setup checkbox toggle
    const chk = document.getElementById('pledge-chk');
    if (chk) {
        chk.addEventListener('change', (e) => {
            uiCtrl.setContinueButton(continueBtnText, !e.target.checked);
        });
    }

    // Setup continue click
    const continueBtn = document.getElementById('pledge-btn');
    if (continueBtn) {
        continueBtn.addEventListener('click', handleContinueClick);
    }
}

async function handleContinueClick() {
    debugLog('Navigation', `Continue clicked at Step ${currentStep}`);
    const participantId = SessionController.getParticipantId();

    if (!participantId) {
        // Pre-registration client flow
        if (currentStep < 3) {
            Utils.showToast(`Step ${currentStep} completed successfully!`, 'success');
            loadStep(currentStep + 1);
        } else {
            // Pre-registration pledges completed
            voiceEng.stop();
            SessionController.setPledgesCompleted(true);
            uiCtrl.showRegistrationForm(SessionController.getTempName());
        }
    } else {
        // Resume workflow (direct DB updates)
        const btn = document.getElementById('pledge-btn');
        if (btn) btn.setAttribute('disabled', 'true');
        Utils.showLoading(true);

        try {
            const result = await pledgeCtrl.saveStepProgress(currentStep, currentPledgeText);
            Utils.showLoading(false);

            if (currentStep < 3) {
                Utils.showToast(`Step ${currentStep} completed successfully!`, 'success');
                loadStep(currentStep + 1);
            } else {
                Utils.showToast('All pledges accepted! Generating certificate...', 'success');
                SessionController.clearTempSession();
                setTimeout(() => {
                    navCtrl.redirectToVerify(result.certificate.certificate_id);
                }, 1200);
            }
        } catch (e) {
            Utils.showLoading(false);
            console.error('[Orchestrator] Save progress error:', e);
            Utils.showToast('Failed to save progress. Please try again.', 'error');
            if (btn) btn.removeAttribute('disabled');
        }
    }
}

function bindRegistrationForm() {
    const regForm = document.getElementById('post-pledge-registration-form');
    if (regForm) {
        // Clear any previous submit listener by replacing elements if necessary, but standard form submit logic is simple
        regForm.onsubmit = handlePostPledgeRegistration;
    }
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
    const referredBy = SessionController.getReferredBy();

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
        const regData = { fullName, whatsapp, email, college };
        const result = await pledgeCtrl.registerParticipant(regData, referredBy);

        Utils.showLoading(false);
        Utils.showToast('Registration complete! Generating your certificate...', 'success');

        // Clear session fields
        SessionController.clearTempSession();

        setTimeout(() => {
            navCtrl.redirectToVerify(result.certificate.certificate_id);
        }, 1200);

    } catch (err) {
        Utils.showLoading(false);
        console.error('[Orchestrator] Registration error:', err);
        Utils.showToast(err.message || 'Registration failed. Please try again.', 'error');
    }
}
