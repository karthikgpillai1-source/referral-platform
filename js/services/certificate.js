// Certificate Generation & Export Service
import { Utils } from '../utils.js';

export const CertificateService = {
    // Generate certificate ID
    generateCertId(seqNumber) {
        return `CERT-2026-${String(seqNumber).padStart(6, '0')}`;
    },

    // Render Certificate QR Code
    renderQRCode(containerId, verificationUrl) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = ''; // Clear previous

        try {
            if (window.QRCode) {
                new window.QRCode(container, {
                    text: verificationUrl,
                    width: 80,
                    height: 80,
                    colorDark: '#0f172a',
                    colorLight: '#ffffff',
                    correctLevel: window.QRCode.CorrectLevel.H
                });
            } else {
                console.warn('QRCode library not loaded yet.');
            }
        } catch (e) {
            console.error('Error rendering QR Code:', e);
        }
    },

    // Export certificate container to PDF
    exportToPDF(elementId, filename = 'certificate.pdf') {
        const element = document.getElementById(elementId);
        if (!element) {
            Utils.showToast('Certificate element not found for PDF export', 'error');
            return;
        }

        Utils.showLoading(true);

        try {
            if (window.html2pdf) {
                const opt = {
                    margin: 0.2,
                    filename: filename,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 2, useCORS: true, logging: false },
                    jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' }
                };

                window.html2pdf().set(opt).from(element).save().then(() => {
                    Utils.showLoading(false);
                    Utils.showToast('Certificate exported successfully!', 'success');
                }).catch(err => {
                    Utils.showLoading(false);
                    console.error('PDF generation error:', err);
                    Utils.showToast('Failed to export PDF.', 'error');
                });
            } else {
                // Fallback to basic window printing
                Utils.showLoading(false);
                window.print();
            }
        } catch (e) {
            Utils.showLoading(false);
            console.error(e);
            Utils.showToast('Export failed: ' + e.message, 'error');
        }
    }
};
