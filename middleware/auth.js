// Kimlik doğrulama middleware'i

// Oturum kontrolü
const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Oturum açmanız gerekiyor' });
    }
    next();
};

// Rol kontrolü
const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.session.user) {
            return res.status(401).json({ error: 'Oturum açmanız gerekiyor' });
        }

        if (!roles.includes(req.session.user.role)) {
            return res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });
        }

        next();
    };
};

// Super Admin kontrolü
const requireSuperAdmin = (req, res, next) => {
    if (!req.session.user || req.session.user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Bu işlem için Super Admin yetkisi gerekiyor' });
    }
    next();
};

// Faculty Admin veya üstü
const requireFacultyAdmin = (req, res, next) => {
    const allowedRoles = ['super_admin', 'faculty_admin'];
    if (!req.session.user || !allowedRoles.includes(req.session.user.role)) {
        return res.status(403).json({ error: 'Bu işlem için Admin yetkisi gerekiyor' });
    }
    next();
};

// Supervisor veya üstü
const requireSupervisor = (req, res, next) => {
    const allowedRoles = ['super_admin', 'faculty_admin', 'supervisor'];
    if (!req.session.user || !allowedRoles.includes(req.session.user.role)) {
        return res.status(403).json({ error: 'Bu işlem için Supervisor yetkisi gerekiyor' });
    }
    next();
};

// Fakülte bazlı erişim kontrolü
const requireSameFaculty = (req, res, next) => {
    const user = req.session.user;

    // Super admin her şeye erişebilir
    if (user.role === 'super_admin') {
        return next();
    }

    // faculty_id parametresi veya kullanıcının fakültesi
    const targetFacultyId = parseInt(req.params.facultyId || req.query.faculty_id || req.body.faculty_id);

    if (targetFacultyId && targetFacultyId !== user.faculty_id) {
        return res.status(403).json({ error: 'Başka fakültenin verilerine erişemezsiniz' });
    }

    next();
};

module.exports = {
    requireAuth,
    requireRole,
    requireSuperAdmin,
    requireFacultyAdmin,
    requireSupervisor,
    requireSameFaculty
};
