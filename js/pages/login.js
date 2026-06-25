import { DatabaseService } from '../services/supabase.js?v=4';
import { Utils } from '../utils.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Check if already authenticated, if so, redirect directly to dashboard
    const user = await DatabaseService.getCurrentUser();
    if (user) {
        const profile = await DatabaseService.getAdminProfile(user.id);
        if (profile && (profile.role === 'admin' || profile.role === 'super_admin')) {
            const dest = window.location.pathname.endsWith('.html') ? 'dashboard.html' : '/dashboard';
            window.location.replace(dest);
            return;
        }
    }

    const form = document.getElementById('admin-login-form');
    if (form) {
        form.addEventListener('submit', handleLogin);
    }
});

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('admin-email').value.trim();
    const password = document.getElementById('admin-password').value.trim();

    Utils.showLoading(true);

    try {
        const authData = await DatabaseService.login(email, password);
        const user = authData.user || (authData.data && authData.data.user);
        
        if (user) {
            // Fetch profile role check
            const profile = await DatabaseService.getAdminProfile(user.id);
            if (profile && (profile.role === 'admin' || profile.role === 'super_admin')) {
                Utils.showToast('Logged in successfully!', 'success');
                setTimeout(() => {
                    const dest = window.location.pathname.endsWith('.html') ? 'dashboard.html' : '/dashboard';
                    window.location.replace(dest);
                }, 1000);
            } else {
                await DatabaseService.logout();
                Utils.showToast('Unauthorized. You do not have admin privileges.', 'error');
            }
        } else {
            Utils.showToast('Authentication failed.', 'error');
        }
    } catch (err) {
        console.error('Login error:', err);
        Utils.showToast(err.message || 'Invalid email or password.', 'error');
    } finally {
        Utils.showLoading(false);
    }
}
