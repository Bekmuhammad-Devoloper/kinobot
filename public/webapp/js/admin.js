// ========== Telegram Web App ========== 
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// ========== Config ========== 
const API_URL = '/api';

// ========== State ========== 
let currentTab = 'dashboard';
let stats = null;
let channels = [];
let users = [];
let movies = [];
let isLoading = false;

// Pagination
let userPage = 1;
let moviePage = 1;
const pageSize = 20;

// ========== Initialize ========== 
document.addEventListener('DOMContentLoaded', init);

async function init() {
    // Set theme
    document.body.style.backgroundColor = tg.themeParams.bg_color || '#ffffff';
    
    // Check admin access
    const userId = tg.initDataUnsafe?.user?.id;
    if (!userId) {
        showAccessDenied();
        return;
    }
    
    // Setup tabs
    setupTabs();
    
    // Load initial data
    await loadDashboard();
    
    // Setup back button
    tg.BackButton.onClick(() => {
        tg.close();
    });
}

// ========== Tab Management ========== 
function setupTabs() {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            switchTab(tabName);
        });
    });
}

function switchTab(tabName) {
    currentTab = tabName;
    
    // Update active tab
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.tab[data-tab="${tabName}"]`).classList.add('active');
    
    // Update content
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(`${tabName}-content`).classList.add('active');
    
    // Load data
    switch(tabName) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'channels':
            loadChannels();
            break;
        case 'users':
            loadUsers();
            break;
        case 'movies':
            loadMovies();
            break;
    }
    
    // Haptic feedback
    if (tg.HapticFeedback) {
        tg.HapticFeedback.selectionChanged();
    }
}

// ========== Dashboard ========== 
async function loadDashboard() {
    showTabLoading('dashboard');
    
    try {
        const response = await fetch(`${API_URL}/admin/stats/dashboard`, {
            headers: {
                'x-telegram-id': tg.initDataUnsafe?.user?.id?.toString() || ''
            }
        });
        const result = await response.json();
        
        if (result.success) {
            stats = result.data;
            renderDashboard();
        }
    } catch (error) {
        console.error('Error loading dashboard:', error);
        showTabError('dashboard');
    }
}

function renderDashboard() {
    const container = document.getElementById('dashboard-content');
    container.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-icon">👥</div>
                <div class="stat-value">${formatNumber(stats.totalUsers || 0)}</div>
                <div class="stat-label">Jami foydalanuvchilar</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">🎬</div>
                <div class="stat-value">${formatNumber(stats.totalMovies || 0)}</div>
                <div class="stat-label">Jami kinolar</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">📺</div>
                <div class="stat-value">${formatNumber(stats.totalChannels || 0)}</div>
                <div class="stat-label">Kanallar</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">👁</div>
                <div class="stat-value">${formatNumber(stats.totalViews || 0)}</div>
                <div class="stat-label">Jami ko'rishlar</div>
            </div>
        </div>
        
        <div class="section">
            <h3 class="section-title">📊 Bugungi statistika</h3>
            <div class="info-list">
                <div class="info-item">
                    <span class="info-label">Yangi foydalanuvchilar</span>
                    <span class="info-value">${stats.todayUsers || 0}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Bugungi ko'rishlar</span>
                    <span class="info-value">${stats.todayViews || 0}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Aktiv foydalanuvchilar (24s)</span>
                    <span class="info-value">${stats.activeUsers || 0}</span>
                </div>
            </div>
        </div>
        
        <div class="section">
            <h3 class="section-title">🔥 Top kinolar</h3>
            <div class="top-movies-list" id="top-movies"></div>
        </div>
    `;
    
    // Render top movies
    if (stats.topMovies && stats.topMovies.length > 0) {
        const topMoviesEl = document.getElementById('top-movies');
        topMoviesEl.innerHTML = stats.topMovies.map((movie, index) => `
            <div class="top-movie-item">
                <span class="top-movie-rank">#${index + 1}</span>
                <span class="top-movie-title">${escapeHtml(movie.title)}</span>
                <span class="top-movie-views">👁 ${formatNumber(movie.viewsCount)}</span>
            </div>
        `).join('');
    }
}

