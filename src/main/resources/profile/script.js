class ProfileManager {
    constructor() {
        this.currentSessionId = null;
        this.sessions = [];
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadUserProfile();
        this.loadSessions();
    }

    setupEventListeners() {
        // Profile form submission
        document.getElementById('profileForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateProfile();
        });

        // Session management buttons
        document.getElementById('refreshSessions').addEventListener('click', () => {
            this.loadSessions();
        });

        document.getElementById('deleteAllSessions').addEventListener('click', () => {
            this.deleteAllSessions();
        });
    }

    async loadUserProfile() {
        try {
            const response = await fetch('/api/user');
            if (response.ok) {
                const user = await response.json();
                document.getElementById('userName').value = user.name || '';
                document.getElementById('userEmail').value = user.email || '';
            } else {
                this.showMessage('Ошибка загрузки профиля пользователя', 'error');
            }
        } catch (error) {
            console.error('Error loading user profile:', error);
            this.showMessage('Ошибка подключения к серверу', 'error');
        }
    }

    async updateProfile() {
        const formData = new FormData(document.getElementById('profileForm'));
        const updateData = {
            name: formData.get('name')
        };

        // Only include password if it's not empty
        const password = formData.get('password');
        if (password && password.trim() !== '') {
            updateData.password = password;
        }

        try {
            this.setLoading(true);
            const response = await fetch('/api/user', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updateData)
            });

            if (response.ok) {
                this.showMessage('Профиль успешно обновлен', 'success');
                // Clear password field
                document.getElementById('userPassword').value = '';
                // Reload profile to get updated data
                await this.loadUserProfile();
            } else {
                this.showMessage('Ошибка обновления профиля', 'error');
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            this.showMessage('Ошибка подключения к серверу', 'error');
        } finally {
            this.setLoading(false);
        }
    }

    async loadSessions() {
        try {
            this.setLoading(true);
            
            // Load current session info
            const currentResponse = await fetch('/api/user/sessions/current');
            if (currentResponse.ok) {
                const currentSession = await currentResponse.json();
                this.currentSessionId = currentSession.id;
            }

            // Load all sessions
            const response = await fetch('/api/user/sessions');
            if (response.ok) {
                this.sessions = await response.json();
                this.renderSessions();
            } else {
                this.showMessage('Ошибка загрузки сеансов', 'error');
            }
        } catch (error) {
            console.error('Error loading sessions:', error);
            this.showMessage('Ошибка подключения к серверу', 'error');
        } finally {
            this.setLoading(false);
        }
    }

    renderSessions() {
        const tbody = document.querySelector('#sessionsTable tbody');
        tbody.innerHTML = '';

        this.sessions.forEach(session => {
            const row = document.createElement('tr');
            const isCurrentSession = session.id === this.currentSessionId;
            
            if (isCurrentSession) {
                row.classList.add('current-session');
            }

            const loginTime = new Date(session.requestData.login_time).toLocaleString('ru-RU');
            const userAgent = session.requestData.user_agent || 'Неизвестно';
            const statusCell = isCurrentSession ? 
                '<span class="session-badge">ТЕКУЩАЯ</span>' : 
                '';

            row.innerHTML = `
                <td>${loginTime}</td>
                <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${userAgent}">${userAgent}</td>
                <td>${statusCell}</td>
                <td>
                    ${!isCurrentSession ? `<button class="danger" onclick="profileManager.deleteSession(${session.id})">Удалить</button>` : ''}
                </td>
            `;

            tbody.appendChild(row);
        });
    }

    async deleteSession(sessionId) {
        if (!confirm('Вы уверены, что хотите удалить этот сеанс?')) {
            return;
        }

        try {
            const response = await fetch(`/api/user/sessions/${sessionId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                this.showMessage('Сеанс успешно удален', 'success');
                await this.loadSessions();
            } else {
                this.showMessage('Ошибка удаления сеанса', 'error');
            }
        } catch (error) {
            console.error('Error deleting session:', error);
            this.showMessage('Ошибка подключения к серверу', 'error');
        }
    }

    async deleteAllSessions() {
        if (!confirm('Вы уверены, что хотите удалить все сеансы? Это приведет к выходу из системы на всех устройствах.')) {
            return;
        }

        try {
            const response = await fetch('/api/user/sessions', {
                method: 'DELETE'
            });

            if (response.ok) {
                this.showMessage('Все сеансы успешно удалены', 'success');
                // Redirect to login as user will be logged out
                setTimeout(() => {
                    window.location.href = '/login';
                }, 2000);
            } else {
                this.showMessage('Ошибка удаления сеансов', 'error');
            }
        } catch (error) {
            console.error('Error deleting all sessions:', error);
            this.showMessage('Ошибка подключения к серверу', 'error');
        }
    }

    showMessage(text, type) {
        const messageEl = document.getElementById('message');
        messageEl.textContent = text;
        messageEl.className = `message ${type}`;
        messageEl.style.display = 'block';
        
        // Auto hide success messages after 5 seconds
        if (type === 'success') {
            setTimeout(() => {
                messageEl.style.display = 'none';
            }, 5000);
        }
    }

    setLoading(loading) {
        const container = document.querySelector('.container');
        if (loading) {
            container.classList.add('loading');
        } else {
            container.classList.remove('loading');
        }
    }
}

// Initialize the profile manager when the page loads
let profileManager;
document.addEventListener('DOMContentLoaded', () => {
    profileManager = new ProfileManager();
});