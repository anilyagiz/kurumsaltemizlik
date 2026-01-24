// API İstemci Modülü
const API = {
    baseUrl: '/api',

    // HTTP istekleri
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            ...options,
        };

        if (options.body && typeof options.body === 'object') {
            config.body = JSON.stringify(options.body);
        }

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Bir hata oluştu');
            }

            return data;
        } catch (error) {
            if (error.name === 'TypeError') {
                throw new Error('Sunucuya bağlanılamadı');
            }
            throw error;
        }
    },

    get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    },

    post(endpoint, body) {
        return this.request(endpoint, { method: 'POST', body });
    },

    put(endpoint, body) {
        return this.request(endpoint, { method: 'PUT', body });
    },

    delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    },

    // Auth
    auth: {
        login: (username, password) => API.post('/auth/login', { username, password }),
        logout: () => API.post('/auth/logout'),
        me: () => API.get('/auth/me'),
    },

    // Faculties
    faculties: {
        list: () => API.get('/faculties'),
        get: (id) => API.get(`/faculties/${id}`),
        create: (data) => API.post('/faculties', data),
        update: (id, data) => API.put(`/faculties/${id}`, data),
        delete: (id) => API.delete(`/faculties/${id}`),
    },

    // Users
    users: {
        list: (params = {}) => {
            const query = new URLSearchParams(params).toString();
            return API.get(`/users${query ? '?' + query : ''}`);
        },
        staff: () => API.get('/users/staff'),
        get: (id) => API.get(`/users/${id}`),
        create: (data) => API.post('/users', data),
        update: (id, data) => API.put(`/users/${id}`, data),
        delete: (id) => API.delete(`/users/${id}`),
    },

    // Locations
    locations: {
        buildings: (params = {}) => {
            const query = new URLSearchParams(params).toString();
            return API.get(`/locations/buildings${query ? '?' + query : ''}`);
        },
        departments: (params = {}) => {
            const query = new URLSearchParams(params).toString();
            return API.get(`/locations/departments${query ? '?' + query : ''}`);
        },
        rooms: (params = {}) => {
            const query = new URLSearchParams(params).toString();
            return API.get(`/locations/rooms${query ? '?' + query : ''}`);
        },
        tree: () => API.get('/locations/tree'),
        createBuilding: (data) => API.post('/locations/buildings', data),
        createDepartment: (data) => API.post('/locations/departments', data),
        createRoom: (data) => API.post('/locations/rooms', data),
        updateBuilding: (id, data) => API.put(`/locations/buildings/${id}`, data),
        updateDepartment: (id, data) => API.put(`/locations/departments/${id}`, data),
        updateRoom: (id, data) => API.put(`/locations/rooms/${id}`, data),
        deleteBuilding: (id) => API.delete(`/locations/buildings/${id}`),
        deleteDepartment: (id) => API.delete(`/locations/departments/${id}`),
        deleteRoom: (id) => API.delete(`/locations/rooms/${id}`),
    },

    // Tasks
    tasks: {
        list: (params = {}) => {
            const query = new URLSearchParams(params).toString();
            return API.get(`/tasks${query ? '?' + query : ''}`);
        },
        today: () => API.get('/tasks/today'),
        pendingApproval: () => API.get('/tasks/pending-approval'),
        get: (id) => API.get(`/tasks/${id}`),
        create: (data) => API.post('/tasks', data),
        start: (id) => API.put(`/tasks/${id}/start`),
        complete: (id, notes) => API.put(`/tasks/${id}/complete`, { notes }),
        approve: (id) => API.put(`/tasks/${id}/approve`),
        reject: (id, reason) => API.put(`/tasks/${id}/reject`, { rejection_reason: reason }),
        delete: (id) => API.delete(`/tasks/${id}`),
    },

    // Schedules
    schedules: {
        list: (params = {}) => {
            const query = new URLSearchParams(params).toString();
            return API.get(`/schedules${query ? '?' + query : ''}`);
        },
        weekly: () => API.get('/schedules/weekly'),
        create: (data) => API.post('/schedules', data),
        bulk: (data) => API.post('/schedules/bulk', data),
        update: (id, data) => API.put(`/schedules/${id}`, data),
        delete: (id) => API.delete(`/schedules/${id}`),
        generateTasks: (date) => API.post('/schedules/generate-tasks', { date }),
        holidays: () => API.get('/schedules/holidays'),
    },

    // Reports
    reports: {
        daily: (date) => API.get(`/reports/daily${date ? '?date=' + date : ''}`),
        weekly: (start) => API.get(`/reports/weekly${start ? '?start=' + start : ''}`),
        monthly: (month) => API.get(`/reports/monthly${month ? '?month=' + month : ''}`),
        dashboard: () => API.get('/reports/dashboard'),
        export: (start, end) => `/api/reports/export?start=${start}&end=${end}`,
    },
};

// Global olarak kullanılabilir yap
window.API = API;
