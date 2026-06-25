import { CONFIG } from '../config.js';

export const ReferralService = {
    // Generate referral link based on referral code
    generateReferralLink(code) {
        if (!code) return '';
        return `${window.location.origin}/?ref=${code}`;
    },

    // Check query params for referral code
    getReferrerFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('ref') || null;
    }
};