// ========== Channels ========== 
async function loadChannels() {
    showTabLoading('channels');
    
    try {
        const response = await fetch(`${API_URL}/admin/channels`, {
            headers: {
                'x-telegram-id': tg.initDataUnsafe?.user?.id?.toString() || ''
            }
        });
        const result = await response.json();
        
        if (result.success) {
            channels = result.data;
            renderChannels();
        }
    } catch (error) {
        console.error('Error loading channels:', error);
        showTabError('channels');
    }
}

function renderChannels() {
    const container = document.getElementById('channels-content');
    
    let html = `
        <div class="section-header">
            <h3 class="section-title">📺 Majburiy obuna kanallari</h3>
            <button class="btn btn-primary btn-sm" onclick="showAddChannelModal()">
                ➕ Kanal qo'shish
            </button>
        </div>
    `;
    
    if (channels.length === 0) {
        html += `
            <div class="empty-state">
                <div style="font-size: 48px; margin-bottom: 16px;">📺</div>
                <p>Hozircha kanal qo'shilmagan</p>
            </div>
        `;
    } else {
        html += '<div class="channels-list">';
        channels.forEach(channel => {
            html += `
                <div class="channel-item ${channel.isActive ? 'active' : 'inactive'}">
                    <div class="channel-info">
                        <div class="channel-name">
                            ${escapeHtml(channel.title)}
                            ${channel.isActive ? '<span class="status-badge active">✓ Aktiv</span>' : '<span class="status-badge inactive">○ Noaktiv</span>'}
                        </div>
                        <div class="channel-username">${channel.username || channel.chatId}</div>
                    </div>
                    <div class="channel-actions">
                        <button class="btn btn-icon" onclick="toggleChannel(${channel.id}, ${!channel.isActive})">
                            ${channel.isActive ? '⏸️' : '▶️'}
                        </button>
                        <button class="btn btn-icon btn-danger" onclick="deleteChannel(${channel.id})">
                            🗑️
                        </button>
                    </div>
                </div>
            `;
        });
        html += '</div>';
    }
    
    container.innerHTML = html;
}

async function toggleChannel(id, isActive) {
    try {
        const response = await fetch(`${API_URL}/admin/channels/${id}`, {
            method: 'PATCH',
            headers: { 
                'Content-Type': 'application/json',
                'x-telegram-id': tg.initDataUnsafe?.user?.id?.toString() || ''
            },
            body: JSON.stringify({ isActive })
        });
        
        if (response.ok) {
            await loadChannels();
            showToast(isActive ? 'Kanal aktivlashtirildi' : 'Kanal o\'chirildi');
        }
    } catch (error) {
        showToast('Xatolik yuz berdi', 'error');
    }
}

async function deleteChannel(id) {
    if (!confirm('Kanalni o\'chirishni xohlaysizmi?')) return;
    
    try {
        const response = await fetch(`${API_URL}/admin/channels/${id}`, {
            method: 'DELETE',
            headers: {
                'x-telegram-id': tg.initDataUnsafe?.user?.id?.toString() || ''
            }
        });
        
        if (response.ok) {
            await loadChannels();
            showToast('Kanal o\'chirildi');
        }
    } catch (error) {
        showToast('Xatolik yuz berdi', 'error');
    }
}

function showAddChannelModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.id = 'add-channel-modal';
    modal.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-header">
                <h3>📺 Kanal qo'shish</h3>
                <button class="modal-close" onclick="closeAddChannelModal()">✕</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>Kanal nomi</label>
                    <input type="text" id="channel-title" class="form-input" placeholder="Masalan: Kino Kanal">
                </div>
                <div class="form-group">
                    <label>Kanal ID yoki username</label>
                    <input type="text" id="channel-id" class="form-input" placeholder="Masalan: @kinokanal yoki -1001234567890">
                </div>
                <div class="form-group">
                    <label>Kanal havola (ixtiyoriy)</label>
                    <input type="text" id="channel-url" class="form-input" placeholder="https://t.me/kinokanal">
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeAddChannelModal()">Bekor qilish</button>
                <button class="btn btn-primary" onclick="addChannel()">Qo'shish</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function closeAddChannelModal() {
    const modal = document.getElementById('add-channel-modal');
    if (modal) modal.remove();
}

