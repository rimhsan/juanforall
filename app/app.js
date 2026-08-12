/* juanforall Barangay Portal Application Script */

// --- Default Initial Data ---
const DEFAULT_USER = {
    firstName: 'Barangay',
    lastName: 'Official',
    email: 'official@juanforall.gov.ph',
    role: 'Barangay Official',
    purok: 'Purok 1',
    phone: '',
    photo: null
};

const INITIAL_ANNOUNCEMENTS = [];
const INITIAL_COMPLAINTS = [];
const INITIAL_COURT_BOOKINGS = [];
const INITIAL_SUMMONS = [];
const INITIAL_RESIDENTS = [];

// --- Helper Functions & Role Enforcement ---
function isOfficial(user = currentUser) {
    if (!user || !user.role) return false;
    const officialRoles = ['Barangay Official', 'Barangay Captain', 'Kagawad', 'SK Chairman', 'Barangay Tanod', 'Staff', 'Admin'];
    return officialRoles.includes(user.role);
}

function isComplaintOwner(complaint, user = currentUser) {
    if (!complaint || !user) return false;
    const currentFullName = `${user.firstName || ''} ${user.lastName || ''}`.trim().toLowerCase();
    const complainantName = (complaint.complainant || '').trim().toLowerCase();
    const complainantEmail = (complaint.complainantEmail || '').trim().toLowerCase();
    const userEmail = (user.email || '').trim().toLowerCase();
    
    return (complainantName && complainantName === currentFullName) ||
           (userEmail && complainantEmail && userEmail === complainantEmail);
}

function isBookingOwner(booking, user = currentUser) {
    if (!booking || !user) return false;
    const currentFullName = `${user.firstName || ''} ${user.lastName || ''}`.trim().toLowerCase();
    const bookerName = (booking.booker || '').trim().toLowerCase();
    const bookerEmail = (booking.bookerEmail || '').trim().toLowerCase();
    const userEmail = (user.email || '').trim().toLowerCase();

    return (bookerName && bookerName === currentFullName) ||
           (userEmail && bookerEmail && userEmail === bookerEmail) ||
           (bookerName && bookerName.includes(currentFullName));
}

function getStorage(key, fallback) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : fallback;
    } catch (e) {
        return fallback;
    }
}

function setStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        console.error('LocalStorage error:', e);
    }
}

function formatStatus(status) {
    if (!status) return '';
    const s = String(status).trim().toLowerCase();
    if (s === 'pending') return 'Pending';
    if (s === 'progress' || s === 'in progress' || s === 'in_progress') return 'In Progress';
    if (s === 'resolved') return 'Resolved';
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatTime12Hour(timeStr) {
    if (!timeStr) return '';
    if (/AM|PM/i.test(timeStr)) return timeStr;
    const parts = String(timeStr).trim().split(':');
    if (parts.length < 2) return timeStr;
    let hours = parseInt(parts[0], 10);
    const minutes = parts[1];
    if (isNaN(hours)) return timeStr;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    if (hours === 0) hours = 12;
    return `${hours}:${minutes} ${ampm}`;
}

// --- App State & Legacy Data Clean Cleanup ---
function clearLegacyDemoData() {
    const legacyDemoIds = ['ann-1', 'ann-2', 'ann-3', 'cmp-1', 'cmp-2', 'cmp-3', 'bk-1', 'bk-2', 'sum-1', 'sum-2'];
    
    let announcements = getStorage('jfa_announcements', []);
    if (announcements.some(a => legacyDemoIds.includes(a.id))) {
        setStorage('jfa_announcements', announcements.filter(a => !legacyDemoIds.includes(a.id)));
    }
    
    let complaints = getStorage('jfa_complaints', []);
    if (complaints.some(c => legacyDemoIds.includes(c.id))) {
        setStorage('jfa_complaints', complaints.filter(c => !legacyDemoIds.includes(c.id)));
    }
    
    let courtBookings = getStorage('jfa_court_bookings', []);
    if (courtBookings.some(b => legacyDemoIds.includes(b.id))) {
        setStorage('jfa_court_bookings', courtBookings.filter(b => !legacyDemoIds.includes(b.id)));
    }

    let summonsList = getStorage('jfa_summons', []);
    if (summonsList.some(s => legacyDemoIds.includes(s.id))) {
        setStorage('jfa_summons', summonsList.filter(s => !legacyDemoIds.includes(s.id)));
    }

    let residents = getStorage('jfa_residents', []);
    if (residents.some(r => r.name === 'Maria Santos' || r.name === 'Pedro Penduko' || r.name === 'Juan Dela Cruz')) {
        setStorage('jfa_residents', []);
    }
}
clearLegacyDemoData();

let currentUser = getStorage('jfa_user', DEFAULT_USER);
let announcements = getStorage('jfa_announcements', INITIAL_ANNOUNCEMENTS);
let complaints = getStorage('jfa_complaints', INITIAL_COMPLAINTS);
let courtBookings = getStorage('jfa_court_bookings', INITIAL_COURT_BOOKINGS);
let summonsList = getStorage('jfa_summons', INITIAL_SUMMONS);
let currentCalendarMonth = new Date();
let currentComplaintFilter = 'all';
let complaintToDeleteId = null;

// --- Update Dashboard Stats ---
function updateDashboardStats() {
    const statResidents = document.getElementById('stat-residents');
    const statComplaints = document.getElementById('stat-complaints');
    const statSummons = document.getElementById('stat-summons');
    const statCourt = document.getElementById('stat-court');

    const residents = getStorage('jfa_residents', []);

    if (statResidents) {
        statResidents.textContent = residents ? residents.length : 0;
    }
    if (statComplaints) {
        const activeCount = complaints ? complaints.filter(c => c.status === 'pending' || c.status === 'progress').length : 0;
        statComplaints.textContent = activeCount;
    }
    if (statSummons) {
        statSummons.textContent = summonsList ? summonsList.length : 0;
    }
    if (statCourt) {
        statCourt.textContent = courtBookings ? courtBookings.length : 0;
    }
}

// --- Window Exported Functions ---

// 1. Navigation & Dropdowns
window.toggleSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.toggle('active');
        sidebar.classList.toggle('open');
    }
};

