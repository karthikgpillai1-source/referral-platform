import { EmailProvider } from './emailProvider.js';

export class ResendEmailProvider extends EmailProvider {
    constructor(config = {}) {
        super(config);
        this.apiKey = config.apiKey || '';
        this.fromEmail = config.fromEmail || 'campaign@awareness.org';
    }

    async sendEmail(to, subject, body, attachment = null) {
        console.log(`[Resend Email Provider] Preparing email delivery to: ${to}`);
        
        // In the future, this executes:
        // fetch('https://api.resend.com/emails', {
        //     method: 'POST',
        //     headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        //     body: JSON.stringify({ from: this.fromEmail, to, subject, html: body })
        // });

        // Simulated action success
        return new Promise((resolve) => {
            setTimeout(() => {
                console.log(`[Resend Email Provider] Email successfully delivered to: ${to}`);
                resolve({
                    success: true,
                    provider: 'resend',
                    messageId: `rs-${crypto.randomUUID()}`
                });
            }, 500);
        });
    }
}
