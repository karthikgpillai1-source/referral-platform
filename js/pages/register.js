import { ReferralService } from '../services/referral.js';
import { Utils } from '../utils.js';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Capture referral code from URL if present and store it in session storage
    const referrer = ReferralService.getReferrerFromURL();
    if (referrer) {
        sessionStorage.setItem('referred_by', referrer);
    }

    const btnContinueName = document.getElementById('btn-continue-name');
    const collectNameInput = document.getElementById('collect-name-input');

    if (btnContinueName && collectNameInput) {
        btnContinueName.addEventListener('click', () => {
            const name = collectNameInput.value.trim();
            if (name.length < 3 || name.length > 100) {
                Utils.showToast('Please enter your full name (3 to 100 characters).', 'error');
                return;
            }

            // Save name to session storage
            sessionStorage.setItem('temp_full_name', name);

            // Redirect to pledge screen
            const dest = window.location.pathname.endsWith('.html') ? 'pledge.html' : 'pledge';
            window.location.href = dest;
        });

        // Add Enter key listener
        collectNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                btnContinueName.click();
            }
        });

        // Auto-focus name field
        collectNameInput.focus();
    }
});
