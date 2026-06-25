// Performance optimization helper engine for Youth Against Drugs Campaign
// Enforces requestAnimationFrame throttles, passive listeners, and unified observers.

class PerformanceEngine {
    constructor() {
        this.mouseX = 0;
        this.mouseY = 0;
        this.currentX = 0;
        this.currentY = 0;
        this.glowEl = null;
        this.glowTicking = false;
        this.observer = null;

        this.init();
    }

    init() {
        document.addEventListener('DOMContentLoaded', () => {
            this.setupBackgrounds();
            this.setupCursorGlow();
            this.setupSharedObserver();
            this.setupDOMWatchers();
        });
    }

    // Append optimized backgrounds once
    setupBackgrounds() {
        if (!document.querySelector('.optimized-bg-canvas')) {
            const bgCanvas = document.createElement('div');
            bgCanvas.className = 'optimized-bg-canvas';
            document.body.appendChild(bgCanvas);
        }
        if (!document.querySelector('.noise-overlay')) {
            const noise = document.createElement('div');
            noise.className = 'noise-overlay';
            document.body.appendChild(noise);
        }
    }

    // High performance cursor glow using requestAnimationFrame
    setupCursorGlow() {
        if (window.innerWidth <= 768) return;

        this.glowEl = document.querySelector('.cursor-glow');
        if (!this.glowEl) {
            this.glowEl = document.createElement('div');
            this.glowEl.className = 'cursor-glow';
            document.body.appendChild(this.glowEl);
        }

        document.addEventListener('mousemove', (e) => {
            this.mouseX = e.clientX;
            this.mouseY = e.clientY;
            
            if (!this.glowTicking) {
                requestAnimationFrame(() => this.updateGlowPosition());
                this.glowTicking = true;
            }
        }, { passive: true });
    }

    updateGlowPosition() {
        this.currentX += (this.mouseX - this.currentX) * 0.15;
        this.currentY += (this.mouseY - this.currentY) * 0.15;

        if (this.glowEl) {
            this.glowEl.style.transform = `translate3d(calc(${this.currentX}px - 50%), calc(${this.currentY}px - 50%), 0)`;
            this.glowEl.style.opacity = '1';
        }
        this.glowTicking = false;
    }

    // Shared IntersectionObserver for all reveal animations
    setupSharedObserver() {
        const revealOptions = {
            root: null,
            rootMargin: '0px 0px -40px 0px',
            threshold: 0.05
        };

        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    this.observer.unobserve(entry.target);
                }
            });
        }, revealOptions);

        this.observeRevealElements();
    }

    observeRevealElements() {
        const targets = document.querySelectorAll('.fade-in, .timeline-node, .stat-card-landing, .edu-section');
        targets.forEach(target => {
            if (this.observer) {
                this.observer.observe(target);
            }
        });
    }

    // Watch DOM mutations to attach elements dynamically (e.g. Card Tilt after loading state hides)
    setupDOMWatchers() {
        const observer = new MutationObserver(() => {
            const tiltTarget = document.getElementById('cert-tilt-element');
            if (tiltTarget && !tiltTarget.dataset.tiltBound) {
                this.setupCardTilt(tiltTarget);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    // Performance-optimized 3D Card Tilt without external library overhead
    setupCardTilt(tiltTarget) {
        if (window.innerWidth <= 768) return;
        tiltTarget.dataset.tiltBound = "true";

        let width = tiltTarget.offsetWidth;
        let height = tiltTarget.offsetHeight;
        let mouseX = 0;
        let mouseY = 0;
        let ticking = false;

        // Ensure target has composite layout styles
        tiltTarget.style.transition = 'transform 0.1s ease-out';
        tiltTarget.style.willChange = 'transform';

        tiltTarget.addEventListener('mousemove', (e) => {
            const rect = tiltTarget.getBoundingClientRect();
            mouseX = e.clientX - rect.left - width / 2;
            mouseY = e.clientY - rect.top - height / 2;

            if (!ticking) {
                requestAnimationFrame(() => {
                    const rX = (mouseY / (height / 2)) * 5;
                    const rY = -(mouseX / (width / 2)) * 5;
                    tiltTarget.style.transform = `perspective(1000px) rotateX(${rX}deg) rotateY(${rY}deg) translateZ(0)`;
                    ticking = false;
                });
                ticking = true;
            }
        }, { passive: true });

        tiltTarget.addEventListener('mouseleave', () => {
            requestAnimationFrame(() => {
                tiltTarget.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0)';
            });
        }, { passive: true });
    }

    static throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        }
    }

    static debounce(func, delay) {
        let timeoutId;
        return function(...args) {
            const context = this;
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                func.apply(context, args);
            }, delay);
        }
    }
}

// Initialize immediately on import
export const performanceEngine = new PerformanceEngine();
