import { DatabaseService } from '../services/supabase.js?v=4';
import { CONFIG } from '../config.js';
import { Utils } from '../utils.js';

let participantsList = [];
let currentAdminProfile = null;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. ROUTE GUARD & AUTHENTICATION CHECK
    const isAuthenticated = await checkRouteGuard();
    if (!isAuthenticated) return;

    // Show authenticated dashboard content
    document.getElementById('auth-loading-state').style.display = 'none';
    document.getElementById('admin-dashboard-content').style.display = 'block';

    // Enable navigation items
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.style.display = 'inline-flex';

    const copyCampaignLinkBtn = document.getElementById('copy-campaign-link-btn');
    if (copyCampaignLinkBtn) copyCampaignLinkBtn.style.display = 'inline-flex';

    // 2. INITIALIZE DATA
    loadDashboardData();

    // 3. BIND HANDLERS
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

    if (copyCampaignLinkBtn) {
        copyCampaignLinkBtn.addEventListener('click', () => {
            const regLink = `${window.location.origin}/register`;
            navigator.clipboard.writeText(regLink)
                .then(() => Utils.showToast('Registration link copied!', 'success'))
                .catch(() => Utils.showToast('Failed to copy link.', 'error'));
        });
    }

    // Toggle API settings panel
    const toggleSettingsBtn = document.getElementById('toggle-settings-btn');
    const settingsCard = document.getElementById('settings-card');
    if (toggleSettingsBtn && settingsCard) {
        toggleSettingsBtn.addEventListener('click', () => {
            const isHidden = settingsCard.style.display === 'none';
            settingsCard.style.display = isHidden ? 'block' : 'none';
            if (isHidden) {
                document.getElementById('setting-supabase-url').value = localStorage.getItem('SUPABASE_URL') || '';
                document.getElementById('setting-supabase-key').value = localStorage.getItem('SUPABASE_ANON_KEY') || '';
            }
        });
    }

    const cancelSettingsBtn = document.getElementById('cancel-settings-btn');
    if (cancelSettingsBtn && settingsCard) {
        cancelSettingsBtn.addEventListener('click', () => {
            settingsCard.style.display = 'none';
        });
    }

    const settingsForm = document.getElementById('settings-form');
    if (settingsForm) settingsForm.addEventListener('submit', handleSaveSettings);

    const searchInput = document.getElementById('admin-search-input');
    if (searchInput) searchInput.addEventListener('input', renderParticipantsTable);

    const statusFilter = document.getElementById('admin-status-filter');
    if (statusFilter) statusFilter.addEventListener('change', renderParticipantsTable);

    // Campaign Link Generator Bindings
    const generateBtn = document.getElementById('btn-generate-campaign');
    if (generateBtn) generateBtn.addEventListener('click', handleGenerateCampaignLink);
});

// Route Guard Verification
async function checkRouteGuard() {
    try {
        const user = await DatabaseService.getCurrentUser();
        const redirectDest = window.location.pathname.endsWith('.html') ? 'login.html' : '/login';

        if (!user) {
            window.location.replace(redirectDest);
            return false;
        }

        const profile = await DatabaseService.getAdminProfile(user.id);
        if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
            Utils.showToast('Access denied. Admin role required.', 'error');
            await DatabaseService.logout();
            setTimeout(() => {
                window.location.replace(redirectDest);
            }, 1500);
            return false;
        }

        currentAdminProfile = profile;
        return true;
    } catch (e) {
        console.error('Route Guard Error:', e);
        const redirectDest = window.location.pathname.endsWith('.html') ? 'login.html' : '/login';
        window.location.replace(redirectDest);
        return false;
    }
}

// Logout handler
async function handleLogout() {
    Utils.showLoading(true);
    try {
        await DatabaseService.logout();
        Utils.showToast('Logged out.', 'info');
        setTimeout(() => {
            const redirectDest = window.location.pathname.endsWith('.html') ? 'login.html' : '/login';
            window.location.replace(redirectDest);
        }, 1000);
    } catch (err) {
        console.error(err);
        Utils.showToast('Error signing out.', 'error');
        Utils.showLoading(false);
    }
}

