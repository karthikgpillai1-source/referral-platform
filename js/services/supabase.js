import { CONFIG } from '../config.js';
import { Utils } from '../utils.js';

// Initialize Supabase Client if credentials exist
let supabaseClient = null;
if (!CONFIG.IS_MOCK_MODE) {
    try {
        if (window.supabase) {
            supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
        } else {
            console.error('Supabase library not found in window object.');
        }
    } catch (e) {
        console.error('Error initializing Supabase client:', e);
    }
}

// Helper to get local mock data
const getLocalData = (key) => JSON.parse(localStorage.getItem(key)) || [];
const setLocalData = (key, data) => localStorage.setItem(key, JSON.stringify(data));

// Initialize default events in Mock mode
if (CONFIG.IS_MOCK_MODE) {
    const events = getLocalData(CONFIG.LOCAL_STORAGE_KEYS.EVENTS);
    if (events.length === 0) {
        setLocalData(CONFIG.LOCAL_STORAGE_KEYS.EVENTS, [{
            id: 'evt-default-uuid',
            event_name: 'Anti-Drug Awareness Campaign 2026',
            event_description: 'A youth-led campaign pledge to support substance awareness and clean living.',
            event_start_date: new Date().toISOString(),
            event_end_date: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
            created_at: new Date().toISOString()
        }]);
    }
}

