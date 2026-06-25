import { DatabaseService } from '../services/supabase.js?v=3';
import { CertificateService } from '../services/certificate.js';
import { WhatsAppService } from '../services/whatsapp.js';
import { ReferralService } from '../services/referral.js';
import { Utils } from '../utils.js';

document.addEventListener('DOMContentLoaded', () => {
    const certId = Utils.getQueryParam('id');
    
    if (certId) {
        verifyCertificate(certId);
    } else {
        showFailureState();
    }

    // Bind retry form
    const form = document.getElementById('verify-search-form');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const searchId = document.getElementById('retry-cert-id').value.trim();
            if (searchId) {
                window.location.href = `verify?id=${searchId}`;
            }
        });
    }
});

async function verifyCertificate(certId) {
    const loadingEl = document.getElementById('verify-loading');
    const successEl = document.getElementById('verify-success-container');
    const failureEl = document.getElementById('verify-failure-container');

    try {
        const certData = await DatabaseService.getCertificateById(certId);

        loadingEl.style.display = 'none';

        if (certData && certData.participants) {
            const participant = certData.participants;

            // Populate fields
            document.getElementById('cert-recipient').textContent = participant.full_name;
            document.getElementById('cert-id-lbl').textContent = certData.certificate_id;
            document.getElementById('cert-date-lbl').textContent = Utils.formatDate(certData.issue_date);

            // Fetch active event if exists
            const events = await DatabaseService.getEvents();
            if (events && events.length > 0) {
                document.getElementById('cert-event').textContent = events[0].event_name;
            }

            // Render QR Code
            const verificationUrl = `${window.location.origin}/verify?id=${certData.certificate_id}`;
            CertificateService.renderQRCode('cert-qr-container', verificationUrl);

            // Setup WhatsApp share button
            const waShareBtn = document.getElementById('share-cert-wa-btn');
            if (waShareBtn) {
                const waText = `I have taken the Youth Against Drugs Pledge and received my official verified certificate! Join the movement and pledge here: ${window.location.origin}/register?ref=${participant.referral_code}`;
                const waUrl = `https://wa.me/?text=${encodeURIComponent(waText)}`;
                waShareBtn.setAttribute('href', waUrl);
            }

            // Setup Referral Link Display
            const refLink = ReferralService.generateReferralLink(participant.referral_code);
            const refInput = document.getElementById('share-referral-link');
            if (refInput) {
                refInput.value = refLink;
            }

            setupCopyButton('copy-ref-link-btn', refLink, 'Referral link copied!');

            // Configure PDF download button
            const downloadBtn = document.getElementById('download-pdf-btn');
            if (downloadBtn) {
                downloadBtn.addEventListener('click', () => {
                    CertificateService.exportToPDF('cert-pdf-target', `certificate-${certData.certificate_id}.pdf`);
                });
            }

            // Show Success Container
            successEl.style.display = 'block';
            failureEl.style.display = 'none';
        } else {
            showFailureState();
        }
    } catch (e) {
        console.error('Verification error:', e);
        loadingEl.style.display = 'none';
        showFailureState();
    }
}

function showFailureState() {
    document.getElementById('verify-loading').style.display = 'none';
    document.getElementById('verify-success-container').style.display = 'none';
    document.getElementById('verify-failure-container').style.display = 'block';
}

function setupCopyButton(btnId, textToCopy, successMsg) {
    const btn = document.getElementById(btnId);
    if (!btn) return;

    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    newBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(textToCopy)
            .then(() => Utils.showToast(successMsg, 'success'))
            .catch(() => Utils.showToast('Failed to copy. Please copy manually.', 'error'));
    });
}
