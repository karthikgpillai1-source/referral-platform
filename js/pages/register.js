import { DatabaseService } from '../services/supabase.js?v=3';
import { ReferralService } from '../services/referral.js';
import { Utils } from '../utils.js';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Pre-fill referral code from URL if present
    const referrer = ReferralService.getReferrerFromURL();
    if (referrer) {
        const refInput = document.getElementById('referred-by');
        if (refInput) {
            refInput.value = referrer;
            refInput.setAttribute('disabled', 'true');
        }
    }

    // 2. Handle form submission
    const form = document.getElementById('campaign-registration-form');
    if (form) {
        form.addEventListener('submit', handleRegisterSubmit);
    }
});

// Indian Mobile Number Validator and Standardizer
function standardizeIndianPhone(phone) {
    const clean = phone.replace(/[\s-()]/g, '');
    // Matches optional +91, 91, or 0, followed by a digit from 6-9 and then 9 digits.
    const match = clean.match(/^(?:\+?91|0)?([6-9]\d{9})$/);
    if (!match) return null;
    return '+91' + match[1]; // Standardize to +91XXXXXXXXXX
}

async function handleRegisterSubmit(e) {
    e.preventDefault();

    const fullName = document.getElementById('part-name').value.trim();
    const whatsappInput = document.getElementById('part-whatsapp').value.trim();
    const email = document.getElementById('part-email').value.trim();
    const college = document.getElementById('part-college').value.trim();
    const referredBy = document.getElementById('referred-by').value.trim();

    // Friends Inputs
    const f1Name = document.getElementById('friend-1-name').value.trim();
    const f1WhatsappInput = document.getElementById('friend-1-whatsapp').value.trim();
    const f2Name = document.getElementById('friend-2-name').value.trim();
    const f2WhatsappInput = document.getElementById('friend-2-whatsapp').value.trim();
    const f3Name = document.getElementById('friend-3-name').value.trim();
    const f3WhatsappInput = document.getElementById('friend-3-whatsapp').value.trim();

    // 1. Validate Participant Info
    if (fullName.length < 3 || fullName.length > 100) {
        Utils.showToast('Full name must be between 3 and 100 characters.', 'error');
        return;
    }

    const partWhatsapp = standardizeIndianPhone(whatsappInput);
    if (!partWhatsapp) {
        Utils.showToast('Please enter a valid 10-digit Indian WhatsApp number.', 'error');
        return;
    }

    if (!Utils.validateEmail(email)) {
        Utils.showToast('Please enter a valid email address.', 'error');
        return;
    }

    // 2. Validate Friend 1
    const f1Whatsapp = standardizeIndianPhone(f1WhatsappInput);
    if (!f1Whatsapp) {
        Utils.showToast('Please enter a valid WhatsApp number for Friend 1.', 'error');
        return;
    }
    if (f1Whatsapp === partWhatsapp) {
        Utils.showToast('Friend 1 number cannot be the same as your WhatsApp number.', 'error');
        return;
    }

    // 3. Validate Friend 2
    const f2Whatsapp = standardizeIndianPhone(f2WhatsappInput);
    if (!f2Whatsapp) {
        Utils.showToast('Please enter a valid WhatsApp number for Friend 2.', 'error');
        return;
    }
    if (f2Whatsapp === partWhatsapp || f2Whatsapp === f1Whatsapp) {
        Utils.showToast('Friend 2 number must be unique and different from yours.', 'error');
        return;
    }

    // 4. Validate Friend 3 (Optional)
    let f3Whatsapp = null;
    if (f3Name || f3WhatsappInput) {
        if (!f3Name || !f3WhatsappInput) {
            Utils.showToast('Please provide both name and WhatsApp for Friend 3 if nomination is filled.', 'error');
            return;
        }
        f3Whatsapp = standardizeIndianPhone(f3WhatsappInput);
        if (!f3Whatsapp) {
            Utils.showToast('Please enter a valid WhatsApp number for Friend 3.', 'error');
            return;
        }
        if (f3Whatsapp === partWhatsapp || f3Whatsapp === f1Whatsapp || f3Whatsapp === f2Whatsapp) {
            Utils.showToast('Friend 3 number must be unique and different from other numbers.', 'error');
            return;
        }
    }

    Utils.showLoading(true);

    try {
        const participantData = {
            fullName,
            whatsappNumber: partWhatsapp,
            email,
            college,
            referredBy,
            friend1Name: f1Name,
            friend1Whatsapp: f1Whatsapp,
            friend2Name: f2Name,
            friend2Whatsapp: f2Whatsapp,
            friend3Name: f3Name || null,
            friend3Whatsapp: f3Whatsapp || null
        };

        const result = await DatabaseService.registerParticipant(participantData);

        Utils.showLoading(false);
        Utils.showToast('Registration successful! Redirecting to pledge...', 'success');

        // Redirect immediately to pledge screen
        setTimeout(() => {
            window.location.href = `pledge?id=${result.id}`;
        }, 1200);

    } catch (err) {
        Utils.showLoading(false);
        console.error(err);
        Utils.showToast(err.message || 'Registration failed. Please check details or network connection.', 'error');
    }
}
