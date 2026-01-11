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
                <div class="stat-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                </div>
                <div class="stat-value">${formatNumber(stats.totalUsers || 0)}</div>
                <div class="stat-label">Jami foydalanuvchilar</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
                        <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
                        <line x1="7" y1="2" x2="7" y2="22"/>
                        <line x1="17" y1="2" x2="17" y2="22"/>
                        <line x1="2" y1="12" x2="22" y2="12"/>
                        <line x1="2" y1="7" x2="7" y2="7"/>
                        <line x1="2" y1="17" x2="7" y2="17"/>
                        <line x1="17" y1="17" x2="22" y2="17"/>
                        <line x1="17" y1="7" x2="22" y2="7"/>
                    </svg>
                </div>
                <div class="stat-value">${formatNumber(stats.totalMovies || 0)}</div>
                <div class="stat-label">Jami kinolar</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2">
                        <rect x="2" y="7" width="20" height="15" rx="2" ry="2"/>
                        <polyline points="17 2 12 7 7 2"/>
                    </svg>
                </div>
                <div class="stat-value">${formatNumber(stats.totalChannels || 0)}</div>
                <div class="stat-label">Kanallar</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                    </svg>
                </div>
                <div class="stat-value">${formatNumber(stats.totalViews || 0)}</div>
                <div class="stat-label">Jami ko'rishlar</div>
            </div>
        </div>
        
        <div class="section">
            <h3 class="section-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 8px;">
                    <line x1="18" y1="20" x2="18" y2="10"/>
                    <line x1="12" y1="20" x2="12" y2="4"/>
                    <line x1="6" y1="20" x2="6" y2="14"/>
                </svg>
                Bugungi statistika
            </h3>
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
            <h3 class="section-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="2" style="vertical-align: middle; margin-right: 8px;">
                    <path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z"/>
                </svg>
                Top kinolar
            </h3>
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
                <span class="top-movie-views">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle;">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                    </svg>
                    ${formatNumber(movie.viewsCount)}
                </span>
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
            <h3 class="section-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 6px;">
                    <rect x="2" y="7" width="20" height="15" rx="2" ry="2"/>
                    <polyline points="17 2 12 7 7 2"/>
                </svg>
                Majburiy obuna kanallari
            </h3>
            <button class="btn btn-primary btn-sm" onclick="showAddChannelModal()">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align: middle; margin-right: 4px;">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Kanal qo'shish
            </button>
        </div>
    `;
    
    if (channels.length === 0) {
        html += `
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--hint-color)" stroke-width="1.5" style="margin-bottom: 16px;">
                    <rect x="2" y="7" width="20" height="15" rx="2" ry="2"/>
                    <polyline points="17 2 12 7 7 2"/>
                </svg>
                <p>Hozircha kanal qo'shilmagan</p>
            </div>
        `;
    } else {
        html += '<div class="channels-list">';
        channels.forEach(channel => {
            const channelTitle = channel.channel_title || channel.title || "Noma'lum kanal";
            const channelUsername = channel.channel_username || channel.username;
            const channelId = channel.channel_id || channel.chatId;
            const isActive = channel.is_active !== undefined ? channel.is_active : channel.isActive;
            const botUsersCount = channel.bot_users_count || channel.botUsersCount || 0;
            const photoUrl = channel.photo_url || channel.photoUrl;
            
            html += `
                <div class="channel-item ${isActive ? 'active' : 'inactive'}">
                    ${photoUrl ? 
                        `<img src="${photoUrl}" class="channel-avatar-img" alt="${escapeHtml(channelTitle)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                        <div class="channel-avatar" style="display:none; background: linear-gradient(135deg, #${getColorFromId(channel.id)} 0%, #${getColorFromId(channel.id + 5)} 100%);">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                                <rect x="2" y="7" width="20" height="15" rx="2" ry="2"/>
                                <polyline points="17 2 12 7 7 2"/>
                            </svg>
                        </div>` :
                        `<div class="channel-avatar" style="background: linear-gradient(135deg, #${getColorFromId(channel.id)} 0%, #${getColorFromId(channel.id + 5)} 100%);">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                                <rect x="2" y="7" width="20" height="15" rx="2" ry="2"/>
                                <polyline points="17 2 12 7 7 2"/>
                            </svg>
                        </div>`
                    }
                    <div class="channel-info">
                        <div class="channel-name">
                            ${escapeHtml(channelTitle)}
                            ${isActive ? 
                                '<span class="status-badge active">Aktiv</span>' : 
                                '<span class="status-badge inactive">Noaktiv</span>'
                            }
                        </div>
                        <div class="channel-meta">
                            ${channelUsername ? `@${channelUsername}` : channelId}
                            ${botUsersCount > 0 ? ` • <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg> ${formatNumber(botUsersCount)} bot user` : ''}
                        </div>
                    </div>
                    <div class="channel-actions">
                        <button class="btn btn-icon" onclick="toggleChannel(${channel.id}, ${!isActive})" title="${isActive ? 'O\'chirish' : 'Yoqish'}">
                            ${isActive ? 
                                '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>' : 
                                '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>'
                            }
                        </button>
                        <button class="btn btn-icon btn-danger" onclick="deleteChannel(${channel.id})" title="O'chirish">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
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
            body: JSON.stringify({ is_active: isActive })
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
                <h3>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 8px;">
                        <rect x="2" y="7" width="20" height="15" rx="2" ry="2"/>
                        <polyline points="17 2 12 7 7 2"/>
                    </svg>
                    Kanal qo'shish
                </h3>
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
        const requestBody = {
                channel_title: title,
                channel_id: chatId,
                is_active: true
            };
            
            // Username bo'lsa qo'shamiz
            if (chatId.startsWith('@')) {
                requestBody.channel_username = chatId.substring(1);
            }
            
            // URL bo'lsa qo'shamiz
            if (url) {
                requestBody.invite_link = url;
            }
        
        const response = await fetch(`${API_URL}/admin/channels`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-telegram-id': tg.initDataUnsafe?.user?.id?.toString() || ''
            },
            body: JSON.stringify(requestBody)
        });
        
        const result = await response.json();
        console.log('Add channel response:', response.status, result);
        
        if (response.ok && result.success) {
            closeAddChannelModal();
            await loadChannels();
            showToast('Kanal qo\'shildi');
        } else {
            showToast(result.message || result.error || `Xatolik: ${response.status}`, 'error');
        }
    } catch (error) {
        console.error('Error adding channel:', error);
        showToast('Tarmoq xatosi: ' + error.message, 'error');
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
            <h3 class="section-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 6px;">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                Foydalanuvchilar (${total || users.length})
            </h3>
            <div class="search-box">
                <input type="text" id="user-search" class="form-input" placeholder="Qidirish..." onkeyup="searchUsers(this.value)">
            </div>
        </div>
    `;
    
    if (users.length === 0) {
        html += `
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--hint-color)" stroke-width="1.5" style="margin-bottom: 16px;">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                <p>Foydalanuvchilar topilmadi</p>
            </div>
        `;
    } else {
        html += '<div class="users-list">';
        users.forEach(user => {
            // Backend full_name qaytaradi
            const fullName = user.full_name || user.fullName || 'Noma\'lum';
            const telegramId = user.telegram_id || user.telegramId;
            const isBanned = user.is_banned || user.isBanned;
            const photoUrl = user.photo_url || user.photoUrl;
            
            html += `
                <div class="user-item ${isBanned ? 'banned' : ''}">
                    ${photoUrl ? 
                        `<img src="${photoUrl}" class="user-avatar-img" alt="${escapeHtml(fullName)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                        <div class="user-avatar" style="display:none; background: linear-gradient(135deg, #${getColorFromId(telegramId)} 0%, #${getColorFromId(telegramId + 1)} 100%);">
                            ${getInitials(fullName)}
                        </div>` :
                        `<div class="user-avatar" style="background: linear-gradient(135deg, #${getColorFromId(telegramId)} 0%, #${getColorFromId(telegramId + 1)} 100%);">
                            ${getInitials(fullName)}
                        </div>`
                    }
                    <div class="user-info">
                        <div class="user-name">
                            ${escapeHtml(fullName)}
                            ${isBanned ? '<span class="status-badge banned">Bloklangan</span>' : ''}
                        </div>
                        <div class="user-details">
                            ID: ${telegramId} 
                            ${user.username ? `• @${user.username}` : ''}
                        </div>
                    </div>
                    <div class="user-actions">
                        <button class="btn btn-icon" onclick="toggleUserBan(${user.id}, ${!isBanned})" title="${isBanned ? 'Blokdan chiqarish' : 'Bloklash'}">
                            ${isBanned ? 
                                '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>' : 
                                '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>'
                            }
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
    
    const filtered = users.filter(u => {
        const fullName = u.full_name || u.fullName || '';
        const telegramId = (u.telegram_id || u.telegramId || '').toString();
        return fullName.toLowerCase().includes(query.toLowerCase()) ||
            (u.username && u.username.toLowerCase().includes(query.toLowerCase())) ||
            telegramId.includes(query);
    });
    
    const container = document.getElementById('users-content');
    let html = `
        <div class="section-header">
            <h3 class="section-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 6px;">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                Qidiruv natijalari (${filtered.length})
            </h3>
            <div class="search-box">
                <input type="text" id="user-search" class="form-input" placeholder="Qidirish..." value="${escapeHtml(query)}" onkeyup="searchUsers(this.value)">
            </div>
        </div>
    `;
    
    html += '<div class="users-list">';
    filtered.forEach(user => {
        const fullName = user.full_name || user.fullName || "Noma'lum";
        const telegramId = user.telegram_id || user.telegramId;
        const isBanned = user.is_banned || user.isBanned;
        
        html += `
            <div class="user-item ${isBanned ? 'banned' : ''}">
                <div class="user-avatar" style="background: linear-gradient(135deg, #${getColorFromId(telegramId)} 0%, #${getColorFromId(telegramId + 1)} 100%);">
                    ${getInitials(fullName)}
                </div>
                <div class="user-info">
                    <div class="user-name">
                        ${escapeHtml(fullName)}
                        ${isBanned ? '<span class="status-badge banned">Bloklangan</span>' : ''}
                    </div>
                    <div class="user-details">
                        ID: ${telegramId} 
                        ${user.username ? `• @${user.username}` : ''}
                    </div>
                </div>
                <div class="user-actions">
                    <button class="btn btn-icon" onclick="toggleUserBan(${user.id}, ${!isBanned})" title="${isBanned ? 'Blokdan chiqarish' : 'Bloklash'}">
                        ${isBanned ? 
                            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>' : 
                            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>'
                        }
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
            <h3 class="section-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 6px;">
                    <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
                    <line x1="7" y1="2" x2="7" y2="22"/>
                    <line x1="17" y1="2" x2="17" y2="22"/>
                    <line x1="2" y1="12" x2="22" y2="12"/>
                    <line x1="2" y1="7" x2="7" y2="7"/>
                    <line x1="2" y1="17" x2="7" y2="17"/>
                    <line x1="17" y1="17" x2="22" y2="17"/>
                    <line x1="17" y1="7" x2="22" y2="7"/>
                </svg>
                Kinolar (${total || movies.length})
            </h3>
            <div class="search-box">
                <input type="text" id="movie-search" class="form-input" placeholder="Qidirish..." onkeyup="searchMovies(this.value)">
            </div>
        </div>
    `;
    
    if (movies.length === 0) {
        html += `
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--hint-color)" stroke-width="1.5" style="margin-bottom: 16px;">
                    <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
                    <line x1="7" y1="2" x2="7" y2="22"/>
                    <line x1="17" y1="2" x2="17" y2="22"/>
                    <line x1="2" y1="12" x2="22" y2="12"/>
                </svg>
                <p>Hozircha kino qo'shilmagan</p>
                <p style="font-size: 14px; margin-top: 10px;">Kino qo'shish uchun botga video yuboring</p>
            </div>
        `;
    } else {
        html += '<div class="movies-admin-list">';
        movies.forEach(movie => {
            const movieTitle = movie.title || "Noma'lum kino";
            const movieCode = movie.code || '---';
            const isPremiere = movie.is_premiere !== undefined ? movie.is_premiere : movie.isPremiere;
            const viewsCount = movie.views_count || movie.viewsCount || 0;
            const thumbnailId = movie.thumbnail_file_id || movie.thumbnailFileId;
            
            html += `
                <div class="movie-admin-item">
                    <div class="movie-thumbnail">
                        ${thumbnailId ? 
                            `<img src="/api/thumbnail/${thumbnailId}" alt="${escapeHtml(movieTitle)}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                            <div class="movie-thumbnail-placeholder" style="display:none;">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                    <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
                                    <polygon points="10 8 16 12 10 16 10 8"/>
                                </svg>
                            </div>` :
                            `<div class="movie-thumbnail-placeholder">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                    <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
                                    <polygon points="10 8 16 12 10 16 10 8"/>
                                </svg>
                            </div>`
                        }
                    </div>
                    <div class="movie-admin-info">
                        <div class="movie-admin-title">
                            ${escapeHtml(movieTitle)}
                        </div>
                        <div class="movie-admin-meta">
                            <span class="movie-code">${movieCode}</span>
                            <span class="movie-views">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle;">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                    <circle cx="12" cy="12" r="3"/>
                                </svg>
                                ${formatNumber(viewsCount)}
                            </span>
                        </div>
                    </div>
                    <div class="movie-admin-actions">
                        <button class="btn btn-icon premiere-btn ${isPremiere ? 'active' : ''}" onclick="togglePremiere(${movie.id}, ${!isPremiere})" title="${isPremiere ? 'Premyeradan olib tashlash' : 'Premyera qilish'}">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="${isPremiere ? '#f59e0b' : 'none'}" stroke="${isPremiere ? '#f59e0b' : 'currentColor'}" stroke-width="2">
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                            </svg>
                        </button>
                        <button class="btn btn-icon btn-danger" onclick="deleteMovie(${movie.id})" title="O'chirish">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
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
                    <button class="btn btn-sm" ${moviePage === 1 ? 'disabled' : ''} onclick="loadMovies(${moviePage - 1})">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
                    </button>
                    <span class="page-info">${moviePage} / ${totalPages}</span>
                    <button class="btn btn-sm" ${moviePage === totalPages ? 'disabled' : ''} onclick="loadMovies(${moviePage + 1})">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
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
            <h3 class="section-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 6px;">
                    <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
                    <line x1="7" y1="2" x2="7" y2="22"/>
                    <line x1="17" y1="2" x2="17" y2="22"/>
                    <line x1="2" y1="12" x2="22" y2="12"/>
                </svg>
                Qidiruv natijalari (${filtered.length})
            </h3>
            <div class="search-box">
                <input type="text" id="movie-search" class="form-input" placeholder="Qidirish..." value="${escapeHtml(query)}" onkeyup="searchMovies(this.value)">
            </div>
        </div>
    `;
    
    html += '<div class="movies-admin-list">';
    filtered.forEach(movie => {
        const movieTitle = movie.title || "Noma'lum kino";
        const movieCode = movie.code || '---';
        const isPremiere = movie.is_premiere !== undefined ? movie.is_premiere : movie.isPremiere;
        const viewsCount = movie.views_count || movie.viewsCount || 0;
        const thumbnailId = movie.thumbnail_file_id || movie.thumbnailFileId;
        
        html += `
            <div class="movie-admin-item">
                <div class="movie-thumbnail">
                    ${thumbnailId ? 
                        `<img src="/api/thumbnail/${thumbnailId}" alt="${escapeHtml(movieTitle)}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                        <div class="movie-thumbnail-placeholder" style="display:none;">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
                                <polygon points="10 8 16 12 10 16 10 8"/>
                            </svg>
                        </div>` :
                        `<div class="movie-thumbnail-placeholder">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
                                <polygon points="10 8 16 12 10 16 10 8"/>
                            </svg>
                        </div>`
                    }
                </div>
                <div class="movie-admin-info">
                    <div class="movie-admin-title">
                        ${escapeHtml(movieTitle)}
                    </div>
                    <div class="movie-admin-meta">
                        <span class="movie-code">${movieCode}</span>
                        <span class="movie-views">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle;">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                <circle cx="12" cy="12" r="3"/>
                            </svg>
                            ${formatNumber(viewsCount)}
                        </span>
                    </div>
                </div>
                <div class="movie-admin-actions">
                    <button class="btn btn-icon premiere-btn ${isPremiere ? 'active' : ''}" onclick="togglePremiere(${movie.id}, ${!isPremiere})" title="${isPremiere ? 'Premyeradan olib tashlash' : 'Premyera qilish'}">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="${isPremiere ? '#f59e0b' : 'none'}" stroke="${isPremiere ? '#f59e0b' : 'currentColor'}" stroke-width="2">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                        </svg>
                    </button>
                    <button class="btn btn-icon btn-danger" onclick="deleteMovie(${movie.id})" title="O'chirish">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
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
    if (!name || name === "Noma'lum") return '?';
    const parts = name.split(' ').filter(Boolean);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

// Telegram ID dan rang generatsiya qilish
function getColorFromId(id) {
    const colors = [
        '6366f1', '8b5cf6', 'a855f7', 'd946ef', 'ec4899',
        'f43f5e', 'ef4444', 'f97316', 'f59e0b', 'eab308',
        '84cc16', '22c55e', '10b981', '14b8a6', '06b6d4',
        '0ea5e9', '3b82f6', '6366f1'
    ];
    return colors[Math.abs(id) % colors.length];
}