// Settings handlers
function handleSaveSettings(e) {
    e.preventDefault();
    const url = document.getElementById('setting-supabase-url').value.trim();
    const key = document.getElementById('setting-supabase-key').value.trim();

    if (url) localStorage.setItem('SUPABASE_URL', url);
    else localStorage.removeItem('SUPABASE_URL');

    if (key) localStorage.setItem('SUPABASE_ANON_KEY', key);
    else localStorage.removeItem('SUPABASE_ANON_KEY');

    Utils.showToast('Credentials saved! Refreshing connectivity...', 'success');
    setTimeout(() => {
        window.location.reload();
    }, 1200);
}

// Campaign Link Generator Handler
function handleGenerateCampaignLink() {
    const campaignIdInput = document.getElementById('campaign-id-input');
    const campaignId = campaignIdInput.value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');

    if (!campaignId) {
        Utils.showToast('Please enter a valid Campaign ID.', 'error');
        return;
    }

    const campaignLink = `${window.location.origin}/register?campaign=${campaignId}`;
    const outputContainer = document.getElementById('campaign-output-container');
    const outputInput = document.getElementById('campaign-link-output');
    const copyBtn = document.getElementById('btn-copy-campaign-output');
    const shareBtn = document.getElementById('btn-share-campaign-output');

    if (outputInput && outputContainer) {
        outputInput.value = campaignLink;
        outputContainer.style.display = 'flex';

        // Copy button binding
        const newCopyBtn = copyBtn.cloneNode(true);
        copyBtn.parentNode.replaceChild(newCopyBtn, copyBtn);
        newCopyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(campaignLink)
                .then(() => Utils.showToast('Campaign link copied!', 'success'))
                .catch(() => Utils.showToast('Failed to copy link.', 'error'));
        });

        // Share button binding
        const waText = `Join the Youth Against Drugs campaign movement here: ${campaignLink}`;
        const waUrl = `https://wa.me/?text=${encodeURIComponent(waText)}`;
        shareBtn.setAttribute('href', waUrl);
    }
}

// Dashboard Data loader
async function loadDashboardData() {
    try {
        const stats = await DatabaseService.getDashboardStats();
        document.getElementById('stat-registrations').textContent = stats.totalParticipants;
        document.getElementById('stat-referrals').textContent = stats.totalReferrals;
        document.getElementById('stat-certificates').textContent = stats.totalCertificates;
        document.getElementById('stat-pledges').textContent = stats.totalPledges;

        participantsList = await DatabaseService.getParticipants();
        renderParticipantsTable();
    } catch (e) {
        console.error('Error loading dashboard stats:', e);
        Utils.showToast('Failed to load dashboard metrics.', 'error');
    }
}