export const DatabaseService = {
    // PARTICIPANTS SERVICES
    async registerParticipant(participantData) {
        const { 
            fullName, whatsappNumber, email, college, referredBy,
            friend1Name, friend1Whatsapp, friend2Name, friend2Whatsapp,
            friend3Name, friend3Whatsapp
        } = participantData;

        if (!CONFIG.IS_MOCK_MODE && supabaseClient) {
            // Check duplicates first
            const { data: existing } = await supabaseClient
                .from('participants')
                .select('id')
                .or(`whatsapp_number.eq.${whatsappNumber},email.eq.${email}`);

            if (existing && existing.length > 0) {
                throw new Error('A user with this WhatsApp number or Email already exists.');
            }

            // Insert into Supabase
            const { data, error } = await supabaseClient
                .from('participants')
                .insert([{
                    full_name: fullName,
                    whatsapp_number: whatsappNumber,
                    email: email,
                    college: college,
                    referred_by: referredBy || null,
                    status: 'registered',
                    friend_1_name: friend1Name,
                    friend_1_whatsapp: friend1Whatsapp,
                    friend_2_name: friend2Name,
                    friend_2_whatsapp: friend2Whatsapp,
                    friend_3_name: friend3Name || null,
                    friend_3_whatsapp: friend3Whatsapp || null,
                    pledge_1_completed: false,
                    pledge_2_completed: false,
                    pledge_3_completed: false,
                    overall_pledge_completed: false,
                    certificate_sent: false,
                    certificate_delivery_method: 'download'
                }])
                .select();

            if (error) throw error;
            return data[0];
        } else {
            // Mock Implementation
            const participants = getLocalData(CONFIG.LOCAL_STORAGE_KEYS.PARTICIPANTS);
            
            // Check duplicates
            const isDuplicate = participants.some(p => 
                p.whatsapp_number === whatsappNumber || p.email === email
            );
            if (isDuplicate) {
                throw new Error('A user with this WhatsApp number or Email already exists.');
            }

            const nextRefId = participants.length + 1;
            const refCode = `REF${String(nextRefId).padStart(4, '0')}`;

            const newParticipant = {
                id: crypto.randomUUID(),
                full_name: fullName,
                whatsapp_number: whatsappNumber,
                email: email,
                college: college,
                referred_by: referredBy || null,
                referral_code: refCode,
                registration_date: new Date().toISOString(),
                status: 'registered',
                certificate_id: null,
                certificate_url: null,
                friend_1_name: friend1Name,
                friend_1_whatsapp: friend1Whatsapp,
                friend_2_name: friend2Name,
                friend_2_whatsapp: friend2Whatsapp,
                friend_3_name: friend3Name || null,
                friend_3_whatsapp: friend3Whatsapp || null,
                pledge_1_completed: false,
                pledge_1_completed_at: null,
                pledge_2_completed: false,
                pledge_2_completed_at: null,
                pledge_3_completed: false,
                pledge_3_completed_at: null,
                overall_pledge_completed: false,
                overall_pledge_completed_at: null,
                pledge_text: null,
                certificate_sent: false,
                certificate_sent_at: null,
                certificate_delivery_method: 'download',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            participants.push(newParticipant);
            setLocalData(CONFIG.LOCAL_STORAGE_KEYS.PARTICIPANTS, participants);

            // Handle referral tracking automatically
            if (referredBy) {
                const referrer = participants.find(p => p.referral_code === referredBy);
                if (referrer && referrer.id !== newParticipant.id) {
                    const referrals = getLocalData(CONFIG.LOCAL_STORAGE_KEYS.REFERRALS);
                    referrals.push({
                        id: crypto.randomUUID(),
                        referrer_id: referrer.id,
                        referred_id: newParticipant.id,
                        created_at: new Date().toISOString()
                    });
                    setLocalData(CONFIG.LOCAL_STORAGE_KEYS.REFERRALS, referrals);
                }
            }

            return newParticipant;
        }
    },

    async getParticipantById(id) {
        if (!CONFIG.IS_MOCK_MODE && supabaseClient) {
            const { data, error } = await supabaseClient
                .from('participants')
                .select('*')
                .eq('id', id)
                .maybeSingle();
            if (error) throw error;
            return data;
        } else {
            const participants = getLocalData(CONFIG.LOCAL_STORAGE_KEYS.PARTICIPANTS);
            return participants.find(p => p.id === id) || null;
        }
    },

    async getParticipants() {
        if (!CONFIG.IS_MOCK_MODE && supabaseClient) {
            const { data, error } = await supabaseClient
                .from('participants')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        } else {
            return getLocalData(CONFIG.LOCAL_STORAGE_KEYS.PARTICIPANTS);
        }
    },

    async getParticipantByReferral(code) {
        if (!CONFIG.IS_MOCK_MODE && supabaseClient) {
            const { data, error } = await supabaseClient
                .from('participants')
                .select('*')
                .eq('referral_code', code)
                .maybeSingle();
            if (error) throw error;
            return data;
        } else {
            const participants = getLocalData(CONFIG.LOCAL_STORAGE_KEYS.PARTICIPANTS);
            return participants.find(p => p.referral_code === code) || null;
        }
    },

    // MULTI-STAGE PLEDGE SERVICES
    async completePledgeStep(participantId, stepNumber, pledgeText) {
        const timestamp = new Date().toISOString();
        const updateFields = {};

        if (stepNumber === 1) {
            updateFields.pledge_1_completed = true;
            updateFields.pledge_1_completed_at = timestamp;
        } else if (stepNumber === 2) {
            updateFields.pledge_2_completed = true;
            updateFields.pledge_2_completed_at = timestamp;
        } else if (stepNumber === 3) {
            updateFields.pledge_3_completed = true;
            updateFields.pledge_3_completed_at = timestamp;
            updateFields.overall_pledge_completed = true;
            updateFields.overall_pledge_completed_at = timestamp;
            updateFields.status = 'pledge_completed';
            updateFields.pledge_text = pledgeText;
        }

        if (!CONFIG.IS_MOCK_MODE && supabaseClient) {
            const { data, error } = await supabaseClient
                .from('participants')
                .update(updateFields)
                .eq('id', participantId)
                .select();

            if (error) throw error;

            let cert = null;
            if (stepNumber === 3) {
                cert = await this.issueCertificate(participantId);
            }
            return { participant: data[0], certificate: cert };
        } else {
            const participants = getLocalData(CONFIG.LOCAL_STORAGE_KEYS.PARTICIPANTS);
            let updatedParticipant = null;

            const nextParticipants = participants.map(p => {
                if (p.id === participantId) {
                    updatedParticipant = {
                        ...p,
                        ...updateFields,
                        updated_at: timestamp
                    };
                    return updatedParticipant;
                }
                return p;
            });

            if (!updatedParticipant) {
                throw new Error('Participant not found.');
            }

            setLocalData(CONFIG.LOCAL_STORAGE_KEYS.PARTICIPANTS, nextParticipants);

            let cert = null;
            if (stepNumber === 3) {
                cert = await this.issueCertificate(participantId);
            }
            return { participant: updatedParticipant, certificate: cert };
        }
    },

    // REFERRALS SERVICES
    async getReferrals() {
        if (!CONFIG.IS_MOCK_MODE && supabaseClient) {
            const { data, error } = await supabaseClient
                .from('referrals')
                .select('*');
            if (error) throw error;
            return data;
        } else {
            return getLocalData(CONFIG.LOCAL_STORAGE_KEYS.REFERRALS);
        }
    },

    // LEADERBOARD SERVICE
    async getLeaderboard() {
        if (!CONFIG.IS_MOCK_MODE && supabaseClient) {
            const { data, error } = await supabaseClient
                .from('participants')
                .select(`
                    id,
                    full_name,
                    referral_code,
                    referrals:referrals!referrer_id(count)
                `);
            
            if (error) throw error;
            return data
                .map(item => ({
                    id: item.id,
                    full_name: item.full_name,
                    referral_code: item.referral_code,
                    referral_count: item.referrals ? item.referrals[0].count : 0
                }))
                .filter(item => item.referral_count > 0)
                .sort((a, b) => b.referral_count - a.referral_count);
        } else {
            const participants = getLocalData(CONFIG.LOCAL_STORAGE_KEYS.PARTICIPANTS);
            const referrals = getLocalData(CONFIG.LOCAL_STORAGE_KEYS.REFERRALS);

            const counts = {};
            referrals.forEach(r => {
                counts[r.referrer_id] = (counts[r.referrer_id] || 0) + 1;
            });

            return participants
                .map(p => ({
                    id: p.id,
                    full_name: p.full_name,
                    referral_code: p.referral_code,
                    referral_count: counts[p.id] || 0
                }))
                .filter(item => item.referral_count > 0)
                .sort((a, b) => b.referral_count - a.referral_count);
        }
    },

    // CERTIFICATES SERVICES
    async getCertificates() {
        if (!CONFIG.IS_MOCK_MODE && supabaseClient) {
            const { data, error } = await supabaseClient
                .from('certificates')
                .select('*');
            if (error) throw error;
            return data;
        } else {
            return getLocalData(CONFIG.LOCAL_STORAGE_KEYS.CERTIFICATES);
        }
    },

    async getCertificateById(certificateId) {
        if (!CONFIG.IS_MOCK_MODE && supabaseClient) {
            const { data, error } = await supabaseClient
                .from('certificates')
                .select(`
                    *,
                    participants:participant_id(*)
                `)
                .eq('certificate_id', certificateId)
                .maybeSingle();
            if (error) throw error;
            return data;
        } else {
            const certificates = getLocalData(CONFIG.LOCAL_STORAGE_KEYS.CERTIFICATES);
            const cert = certificates.find(c => c.certificate_id === certificateId);
            if (!cert) return null;

            const participants = getLocalData(CONFIG.LOCAL_STORAGE_KEYS.PARTICIPANTS);
            const participant = participants.find(p => p.id === cert.participant_id);

            return {
                ...cert,
                participants: participant || null
            };
        }
    },

    async issueCertificate(participantId, certificateUrl = '') {
        if (!CONFIG.IS_MOCK_MODE && supabaseClient) {
            const { data: existing } = await supabaseClient
                .from('certificates')
                .select('*, participants:participant_id(*)')
                .eq('participant_id', participantId)
                .maybeSingle();

            if (existing) {
                return existing;
            }

            const verificationUrl = `${CONFIG.APP_URL}/verify.html?id=__CERT_ID__`;
            const { data, error } = await supabaseClient
                .from('certificates')
                .insert([{
                    participant_id: participantId,
                    certificate_url: certificateUrl,
                    verification_url: verificationUrl
                }])
                .select();

            if (error) throw error;

            const certId = data[0].certificate_id;
            const updatedVerificationUrl = `${CONFIG.APP_URL}/verify.html?id=${certId}`;

            const { data: updatedCert } = await supabaseClient
                .from('certificates')
                .update({ verification_url: updatedVerificationUrl })
                .eq('id', data[0].id)
                .select('*, participants:participant_id(*)');

            return updatedCert[0];
        } else {
            const certificates = getLocalData(CONFIG.LOCAL_STORAGE_KEYS.CERTIFICATES);
            const participants = getLocalData(CONFIG.LOCAL_STORAGE_KEYS.PARTICIPANTS);

            const existingCert = certificates.find(c => c.participant_id === participantId);
            if (existingCert) {
                const participant = participants.find(p => p.id === participantId);
                return { ...existingCert, participants: participant || null };
            }

            const nextCertIdVal = certificates.length + 1;
            const certId = `CERT-2026-${String(nextCertIdVal).padStart(6, '0')}`;
            const verificationUrl = `${CONFIG.APP_URL}/verify.html?id=${certId}`;

            const newCert = {
                id: crypto.randomUUID(),
                certificate_id: certId,
                participant_id: participantId,
                issue_date: new Date().toISOString(),
                certificate_url: certificateUrl,
                verification_url: verificationUrl,
                created_at: new Date().toISOString()
            };

            certificates.push(newCert);
            setLocalData(CONFIG.LOCAL_STORAGE_KEYS.CERTIFICATES, certificates);

            // Sync back to participant status
            const updatedParticipants = participants.map(p => {
                if (p.id === participantId) {
                    return {
                        ...p,
                        certificate_id: certId,
                        certificate_url: certificateUrl,
                        status: 'certificate_issued',
                        updated_at: new Date().toISOString()
                    };
                }
                return p;
            });
            setLocalData(CONFIG.LOCAL_STORAGE_KEYS.PARTICIPANTS, updatedParticipants);

            const participant = updatedParticipants.find(p => p.id === participantId);
            return { ...newCert, participants: participant || null };
        }
    },

    // STATS / OVERVIEW SERVICES
    async getDashboardStats() {
        if (!CONFIG.IS_MOCK_MODE && supabaseClient) {
            const { count: totalParticipants } = await supabaseClient
                .from('participants')
                .select('*', { count: 'exact', head: true });

            const { count: totalReferrals } = await supabaseClient
                .from('referrals')
                .select('*', { count: 'exact', head: true });

            const { count: totalCertificates } = await supabaseClient
                .from('certificates')
                .select('*', { count: 'exact', head: true });

            const { count: totalPledges } = await supabaseClient
                .from('participants')
                .select('*', { count: 'exact', head: true })
                .eq('overall_pledge_completed', true);

            return {
                totalParticipants: totalParticipants || 0,
                totalReferrals: totalReferrals || 0,
                totalCertificates: totalCertificates || 0,
                totalPledges: totalPledges || 0
            };
        } else {
            const participants = getLocalData(CONFIG.LOCAL_STORAGE_KEYS.PARTICIPANTS);
            const referrals = getLocalData(CONFIG.LOCAL_STORAGE_KEYS.REFERRALS);
            const certificates = getLocalData(CONFIG.LOCAL_STORAGE_KEYS.CERTIFICATES);
            const totalPledges = participants.filter(p => p.overall_pledge_completed).length;

            return {
                totalParticipants: participants.length,
                totalReferrals: referrals.length,
                totalCertificates: certificates.length,
                totalPledges: totalPledges
            };
        }
    },

    // EVENTS SERVICES
    async getEvents() {
        if (!CONFIG.IS_MOCK_MODE && supabaseClient) {
            const { data, error } = await supabaseClient
                .from('events')
                .select('*');
            if (error) throw error;
            return data;
        } else {
            return getLocalData(CONFIG.LOCAL_STORAGE_KEYS.EVENTS);
        }
    },

    // AUTH & ROLE SERVICES
    async login(email, password) {
        if (!CONFIG.IS_MOCK_MODE && supabaseClient) {
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email,
                password
            });
            if (error) throw error;
            return data;
        } else {
            // Mock authentication
            if ((email === 'admin@example.com' || email === 'admin') && password === 'admin123') {
                const mockSession = {
                    user: { id: 'mock-admin-uuid', email: 'admin@example.com' },
                    access_token: 'mock-token'
                };
                sessionStorage.setItem('mock_session', JSON.stringify(mockSession));
                return { data: mockSession };
            } else if ((email === 'superadmin@example.com' || email === 'superadmin') && password === 'admin123') {
                const mockSession = {
                    user: { id: 'mock-super-admin-uuid', email: 'superadmin@example.com' },
                    access_token: 'mock-token-super'
                };
                sessionStorage.setItem('mock_session', JSON.stringify(mockSession));
                return { data: mockSession };
            } else {
                throw new Error('Invalid email/username or password.');
            }
        }
    },

    async logout() {
        if (!CONFIG.IS_MOCK_MODE && supabaseClient) {
            const { error } = await supabaseClient.auth.signOut();
            if (error) throw error;
        } else {
            sessionStorage.removeItem('mock_session');
        }
    },

    async getCurrentUser() {
        if (!CONFIG.IS_MOCK_MODE && supabaseClient) {
            const { data: { user } } = await supabaseClient.auth.getUser();
            return user;
        } else {
            const mockSession = JSON.parse(sessionStorage.getItem('mock_session'));
            return mockSession ? mockSession.user : null;
        }
    },

    async getAdminProfile(userId) {
        if (!CONFIG.IS_MOCK_MODE && supabaseClient) {
            const { data, error } = await supabaseClient
                .from('admin_profiles')
                .select('*')
                .eq('id', userId)
                .maybeSingle();
            if (error) throw error;
            return data;
        } else {
            if (userId === 'mock-admin-uuid') {
                return { id: 'mock-admin-uuid', email: 'admin@example.com', role: 'admin' };
            } else if (userId === 'mock-super-admin-uuid') {
                return { id: 'mock-super-admin-uuid', email: 'superadmin@example.com', role: 'super_admin' };
            }
            return null;
        }
    }
};
