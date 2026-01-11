// ========== Telegram Web App ========== 
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// ========== Config ========== 
const API_URL = '/api';

// ========== State ========== 
let movies = [];
let selectedMovie = null;
let isLoading = false;

// ========== DOM Elements ========== 
const loadingEl = document.getElementById('loading');
const emptyEl = document.getElementById('empty');
const moviesGridEl = document.getElementById('movies-grid');
const modalEl = document.getElementById('modal');

// ========== Initialize ========== 
document.addEventListener('DOMContentLoaded', init);

async function init() {
    // Set theme
    document.body.style.backgroundColor = tg.themeParams.bg_color || '#ffffff';
    
    // Load movies
    await loadMovies();
    
    // Setup back button
    tg.BackButton.onClick(() => {
        if (modalEl.classList.contains('active')) {
            closeModal();
        } else {
            tg.close();
        }
    });
}

// ========== API Functions ========== 
async function loadMovies() {
    if (isLoading) return;
    isLoading = true;
    
    showLoading();
    
    try {
        const response = await fetch(`${API_URL}/webapp/premiere`);
        const result = await response.json();
        
        hideLoading();
        
        if (!result.success || !result.data || result.data.length === 0) {
            showEmpty();
            return;
        }
        
        movies = result.data;
        renderMovies();
        
    } catch (error) {
        console.error('Error loading movies:', error);
        hideLoading();
        showError('Xatolik yuz berdi. Qayta urinib ko\'ring.');
    } finally {
        isLoading = false;
    }
}

// ========== Render Functions ========== 
function renderMovies() {
    moviesGridEl.innerHTML = '';
    moviesGridEl.style.display = 'grid';
    
    movies.forEach((movie, index) => {
        const card = createMovieCard(movie, index);
        moviesGridEl.appendChild(card);
    });
}

function createMovieCard(movie, index) {
    const card = document.createElement('div');
    card.className = 'movie-card';
    card.style.animationDelay = `${index * 0.05}s`;
    card.onclick = () => openModal(movie);
    
    const thumbnailContent = movie.thumbnailFileId 
        ? `<img src="${movie.thumbnailFileId}" alt="${movie.title}" loading="lazy">`
        : `<span class="movie-placeholder">🎬</span>`;
    
    const duration = movie.duration 
        ? `<span class="movie-duration">⏱ ${formatDuration(movie.duration)}</span>`
        : '';
    
    card.innerHTML = `
        <div class="movie-thumbnail">
            ${thumbnailContent}
            <div class="play-icon"></div>
            ${index < 3 ? '<span class="movie-badge">🔥 TOP</span>' : ''}
        </div>
        <div class="movie-info">
            <h3 class="movie-title">${escapeHtml(movie.title)}</h3>
            <p class="movie-description">${escapeHtml(movie.description || 'Tavsif mavjud emas')}</p>
            <div class="movie-meta">
                <span class="movie-views">👁 ${formatNumber(movie.viewsCount || 0)}</span>
                ${duration}
            </div>
            <div class="movie-code-row">
                <span class="movie-code">📋 ${movie.code}</span>
            </div>
            <button class="btn-watch" onclick="event.stopPropagation(); watchMovie('${movie.code}')">
                ▶️ Ko'rish
            </button>
        </div>
    `;
    
    return card;
}

// ========== Modal Functions ========== 
function openModal(movie) {
    selectedMovie = movie;
    
    const thumbnailContent = movie.thumbnailFileId 
        ? `<img src="${movie.thumbnailFileId}" alt="${movie.title}">`
        : `<span class="modal-placeholder">🎬</span>`;
    
    document.getElementById('modal-thumbnail').innerHTML = thumbnailContent;
    document.getElementById('modal-title').textContent = movie.title;
    document.getElementById('modal-description').textContent = movie.description || 'Tavsif mavjud emas';
    document.getElementById('modal-views').textContent = formatNumber(movie.viewsCount || 0);
    document.getElementById('modal-duration').textContent = movie.duration 
        ? formatDuration(movie.duration) 
        : '--:--';
    document.getElementById('modal-code').textContent = movie.code;
    
    modalEl.classList.add('active');
    tg.BackButton.show();
    
    // Haptic feedback
    if (tg.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('light');
    }
}

function closeModal() {
    modalEl.classList.remove('active');
    selectedMovie = null;
    tg.BackButton.hide();
}

function watchMovie(code) {
    const movie = movies.find(m => m.code === code) || selectedMovie;
    if (!movie) return;
    
    // Haptic feedback
    if (tg.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('medium');
    }
    
    // Send data to bot
    tg.sendData(JSON.stringify({
        action: 'watch',
        movieCode: movie.code,
        movieId: movie.id
    }));
    
    // Close web app
    setTimeout(() => tg.close(), 300);
}

// ========== UI State Functions ========== 
function showLoading() {
    loadingEl.style.display = 'flex';
    emptyEl.style.display = 'none';
    moviesGridEl.style.display = 'none';
}

function hideLoading() {
    loadingEl.style.display = 'none';
}

function showEmpty() {
    emptyEl.style.display = 'block';
    moviesGridEl.style.display = 'none';
}

function showError(message) {
    loadingEl.innerHTML = `
        <div class="error-state">
            <div style="font-size: 48px; margin-bottom: 16px;">😕</div>
            <p>${message}</p>
            <button class="btn btn-primary" style="margin-top: 20px;" onclick="loadMovies()">
                🔄 Qayta yuklash
            </button>
        </div>
    `;
    loadingEl.style.display = 'flex';
}

// ========== Utility Functions ========== 
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
        return `${hours}s ${minutes}d`;
    }
    if (minutes > 0) {
        return `${minutes}d ${secs}s`;
    }
    return `${secs} sekund`;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========== Event Listeners ========== 
// Close modal on overlay click
modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) {
        closeModal();
    }
});

// Handle swipe down to close modal
let touchStartY = 0;
const modalContent = document.querySelector('.modal');

if (modalContent) {
    modalContent.addEventListener('touchstart', (e) => {
        touchStartY = e.touches[0].clientY;
    });
    
    modalContent.addEventListener('touchmove', (e) => {
        const touchY = e.touches[0].clientY;
        const diff = touchY - touchStartY;
        
        if (diff > 100) {
            closeModal();
        }
    });
}

// Refresh on pull (optional)
let startY = 0;
document.addEventListener('touchstart', (e) => {
    startY = e.touches[0].clientY;
});

document.addEventListener('touchend', (e) => {
    const endY = e.changedTouches[0].clientY;
    if (window.scrollY === 0 && endY - startY > 150) {
        loadMovies();
    }
});
