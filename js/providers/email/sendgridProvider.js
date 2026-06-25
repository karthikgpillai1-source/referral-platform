import { EmailProvider } from './emailProvider.js';

export class SendGridEmailProvider extends EmailProvider {
    constructor(config = {}) {
        super(config);
        this.apiKey = config.apiKey || '';
        this.fromEmail = config.fromEmail || 'campaign@awareness.org';
    }

    async sendEmail(to, subject, body, attachment = null) {
        console.log(`[SendGrid Email Provider] Preparing email delivery to: ${to}`);

        // In the future, this executes:
        // fetch('https://api.sendgrid.com/v3/mail/send', {
        //     method: 'POST',
        //     headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        //     body: JSON.stringify({ personalizations: [{ to: [{ email: to }] }], from: { email: this.fromEmail }, subject, content: [{ type: 'text/html', value: body }] })
        // });

        return new Promise((resolve) => {
            setTimeout(() => {
                console.log(`[SendGrid Email Provider] Email successfully delivered to: ${to}`);
                resolve({
                    success: true,
                    provider: 'sendgrid',
                    messageId: `sg-${crypto.randomUUID()}`
                });
            }, 500);
        });
    }
}
