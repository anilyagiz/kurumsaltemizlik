// Ana Uygulama Modülü
const App = {
    user: null,
    currentPage: 'dashboard',

    // Başlatma
    async init() {
        // Event listener'ları kur
        this.setupEventListeners();

        // Oturum kontrolü
        await this.checkAuth();

        // PWA kurulum banner
        this.setupPWA();

        // Çevrimdışı kontrolü
        this.setupOfflineDetection();
    },

    // Event Listener'lar
    setupEventListeners() {
        // Login form
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.login();
        });

        // Logout button
        document.getElementById('btn-logout').addEventListener('click', () => this.logout());

        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = link.dataset.page;
                this.navigateTo(page);
            });
        });

        // Modal kapatma
        document.querySelectorAll('[data-close-modal]').forEach(btn => {
            btn.addEventListener('click', () => this.closeModals());
        });

        // Modal overlay tıklama
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) this.closeModals();
            });
        });

        // ESC tuşu ile modal kapatma
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeModals();
        });

        // Task filter
        document.getElementById('filter-status').addEventListener('change', () => this.loadTasks());

        // New Task button
        document.getElementById('btn-new-task').addEventListener('click', () => this.showTaskModal());
        document.getElementById('btn-save-task').addEventListener('click', () => this.saveTask());

        // New Schedule button
        document.getElementById('btn-new-schedule').addEventListener('click', () => this.showScheduleModal());
        document.getElementById('btn-save-schedule').addEventListener('click', () => this.saveSchedule());
        document.getElementById('btn-generate-tasks').addEventListener('click', () => this.generateTasks());

        // New User button
        document.getElementById('btn-new-user').addEventListener('click', () => this.showUserModal());
        document.getElementById('btn-save-user').addEventListener('click', () => this.saveUser());

        // Location buttons
        document.getElementById('btn-new-building').addEventListener('click', () => this.showLocationModal('building'));
        document.getElementById('btn-new-department').addEventListener('click', () => this.showLocationModal('department'));
        document.getElementById('btn-new-room').addEventListener('click', () => this.showLocationModal('room'));
        document.getElementById('btn-save-location').addEventListener('click', () => this.saveLocation());

        // Reject button
        document.getElementById('btn-confirm-reject').addEventListener('click', () => this.confirmReject());

        // Report export
        document.getElementById('btn-export-csv').addEventListener('click', () => this.exportCSV());
    },

    // Auth
    async checkAuth() {
        try {
            const response = await API.auth.me();
            this.user = response.user;
            this.showApp();
        } catch (error) {
            this.showLogin();
        }
    },

    async login() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        this.showLoading();

        try {
            const response = await API.auth.login(username, password);
            this.user = response.user;
            this.showApp();
            this.toast('Hoş geldiniz, ' + this.user.full_name, 'success');
        } catch (error) {
            this.toast(error.message, 'error');
        } finally {
            this.hideLoading();
        }
    },

    async logout() {
        try {
            await API.auth.logout();
        } catch (e) { }

        this.user = null;
        this.showLogin();
        this.toast('Çıkış yapıldı', 'success');
    },

    showLogin() {
        document.getElementById('login-page').classList.remove('hidden');
        document.getElementById('app').classList.add('hidden');
    },

    showApp() {
        document.getElementById('login-page').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');

        // Kullanıcı bilgilerini göster
        document.getElementById('header-user-name').textContent = this.user.full_name;
        document.getElementById('header-user-role').textContent = this.getRoleName(this.user.role);

        if (this.user.faculty_name) {
            document.getElementById('header-faculty').textContent = this.user.faculty_name;
        }

        // Rol bazlı navigasyon
        this.updateNavigation();

        // İlk sayfayı yükle
        this.navigateTo('dashboard');
    },

    getRoleName(role) {
        const names = {
            super_admin: 'Super Admin',
            faculty_admin: 'Fakülte Admin',
            supervisor: 'Supervisor',
            staff: 'Personel'
        };
        return names[role] || role;
    },

    updateNavigation() {
        const role = this.user.role;

        document.querySelectorAll('.nav-link[data-role]').forEach(link => {
            const allowedRoles = link.dataset.role.split(',');
            if (allowedRoles.includes(role)) {
                link.parentElement.classList.remove('hidden');
            } else {
                link.parentElement.classList.add('hidden');
            }
        });

        // Butonlar için de
        document.querySelectorAll('[data-role]').forEach(el => {
            if (el.classList.contains('nav-link')) return;
            const allowedRoles = el.dataset.role.split(',');
            if (allowedRoles.includes(role)) {
                el.classList.remove('hidden');
            } else {
                el.classList.add('hidden');
            }
        });
    },

    // Navigasyon
    navigateTo(page) {
        this.currentPage = page;

        // Sayfaları gizle/göster
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(`page-${page}`).classList.add('active');

        // Nav link'leri güncelle
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.toggle('active', link.dataset.page === page);
        });

        // Sayfa verilerini yükle
        this.loadPageData(page);
    },

    async loadPageData(page) {
        this.showLoading();

        try {
            switch (page) {
                case 'dashboard':
                    await this.loadDashboard();
                    break;
                case 'tasks':
                    await this.loadTasks();
                    break;
                case 'schedules':
                    await this.loadSchedules();
                    break;
                case 'locations':
                    await this.loadLocations();
                    break;
                case 'users':
                    await this.loadUsers();
                    break;
                case 'reports':
                    await this.loadReports();
                    break;
                case 'faculties':
                    await this.loadFaculties();
                    break;
            }
        } catch (error) {
            this.toast(error.message, 'error');
        } finally {
            this.hideLoading();
        }
    },

    // Dashboard
    async loadDashboard() {
        const [dashboardData, todayTasks] = await Promise.all([
            API.reports.dashboard(),
            API.tasks.today()
        ]);

        // Stats
        const statsHtml = `
            <div class="stat-card">
                <div class="stat-icon primary">📋</div>
                <div class="stat-content">
                    <div class="stat-value">${dashboardData.today.total || 0}</div>
                    <div class="stat-label">Bugünün Görevleri</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon warning">⏳</div>
                <div class="stat-content">
                    <div class="stat-value">${dashboardData.today.pending || 0}</div>
                    <div class="stat-label">Bekleyen</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon success">✅</div>
                <div class="stat-content">
                    <div class="stat-value">${dashboardData.today.done || 0}</div>
                    <div class="stat-label">Tamamlanan</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon primary">📊</div>
                <div class="stat-content">
                    <div class="stat-value">${dashboardData.today.completion_rate}</div>
                    <div class="stat-label">Tamamlanma Oranı</div>
                </div>
            </div>
        `;
        document.getElementById('dashboard-stats').innerHTML = statsHtml;

        // Today's tasks
        this.renderTaskList(todayTasks, 'today-tasks');
    },

    // Tasks
    async loadTasks() {
        const status = document.getElementById('filter-status').value;
        const params = status ? { status } : {};
        const tasks = await API.tasks.list(params);
        this.renderTaskList(tasks, 'task-list');
    },

    renderTaskList(tasks, containerId) {
        const container = document.getElementById(containerId);

        if (!tasks || tasks.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📋</div>
                    <div class="empty-state-title">Görev bulunamadı</div>
                    <p>Henüz görev eklenmemiş veya filtrelere uygun görev yok.</p>
                </div>
            `;
            return;
        }

        const statusNames = {
            pending: 'Bekliyor',
            in_progress: 'Devam Ediyor',
            completed: 'Tamamlandı',
            approved: 'Onaylandı',
            rejected: 'Reddedildi'
        };

        const html = tasks.map(task => `
            <div class="task-card priority-${task.priority} status-${task.status}">
                <div class="task-header">
                    <div>
                        <div class="task-location">${task.location_name}</div>
                        <div class="task-building">${task.building_name} - ${task.department_name}</div>
                    </div>
                    <span class="task-status ${task.status}">${statusNames[task.status]}</span>
                </div>
                <div class="task-meta">
                    <span>👤 ${task.assigned_to_name || '-'}</span>
                    <span>📅 ${this.formatDate(task.due_date)}</span>
                </div>
                <div class="task-actions">
                    ${this.getTaskActions(task)}
                </div>
            </div>
        `).join('');

        container.innerHTML = html;

        // Action button event'leri
        container.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', () => this.handleTaskAction(btn.dataset.action, btn.dataset.id));
        });
    },

    getTaskActions(task) {
        const role = this.user.role;
        let actions = '';

        if (task.status === 'pending' && (role === 'staff' || task.assigned_to === this.user.id)) {
            actions += `<button class="btn btn-primary btn-sm" data-action="start" data-id="${task.id}">▶️ Başla</button>`;
        }

        if (task.status === 'in_progress' && (role === 'staff' || task.assigned_to === this.user.id)) {
            actions += `<button class="btn btn-success btn-sm" data-action="complete" data-id="${task.id}">✅ Tamamla</button>`;
        }

        if (task.status === 'completed' && ['supervisor', 'faculty_admin', 'super_admin'].includes(role)) {
            actions += `<button class="btn btn-success btn-sm" data-action="approve" data-id="${task.id}">👍 Onayla</button>`;
            actions += `<button class="btn btn-danger btn-sm" data-action="reject" data-id="${task.id}">👎 Reddet</button>`;
        }

        return actions || '<span style="color: var(--gray-400);">İşlem yok</span>';
    },

    async handleTaskAction(action, taskId) {
        this.showLoading();

        try {
            switch (action) {
                case 'start':
                    await API.tasks.start(taskId);
                    this.toast('Görev başlatıldı', 'success');
                    break;
                case 'complete':
                    await API.tasks.complete(taskId);
                    this.toast('Görev tamamlandı, onay bekleniyor', 'success');
                    break;
                case 'approve':
                    await API.tasks.approve(taskId);
                    this.toast('Görev onaylandı', 'success');
                    break;
                case 'reject':
                    this.showRejectModal(taskId);
                    return;
            }

            await this.loadPageData(this.currentPage);
        } catch (error) {
            this.toast(error.message, 'error');
        } finally {
            this.hideLoading();
        }
    },

    // Task Modal
    async showTaskModal() {
        const [rooms, staff] = await Promise.all([
            API.locations.rooms(),
            API.users.staff()
        ]);

        // Lokasyon dropdown
        const locationSelect = document.getElementById('task-location');
        locationSelect.innerHTML = rooms.map(r =>
            `<option value="${r.id}">${r.building_name} - ${r.department_name} - ${r.name}</option>`
        ).join('');

        // Staff dropdown
        const staffSelect = document.getElementById('task-staff');
        staffSelect.innerHTML = staff.map(s =>
            `<option value="${s.id}">${s.full_name}</option>`
        ).join('');

        // Bugünün tarihi
        document.getElementById('task-date').valueAsDate = new Date();

        document.getElementById('modal-task').classList.add('active');
    },

    async saveTask() {
        const data = {
            location_id: parseInt(document.getElementById('task-location').value),
            assigned_to: parseInt(document.getElementById('task-staff').value),
            due_date: document.getElementById('task-date').value,
            priority: document.getElementById('task-priority').value,
            notes: document.getElementById('task-notes').value
        };

        this.showLoading();

        try {
            await API.tasks.create(data);
            this.toast('Görev oluşturuldu', 'success');
            this.closeModals();
            await this.loadTasks();
        } catch (error) {
            this.toast(error.message, 'error');
        } finally {
            this.hideLoading();
        }
    },

    // Reject Modal
    rejectingTaskId: null,

    showRejectModal(taskId) {
        this.rejectingTaskId = taskId;
        document.getElementById('reject-reason').value = '';
        document.getElementById('modal-reject').classList.add('active');
    },

    async confirmReject() {
        const reason = document.getElementById('reject-reason').value;

        if (!reason.trim()) {
            this.toast('Red nedeni yazmalısınız', 'error');
            return;
        }

        this.showLoading();

        try {
            await API.tasks.reject(this.rejectingTaskId, reason);
            this.toast('Görev reddedildi', 'success');
            this.closeModals();
            await this.loadPageData(this.currentPage);
        } catch (error) {
            this.toast(error.message, 'error');
        } finally {
            this.hideLoading();
        }
    },

    // Schedules
    async loadSchedules() {
        const data = await API.schedules.weekly();

        const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
        const dayNames = {
            mon: 'Pazartesi',
            tue: 'Salı',
            wed: 'Çarşamba',
            thu: 'Perşembe',
            fri: 'Cuma',
            sat: 'Cumartesi',
            sun: 'Pazar'
        };

        let html = '<div class="schedule-grid">';

        // Header
        html += '<div class="schedule-header">Personel</div>';
        days.forEach(day => {
            html += `<div class="schedule-header">${dayNames[day]}</div>`;
        });

        // Rows
        data.schedules.forEach(row => {
            html += `<div class="schedule-cell schedule-staff">${row.staff_name}</div>`;
            days.forEach(day => {
                const items = row[day] || [];
                html += '<div class="schedule-cell">';
                items.forEach(item => {
                    html += `<div class="schedule-item" title="${item.building_name}">${item.location_name}</div>`;
                });
                html += '</div>';
            });
        });

        html += '</div>';

        if (data.schedules.length === 0) {
            html = `
                <div class="empty-state">
                    <div class="empty-state-icon">📅</div>
                    <div class="empty-state-title">Program bulunamadı</div>
                    <p>Henüz haftalık program oluşturulmamış.</p>
                </div>
            `;
        }

        document.getElementById('schedule-calendar').innerHTML = html;
    },

    async showScheduleModal() {
        const [rooms, staff] = await Promise.all([
            API.locations.rooms(),
            API.users.staff()
        ]);

        const staffSelect = document.getElementById('schedule-staff');
        staffSelect.innerHTML = staff.map(s =>
            `<option value="${s.id}">${s.full_name}</option>`
        ).join('');

        const locationsSelect = document.getElementById('schedule-locations');
        locationsSelect.innerHTML = rooms.map(r =>
            `<option value="${r.id}">${r.building_name} - ${r.name}</option>`
        ).join('');

        document.getElementById('schedule-from').valueAsDate = new Date();
        document.getElementById('schedule-until').value = '';
        document.querySelectorAll('[name="schedule-days"]').forEach(cb => cb.checked = false);

        document.getElementById('modal-schedule').classList.add('active');
    },

    async saveSchedule() {
        const days = Array.from(document.querySelectorAll('[name="schedule-days"]:checked'))
            .map(cb => cb.value);

        const locations = Array.from(document.getElementById('schedule-locations').selectedOptions)
            .map(opt => parseInt(opt.value));

        if (days.length === 0) {
            this.toast('En az bir gün seçmelisiniz', 'error');
            return;
        }

        if (locations.length === 0) {
            this.toast('En az bir lokasyon seçmelisiniz', 'error');
            return;
        }

        const data = {
            staff_id: parseInt(document.getElementById('schedule-staff').value),
            location_ids: locations,
            days: days,
            valid_from: document.getElementById('schedule-from').value,
            valid_until: document.getElementById('schedule-until').value || null
        };

        this.showLoading();

        try {
            await API.schedules.bulk(data);
            this.toast('Program oluşturuldu', 'success');
            this.closeModals();
            await this.loadSchedules();
        } catch (error) {
            this.toast(error.message, 'error');
        } finally {
            this.hideLoading();
        }
    },

    async generateTasks() {
        if (!confirm('Bugün için görevler oluşturulsun mu?')) return;

        this.showLoading();

        try {
            const result = await API.schedules.generateTasks();
            this.toast(result.message, 'success');
        } catch (error) {
            this.toast(error.message, 'error');
        } finally {
            this.hideLoading();
        }
    },

    // Locations
    async loadLocations() {
        const tree = await API.locations.tree();

        let html = '';

        tree.forEach(building => {
            html += `
                <div style="margin-bottom: 16px; padding: 16px; background: var(--gray-50); border-radius: 8px;">
                    <h3 style="margin-bottom: 12px;">🏢 ${building.name} (${building.code})</h3>
                    ${building.departments.map(dept => `
                        <div style="margin-left: 24px; margin-bottom: 12px;">
                            <h4 style="color: var(--gray-600);">📁 ${dept.name} ${dept.floor ? '(Kat ' + dept.floor + ')' : ''}</h4>
                            <div style="margin-left: 24px; display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;">
                                ${dept.locations.map(loc => `
                                    <span class="badge badge-gray">🚪 ${loc.name}</span>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        });

        if (tree.length === 0) {
            html = `
                <div class="empty-state">
                    <div class="empty-state-icon">📍</div>
                    <div class="empty-state-title">Mekan bulunamadı</div>
                    <p>Henüz bina/departman/oda eklenmemiş.</p>
                </div>
            `;
        }

        document.getElementById('location-tree').innerHTML = html;
    },

    async showLocationModal(type) {
        document.getElementById('location-type').value = type;
        document.getElementById('location-name').value = '';
        document.getElementById('location-code').value = '';
        document.getElementById('location-floor').value = '';

        const parentGroup = document.getElementById('location-parent-group');
        const codeGroup = document.getElementById('location-code-group');
        const floorGroup = document.getElementById('location-floor-group');
        const roomTypeGroup = document.getElementById('location-room-type-group');

        if (type === 'building') {
            document.getElementById('modal-location-title').textContent = 'Yeni Bina';
            parentGroup.classList.add('hidden');
            codeGroup.classList.remove('hidden');
            floorGroup.classList.add('hidden');
            roomTypeGroup.classList.add('hidden');
        } else if (type === 'department') {
            document.getElementById('modal-location-title').textContent = 'Yeni Departman';
            document.getElementById('location-parent-label').textContent = 'Bina';
            parentGroup.classList.remove('hidden');
            codeGroup.classList.add('hidden');
            floorGroup.classList.remove('hidden');
            roomTypeGroup.classList.add('hidden');

            const buildings = await API.locations.buildings();
            document.getElementById('location-parent').innerHTML = buildings.map(b =>
                `<option value="${b.id}">${b.name}</option>`
            ).join('');
        } else {
            document.getElementById('modal-location-title').textContent = 'Yeni Oda';
            document.getElementById('location-parent-label').textContent = 'Departman';
            parentGroup.classList.remove('hidden');
            codeGroup.classList.add('hidden');
            floorGroup.classList.add('hidden');
            roomTypeGroup.classList.remove('hidden');

            const departments = await API.locations.departments();
            document.getElementById('location-parent').innerHTML = departments.map(d =>
                `<option value="${d.id}">${d.building_name} - ${d.name}</option>`
            ).join('');
        }

        document.getElementById('modal-location').classList.add('active');
    },

    async saveLocation() {
        const type = document.getElementById('location-type').value;
        const name = document.getElementById('location-name').value;

        if (!name) {
            this.toast('Ad alanı zorunludur', 'error');
            return;
        }

        this.showLoading();

        try {
            if (type === 'building') {
                await API.locations.createBuilding({
                    name,
                    code: document.getElementById('location-code').value || name.substring(0, 3).toUpperCase()
                });
            } else if (type === 'department') {
                await API.locations.createDepartment({
                    building_id: parseInt(document.getElementById('location-parent').value),
                    name,
                    floor: document.getElementById('location-floor').value
                });
            } else {
                await API.locations.createRoom({
                    department_id: parseInt(document.getElementById('location-parent').value),
                    name,
                    type: document.getElementById('location-room-type').value
                });
            }

            this.toast('Kayıt oluşturuldu', 'success');
            this.closeModals();
            await this.loadLocations();
        } catch (error) {
            this.toast(error.message, 'error');
        } finally {
            this.hideLoading();
        }
    },

    // Users
    async loadUsers() {
        const users = await API.users.list();

        const roleNames = {
            super_admin: 'Super Admin',
            faculty_admin: 'Fakülte Admin',
            supervisor: 'Supervisor',
            staff: 'Personel'
        };

        const html = users.map(user => `
            <tr>
                <td>${user.full_name}</td>
                <td>${user.username}</td>
                <td><span class="badge badge-primary">${roleNames[user.role]}</span></td>
                <td>${user.faculty_name || '-'}</td>
                <td>
                    <span class="badge ${user.is_active ? 'badge-success' : 'badge-gray'}">
                        ${user.is_active ? 'Aktif' : 'Pasif'}
                    </span>
                </td>
                <td>
                    <button class="btn btn-ghost btn-sm" onclick="App.editUser(${user.id})">✏️</button>
                </td>
            </tr>
        `).join('');

        document.getElementById('users-table-body').innerHTML = html || '<tr><td colspan="6">Kullanıcı bulunamadı</td></tr>';
    },

    async showUserModal() {
        document.getElementById('modal-user-title').textContent = 'Yeni Kullanıcı';
        document.getElementById('user-id').value = '';
        document.getElementById('user-fullname').value = '';
        document.getElementById('user-username').value = '';
        document.getElementById('user-password').value = '';
        document.getElementById('user-role').value = 'staff';

        if (this.user.role === 'super_admin') {
            document.getElementById('user-faculty-group').classList.remove('hidden');
            const faculties = await API.faculties.list();
            document.getElementById('user-faculty').innerHTML = faculties.map(f =>
                `<option value="${f.id}">${f.name}</option>`
            ).join('');
        } else {
            document.getElementById('user-faculty-group').classList.add('hidden');
        }

        document.getElementById('modal-user').classList.add('active');
    },

    async editUser(userId) {
        const user = await API.users.get(userId);

        document.getElementById('modal-user-title').textContent = 'Kullanıcı Düzenle';
        document.getElementById('user-id').value = user.id;
        document.getElementById('user-fullname').value = user.full_name;
        document.getElementById('user-username').value = user.username;
        document.getElementById('user-password').value = '';
        document.getElementById('user-role').value = user.role;

        document.getElementById('modal-user').classList.add('active');
    },

    async saveUser() {
        const userId = document.getElementById('user-id').value;
        const data = {
            full_name: document.getElementById('user-fullname').value,
            username: document.getElementById('user-username').value,
            role: document.getElementById('user-role').value,
            is_active: true
        };

        const password = document.getElementById('user-password').value;
        if (password) data.password = password;

        if (this.user.role === 'super_admin') {
            data.faculty_id = parseInt(document.getElementById('user-faculty').value);
        }

        this.showLoading();

        try {
            if (userId) {
                await API.users.update(userId, data);
            } else {
                if (!password) {
                    this.toast('Şifre zorunludur', 'error');
                    return;
                }
                await API.users.create(data);
            }

            this.toast('Kullanıcı kaydedildi', 'success');
            this.closeModals();
            await this.loadUsers();
        } catch (error) {
            this.toast(error.message, 'error');
        } finally {
            this.hideLoading();
        }
    },

    // Reports
    async loadReports() {
        const [dashboard, weekly] = await Promise.all([
            API.reports.dashboard(),
            API.reports.weekly()
        ]);

        // Stats
        const statsHtml = `
            <div class="stat-card">
                <div class="stat-icon success">✅</div>
                <div class="stat-content">
                    <div class="stat-value">${weekly.summary.completed || 0}</div>
                    <div class="stat-label">Haftalık Tamamlanan</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon primary">📊</div>
                <div class="stat-content">
                    <div class="stat-value">${weekly.summary.completion_rate}</div>
                    <div class="stat-label">Tamamlanma Oranı</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon success">👍</div>
                <div class="stat-content">
                    <div class="stat-value">${weekly.summary.approved || 0}</div>
                    <div class="stat-label">Onaylanan</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon danger">👎</div>
                <div class="stat-content">
                    <div class="stat-value">${weekly.summary.rejected || 0}</div>
                    <div class="stat-label">Reddedilen</div>
                </div>
            </div>
        `;
        document.getElementById('report-stats').innerHTML = statsHtml;

        // Weekly by staff
        let weeklyHtml = '<table class="table"><thead><tr><th>Personel</th><th>Toplam</th><th>Tamamlanan</th><th>Onaylanan</th><th>Oran</th></tr></thead><tbody>';
        weekly.by_staff.forEach(s => {
            weeklyHtml += `<tr>
                <td>${s.full_name}</td>
                <td>${s.total}</td>
                <td>${s.completed}</td>
                <td>${s.approved}</td>
                <td>${s.rate}</td>
            </tr>`;
        });
        weeklyHtml += '</tbody></table>';

        if (weekly.by_staff.length === 0) {
            weeklyHtml = '<p style="color: var(--gray-500);">Bu hafta için veri bulunamadı.</p>';
        }

        document.getElementById('report-weekly').innerHTML = weeklyHtml;
    },

    exportCSV() {
        const today = new Date();
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay() + 1);

        const start = weekStart.toISOString().split('T')[0];
        const end = today.toISOString().split('T')[0];

        window.open(API.reports.export(start, end), '_blank');
    },

    // Faculties
    async loadFaculties() {
        const faculties = await API.faculties.list();

        const html = faculties.map(f => `
            <div class="stat-card" style="border-left: 4px solid ${f.color}">
                <div class="stat-content">
                    <div class="stat-value" style="font-size: 20px;">${f.name}</div>
                    <div class="stat-label">${f.code}</div>
                    <div style="margin-top: 8px; font-size: 14px; color: var(--gray-500);">
                        👥 ${f.user_count || 0} kullanıcı &nbsp;|&nbsp; 🏢 ${f.building_count || 0} bina
                    </div>
                </div>
            </div>
        `).join('');

        document.getElementById('faculties-grid').innerHTML = html || '<p>Fakülte bulunamadı</p>';
    },

    // Utilities
    closeModals() {
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
    },

    showLoading() {
        document.getElementById('loading-overlay').classList.add('active');
    },

    hideLoading() {
        document.getElementById('loading-overlay').classList.remove('active');
    },

    toast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => toast.remove(), 4000);
    },

    formatDate(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('tr-TR');
    },

    // PWA
    setupPWA() {
        let deferredPrompt;

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            document.getElementById('install-banner').classList.add('show');
        });

        document.getElementById('btn-install').addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                deferredPrompt = null;
                document.getElementById('install-banner').classList.remove('show');
            }
        });

        document.getElementById('btn-dismiss-install').addEventListener('click', () => {
            document.getElementById('install-banner').classList.remove('show');
        });
    },

    setupOfflineDetection() {
        const banner = document.getElementById('offline-banner');

        const updateOnlineStatus = () => {
            if (navigator.onLine) {
                banner.classList.remove('show');
            } else {
                banner.classList.add('show');
            }
        };

        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);
    }
};

// App başlat
document.addEventListener('DOMContentLoaded', () => App.init());

// Global olarak kullanılabilir yap
window.App = App;