// Render dynamic table rows
function renderParticipantsTable() {
    const tbody = document.getElementById('admin-participants-tbody');
    const emptyState = document.getElementById('admin-empty-state');
    const searchQuery = document.getElementById('admin-search-input').value.toLowerCase().trim();
    const statusVal = document.getElementById('admin-status-filter').value;

    if (!tbody) return;
    tbody.innerHTML = '';

    const filtered = participantsList.filter(p => {
        const textMatch = 
            p.full_name.toLowerCase().includes(searchQuery) ||
            p.college.toLowerCase().includes(searchQuery) ||
            p.whatsapp_number.includes(searchQuery) ||
            (p.email && p.email.toLowerCase().includes(searchQuery)) ||
            (p.referral_code && p.referral_code.toLowerCase().includes(searchQuery));
        
        let statusMatch = true;
        if (statusVal === 'pledge-completed') statusMatch = p.overall_pledge_completed === true;
        if (statusVal === 'pledge-pending') statusMatch = p.overall_pledge_completed === false;

        return textMatch && statusMatch;
    });

    if (filtered.length === 0) {
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';

    filtered.forEach(p => {
        const tr = document.createElement('tr');
        const trDetail = document.createElement('tr');
        trDetail.style.display = 'none';

        // Progress checkmarks
        const p1 = p.pledge_1_completed ? '<span style="color:var(--primary)">✓ P1</span>' : '<span style="color:var(--danger)">✗ P1</span>';
        const p2 = p.pledge_2_completed ? '<span style="color:var(--primary)">✓ P2</span>' : '<span style="color:var(--danger)">✗ P2</span>';
        const p3 = p.pledge_3_completed ? '<span style="color:var(--primary)">✓ P3</span>' : '<span style="color:var(--danger)">✗ P3</span>';
        const progressStr = `${p1} | ${p2} | ${p3}`;

        // Status Badge
        let statusBadge = '';
        if (p.overall_pledge_completed) {
            statusBadge = `<span class="badge badge-success">Completed</span>`;
        } else {
            statusBadge = `<span class="badge badge-warning">In Progress</span>`;
        }

        // Actions
        let viewCertBtn = '';
        if (p.overall_pledge_completed && p.certificate_id) {
            viewCertBtn = `
                <a href="verify?id=${p.certificate_id}" target="_blank" class="btn btn-secondary btn-sm" style="text-transform:none;">
                    View Cert
                </a>
            `;
        } else {
            viewCertBtn = `<span style="font-size:0.8rem; color:var(--text-muted);">Awaiting Pledge</span>`;
        }

        // Main Row HTML
        tr.innerHTML = `
            <td>
                <strong>${p.full_name}</strong>
                <div style="font-size:0.8rem; color:var(--text-muted);">${p.email}</div>
            </td>
            <td style="font-family: var(--font-mono);">${p.whatsapp_number}</td>
            <td><code>${p.referral_code || 'None'}</code></td>
            <td><div style="font-size:0.8rem;">${progressStr}</div></td>
            <td>${statusBadge}</td>
            <td>
                <div style="display: flex; gap: 8px; align-items: center;">
                    ${viewCertBtn}
                    <button class="btn btn-secondary btn-sm toggle-details-btn" style="text-transform:none;">
                        Details ▼
                    </button>
                </div>
            </td>
        `;

        // Collapsible Detail Content
        let friendsList = `
            1. <strong>${p.friend_1_name}</strong> (${p.friend_1_whatsapp})<br>
            2. <strong>${p.friend_2_name}</strong> (${p.friend_2_whatsapp})
        `;
        if (p.friend_3_name) {
            friendsList += `<br>3. <strong>${p.friend_3_name}</strong> (${p.friend_3_whatsapp})`;
        }

        let emailStatus = 'N/A';
        if (p.certificate_sent) {
            emailStatus = `Sent (${p.certificate_delivery_method || 'email'}) on ${Utils.formatDate(p.certificate_sent_at)}`;
        } else if (p.overall_pledge_completed) {
            emailStatus = 'Pending (Scheduled)';
        }

        trDetail.innerHTML = `
            <td colspan="6" style="background: #0B1120; border-bottom: 1px solid var(--border-color); padding: 16px;">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; font-size: 0.85rem; text-align: left; color: var(--text-main);">
                    <div>
                        <div style="font-weight: 700; color: var(--primary); margin-bottom: 4px; text-transform: uppercase; font-size: 0.75rem;">Institution Details</div>
                        <strong>College:</strong> ${p.college}<br>
                        <strong>Referred By:</strong> <code>${p.referred_by || 'Direct Registration'}</code>
                    </div>
                    <div>
                        <div style="font-weight: 700; color: var(--primary); margin-bottom: 4px; text-transform: uppercase; font-size: 0.75rem;">Nominated Friends</div>
                        ${friendsList}
                    </div>
                    <div>
                        <div style="font-weight: 700; color: var(--primary); margin-bottom: 4px; text-transform: uppercase; font-size: 0.75rem;">Campaign Timeline & Delivery</div>
                        <strong>Registered At:</strong> ${Utils.formatDate(p.created_at || p.registration_date)}<br>
                        <strong>Pledge Completed At:</strong> ${p.overall_pledge_completed_at ? Utils.formatDate(p.overall_pledge_completed_at) : 'Not completed yet'}<br>
                        <strong>Email Delivery:</strong> ${emailStatus}
                    </div>
                </div>
            </td>
        `;

        // Toggle action
        const toggleBtn = tr.querySelector('.toggle-details-btn');
        toggleBtn.addEventListener('click', () => {
            const isCollapsed = trDetail.style.display === 'none';
            trDetail.style.display = isCollapsed ? 'table-row' : 'none';
            toggleBtn.textContent = isCollapsed ? 'Details ▲' : 'Details ▼';
        });

        tbody.appendChild(tr);
        tbody.appendChild(trDetail);
    });
}
