import { DatabaseService } from '../services/supabase.js?v=3';
import { CertificateService } from '../services/certificate.js';
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

            // Show personalized celebration banner
            const congratsNameEl = document.getElementById('congrats-name');
            if (congratsNameEl) {
                const firstName = participant.full_name.trim().split(/\s+/)[0];
                congratsNameEl.textContent = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
            }
            document.getElementById('celebration-banner').style.display = 'block';

            // Fetch active event if exists
            const events = await DatabaseService.getEvents();
            if (events && events.length > 0) {
                document.getElementById('cert-event').textContent = events[0].event_name;
            }

            // Render Certificate QR Code (embeds verification link)
            const verificationUrl = `${window.location.origin}/verify?id=${certData.certificate_id}`;
            CertificateService.renderQRCode('cert-qr-container', verificationUrl);

            // Setup Referral Link Display
            const refLink = ReferralService.generateReferralLink(participant.referral_code);

            // Configure Copy Buttons
            setupCopyButton('copy-cert-link-btn', verificationUrl, 'Certificate verification link copied!');
            setupCopyButton('copy-ref-link-btn', refLink, 'Referral invitation link copied!');

            // Configure Combined Sharing Message Panel
            setupCombinedSharing(verificationUrl, refLink);

            // Configure PDF download button
            const downloadBtn = document.getElementById('download-pdf-btn');
            if (downloadBtn) {
                const newDownloadBtn = downloadBtn.cloneNode(true);
                downloadBtn.parentNode.replaceChild(newDownloadBtn, downloadBtn);
                newDownloadBtn.addEventListener('click', () => {
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

function setupCombinedSharing(verificationUrl, refLink) {
    const textMessage = 
`I have proudly completed the Youth Against Drugs Campaign and taken the pledge for a drug-free future.

Here is my campaign certificate:
${verificationUrl}

Join me by taking the pledge using my personal invitation link:
${refLink}

Together we can build a healthier and drug-free society.`;

    // Social Share links
    const waShare = document.getElementById('share-cert-wa');
    if (waShare) waShare.setAttribute('href', `https://wa.me/?text=${encodeURIComponent(textMessage)}`);

    const fbShare = document.getElementById('share-cert-fb');
    if (fbShare) fbShare.setAttribute('href', `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(verificationUrl)}`);

    const xShare = document.getElementById('share-cert-x');
    if (xShare) xShare.setAttribute('href', `https://twitter.com/intent/tweet?text=${encodeURIComponent("I have taken the Youth Against Drugs pledge! Join me:")}&url=${encodeURIComponent(refLink)}`);

    const tgShare = document.getElementById('share-cert-tg');
    if (tgShare) tgShare.setAttribute('href', `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent(textMessage)}`);

    const emailShare = document.getElementById('share-cert-email');
    if (emailShare) {
        const subject = `Official Youth Against Drugs Pledge Certificate`;
        emailShare.setAttribute('href', `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(textMessage)}`);
    }

    // Native Web Share integration
    const nativeShareBtn = document.getElementById('btn-share-native-cert');
    const customPanel = document.getElementById('cert-sharing-panel');
    if (navigator.share && nativeShareBtn) {
        customPanel.style.display = 'none';
        nativeShareBtn.style.display = 'inline-flex';
        
        const newNativeBtn = nativeShareBtn.cloneNode(true);
        nativeShareBtn.parentNode.replaceChild(newNativeBtn, nativeShareBtn);
        newNativeBtn.addEventListener('click', () => {
            navigator.share({
                title: 'Youth Against Drugs Certificate & Invitation',
                text: textMessage
            }).catch(err => console.log('Share failed:', err));
        });
    }

    // Render Referral QR Code pointing directly to participant's referral registration link
    const qrContainer = document.getElementById('referral-qr-container');
    if (qrContainer && window.QRCode) {
        qrContainer.innerHTML = '';
        new window.QRCode(qrContainer, {
            text: refLink,
            width: 144,
            height: 144,
            colorDark: '#0f172a',
            colorLight: '#ffffff',
            correctLevel: window.QRCode.CorrectLevel.M
        });
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
