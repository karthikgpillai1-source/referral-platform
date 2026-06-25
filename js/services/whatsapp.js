import { CONFIG } from '../config.js';

export const WhatsAppService = {
    // Generate simple deep link URL
    _buildWhatsAppUrl(phone = '', text = '') {
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        const encodedText = encodeURIComponent(text);
        return `https://wa.me/${cleanPhone}?text=${encodedText}`;
    },

    // Share unique referral link with others
    shareReferralLink(referralCode, referrerName) {
        const link = `${CONFIG.APP_URL}/register.html?ref=${referralCode}`;
        const text = `Hey! I just registered for the Referral & Outreach Campaign. Register using my link to track points and win certificates: ${link}`;
        return this._buildWhatsAppUrl('', text);
    },

    // Invite a specific contact on WhatsApp
    inviteContact(phone, referrerName) {
        const text = `Hello! Join me in the Referral & Outreach Campaign. Register here: ${CONFIG.APP_URL}/register.html`;
        return this._buildWhatsAppUrl(phone, text);
    },

    // Share certificate verification details
    shareCertificate(certificateId, verificationUrl) {
        const text = `I just received my official Event Certificate! Check and verify it here: ${verificationUrl}`;
        return this._buildWhatsAppUrl('', text);
    }
};