window.toggleProfileDropdown = function(event) {
    if (event) {
        event.stopPropagation();
    }
    const dropdown = document.getElementById('profileDropdown');
    if (dropdown) {
        dropdown.classList.toggle('show');
    }
};

// Close profile dropdown when clicking outside
document.addEventListener('click', function(e) {
    const dropdown = document.getElementById('profileDropdown');
    const trigger = document.querySelector('.user-profile-trigger');
    if (dropdown && dropdown.classList.contains('show')) {
        if (!dropdown.contains(e.target) && (!trigger || !trigger.contains(e.target))) {
            dropdown.classList.remove('show');
        }
    }
});

window.handleLogout = function() {
    localStorage.removeItem('jfa_user');
    window.location.href = 'login.html';
};

window.openModal = function(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.add('active');
        modal.classList.add('show');
        modal.style.display = 'flex';
    }
};

window.closeModal = function(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.remove('active');
        modal.classList.remove('show');
        modal.style.display = 'none';
    }
};

window.showToast = function(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `
        padding: 12px 20px;
        margin-top: 8px;
        border-radius: 8px;
        color: #fff;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        font-size: 0.9rem;
        display: flex;
        align-items: center;
        gap: 8px;
        animation: fadeIn 0.3s ease;
    `;
    toast.innerHTML = `<i class="${type === 'success' ? 'ri-checkbox-circle-line' : type === 'error' ? 'ri-error-warning-line' : 'ri-information-line'}"></i> ${message}`;
    
    container.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, 3500);
};

// 2. User & Profile UI Binding
function updateHeaderUserInfo() {
    if (!currentUser) return;
    const initials = (currentUser.firstName[0] || 'J') + (currentUser.lastName[0] || 'D');
    
    const userAvatar = document.getElementById('user-avatar');
    const userName = document.getElementById('user-name');
    const userRole = document.getElementById('user-role');
    const dropdownAvatar = document.getElementById('dropdown-avatar');
    const dropdownName = document.getElementById('dropdown-name');
    const dropdownEmail = document.getElementById('dropdown-email');
    const dropdownRoleTag = document.getElementById('dropdown-role-tag');

    if (userAvatar) {
        if (currentUser.photo) {
            userAvatar.innerHTML = `<img src="${currentUser.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        } else {
            userAvatar.textContent = initials;
        }
    }
    if (userName) userName.textContent = `${currentUser.firstName} ${currentUser.lastName}`;
    if (userRole) userRole.textContent = currentUser.role || 'Resident';

    if (dropdownAvatar) {
        if (currentUser.photo) {
            dropdownAvatar.innerHTML = `<img src="${currentUser.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        } else {
            dropdownAvatar.textContent = initials;
        }
    }
    if (dropdownName) dropdownName.textContent = `${currentUser.firstName} ${currentUser.lastName}`;
    if (dropdownEmail) dropdownEmail.textContent = currentUser.email || '';
    if (dropdownRoleTag) dropdownRoleTag.textContent = currentUser.role || 'Resident';

    // Show admin options if official or staff
    const isAdmin = isOfficial();
    
    const addAnnouncementBtn = document.getElementById('add-announcement-btn');
    if (addAnnouncementBtn) addAnnouncementBtn.style.display = isAdmin ? 'inline-flex' : 'none';

    const scheduleSummonsBtn = document.getElementById('schedule-summons-btn');
    if (scheduleSummonsBtn) scheduleSummonsBtn.style.display = isAdmin ? 'inline-flex' : 'none';

    const adminBadge = document.getElementById('admin-badge');
    if (adminBadge) adminBadge.style.display = isAdmin ? 'inline-block' : 'none';

    const adminCourtSidebar = document.getElementById('admin-court-sidebar');
    if (adminCourtSidebar) adminCourtSidebar.style.display = isAdmin ? 'block' : 'none';
}

// 3. Account Page
window.switchAccountTab = function(tabName, el) {
    document.querySelectorAll('.account-nav button').forEach(btn => btn.classList.remove('active'));
    if (el) el.classList.add('active');

    document.querySelectorAll('.account-section').forEach(sec => sec.classList.remove('active'));
    const target = document.getElementById(`tab-${tabName}`);
    if (target) target.classList.add('active');
};