async function addChannel() {
    const title = document.getElementById('channel-title').value.trim();
    const chatId = document.getElementById('channel-id').value.trim();
    const url = document.getElementById('channel-url').value.trim();
    
    if (!title || !chatId) {
        showToast('Barcha maydonlarni to\'ldiring', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/admin/channels`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-telegram-id': tg.initDataUnsafe?.user?.id?.toString() || ''
            },
            body: JSON.stringify({
                title,
                chatId,
                url: url || null,
                username: chatId.startsWith('@') ? chatId : null
            })
        });
        
        if (response.ok) {
            closeAddChannelModal();
            await loadChannels();
            showToast('Kanal qo\'shildi');
        }
    } catch (error) {
        showToast('Xatolik yuz berdi', 'error');
    }
}

// ========== Users ========== 
async function loadUsers(page = 1) {
    showTabLoading('users');
    userPage = page;
    
    try {
        const response = await fetch(`${API_URL}/admin/users?page=${page}&limit=${pageSize}`, {
            headers: {
                'x-telegram-id': tg.initDataUnsafe?.user?.id?.toString() || ''
            }
        });
        const result = await response.json();
        
        if (result.success) {
            users = result.data.users || result.data;
            renderUsers(result.data.total);
        }
    } catch (error) {
        console.error('Error loading users:', error);
        showTabError('users');
    }
}

function renderUsers(total) {
    const container = document.getElementById('users-content');
    
    let html = `
        <div class="section-header">
            <h3 class="section-title">👥 Foydalanuvchilar (${total || users.length})</h3>
            <div class="search-box">
                <input type="text" id="user-search" class="form-input" placeholder="🔍 Qidirish..." onkeyup="searchUsers(this.value)">
            </div>
        </div>
    `;
    
    if (users.length === 0) {
        html += `
            <div class="empty-state">
                <div style="font-size: 48px; margin-bottom: 16px;">👥</div>
                <p>Foydalanuvchilar topilmadi</p>
            </div>
        `;
    } else {
        html += '<div class="users-list">';
        users.forEach(user => {
            const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Ism kiritilmagan';
            html += `
                <div class="user-item ${user.isBanned ? 'banned' : ''}">
                    <div class="user-avatar">${getInitials(fullName)}</div>
                    <div class="user-info">
                        <div class="user-name">
                            ${escapeHtml(fullName)}
                            ${user.isBanned ? '<span class="status-badge banned">🚫 Bloklangan</span>' : ''}
                        </div>
                        <div class="user-details">
                            ID: ${user.telegramId} 
                            ${user.username ? `• @${user.username}` : ''}
                        </div>
                    </div>
                    <div class="user-actions">
                        <button class="btn btn-icon" onclick="toggleUserBan(${user.id}, ${!user.isBanned})">
                            ${user.isBanned ? '✅' : '🚫'}
                        </button>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        
        // Pagination
        if (total > pageSize) {
            const totalPages = Math.ceil(total / pageSize);
            html += `
                <div class="pagination">
                    <button class="btn btn-sm" ${userPage === 1 ? 'disabled' : ''} onclick="loadUsers(${userPage - 1})">◀️</button>
                    <span class="page-info">${userPage} / ${totalPages}</span>
                    <button class="btn btn-sm" ${userPage === totalPages ? 'disabled' : ''} onclick="loadUsers(${userPage + 1})">▶️</button>
                </div>
            `;
        }
    }
    
    container.innerHTML = html;
}

async function toggleUserBan(id, isBanned) {
    try {
        const response = await fetch(`${API_URL}/admin/users/${id}/ban`, {
            method: 'PATCH',
            headers: { 
                'Content-Type': 'application/json',
                'x-telegram-id': tg.initDataUnsafe?.user?.id?.toString() || ''
            },
            body: JSON.stringify({ isBanned })
        });
        
        if (response.ok) {
            await loadUsers(userPage);
            showToast(isBanned ? 'Foydalanuvchi bloklandi' : 'Foydalanuvchi blokdan chiqarildi');
        }
    } catch (error) {
        showToast('Xatolik yuz berdi', 'error');
    }
}

function searchUsers(query) {
    if (!query) {
        loadUsers(1);
        return;
    }
    
    const filtered = users.filter(u => 
        (u.firstName && u.firstName.toLowerCase().includes(query.toLowerCase())) ||
        (u.lastName && u.lastName.toLowerCase().includes(query.toLowerCase())) ||
        (u.username && u.username.toLowerCase().includes(query.toLowerCase())) ||
        u.telegramId.toString().includes(query)
    );
    
    const container = document.getElementById('users-content');
    let html = `
        <div class="section-header">
            <h3 class="section-title">👥 Qidiruv natijalari (${filtered.length})</h3>
            <div class="search-box">
                <input type="text" id="user-search" class="form-input" placeholder="🔍 Qidirish..." value="${escapeHtml(query)}" onkeyup="searchUsers(this.value)">
            </div>
        </div>
    `;
    
    html += '<div class="users-list">';
    filtered.forEach(user => {
        const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Ism kiritilmagan';
        html += `
            <div class="user-item ${user.isBanned ? 'banned' : ''}">
                <div class="user-avatar">${getInitials(fullName)}</div>
                <div class="user-info">
                    <div class="user-name">
                        ${escapeHtml(fullName)}
                        ${user.isBanned ? '<span class="status-badge banned">🚫 Bloklangan</span>' : ''}
                    </div>
                    <div class="user-details">
                        ID: ${user.telegramId} 
                        ${user.username ? `• @${user.username}` : ''}
                    </div>
                </div>
                <div class="user-actions">
                    <button class="btn btn-icon" onclick="toggleUserBan(${user.id}, ${!user.isBanned})">
                        ${user.isBanned ? '✅' : '🚫'}
                    </button>
                </div>
            </div>
        `;
    });
    html += '</div>';
    
    container.innerHTML = html;
}

// ========== Movies ========== 
async function loadMovies(page = 1) {
    showTabLoading('movies');
    moviePage = page;
    
    try {
        const response = await fetch(`${API_URL}/admin/movies?page=${page}&limit=${pageSize}`, {
            headers: {
                'x-telegram-id': tg.initDataUnsafe?.user?.id?.toString() || ''
            }
        });
        const result = await response.json();
        
        if (result.success) {
            movies = result.data.movies || result.data;
            renderMoviesAdmin(result.data.total);
        }
    } catch (error) {
        console.error('Error loading movies:', error);
        showTabError('movies');
    }
}

function renderMoviesAdmin(total) {
    const container = document.getElementById('movies-content');
    
    let html = `
        <div class="section-header">
            <h3 class="section-title">🎬 Kinolar (${total || movies.length})</h3>
            <div class="search-box">
                <input type="text" id="movie-search" class="form-input" placeholder="🔍 Qidirish..." onkeyup="searchMovies(this.value)">
            </div>
        </div>
    `;
    
    if (movies.length === 0) {
        html += `
            <div class="empty-state">
                <div style="font-size: 48px; margin-bottom: 16px;">🎬</div>
                <p>Hozircha kino qo'shilmagan</p>
                <p style="font-size: 14px; margin-top: 10px;">Kino qo'shish uchun botga video yuboring</p>
            </div>
        `;
    } else {
        html += '<div class="movies-admin-list">';
        movies.forEach(movie => {
            html += `
                <div class="movie-admin-item">
                    <div class="movie-admin-info">
                        <div class="movie-admin-title">
                            ${escapeHtml(movie.title)}
                            ${movie.isPremiere ? '<span class="status-badge premiere">🌟 Premyera</span>' : ''}
                        </div>
                        <div class="movie-admin-meta">
                            📋 ${movie.code} • 👁 ${formatNumber(movie.viewsCount || 0)}
                        </div>
                    </div>
                    <div class="movie-admin-actions">
                        <button class="btn btn-icon" onclick="togglePremiere(${movie.id}, ${!movie.isPremiere})">
                            ${movie.isPremiere ? '⭐' : '☆'}
                        </button>
                        <button class="btn btn-icon btn-danger" onclick="deleteMovie(${movie.id})">
                            🗑️
                        </button>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        
        // Pagination
        if (total > pageSize) {
            const totalPages = Math.ceil(total / pageSize);
            html += `
                <div class="pagination">
                    <button class="btn btn-sm" ${moviePage === 1 ? 'disabled' : ''} onclick="loadMovies(${moviePage - 1})">◀️</button>
                    <span class="page-info">${moviePage} / ${totalPages}</span>
                    <button class="btn btn-sm" ${moviePage === totalPages ? 'disabled' : ''} onclick="loadMovies(${moviePage + 1})">▶️</button>
                </div>
            `;
        }
    }
    
    container.innerHTML = html;
}

async function togglePremiere(id, isPremiere) {
    try {
        const response = await fetch(`${API_URL}/admin/movies/${id}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'x-telegram-id': tg.initDataUnsafe?.user?.id?.toString() || ''
            },
            body: JSON.stringify({ is_premiere: isPremiere })
        });
        
        if (response.ok) {
            await loadMovies(moviePage);
            showToast(isPremiere ? 'Kino premyeraga qo\'shildi' : 'Kino premyeradan olib tashlandi');
        }
    } catch (error) {
        showToast('Xatolik yuz berdi', 'error');
    }
}

