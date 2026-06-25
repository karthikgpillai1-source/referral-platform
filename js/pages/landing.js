import { DatabaseService } from '../services/supabase.js';
import { Utils } from '../utils.js';

document.addEventListener('DOMContentLoaded', () => {
    initLeaderboard();
    initVerifyForm();
});

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
