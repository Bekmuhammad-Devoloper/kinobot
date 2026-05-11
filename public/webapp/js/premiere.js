// ========== Telegram Web App ==========
const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }

const API_URL = '/api';
const BOT_ID = (() => {
    const p = new URLSearchParams(location.search).get('bot');
    return p ? parseInt(p) : null;
})();

let movies = [];
let selectedMovie = null;

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', init);

async function init() {
    if (tg) {
        document.body.style.backgroundColor = tg.themeParams?.bg_color || '';
    }
    await loadMovies();

    if (tg?.BackButton) {
        tg.BackButton.onClick(() => {
            if (document.getElementById('modal').classList.contains('active')) {
                closeModal();
            } else {
                tg.close();
            }
        });
    }
}

// ========== LOAD ==========
async function loadMovies() {
    try {
        const response = await fetch(`${API_URL}/webapp/premiere?bot=${BOT_ID || ''}`);
        const result = await response.json();

        document.getElementById('loading').style.display = 'none';

        if (!result.success || !result.data || result.data.length === 0) {
            document.getElementById('empty').style.display = 'flex';
            return;
        }

        movies = result.data;
        render();
    } catch (err) {
        console.error('Load error', err);
        document.getElementById('loading').style.display = 'none';
        document.getElementById('empty').style.display = 'flex';
    }
}

// ========== RENDER ==========
function render() {
    const totalViews = movies.reduce((s, m) => s + (m.viewsCount || 0), 0);
    document.getElementById('hs-count').textContent = movies.length;
    document.getElementById('hs-views').textContent = formatNum(totalViews);
    document.getElementById('heroStats').style.display = 'inline-flex';

    const grid = document.getElementById('moviesGrid');
    grid.style.display = 'grid';

    grid.innerHTML = movies.map((m, i) => cardHtml(m, i)).join('');
}

function cardHtml(m, index) {
    const isTop = index < 3;
    const isNew = movieIsNew(m);
    const delay = Math.min(index * 0.04, 0.6);
    const grad = generateGradientValue(m); // faqat gradient string (`linear-gradient(...)`)

    // Thumbnail varianti
    // Muhim: `background:` shorthand `background-image` ni o'chirib yuboradi.
    // Shuning uchun thumbnail bor bo'lsa, FAQAT background-image va background-color (gradient fallback) o'rnatamiz.
    let thumbHtml;
    if (m.thumbnailFileId) {
        thumbHtml = `
            <div class="card-image"
                 style="background-image: url('${m.thumbnailFileId}'); background-size: cover; background-position: center; background-color: #1e293b;">
            </div>
        `;
    } else {
        thumbHtml = `
            <div class="card-image" style="background: ${grad};"></div>
            <div class="card-fallback">
                <span class="big-emoji">🎬</span>
                <span class="fb-title">${escapeHtml(m.title)}</span>
            </div>
        `;
    }

    const badge = isTop
        ? `<span class="card-badge top">🔥 TOP</span>`
        : isNew
            ? `<span class="card-badge new">✨ NEW</span>`
            : '';

    const duration = m.duration
        ? `<span class="card-duration">⏱ ${formatDuration(m.duration)}</span>`
        : '';

    return `
        <div class="card" style="animation-delay: ${delay}s" onclick="openModal(${m.id})">
            ${thumbHtml}
            <div class="card-overlay"></div>
            ${badge}
            ${duration}
            <div class="card-play">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            </div>
            <div class="card-body">
                <div class="card-title">${escapeHtml(m.title)}</div>
                <div class="card-meta">
                    <span><svg class="ic" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>${formatNum(m.viewsCount || 0)}</span>
                    <span style="font-family:ui-monospace,monospace;font-size:10.5px;opacity:0.9">${m.code}</span>
                </div>
            </div>
        </div>
    `;
}

function generateGradientValue(m) {
    // Movie code'dan deterministic gradient — har kino uchun bir xil rang
    const code = (m.code || m.title || 'X').toString();
    let hash = 0;
    for (let i = 0; i < code.length; i++) {
        hash = (hash << 5) - hash + code.charCodeAt(i);
        hash |= 0;
    }
    const palettes = [
        'linear-gradient(135deg, #6366f1, #8b5cf6)',  // indigo-violet
        'linear-gradient(135deg, #f43f5e, #ec4899)',  // rose-pink
        'linear-gradient(135deg, #06b6d4, #6366f1)',  // cyan-indigo
        'linear-gradient(135deg, #f59e0b, #ef4444)',  // amber-red
        'linear-gradient(135deg, #10b981, #06b6d4)',  // emerald-cyan
        'linear-gradient(135deg, #8b5cf6, #ec4899)',  // violet-pink
        'linear-gradient(135deg, #fb923c, #f43f5e)',  // orange-rose
        'linear-gradient(135deg, #6366f1, #06b6d4)',  // indigo-cyan
    ];
    const idx = Math.abs(hash) % palettes.length;
    return palettes[idx];
}

