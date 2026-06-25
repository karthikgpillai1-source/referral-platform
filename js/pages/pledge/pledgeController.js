// Pledge Controller - Logic for multi-step pledge data and database sync
import { DatabaseService } from '../../services/supabase.js?v=4';

export const PLEDGES = {
    1: "I pledge to lead a drug-free life, value my health, support others in making healthy choices, and contribute to building a safe, drug-free community.",
    2: "I solemnly swear to never use or distribute harmful substances, to protect my peers from substance abuse, and to actively advocate for wellness, safety, and awareness.",
    3: "I commit to raising awareness about the dangers of drugs, assisting those struggling with addiction, and maintaining a healthy mind and body to secure a brighter future."
};

export class PledgeController {
    constructor() {
        this.participant = null;
    }

    async loadParticipant(participantId, tempName) {
        if (participantId) {
            this.participant = await DatabaseService.getParticipantById(participantId);
            return this.participant;
        } else if (tempName) {
            this.participant = { full_name: tempName };
            return this.participant;
        }
        return null;
    }

    determineStartStep() {
        if (!this.participant) return 1;
        if (this.participant.pledge_3_completed) return 3;
        if (this.participant.pledge_2_completed) return 3;
        if (this.participant.pledge_1_completed) return 2;
        return 1;
    }

    getPledgeText(step) {
        if (!this.participant) return '';
        const fullName = this.participant.full_name.trim();
        let firstName = fullName.split(/\s+/)[0];
        firstName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();

        const basePledge = PLEDGES[step];
        return basePledge.replace(/^I\s+/, `I, ${firstName}, `);
    }

    async saveStepProgress(stepNumber, pledgeText) {
        if (!this.participant || !this.participant.id) {
            // Pre-registration client-side step completed, no DB sync yet
            return null;
        }
        return await DatabaseService.completePledgeStep(this.participant.id, stepNumber, pledgeText);
    }

    async registerParticipant(regData, referredBy) {
        const { fullName, whatsapp, email, college } = regData;

        // Satisfying DB constraints (dummy nomination values)
        const participantData = {
            fullName,
            whatsappNumber: whatsapp,
            email,
            college,
            referredBy: referredBy || null,
            friend1Name: 'N/A',
            friend1Whatsapp: '+910000000000',
            friend2Name: 'N/A',
            friend2Whatsapp: '+910000000000',
            friend3Name: null,
            friend3Whatsapp: null
        };

        // 1. Insert participant
        const newPart = await DatabaseService.registerParticipant(participantData);
        this.participant = newPart;

        // 2. Complete all pledge steps in database sequentially
        await DatabaseService.completePledgeStep(newPart.id, 1, PLEDGES[1]);
        await DatabaseService.completePledgeStep(newPart.id, 2, PLEDGES[2]);
        const finalResult = await DatabaseService.completePledgeStep(newPart.id, 3, PLEDGES[3]);

        return finalResult;
    }
}
