// Navigation Controller - Redirects and route guards
import { SessionController } from './sessionController.js';
import { Utils } from '../../utils.js';

export class NavigationController {
    constructor(pledgeController, uiController, sessionController) {
        this.pledge = pledgeController;
        this.ui = uiController;
        this.session = sessionController;
    }

    verifyRouteGuard(participantId, tempName) {
        if (!participantId && !tempName) {
            Utils.showToast('Please enter your name first. Redirecting to start...', 'error');
            setTimeout(() => {
                const dest = window.location.pathname.endsWith('.html') ? 'register.html' : 'register';
                window.location.href = dest;
            }, 1500);
            return false;
        }
        return true;
    }

    redirectToVerify(certId) {
        const dest = window.location.pathname.endsWith('.html') ? `verify.html?id=${certId}` : `verify?id=${certId}`;
        window.location.href = dest;
    }
}