function movieIsNew(m) {
    // hozircha barchaga "new" qo'ymaymiz — keyinroq created_at'ni qo'shsak bo'ladi
    return false;
}

// ========== MODAL ==========
function openModal(id) {
    selectedMovie = movies.find(m => m.id === id);
    if (!selectedMovie) return;

    const m = selectedMovie;
    const hero = document.getElementById('modalHero');
    const grad = generateGradientValue(m);

    let heroContent = '';
    if (m.thumbnailFileId) {
        heroContent = `<div class="hero-img"
                            style="background-image: url('${m.thumbnailFileId}'); background-size: cover; background-position: center; background-color: #1e293b;">
                       </div>`;
    } else {
        heroContent = `
            <div class="hero-img" style="background: ${grad};"></div>
            <div class="hero-fb">🎬</div>
        `;
    }
    hero.innerHTML = heroContent + `<button class="modal-close" onclick="closeModal()">✕</button>`;

    const isTop = movies.findIndex(x => x.id === m.id) < 3;
    const badges = [
        isTop ? '<span class="m-badge hot">🔥 TOP</span>' : '',
        '<span class="m-badge premiere">⭐ Premyera</span>',
        `<span class="m-badge code">${escapeHtml(m.code)}</span>`,
    ].filter(Boolean).join('');

    document.getElementById('modalBody').innerHTML = `
        <div class="modal-badges">${badges}</div>
        <div class="modal-title">${escapeHtml(m.title)}</div>
        <div class="modal-desc">${escapeHtml(m.description || 'Tavsif mavjud emas')}</div>
        <div class="modal-stats">
            <div class="stat-cell">
                <div class="val">${formatNum(m.viewsCount || 0)}</div>
                <div class="lbl">Ko'rilgan</div>
            </div>
            <div class="stat-cell">
                <div class="val">${m.duration ? formatDuration(m.duration) : '—'}</div>
                <div class="lbl">Davomiyligi</div>
            </div>
            <div class="stat-cell">
                <div class="val" style="font-family:ui-monospace,monospace;font-size:13px">${escapeHtml(m.code)}</div>
                <div class="lbl">Kod</div>
            </div>
        </div>
        <button class="watch-btn" onclick="watchMovie('${escapeAttr(m.code)}')">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            Ko'rishni boshlash
        </button>
    `;

    document.getElementById('modal').classList.add('active');
    document.body.style.overflow = 'hidden';
    if (tg?.BackButton) tg.BackButton.show();
    if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
}

function closeModal() {
    document.getElementById('modal').classList.remove('active');
    document.body.style.overflow = '';
    selectedMovie = null;
    if (tg?.BackButton) tg.BackButton.hide();
}

function watchMovie(code) {
    if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
    if (tg?.sendData) {
        tg.sendData(JSON.stringify({ action: 'watch', movieCode: code }));
        setTimeout(() => tg.close(), 300);
    } else {
        alert("Bu sahifa Telegram bot ichidan ochilishi kerak");
    }
}

// ========== HELPERS ==========
function formatNum(n) {
    if (n == null) return '0';
    if (n >= 1e6) return (n/1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n/1e3).toFixed(1) + 'K';
    return String(n);
}
function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}`;
    return `${m}:${String(s).padStart(2,'0')}`;
}
function escapeHtml(text) {
    if (text == null) return '';
    return String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escapeAttr(s) {
    return String(s || '').replace(/'/g, "\\'");
}

// Swipe-down to close modal on mobile
let touchStartY = 0, touchStartX = 0;
document.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
    touchStartX = e.touches[0].clientX;
}, { passive: true });
document.addEventListener('touchend', (e) => {
    const modal = document.getElementById('modal');
    if (!modal.classList.contains('active')) return;
    const dy = e.changedTouches[0].clientY - touchStartY;
    const dx = Math.abs(e.changedTouches[0].clientX - touchStartX);
    if (dy > 80 && dx < 60) closeModal();
}, { passive: true });
