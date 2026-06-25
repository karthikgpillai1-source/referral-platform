// Session Controller - Manages sessionStorage, localStorage, and query parameters

export const SessionController = {
    getParticipantId() {
        const params = new URLSearchParams(window.location.search);
        return params.get('id') || null;
    },

    getTempName() {
        return sessionStorage.getItem('temp_full_name') || null;
    },

    getPledgesCompleted() {
        return sessionStorage.getItem('pledges_completed') === 'true';
    },

    setPledgesCompleted(val) {
        if (val) {
            sessionStorage.setItem('pledges_completed', 'true');
        } else {
            sessionStorage.removeItem('pledges_completed');
        }
    },

    getCurrentStep() {
        const saved = sessionStorage.getItem('current_pledge_step');
        return saved ? parseInt(saved, 10) : 1;
    },

    setCurrentStep(step) {
        sessionStorage.setItem('current_pledge_step', step.toString());
    },

    getReferredBy() {
        return sessionStorage.getItem('referred_by') || null;
    },

    clearTempSession() {
        sessionStorage.removeItem('temp_full_name');
        sessionStorage.removeItem('referred_by');
        sessionStorage.removeItem('current_pledge_step');
        sessionStorage.removeItem('pledges_completed');
    }
};
