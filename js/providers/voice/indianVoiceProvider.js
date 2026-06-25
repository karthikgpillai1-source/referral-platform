import { BrowserProvider } from './browserProvider.js';

// Indian Voice Provider - Specializes in matching and tuning browser Indian English voices
export class IndianVoiceProvider extends BrowserProvider {
    constructor() {
        super();
        this.name = 'Indian Voice Provider (Browser)';
    }

    selectVoice(voices) {
        // High priority Indian English voices
        const preferredIndianVoices = [
            'google english india',
            'microsoft heera',
            'microsoft ravi',
            'microsoft neerja',
            'microsoft prabhat',
            'en-in'
        ];

        let foundVoice = null;

        // Try exact match on name keywords
        for (const nameKeyword of preferredIndianVoices) {
            foundVoice = voices.find(v => v.name.toLowerCase().includes(nameKeyword) || v.lang.toLowerCase().replace('_', '-').startsWith(nameKeyword));
            if (foundVoice) break;
        }

        // Fallback to general en-IN languages
        if (!foundVoice) {
            foundVoice = voices.find(v => v.lang.toLowerCase().replace('_', '-').startsWith('en-in'));
        }

        this.selectedVoice = foundVoice;
        return this.selectedVoice;
    }
}
