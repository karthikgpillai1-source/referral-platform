import { DatabaseService } from '../services/supabase.js';
import { ReferralService } from '../services/referral.js';
import { Utils } from '../utils.js';
import { CAMPAIGN_AWARENESS_DATA } from '../campaign-data.js';

document.addEventListener('DOMContentLoaded', () => {
    // Capture referral code if visiting via referral link
    const referrer = ReferralService.getReferrerFromURL();
    if (referrer) {
        sessionStorage.setItem('referred_by', referrer);
        console.log(`[Referral Tracking] Stored referrer: ${referrer}`);
    }

    initStats();
    initQuotesRotation();
    initLeaderboard();
    initVerifyForm();
});

// Render dynamic campaign stats from campaign-data.js
function initStats() {
    const container = document.getElementById('campaign-stats-container');
    if (!container) return;
    container.innerHTML = '';

    const stats = CAMPAIGN_AWARENESS_DATA.AWARENESS_STATS || [];
    stats.forEach(stat => {
        const div = document.createElement('div');
        div.className = 'stat-card-landing';
        div.innerHTML = `
            <div class="stat-num-landing">${stat.num}</div>
            <div class="stat-lbl-landing">${stat.label}</div>
            <div style="font-size:12px; color: var(--text-muted); margin-top:4px;">${stat.desc}</div>
        `;
        container.appendChild(div);
    });
}

// Quote Panel Rotator with smooth opacity transitions
function initQuotesRotation() {
    const quoteEl = document.getElementById('rotating-quote-text');
    if (!quoteEl) return;

    const quotes = CAMPAIGN_AWARENESS_DATA.ROTATING_QUOTES || [];
    if (quotes.length === 0) return;

    let index = 0;
    quoteEl.textContent = quotes[0];

    setInterval(() => {
        // Fade out
        quoteEl.style.opacity = 0;

        setTimeout(() => {
            index = (index + 1) % quotes.length;
            quoteEl.textContent = quotes[index];
            // Fade in
            quoteEl.style.opacity = 1;
        }, 500); // Wait for fade out to finish
    }, 4500); // Rotate every 4.5s
}

// Load and render top referrers
async function initLeaderboard() {
    const listContainer = document.getElementById('leaderboard-list');
    const loadingEl = document.getElementById('leaderboard-loading');
    const emptyEl = document.getElementById('leaderboard-empty');

    if (!listContainer) return;

    try {
        const leaderboard = await DatabaseService.getLeaderboard();
        
        loadingEl.style.display = 'none';

        if (leaderboard.length === 0) {
            emptyEl.style.display = 'block';
            return;
        }

        emptyEl.style.display = 'none';
        listContainer.innerHTML = '';

        leaderboard.slice(0, 5).forEach((item, index) => {
            const row = document.createElement('div');
            row.className = 'leaderboard-item';
            row.innerHTML = `
                <div class="leaderboard-rank">#${index + 1}</div>
                <div class="leaderboard-name">${item.full_name}</div>
                <div class="leaderboard-count">${item.referral_count} Refs</div>
            `;
            listContainer.appendChild(row);
        });
    } catch (e) {
        console.error('Error fetching leaderboard:', e);
        loadingEl.style.display = 'none';
        emptyEl.textContent = 'Failed to load leaderboard data.';
        emptyEl.style.display = 'block';
    }
}

// Set up verification redirect
function initVerifyForm() {
    const form = document.getElementById('landing-verify-form');
    if (!form) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const certId = document.getElementById('verify-cert-id').value.trim();
        if (certId) {
            window.location.href = `verify.html?id=${certId}`;
        }
    });
}