function initAccountPage() {
    const firstNameInput = document.getElementById('acc-first-name');
    if (!firstNameInput) return; // Not on account page

    firstNameInput.value = currentUser.firstName || '';
    document.getElementById('acc-last-name').value = currentUser.lastName || '';
    document.getElementById('acc-email').value = currentUser.email || '';
    
    const roleSelect = document.getElementById('acc-role');
    if (roleSelect) {
        roleSelect.value = currentUser.role || 'Resident';
        if (!isOfficial()) {
            roleSelect.disabled = true;
            roleSelect.title = 'Only Barangay Officials can change account roles';
        } else {
            roleSelect.disabled = false;
            roleSelect.title = '';
        }
    }

    if (document.getElementById('acc-purok')) document.getElementById('acc-purok').value = currentUser.purok || 'Purok 1';
    if (document.getElementById('acc-phone')) document.getElementById('acc-phone').value = currentUser.phone || '';

    const avatarPreview = document.getElementById('acc-avatar-preview');
    const removePhotoBtn = document.getElementById('remove-photo-btn');
    if (avatarPreview) {
        if (currentUser.photo) {
            avatarPreview.innerHTML = `<img src="${currentUser.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
            if (removePhotoBtn) removePhotoBtn.style.display = 'inline-flex';
        } else {
            avatarPreview.textContent = (currentUser.firstName[0] || 'J') + (currentUser.lastName[0] || 'D');
            if (removePhotoBtn) removePhotoBtn.style.display = 'none';
        }
    }

    renderMyComplaints();
}

window.handleProfilePhotoUpload = function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        currentUser.photo = e.target.result;
        setStorage('jfa_user', currentUser);
        updateHeaderUserInfo();
        initAccountPage();
        showToast('Profile photo updated successfully', 'success');
    };
    reader.readAsDataURL(file);
};

window.removeProfilePhoto = function() {
    currentUser.photo = null;
    setStorage('jfa_user', currentUser);
    updateHeaderUserInfo();
    initAccountPage();
    showToast('Profile photo removed', 'info');
};

window.saveAccountProfile = function() {
    const oldEmail = currentUser.email;
    currentUser.firstName = document.getElementById('acc-first-name').value.trim() || currentUser.firstName;
    currentUser.lastName = document.getElementById('acc-last-name').value.trim() || currentUser.lastName;
    currentUser.email = document.getElementById('acc-email').value.trim() || currentUser.email;
    
    const roleSelect = document.getElementById('acc-role');
    if (roleSelect) {
        const requestedRole = roleSelect.value;
        if (!isOfficial() && requestedRole !== currentUser.role) {
            showToast('Permission Denied: Only Barangay Officials can change account roles', 'error');
            roleSelect.value = currentUser.role;
        } else {
            currentUser.role = requestedRole || currentUser.role;
        }
    }

    currentUser.purok = document.getElementById('acc-purok').value || currentUser.purok;
    currentUser.phone = document.getElementById('acc-phone').value.trim() || currentUser.phone;

    setStorage('jfa_user', currentUser);

    // Sync to residents directory
    let residents = getStorage('jfa_residents', []);
    const fullName = `${currentUser.firstName} ${currentUser.lastName}`.trim();
    let residentIdx = residents.findIndex(r => r.email === oldEmail || r.email === currentUser.email);
    if (residentIdx !== -1) {
        residents[residentIdx] = {
            name: fullName,
            purok: currentUser.purok,
            role: currentUser.role || 'Resident',
            phone: currentUser.phone || 'N/A',
            email: currentUser.email
        };
    } else {
        residents.push({
            name: fullName,
            purok: currentUser.purok,
            role: currentUser.role || 'Resident',
            phone: currentUser.phone || 'N/A',
            email: currentUser.email
        });
    }
    setStorage('jfa_residents', residents);

    updateHeaderUserInfo();
    showToast('Account details saved successfully!', 'success');
};

window.changeAccountPassword = function() {
    const currentPass = document.getElementById('acc-current-pass').value;
    const newPass = document.getElementById('acc-new-pass').value;
    const confirmPass = document.getElementById('acc-confirm-pass').value;

    if (!currentPass) {
        showToast('Please enter your current password', 'error');
        return;
    }
    if (newPass.length < 6) {
        showToast('New password must be at least 6 characters long', 'error');
        return;
    }
    if (newPass !== confirmPass) {
        showToast('New passwords do not match', 'error');
        return;
    }

    document.getElementById('acc-current-pass').value = '';
    document.getElementById('acc-new-pass').value = '';
    document.getElementById('acc-confirm-pass').value = '';
    showToast('Password updated successfully!', 'success');
};

window.openDeleteComplaintModal = function(id) {
    const item = complaints.find(c => c.id === id);
    if (item && !isOfficial() && !isComplaintOwner(item)) {
        showToast('Permission Denied: You can only remove your own complaints', 'error');
        return;
    }
    complaintToDeleteId = id;
    openModal('deleteComplaintModal');
};

window.confirmRemoveComplaint = function() {
    if (complaintToDeleteId) {
        const item = complaints.find(c => c.id === complaintToDeleteId);
        if (item && !isOfficial() && !isComplaintOwner(item)) {
            showToast('Permission Denied: You can only remove your own complaints', 'error');
            complaintToDeleteId = null;
            closeModal('deleteComplaintModal');
            return;
        }
        complaints = complaints.filter(c => c.id !== complaintToDeleteId);
        setStorage('jfa_complaints', complaints);
        complaintToDeleteId = null;
        closeModal('deleteComplaintModal');
        renderComplaints();
        renderMyComplaints();
        showToast('Complaint removed', 'info');
    }
};

function renderMyComplaints() {
    const container = document.getElementById('my-complaints-list');
    if (!container) return;

    const myComplaints = complaints.filter(c => isComplaintOwner(c));
    if (myComplaints.length === 0) {
        container.innerHTML = `<p style="text-align:center; color:var(--text-muted); padding:30px;">You haven't filed any complaints yet.</p>`;
        return;
    }

    container.innerHTML = myComplaints.map(c => `
        <div class="card" style="margin-bottom:12px; padding:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <span class="badge badge-${c.status === 'resolved' ? 'success' : c.status === 'progress' ? 'warning' : 'info'}">${formatStatus(c.status)}</span>
                <span style="font-size:0.8rem; color:var(--text-muted);">${c.date}</span>
            </div>
            <h4 style="font-size:1rem; font-weight:700; margin-bottom:4px;">${c.title}</h4>
            <p style="font-size:0.88rem; color:var(--text-muted); margin-bottom:8px;">${c.description}</p>
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="font-size:0.8rem; color:var(--primary);"><i class="ri-map-pin-line"></i> ${c.purok} &bull; ${c.category}</div>
                ${c.status === 'pending' || isOfficial() ? `<button class="btn btn-sm btn-outline" style="color:#ef4444; border-color:#fca5a5;" onclick="openDeleteComplaintModal('${c.id}')"><i class="ri-delete-bin-line"></i> Remove</button>` : ''}
            </div>
        </div>
    `).join('');
}

// 4. Announcements
function renderAnnouncements() {
    const list = document.getElementById('announcementsList');
    const recent = document.getElementById('recent-announcements');

    if (recent) {
        if (announcements.length === 0) {
            recent.innerHTML = `<p style="text-align:center; color:#7f8c8d; padding:20px;">No recent announcements.</p>`;
        } else {
            recent.innerHTML = announcements.slice(0, 3).map(a => `
                <div class="announcement-item" style="padding:12px 0; border-bottom:1px solid var(--border-color);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                        <span class="badge badge-info" style="font-size:0.75rem;">${a.category.toUpperCase()}</span>
                        <span style="font-size:0.8rem; color:var(--text-muted);">${a.date}</span>
                    </div>
                    <h4 style="font-size:0.95rem; font-weight:700; margin-bottom:4px;">${a.title}</h4>
                    <p style="font-size:0.85rem; color:var(--text-muted); line-height:1.4;">${a.content}</p>
                </div>
            `).join('');
        }
    }

    if (list) {
        if (announcements.length === 0) {
            list.innerHTML = `<p style="text-align:center; color:#7f8c8d; padding:60px 20px;">No announcements available.</p>`;
            return;
        }
        const isAdmin = isOfficial();

        list.innerHTML = announcements.map(a => `
            <div class="card" style="margin-bottom:16px;">
                <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span class="badge badge-info">${a.category.toUpperCase()}</span>
                        <span style="font-size:0.85rem; color:var(--text-muted);"><i class="ri-calendar-line"></i> ${a.date}</span>
                    </div>
                    ${isAdmin ? `
                        <button class="btn btn-sm btn-outline" onclick="deleteAnnouncement('${a.id}')" style="color:#ef4444; border-color:#fca5a5;">
                            <i class="ri-delete-bin-line"></i> Delete
                        </button>
                    ` : ''}
                </div>
                <div class="card-body" style="padding:16px;">
                    <h3 style="font-size:1.1rem; font-weight:700; margin-bottom:8px; color:#0f172a;">${a.title}</h3>
                    <p style="font-size:0.92rem; color:#475569; line-height:1.6; white-space:pre-line;">${a.content}</p>
                    <div style="margin-top:12px; font-size:0.8rem; color:var(--text-muted);">Posted by: ${a.author}</div>
                </div>
            </div>
        `).join('');
    }
}

window.openAnnouncementModal = function(id = null) {
    if (!isOfficial()) {
        showToast('Permission Denied: Only Barangay Officials can post announcements', 'error');
        return;
    }
    document.getElementById('announcement-edit-id').value = id || '';
    document.getElementById('announcement-title').value = '';
    document.getElementById('announcement-category').value = 'general';
    document.getElementById('announcement-content').value = '';
    openModal('announcementModal');
};

window.saveAnnouncement = function() {
    if (!isOfficial()) {
        showToast('Permission Denied: Only Barangay Officials can post announcements', 'error');
        return;
    }
    const title = document.getElementById('announcement-title').value.trim();
    const category = document.getElementById('announcement-category').value;
    const content = document.getElementById('announcement-content').value.trim();

    if (!title || !content) {
        showToast('Please fill in required fields (*)', 'error');
        return;
    }

    const newAnn = {
        id: 'ann-' + Date.now(),
        title,
        category,
        content,
        date: new Date().toISOString().split('T')[0],
        author: `${currentUser.firstName} ${currentUser.lastName}`
    };

    announcements.unshift(newAnn);
    setStorage('jfa_announcements', announcements);
    closeModal('announcementModal');
    renderAnnouncements();
    showToast('Announcement posted successfully!', 'success');
};

window.deleteAnnouncement = function(id) {
    if (!isOfficial()) {
        showToast('Permission Denied: Only Barangay Officials can delete announcements', 'error');
        return;
    }
    if (id) {
        announcements = announcements.filter(a => a.id !== id);
        setStorage('jfa_announcements', announcements);
        renderAnnouncements();
        showToast('Announcement deleted', 'info');
    }
};

// 5. Complaints
function renderComplaints() {
    updateDashboardStats();
    const list = document.getElementById('complaintList');
    const recent = document.getElementById('recent-complaints');

    if (recent) {
        if (complaints.length === 0) {
            recent.innerHTML = `<p style="text-align:center; color:#7f8c8d; padding:20px;">No complaints filed.</p>`;
        } else {
            recent.innerHTML = complaints.slice(0, 3).map(c => `
                <div style="padding:10px 0; border-bottom:1px solid var(--border-color);">
                    <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                        <span style="font-weight:600; font-size:0.9rem;">${c.title}</span>
                        <span class="badge badge-${c.status === 'resolved' ? 'success' : c.status === 'progress' ? 'warning' : 'info'}" style="font-size:0.7rem;">${formatStatus(c.status)}</span>
                    </div>
                    <div style="font-size:0.8rem; color:var(--text-muted);">${c.purok} &bull; ${c.date}</div>
                </div>
            `).join('');
        }
    }

    if (list) {
        let filtered = complaints;
        if (currentComplaintFilter !== 'all') {
            filtered = complaints.filter(c => c.status === currentComplaintFilter);
        }

        if (filtered.length === 0) {
            list.innerHTML = `<p style="text-align:center; color:#7f8c8d; padding:60px 20px;">No complaints match this filter.</p>`;
            return;
        }

        const isAdmin = isOfficial();

        list.innerHTML = filtered.map(c => {
            const canDelete = isAdmin || isComplaintOwner(c);
            return `
                <div class="card" style="margin-bottom:16px; padding:16px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px; flex-wrap:wrap; gap:8px;">
                        <div>
                            <span class="badge badge-${c.status === 'resolved' ? 'success' : c.status === 'progress' ? 'warning' : 'info'}">${formatStatus(c.status)}</span>
                            <span class="badge" style="background:#e2e8f0; color:#334155; margin-left:6px;">${c.category}</span>
                        </div>
                        <span style="font-size:0.82rem; color:var(--text-muted);"><i class="ri-calendar-line"></i> ${c.date}</span>
                    </div>
                    <h3 style="font-size:1.05rem; font-weight:700; margin-bottom:6px;">${c.title}</h3>
                    <p style="font-size:0.9rem; color:#475569; margin-bottom:12px; line-height:1.5;">${c.description}</p>
                    <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.82rem; color:var(--text-muted); border-top:1px solid #f1f5f9; padding-top:10px;">
                        <span><i class="ri-user-line"></i> Filed by: ${c.complainant} (${c.purok})</span>
                        <div style="display:flex; gap:6px;">
                            ${isAdmin ? `
                                ${c.status !== 'resolved' ? `<button class="btn btn-sm btn-primary" onclick="updateComplaintStatus('${c.id}', 'resolved')">Mark Resolved</button>` : ''}
                                ${c.status === 'pending' ? `<button class="btn btn-sm btn-outline" onclick="updateComplaintStatus('${c.id}', 'progress')">In Progress</button>` : ''}
                            ` : ''}
                            ${canDelete ? `
                                <button class="btn btn-sm btn-outline" style="color:#ef4444; border-color:#fca5a5;" onclick="openDeleteComplaintModal('${c.id}')"><i class="ri-delete-bin-line"></i> Remove</button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
}

window.filterComplaints = function(status, el) {
    currentComplaintFilter = status;
    document.querySelectorAll('.filter-tab').forEach(tab => tab.classList.remove('active'));
    if (el) el.classList.add('active');
    renderComplaints();
};

window.submitComplaint = function() {
    const category = document.getElementById('complaint-category').value;
    const title = document.getElementById('complaint-title').value.trim();
    const desc = document.getElementById('complaint-desc').value.trim();
    const purok = document.getElementById('complaint-purok').value;

    if (!category || !title || !desc || !purok) {
        showToast('Please fill in all required fields', 'error');
        return;
    }

    const newComplaint = {
        id: 'cmp-' + Date.now(),
        category,
        title,
        description: desc,
        purok,
        status: 'pending',
        date: new Date().toISOString().split('T')[0],
        complainant: `${currentUser.firstName} ${currentUser.lastName}`,
        complainantEmail: currentUser.email || ''
    };

    complaints.unshift(newComplaint);
    setStorage('jfa_complaints', complaints);
    closeModal('complaintModal');
    renderComplaints();
    renderMyComplaints();
    showToast('Complaint submitted successfully!', 'success');
};

window.updateComplaintStatus = function(id, newStatus) {
    if (!isOfficial()) {
        showToast('Permission Denied: Only Barangay Officials can update complaint status', 'error');
        return;
    }
    const item = complaints.find(c => c.id === id);
    if (item) {
        item.status = newStatus;
        setStorage('jfa_complaints', complaints);
        renderComplaints();
        showToast(`Complaint status updated to ${formatStatus(newStatus)}`, 'success');
    }
};

// 6. Court Booking
window.changeMonth = function(delta) {
    currentCalendarMonth.setMonth(currentCalendarMonth.getMonth() + delta);
    initCalendar(true);
};

window.initCalendar = function(isAdmin = false) {
    renderRecentBookings();

    const monthEl = document.getElementById('current-month');
    const gridEl = document.getElementById('calendar-grid');
    if (!gridEl) return;

    const year = currentCalendarMonth.getFullYear();
    const month = currentCalendarMonth.getMonth();

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    if (monthEl) monthEl.textContent = `${monthNames[month]} ${year}`;

    // Clear grid after 7 day headers
    const dayHeaders = Array.from(gridEl.children).slice(0, 7);
    gridEl.innerHTML = '';
    dayHeaders.forEach(h => gridEl.appendChild(h));

    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    // Blank cells before month start
    for (let i = 0; i < firstDayIndex; i++) {
        const blank = document.createElement('div');
        blank.className = 'calendar-day empty';
        gridEl.appendChild(blank);
    }

    const todayStr = new Date().toISOString().split('T')[0];

    for (let day = 1; day <= totalDays; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayCell = document.createElement('div');
        dayCell.className = `calendar-day ${dateStr === todayStr ? 'today' : ''}`;
        
        const dayBookings = courtBookings.filter(b => b.date === dateStr);

        dayCell.innerHTML = `
            <div class="day-number">${day}</div>
            <div class="day-bookings">
                ${dayBookings.map(b => `
                    <div class="booking-pill" title="${b.booker} (${formatTime12Hour(b.startTime)} - ${formatTime12Hour(b.endTime)})">
                        <span class="booking-time">${formatTime12Hour(b.startTime)}</span>
                        <span class="booking-activity">${b.activity}</span>
                    </div>
                `).join('')}
            </div>
        `;

        dayCell.onclick = function() {
            openBookingModal(dateStr);
        };

        gridEl.appendChild(dayCell);
    }

    renderRecentBookings();
};

function renderRecentBookings() {
    updateDashboardStats();
    const list = document.getElementById('admin-recent-bookings-list');
    const recentDashboard = document.getElementById('recent-court-bookings');

    if (recentDashboard) {
        if (courtBookings.length === 0) {
            recentDashboard.innerHTML = `<p style="text-align:center; color:#7f8c8d; padding:20px;">No court bookings.</p>`;
        } else {
            recentDashboard.innerHTML = courtBookings.slice(0, 3).map(b => `
                <div style="padding:10px 0; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div style="font-weight:600; font-size:0.9rem;">${b.activity} - ${b.booker}</div>
                        <div style="font-size:0.8rem; color:var(--text-muted);"><i class="ri-time-line"></i> ${formatTime12Hour(b.startTime)} - ${formatTime12Hour(b.endTime)}</div>
                    </div>
                    <span class="badge badge-info">${b.date}</span>
                </div>
            `).join('');
        }
    }

    if (list) {
        if (courtBookings.length === 0) {
            list.innerHTML = `<p style="text-align:center; color:#7f8c8d; font-size:13px;">No court bookings scheduled.</p>`;
            return;
        }

        list.innerHTML = courtBookings.map(b => {
            const canCancel = isOfficial() || isBookingOwner(b);
            return `
                <div style="padding:10px; border-bottom:1px solid var(--border-color); font-size:0.85rem;">
                    <div style="font-weight:700; color:#0f172a;">${b.booker}</div>
                    <div style="color:var(--text-muted); margin-top:2px;">${b.date} &bull; ${formatTime12Hour(b.startTime)} - ${formatTime12Hour(b.endTime)} (${b.activity})</div>
                    ${canCancel ? `
                        <button class="btn btn-sm btn-outline" onclick="deleteCurrentBooking('${b.id}')" style="margin-top:6px; color:#ef4444; border-color:#fca5a5; padding:2px 8px; font-size:0.75rem;">
                            Cancel Booking
                        </button>
                    ` : ''}
                </div>
            `;
        }).join('');
    }
}

window.openBookingModal = function(dateStr = null) {
    const targetDate = dateStr || new Date().toISOString().split('T')[0];
    document.getElementById('court-date').value = targetDate;
    document.getElementById('court-booker').value = `${currentUser.firstName} ${currentUser.lastName}`;
    openModal('courtModal');
};

window.bookCourt = function() {
    const booker = document.getElementById('court-booker').value.trim();
    const date = document.getElementById('court-date').value;
    const startTime = document.getElementById('court-start-time').value;
    const endTime = document.getElementById('court-end-time').value;
    const activity = document.getElementById('court-activity').value;

    if (!booker || !date || !startTime || !endTime) {
        showToast('Please fill in all booking fields', 'error');
        return;
    }

    const newBooking = {
        id: 'bk-' + Date.now(),
        booker,
        bookerEmail: currentUser.email || '',
        date,
        startTime,
        endTime,
        activity
    };

    courtBookings.push(newBooking);
    setStorage('jfa_court_bookings', courtBookings);
    closeModal('courtModal');
    initCalendar(true);
    showToast('Court slot booked successfully!', 'success');
};

window.deleteCurrentBooking = function(id) {
    const targetId = id || document.getElementById('court-booking-edit-id')?.value;
    if (targetId) {
        const booking = courtBookings.find(b => b.id === targetId);
        if (booking && !isOfficial() && !isBookingOwner(booking)) {
            showToast('Permission Denied: You can only cancel your own court bookings', 'error');
            return;
        }
        courtBookings = courtBookings.filter(b => b.id !== targetId);
        setStorage('jfa_court_bookings', courtBookings);
        closeModal('courtModal');
        initCalendar(true);
        showToast('Booking cancelled', 'info');
    }
};

// 7. Summons
function renderSummons() {
    updateDashboardStats();
    const list = document.getElementById('summonsList');
    if (!list) return;

    if (summonsList.length === 0) {
        list.innerHTML = `<p style="text-align:center; color:#7f8c8d; padding:60px 20px;">No scheduled summons.</p>`;
        return;
    }

    const isAdmin = isOfficial();

    list.innerHTML = summonsList.map(s => `
        <div class="card" style="margin-bottom:16px; padding:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <span class="badge badge-warning"><i class="ri-scales-3-line"></i> SUMMONS</span>
                <span style="font-size:0.85rem; color:var(--text-muted);"><i class="ri-calendar-event-line"></i> ${s.date} at ${formatTime12Hour(s.time)}</span>
            </div>
            <h3 style="font-size:1.05rem; font-weight:700; margin-bottom:6px;">Case: ${s.case}</h3>
            <div style="font-size:0.9rem; color:#475569; margin-bottom:8px;">
                <strong>Complainant:</strong> ${s.complainant} &nbsp;|&nbsp; <strong>Respondent:</strong> ${s.respondent}
            </div>
            <div style="font-size:0.85rem; color:var(--primary);"><i class="ri-map-pin-line"></i> ${s.location}</div>
            ${isAdmin ? `
                <div style="margin-top:12px; text-align:right;">
                    <button class="btn btn-sm btn-outline" onclick="deleteSummons('${s.id}')" style="color:#ef4444; border-color:#fca5a5;">
                        <i class="ri-delete-bin-line"></i> Cancel Summons
                    </button>
                </div>
            ` : ''}
        </div>
    `).join('');
}

window.openSummonsModal = function() {
    if (!isOfficial()) {
        showToast('Permission Denied: Only Barangay Officials can schedule summons', 'error');
        return;
    }
    document.getElementById('summons-complainant').value = '';
    document.getElementById('summons-respondent').value = '';
    document.getElementById('summons-case').value = '';
    document.getElementById('summons-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('summons-time').value = '09:00';
    openModal('summonsModal');
};

window.saveSummons = function() {
    if (!isOfficial()) {
        showToast('Permission Denied: Only Barangay Officials can schedule summons', 'error');
        return;
    }
    const complainant = document.getElementById('summons-complainant').value.trim();
    const respondent = document.getElementById('summons-respondent').value.trim();
    const caseTitle = document.getElementById('summons-case').value.trim();
    const date = document.getElementById('summons-date').value;
    const time = document.getElementById('summons-time').value;
    const location = document.getElementById('summons-location').value;

    if (!complainant || !respondent || !caseTitle || !date || !time) {
        showToast('Please fill in all required summons details', 'error');
        return;
    }

    const newSummons = {
        id: 'sum-' + Date.now(),
        complainant,
        respondent,
        case: caseTitle,
        date,
        time,
        location
    };

    summonsList.unshift(newSummons);
    setStorage('jfa_summons', summonsList);
    closeModal('summonsModal');
    renderSummons();
    showToast('Summons scheduled successfully!', 'success');
};

window.deleteSummons = function(id) {
    if (!isOfficial()) {
        showToast('Permission Denied: Only Barangay Officials can cancel summons', 'error');
        return;
    }
    if (id) {
        summonsList = summonsList.filter(s => s.id !== id);
        setStorage('jfa_summons', summonsList);
        renderSummons();
        showToast('Summons cancelled', 'info');
    }
};

// 8. Residents Page
function renderResidents() {
    updateDashboardStats();
    const grid = document.getElementById('residentGrid');
    if (!grid) return;

    let residents = getStorage('jfa_residents', []);

    // Sync current logged in user into residents list
    if (currentUser && currentUser.email) {
        const fullName = `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim();
        let residentIdx = residents.findIndex(r => r.email === currentUser.email);
        if (residentIdx !== -1) {
            residents[residentIdx].name = fullName || residents[residentIdx].name;
            residents[residentIdx].purok = currentUser.purok || residents[residentIdx].purok;
            residents[residentIdx].role = currentUser.role || residents[residentIdx].role;
            residents[residentIdx].phone = currentUser.phone || residents[residentIdx].phone;
        } else if (fullName) {
            residents.push({
                name: fullName,
                purok: currentUser.purok || 'Purok 1',
                role: currentUser.role || 'Resident',
                phone: currentUser.phone || 'N/A',
                email: currentUser.email
            });
        }
        setStorage('jfa_residents', residents);
    }

    if (residents.length === 0) {
        grid.innerHTML = `<p style="text-align:center; color:var(--text-muted); padding:60px 20px; grid-column:1/-1;">No residents registered yet.</p>`;
        return;
    }

    grid.innerHTML = residents.map(r => `
        <div class="card" style="padding:16px; display:flex; align-items:center; gap:16px;">
            <div style="width:50px; height:50px; border-radius:50%; background:var(--primary); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:1.2rem; flex-shrink:0;">
                ${(r.name || 'Resident').split(' ').map(n=>n[0]).join('')}
            </div>
            <div>
                <h4 style="font-size:0.98rem; font-weight:700; margin-bottom:2px;">${r.name}</h4>
                <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:4px;">${r.purok || 'Purok 1'} &bull; <span class="badge badge-info" style="font-size:0.7rem; padding:2px 6px;">${r.role || 'Resident'}</span></div>
                <div style="font-size:0.8rem; color:#475569;"><i class="ri-phone-line"></i> ${r.phone || 'N/A'}</div>
            </div>
        </div>
    `).join('');
}

// 9. Map initialization
function initMap() {
    const mapEl = document.getElementById('map');
    if (!mapEl || typeof L === 'undefined') return;

    // Iriga City center coordinates
    const lat = 13.4333;
    const lng = 123.4167;

    const map = L.map('map').setView([lat, lng], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    const locations = [
        { name: 'juanforall Barangay Hall', lat: 13.4333, lng: 123.4167, icon: 'ri-building-2-fill', color: '#166534' },
        { name: 'Multipurpose Covered Court', lat: 13.4340, lng: 123.4175, icon: 'ri-basketball-line', color: '#2563eb' },
        { name: 'Barangay Health Center', lat: 13.4325, lng: 123.4158, icon: 'ri-hospital-line', color: '#dc2626' },
        { name: 'Purok 1 Outpost', lat: 13.4350, lng: 123.4180, icon: 'ri-shield-user-line', color: '#d97706' }
    ];

    locations.forEach(loc => {
        L.marker([loc.lat, loc.lng])
            .addTo(map)
            .bindPopup(`<strong>${loc.name}</strong><br>juanforall, Iriga City`);
    });
}

// 10. Login & Signup Forms
function initAuthForms() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.onsubmit = function(e) {
            e.preventDefault();
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;

            if (email && password) {
                let residents = getStorage('jfa_residents', []);
                const existing = residents.find(r => r.email === email);
                if (existing) {
                    const parts = (existing.name || '').split(' ');
                    currentUser = {
                        firstName: parts[0] || email.split('@')[0],
                        lastName: parts.slice(1).join(' ') || '',
                        email: email,
                        role: existing.role || 'Resident',
                        purok: existing.purok || 'Purok 1',
                        phone: existing.phone || '',
                        photo: null
                    };
                } else {
                    currentUser = {
                        firstName: email.split('@')[0],
                        lastName: 'User',
                        email: email,
                        role: 'Resident',
                        purok: 'Purok 1',
                        phone: '',
                        photo: null
                    };
                    residents.push({
                        name: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
                        purok: currentUser.purok,
                        role: currentUser.role,
                        phone: 'N/A',
                        email: currentUser.email
                    });
                    setStorage('jfa_residents', residents);
                }
                setStorage('jfa_user', currentUser);
                showToast('Login successful! Redirecting...', 'success');
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 800);
            }
        };
    }

    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        signupForm.onsubmit = function(e) {
            e.preventDefault();
            const firstName = document.getElementById('firstname').value.trim();
            const lastName = document.getElementById('lastname').value.trim();
            const purok = document.getElementById('purok').value;
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            const confirmPass = document.getElementById('confirm-password').value;

            if (password !== confirmPass) {
                showToast('Passwords do not match', 'error');
                return;
            }

            currentUser = {
                firstName,
                lastName,
                email,
                role: 'Resident',
                purok,
                phone: '',
                photo: null
            };
            setStorage('jfa_user', currentUser);

            let residents = getStorage('jfa_residents', []);
            if (!residents.some(r => r.email === email)) {
                residents.push({
                    name: `${firstName} ${lastName}`,
                    purok,
                    role: 'Resident',
                    phone: 'N/A',
                    email
                });
                setStorage('jfa_residents', residents);
            }

            showToast('Account created successfully! Redirecting...', 'success');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 800);
        };
    }
}

// --- DOM Loaded Initialization ---
document.addEventListener('DOMContentLoaded', function() {
    updateHeaderUserInfo();
    initAccountPage();
    renderAnnouncements();
    renderComplaints();
    initCalendar(true);
    renderRecentBookings();
    renderSummons();
    renderResidents();
    initMap();
    initAuthForms();
    updateDashboardStats();
});
