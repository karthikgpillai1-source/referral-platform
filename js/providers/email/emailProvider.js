// Abstract base class representing an Email Provider integration
export class EmailProvider {
    constructor(config = {}) {
        if (this.constructor === EmailProvider) {
            throw new Error("Cannot instantiate abstract class EmailProvider directly.");
        }
        this.config = config;
    }

    /**
     * Sends an email.
     * @param {string} to - Recipient email address.
     * @param {string} subject - Email subject line.
     * @param {string} body - Email body content (HTML or Plaintext).
     * @param {Object} [attachment] - Optional attachment data (filename, content).
     * @returns {Promise<Object>} - Status report of the send action.
     */
    async sendEmail(to, subject, body, attachment = null) {
        throw new Error("Method 'sendEmail()' must be implemented by subclasses.");
    }
}
