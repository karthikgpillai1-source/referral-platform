// Application Configuration Module

export const CONFIG = {
    // Dynamic loading from local storage, allowing setup via Admin Panel
    SUPABASE_URL: localStorage.getItem('SUPABASE_URL') || window.ENV_SUPABASE_URL || 'https://vlgvwqzxmybiqcqeduha.supabase.co',
    SUPABASE_KEY: localStorage.getItem('SUPABASE_ANON_KEY') || window.ENV_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsZ3Z3cXp4bXliaXFjcWVkdWhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMTg3MDAsImV4cCI6MjA5Nzg5NDcwMH0.oOTCCOK4IoLr7msHIs82qtiamk1_KH0CiXle4XCg7Eg',
    
    // Fallback Mock mode enabled if Supabase configuration is missing
    get IS_MOCK_MODE() {
        return !this.SUPABASE_URL || !this.SUPABASE_KEY;
    },

    // App URL settings
    APP_URL: window.location.origin,

    // Storage keys
    LOCAL_STORAGE_KEYS: {
        PARTICIPANTS: 'ref_platform_participants',
        REFERRALS: 'ref_platform_referrals',
        CERTIFICATES: 'ref_platform_certificates',
        EVENTS: 'ref_platform_events',
        ADMIN_AUTH: 'ref_platform_admin_auth'
    }
};

// Log current operational mode
console.log(`[Platform Mode] Operating in: ${CONFIG.IS_MOCK_MODE ? 'MOCK (Local Storage)' : 'PRODUCTION (Supabase Backend)'}`);