async function deleteMovie(id) {
    if (!confirm('Kinoni o\'chirishni xohlaysizmi?')) return;
    
    try {
        const response = await fetch(`${API_URL}/admin/movies/${id}`, {
            method: 'DELETE',
            headers: {
                'x-telegram-id': tg.initDataUnsafe?.user?.id?.toString() || ''
            }
        });
        
        if (response.ok) {
            await loadMovies(moviePage);
            showToast('Kino o\'chirildi');
        }
    } catch (error) {
        showToast('Xatolik yuz berdi', 'error');
    }
}

function searchMovies(query) {
    if (!query) {
        loadMovies(1);
        return;
    }
    
    const filtered = movies.filter(m => 
        m.title.toLowerCase().includes(query.toLowerCase()) ||
        m.code.toLowerCase().includes(query.toLowerCase())
    );
    
    const container = document.getElementById('movies-content');
    let html = `
        <div class="section-header">
            <h3 class="section-title">🎬 Qidiruv natijalari (${filtered.length})</h3>
            <div class="search-box">
                <input type="text" id="movie-search" class="form-input" placeholder="🔍 Qidirish..." value="${escapeHtml(query)}" onkeyup="searchMovies(this.value)">
            </div>
        </div>
    `;
    
    html += '<div class="movies-admin-list">';
    filtered.forEach(movie => {
        html += `
            <div class="movie-admin-item">
                <div class="movie-admin-info">
                    <div class="movie-admin-title">
                        ${escapeHtml(movie.title)}
                        ${movie.isPremiere ? '<span class="status-badge premiere">🌟 Premyera</span>' : ''}
                    </div>
                    <div class="movie-admin-meta">
                        📋 ${movie.code} • 👁 ${formatNumber(movie.viewsCount || 0)}
                    </div>
                </div>
                <div class="movie-admin-actions">
                    <button class="btn btn-icon" onclick="togglePremiere(${movie.id}, ${!movie.isPremiere})">
                        ${movie.isPremiere ? '⭐' : '☆'}
                    </button>
                    <button class="btn btn-icon btn-danger" onclick="deleteMovie(${movie.id})">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    });
    html += '</div>';
    
    container.innerHTML = html;
}

// ========== UI Helpers ========== 
function showTabLoading(tabName) {
    const container = document.getElementById(`${tabName}-content`);
    container.innerHTML = `
        <div class="loading-state">
            <div class="loading-spinner"></div>
            <p>Yuklanmoqda...</p>
        </div>
    `;
}

function showTabError(tabName) {
    const container = document.getElementById(`${tabName}-content`);
    container.innerHTML = `
        <div class="error-state">
            <div style="font-size: 48px; margin-bottom: 16px;">😕</div>
            <p>Xatolik yuz berdi</p>
            <button class="btn btn-primary" style="margin-top: 20px;" onclick="switchTab('${tabName}')">
                🔄 Qayta yuklash
            </button>
        </div>
    `;
}

function showAccessDenied() {
    document.body.innerHTML = `
        <div class="access-denied">
            <div style="font-size: 64px; margin-bottom: 20px;">🚫</div>
            <h2>Kirish taqiqlangan</h2>
            <p>Bu sahifaga faqat adminlar kira oladi</p>
        </div>
    `;
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // Haptic feedback
    if (tg.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred(type === 'error' ? 'error' : 'success');
    }
    
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
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

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getInitials(name) {
    const parts = name.split(' ').filter(Boolean);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}
