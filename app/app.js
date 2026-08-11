const firebaseConfig = {
    apiKey: "AIzaSyCUn_OVro6-NBfIAn0SAcGZeV25HqiCvlc",
    authDomain: "barangay-san-juan.firebaseapp.com",
    projectId: "barangay-san-juan",
    storageBucket: "barangay-san-juan.firebasestorage.app",
    messagingSenderId: "987977241267",
    appId: "1:987977241267:web:4685a282641fce2ccad6c6",
    measurementId: "G-5XWG6ET1CE"
};

try {
    firebase.initializeApp(firebaseConfig);
} catch (e) {
    console.error("Firebase Init Error:", e);
    alert("Firebase Configuration Error. Check console.");
}

const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let userRole = 'resident';
let mapInstance = null;
let currentMonth = new Date();
let selectedDate = new Date();
let allBookings = [];

const currentPage = window.location.pathname.split('/').pop() || 'index.html';

const categoryConfig = {
    roadwork: { label: '🚧 Roadwork', class: 'cat-roadwork' },
    lightpost: { label: '💡 Lightpost', class: 'cat-lightpost' },
    drainage: { label: '🔧 Drainage', class: 'cat-drainage' },
    noise: { label: '📢 Noise', class: 'cat-noise' },
    garbage: { label: '🗑️ Garbage', class: 'cat-garbage' },
    other: { label: '📌 Other', class: 'cat-other' },
    general: { label: '📢 General', class: 'cat-general' }
};

auth.onAuthStateChanged(async (user) => {
    const isLoginPage = currentPage === 'login.html';
    const authOverlay = document.getElementById('auth-overlay');
    
    if (user) {
        currentUser = user;
        if (isLoginPage) {
            window.location.href = 'index.html';
            return;
        }
        try {
            await loadUserProfile();
            if (authOverlay) authOverlay.style.display = 'none';
            initializeApp();
        } catch (error) {
            console.error("Init Error:", error);
            if (authOverlay) authOverlay.style.display = 'none';
        }
    } else {
        currentUser = null;
        if (!isLoginPage) {
            window.location.href = 'login.html';
            return;
        }
        if (authOverlay) authOverlay.style.display = 'flex';
    }
});

async function loadUserProfile() {
    if (!currentUser) return;
    try {
        const doc = await db.collection('profiles').doc(currentUser.uid).get();
        if (doc.exists) {
            const data = doc.data();
            userRole = data.role || 'resident';
            
            const name = `${data.firstName} ${data.lastName}`;
            const initials = `${data.firstName[0]}${data.lastName[0]}`.toUpperCase();
            
            const setText = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
            
            setText('user-name', name);
            setText('user-role', userRole === 'admin' ? 'Admin' : 'Resident');
            setText('dropdown-name', name);
            setText('dropdown-email', data.email || currentUser.email);
            setText('user-avatar', initials);
            setText('dropdown-avatar', initials);
            setText('dropdown-role', userRole === 'admin' ? 'Admin' : 'Resident');
            
            if (userRole === 'admin') {
                const showBtn = (id) => { const el = document.getElementById(id); if(el) el.style.display = 'inline-flex'; };
                showBtn('schedule-summons-btn');
                showBtn('add-announcement-btn');
                showBtn('admin-court-btn');
            }
        }
    } catch (error) {
        console.error("Profile Load Error:", error);
    }
}

async function initializeApp() {
    if (currentPage === 'index.html' || currentPage === '') {
        await updateStats();
        await loadRecentComplaints();
        await loadRecentCourtBookings();
    }
    if (currentPage === 'complaints.html') await renderComplaints('all', 'complaintList');
    if (currentPage === 'residents.html') await renderResidents();
    if (currentPage === 'summons.html') await renderSummons();
    if (currentPage === 'court.html') await initCalendar(true);
    if (currentPage === 'map.html') setTimeout(initMap, 500);
    if (currentPage === 'announcements.html') await loadAnnouncements();
    if (currentPage === 'account.html') await loadAccountPage();
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('open');
}

function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('show');
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('show');
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `${type === 'success' ? '✅' : '❌'} ${message}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

window.toggleProfileDropdown = function() {
    const dropdown = document.getElementById('profileDropdown');
    const trigger = document.querySelector('.user-profile-trigger');
    if (dropdown) {
        dropdown.classList.toggle('show');
        if (trigger) trigger.classList.toggle('active');
    }
};

document.addEventListener('click', function(e) {
    const dropdown = document.getElementById('profileDropdown');
    const trigger = document.querySelector('.user-profile-trigger');
    if (dropdown && trigger && !trigger.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.remove('show');
        if(trigger) trigger.classList.remove('active');
    }
});

async function handleLogout() { 
    await auth.signOut(); 
    window.location.href = 'login.html'; 
}

async function updateStats() {
    if (!document.getElementById('stat-residents')) return;
    try {
        const resSnap = await db.collection('profiles').get();
        const compSnap = await db.collection('complaints').get();
        let activeComplaints = 0;
        compSnap.forEach(doc => {
            if (doc.data().status !== 'resolved') activeComplaints++;
        });
        
        const sumSnap = await db.collection('summons').where('status', '==', 'confirmed').get();
        const today = new Date().toISOString().split('T')[0];
        const courtSnap = await db.collection('courtBookings').where('date', '==', today).get();
        
        const setStat = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
        setStat('stat-residents', resSnap.size);
        setStat('stat-complaints', activeComplaints);
        setStat('stat-summons', sumSnap.size);
        setStat('stat-court', courtSnap.size);
    } catch (e) { console.error(e); }
}

async function loadRecentComplaints() {
    const container = document.getElementById('recent-complaints');
    if (!container) return;
    try {
        const snap = await db.collection('complaints').orderBy('createdAt', 'desc').limit(3).get();
        if (snap.empty) { container.innerHTML = '<p style="text-align:center;color:#7f8c8d;padding:20px;">No recent complaints.</p>'; return; }
        container.innerHTML = snap.docs.map(doc => {
            const c = doc.data();
            return `<div class="complaint-item" style="padding:14px;"><div class="complaint-header"><span class="complaint-category cat-${c.category||'other'}">${categoryConfig[c.category]?.label||'📌 Other'}</span></div><div class="complaint-title">${escapeHtml(c.title)}</div></div>`;
        }).join('');
    } catch (e) { container.innerHTML = '<p>Error.</p>'; }
}

async function loadRecentCourtBookings() {
    const container = document.getElementById('recent-court-bookings');
    if (!container) return;
    try {
        const snap = await db.collection('courtBookings').orderBy('createdAt', 'desc').limit(5).get();
        const bookings = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).slice(0, 5);
        if (bookings.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:#7f8c8d;padding:20px;">No recent bookings.</p>';
            return;
        }
        container.innerHTML = bookings.map(b => {
            const time = (b.startTime && b.endTime) ? `${formatTime(b.startTime)} - ${formatTime(b.endTime)}` : 'All Day';
            return `
                <div class="court-booking-item ${b.isAdminBooking ? 'admin' : ''}">
                    <div class="court-booking-header">
                        <span class="court-booking-time">${time}</span>
                        <span class="court-booking-date">${new Date(b.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    </div>
                    <div class="court-booking-name">${escapeHtml(b.bookerName)}</div>
                    <div class="court-booking-activity">${escapeHtml(b.activity)}</div>
                </div>
            `;
        }).join('');
    } catch (e) { container.innerHTML = '<p>Error.</p>'; }
}

function formatTime(timeStr) {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h);
    return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
}

async function renderComplaints(filter = 'all', elementId = 'complaintList') {
    const container = document.getElementById(elementId);
    if (!container) return;
    container.innerHTML = '<p style="text-align:center;padding:40px;color:#7f8c8d;">⏳ Loading...</p>';
    
    try {
        const snap = await db.collection('complaints').orderBy('createdAt', 'desc').get();
        let complaints = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (filter !== 'all') complaints = complaints.filter(c => c.status === filter);
        
        if (complaints.length === 0) { 
            container.innerHTML = '<p style="text-align:center;padding:40px;color:#7f8c8d;">No complaints found.</p>'; 
            return; 
        }
        
        container.innerHTML = complaints.map(c => `
            <div class="complaint-item">
                <div class="complaint-header">
                    <span class="complaint-category ${categoryConfig[c.category]?.class || 'cat-other'}">
                        ${categoryConfig[c.category]?.label || '📌 Other'}
                    </span>
                    ${userRole === 'admin' ? `
                        <div style="display:flex; gap:8px;">
                            <select class="status-dropdown" onchange="updateComplaintStatus('${c.id}', this.value)">
                                <option value="pending" ${c.status === 'pending' ? 'selected' : ''}>⏳ Pending</option>
                                <option value="progress" ${c.status === 'progress' ? 'selected' : ''}>🔄 In Progress</option>
                                <option value="resolved" ${c.status === 'resolved' ? 'selected' : ''}>✅ Resolved</option>
                            </select>
                        </div>
                    ` : `
                        <span class="status-badge status-${c.status || 'pending'}">
                            <span class="status-dot"></span> ${c.status === 'progress' ? 'In Progress' : (c.status === 'resolved' ? 'Resolved' : 'Pending')}
                        </span>
                    `}
                </div>
                <div class="complaint-title">${escapeHtml(c.title)}</div>
                <div class="complaint-desc">${escapeHtml(c.description)}</div>
                <div class="complaint-meta">
                    <span>👤 ${escapeHtml(c.userName)}</span>
                    <span>📍 ${escapeHtml(c.purok)}</span>
                    <span>🕐 ${c.createdAt ? new Date(c.createdAt.toDate()).toLocaleDateString() : 'N/A'}</span>
                </div>
                ${userRole === 'admin' ? `
                    <div style="margin-top:16px; display:flex; gap:8px; border-top:1px solid var(--border); padding-top:12px;">
                        <button class="btn btn-sm btn-outline" onclick="openEditComplaintModal('${c.id}')">✏️ Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteComplaint('${c.id}')">🗑️ Delete</button>
                    </div>
                ` : ''}
            </div>
        `).join('');
    } catch (e) { 
        console.error(e);
        container.innerHTML = '<p style="text-align:center;color:var(--danger);padding:20px;">Error loading complaints.</p>'; 
    }
}

async function updateComplaintStatus(id, status) {
    if (userRole !== 'admin') return;
    try {
        await db.collection('complaints').doc(id).update({ status });
        showToast(`Updated to ${status}`, 'success');
        renderComplaints();
    } catch (error) {
        showToast('Failed: ' + error.message, 'danger');
    }
}

async function openEditComplaintModal(id) {
    if (userRole !== 'admin') return;
    try {
        const doc = await db.collection('complaints').doc(id).get();
        if (doc.exists) {
            const data = doc.data();
            document.getElementById('complaint-edit-id').value = id;
            document.getElementById('complaint-category').value = data.category;
            document.getElementById('complaint-title').value = data.title;
            document.getElementById('complaint-desc').value = data.description;
            document.getElementById('complaint-purok').value = data.purok;
            document.getElementById('complaint-modal-title').textContent = '✏️ Edit Complaint';
            openModal('complaintModal');
        }
    } catch (e) { showToast('Error loading complaint', 'danger'); }
}

async function deleteComplaint(id) {
    if (userRole !== 'admin') return;
    if (!confirm('Are you sure you want to delete this complaint?')) return;
    try {
        await db.collection('complaints').doc(id).delete();
        showToast('Complaint deleted', 'success');
        renderComplaints();
    } catch (e) { showToast('Failed to delete', 'danger'); }
}

async function submitComplaint() {
    const category = document.getElementById('complaint-category')?.value;
    const title = document.getElementById('complaint-title')?.value.trim();
    const desc = document.getElementById('complaint-desc')?.value.trim();
    const purok = document.getElementById('complaint-purok')?.value;
    const editId = document.getElementById('complaint-edit-id')?.value;

    if (!category || !title || !desc || !purok) { showToast('Fill all fields.', 'warning'); return; }

    try {
        const data = { category, title, description: desc, purok };
        if (editId) {
            await db.collection('complaints').doc(editId).update({ ...data, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
            showToast('Complaint updated!', 'success');
        } else {
            await db.collection('complaints').add({ ...data, userId: currentUser.uid, userName: currentUser.email, status: 'pending', createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            showToast('Complaint filed!', 'success');
        }
        closeModal('complaintModal');
        renderComplaints();
        document.getElementById('complaint-edit-id').value = '';
        ['complaint-category', 'complaint-title', 'complaint-desc', 'complaint-purok'].forEach(id => { 
            const el = document.getElementById(id); if(el) el.value = ''; 
        });
    } catch (e) { showToast('Failed: ' + e.message, 'danger'); }
}

function filterComplaints(filter, btn) {
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    if(btn) btn.classList.add('active');
    renderComplaints(filter);
}

async function renderResidents() {
    const container = document.getElementById('residentGrid');
    if (!container) return;
    container.innerHTML = '<p style="text-align:center;padding:40px;color:#7f8c8d;">Loading...</p>';
    try {
        const snap = await db.collection('profiles').orderBy('lastName').get();
        const residents = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        container.innerHTML = residents.map(r => `
            <div class="resident-card">
                <div class="resident-avatar" style="background:${stringToColor((r.firstName||'')+(r.lastName||''))}">${(r.firstName?.[0]||'U')}${(r.lastName?.[0]||'')}</div>
                <div class="resident-name">${escapeHtml(r.firstName)} ${escapeHtml(r.lastName)}</div>
                <div class="resident-address">${escapeHtml(r.purok)}</div>
            </div>
        `).join('');
    } catch (e) { container.innerHTML = '<p>Error.</p>'; }
}

function stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    const c = (hash & 0x00ffffff).toString(16).toUpperCase();
    return '#' + '00000'.substring(0, 6 - c.length) + c;
}

async function renderSummons() {
    const container = document.getElementById('summonsList');
    if (!container) return;
    container.innerHTML = '<p style="text-align:center;padding:40px;color:#7f8c8d;">Loading...</p>';
    try {
        const snap = await db.collection('summons').orderBy('date', 'asc').get();
        const summons = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (summons.length === 0) { container.innerHTML = '<p style="text-align:center;padding:40px;color:#7f8c8d;">No summons.</p>'; return; }
        
        container.innerHTML = summons.map(s => `
            <div class="summons-card">
                <div class="summons-info">
                    <h4>${escapeHtml(s.caseTitle)}</h4>
                    <p>${escapeHtml(s.complainantName)} vs ${escapeHtml(s.respondentName)}</p>
                </div>
                <div class="summons-date">
                    <div class="date">${s.date}</div>
                    <div class="time">${s.time}</div>
                    ${userRole === 'admin' ? `
                    <div style="display:flex; gap:6px; margin-top:6px;">
                        <button class="btn btn-sm btn-outline" onclick="openEditSummonsModal('${s.id}')">✏️</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteSummons('${s.id}')">🗑️</button>
                    </div>
                    ` : `<span class="status-badge status-confirmed"><span class="status-dot"></span> Confirmed</span>`}
                </div>
            </div>
        `).join('');
    } catch (e) { container.innerHTML = '<p>Error.</p>'; }
}

async function openEditSummonsModal(id) {
    if (userRole !== 'admin') return;
    try {
        const doc = await db.collection('summons').doc(id).get();
        if (doc.exists) {
            const data = doc.data();
            document.getElementById('summons-edit-id').value = id;
            document.getElementById('summons-complainant').value = data.complainantName;
            document.getElementById('summons-respondent').value = data.respondentName;
            document.getElementById('summons-case').value = data.caseTitle;
            document.getElementById('summons-date').value = data.date;
            document.getElementById('summons-time').value = data.time;
            document.getElementById('summons-location').value = data.location;
            document.getElementById('summons-modal-title').textContent = '✏️ Edit Summons';
            openModal('summonsModal');
        }
    } catch (e) { showToast('Error loading summons', 'danger'); }
}

async function deleteSummons(id) {
    if (userRole !== 'admin') return;
    if (!confirm('Delete this summons?')) return;
    try {
        await db.collection('summons').doc(id).delete();
        showToast('Summons deleted', 'success');
        renderSummons();
    } catch (e) { showToast('Failed to delete', 'danger'); }
}

async function saveSummons() {
    const c = document.getElementById('summons-complainant')?.value.trim();
    const r = document.getElementById('summons-respondent')?.value.trim();
    const caseT = document.getElementById('summons-case')?.value.trim();
    const d = document.getElementById('summons-date')?.value;
    const t = document.getElementById('summons-time')?.value;
    const l = document.getElementById('summons-location')?.value;
    const editId = document.getElementById('summons-edit-id')?.value;
    
    if (!c || !r || !caseT || !d || !t) { showToast('Fill all fields.', 'warning'); return; }

    try {
        const data = { complainantName: c, respondentName: r, caseTitle: caseT, date: d, time: t, location: l };
        if (editId) {
            await db.collection('summons').doc(editId).update({ ...data, status: 'confirmed' });
            showToast('Summons updated!', 'success');
        } else {
            await db.collection('summons').add({ ...data, status: 'confirmed', createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            showToast('Summons scheduled!', 'success');
        }
        closeModal('summonsModal');
        renderSummons();
        document.getElementById('summons-edit-id').value = '';
    } catch (e) { showToast('Failed: ' + e.message, 'danger'); }
}

function openSummonsModal() {
    document.getElementById('summons-edit-id').value = '';
    document.getElementById('summons-complainant').value = '';
    document.getElementById('summons-respondent').value = '';
    document.getElementById('summons-case').value = '';
    document.getElementById('summons-date').value = '';
    document.getElementById('summons-time').value = '';
    document.getElementById('summons-location').value = 'Barangay Hall - Conference Room';
    document.getElementById('summons-modal-title').textContent = '📋 Schedule Summons';
    openModal('summonsModal');
}

function getLocalDateString(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

async function initCalendar(resetDate = false) {
    if (resetDate) {
        currentMonth = new Date();
        selectedDate = new Date();
    }
    
    const adminSidebar = document.getElementById('admin-court-sidebar');
    if (adminSidebar) {
        adminSidebar.style.display = userRole === 'admin' ? 'block' : 'none';
        if (userRole === 'admin') await loadAdminRecentBookings();
    }

    renderCalendarHeader();
    await fetchMonthBookings();
    renderCalendarGrid();
}

async function loadAdminRecentBookings() {
    const container = document.getElementById('admin-recent-bookings-list');
    if (!container) return;
    try {
        const snap = await db.collection('courtBookings').orderBy('createdAt', 'desc').limit(10).get();
        const bookings = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (bookings.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:#7f8c8d;font-size:13px;padding:20px;">No bookings found.</p>';
            return;
        }
        container.innerHTML = bookings.map(b => {
            const time = (b.startTime && b.endTime) ? `${b.startTime} - ${b.endTime}` : 'All Day';
            return `
                <div class="admin-booking-item" onclick="openEditBookingModal('${b.id}')">
                    <div class="admin-booking-time">${time}</div>
                    <div class="admin-booking-name">${escapeHtml(b.bookerName)}</div>
                    <div class="admin-booking-activity">${escapeHtml(b.activity)} • ${b.date}</div>
                </div>
            `;
        }).join('');
    } catch (e) { container.innerHTML = '<p style="color:var(--danger);font-size:13px;">Error loading.</p>'; }
}

function renderCalendarHeader() {
    const el = document.getElementById('current-month');
    if(el) el.textContent = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

async function fetchMonthBookings() {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const startOfMonth = getLocalDateString(new Date(year, month, 1));
    const endOfMonth = getLocalDateString(new Date(year, month + 1, 0));
    try {
        const snapshot = await db.collection('courtBookings').where('date', '>=', startOfMonth).where('date', '<=', endOfMonth).get();
        allBookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) { allBookings = []; }
}

function renderCalendarGrid() {
    const grid = document.getElementById('calendar-grid');
    if(!grid) return;
    const headers = Array.from(grid.children).slice(0, 7);
    grid.innerHTML = '';
    headers.forEach(h => grid.appendChild(h));
    
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr = getLocalDateString(new Date());
    const selectedStr = getLocalDateString(selectedDate);
    
    for (let i = 0; i < firstDayOfMonth; i++) grid.appendChild(document.createElement('div'));
    
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayBookings = allBookings.filter(b => b.date === dateStr);
        const cell = document.createElement('div');
        cell.className = `calendar-day ${dateStr === todayStr ? 'today' : ''} ${dateStr === selectedStr ? 'selected' : ''}`;
        cell.onclick = () => { selectedDate = new Date(year, month, day); renderCalendarGrid(); };
        
        let bookingsHtml = '';
        if (dayBookings.length > 0) {
            bookingsHtml = '<div class="grid-bookings">';
            dayBookings.forEach(b => {
                const time = (b.startTime && b.endTime) ? `${b.startTime} - ${b.endTime}` : 'All Day';
                const clickAction = userRole === 'admin' ? `onclick="event.stopPropagation(); openEditBookingModal('${b.id}')"` : '';
                bookingsHtml += `<div class="grid-booking ${b.isAdminBooking ? 'admin' : ''}" ${clickAction}>
                    <div class="grid-time">${time}</div>
                    <div class="grid-name">${escapeHtml(b.bookerName)}</div>
                </div>`;
            });
            bookingsHtml += '</div>';
        }
        cell.innerHTML = `<div class="day-number">${day}</div>${bookingsHtml}`;
        grid.appendChild(cell);
    }
}

function changeMonth(delta) { currentMonth.setMonth(currentMonth.getMonth() + delta); initCalendar(false); }

function openBookingModal() {
    document.getElementById('court-booking-edit-id').value = '';
    document.getElementById('court-date').value = getLocalDateString(selectedDate);
    document.getElementById('court-booker').value = '';
    document.getElementById('court-start-time').value = '';
    document.getElementById('court-end-time').value = '';
    document.getElementById('court-activity').value = 'Basketball';
    document.getElementById('court-modal-title').textContent = '📅 Book Court Slot';
    document.getElementById('btn-delete-booking').style.display = 'none';
    openModal('courtModal');
}

async function openEditBookingModal(id) {
    if (userRole !== 'admin') return;
    try {
        const doc = await db.collection('courtBookings').doc(id).get();
        if (doc.exists) {
            const data = doc.data();
            document.getElementById('court-booking-edit-id').value = id;
            document.getElementById('court-booker').value = data.bookerName;
            document.getElementById('court-date').value = data.date;
            document.getElementById('court-start-time').value = data.startTime;
            document.getElementById('court-end-time').value = data.endTime;
            document.getElementById('court-activity').value = data.activity;
            document.getElementById('court-modal-title').textContent = '✏️ Edit Booking';
            document.getElementById('btn-delete-booking').style.display = 'inline-flex';
            openModal('courtModal');
        }
    } catch (e) { showToast('Error loading booking', 'danger'); }
}

async function deleteCurrentBooking() {
    const editId = document.getElementById('court-booking-edit-id')?.value;
    if (!editId) return;
    if (!confirm('Delete this booking?')) return;
    try {
        await db.collection('courtBookings').doc(editId).delete();
        showToast('Booking deleted', 'success');
        closeModal('courtModal');
        await fetchMonthBookings();
        renderCalendarGrid();
        if (userRole === 'admin') await loadAdminRecentBookings();
    } catch (e) { showToast('Failed', 'danger'); }
}

function toMinutes(t) { if (!t) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + m; }

async function bookCourt() {
    const name = document.getElementById('court-booker')?.value.trim();
    const date = document.getElementById('court-date')?.value;
    const start = document.getElementById('court-start-time')?.value;
    const end = document.getElementById('court-end-time')?.value;
    const activity = document.getElementById('court-activity')?.value;
    const editId = document.getElementById('court-booking-edit-id')?.value;

    if (!name || !date || !start || !end) return showToast('Fill all fields.', 'warning');
    if (start >= end) return showToast('End time must be after start.', 'warning');
    if (parseInt(start.split(':')[0]) < 6 || parseInt(end.split(':')[0]) > 19) return showToast('Court hours: 6 AM - 7 PM', 'warning');

    try {
        if (!editId) {
            if (allBookings.some(b => b.date === date && toMinutes(start) < toMinutes(b.endTime) && toMinutes(end) > toMinutes(b.startTime))) return showToast('Slot overlaps!', 'danger');
            await db.collection('courtBookings').add({ userId: currentUser.uid, bookerName: name, date, startTime: start, endTime: end, activity, isAdminBooking: false, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            showToast('Booked!', 'success');
        } else {
            await db.collection('courtBookings').doc(editId).update({ bookerName: name, startTime: start, endTime: end, activity, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
            showToast('Updated!', 'success');
        }
        closeModal('courtModal'); await fetchMonthBookings(); renderCalendarGrid(); document.getElementById('court-booking-edit-id').value = ''; document.getElementById('court-booker').value = '';
    } catch (e) { showToast('Failed: ' + e.message, 'danger'); }
}

async function loadAnnouncements() {
    const container = document.getElementById('announcementsList');
    const addBtn = document.getElementById('add-announcement-btn');
    
    if (!container) return;
    
    if (userRole === 'admin') {
        if (addBtn) addBtn.style.display = 'inline-flex';
    } else {
        if (addBtn) addBtn.style.display = 'none';
    }

    container.innerHTML = '<p style="text-align:center; color:#7f8c8d; padding:60px 20px;">⏳ Loading...</p>';
    
    try {
        const snap = await db.collection('announcements').orderBy('createdAt', 'desc').get();
        const announcements = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (announcements.length === 0) { 
            container.innerHTML = '<p style="text-align:center; color:#7f8c8d; padding:60px 20px;">📭 No announcements yet.</p>'; 
            return; 
        }
        
        container.innerHTML = announcements.map(a => {
            const categoryLabel = categoryConfig[a.category]?.label || '📢 General';
            const categoryClass = categoryConfig[a.category]?.class || 'cat-general';
            return `
                <div class="announcement-card">
                    <div class="announcement-header">
                        <span class="complaint-category ${categoryClass}">${categoryLabel}</span>
                        <span class="announcement-date">🗓️ ${a.createdAt ? new Date(a.createdAt.toDate()).toLocaleDateString() : 'N/A'}</span>
                    </div>
                    <h3 class="announcement-title">${escapeHtml(a.title)}</h3>
                    <p class="announcement-content">${escapeHtml(a.content)}</p>
                    ${userRole === 'admin' ? `
                        <div style="margin-top:16px; display:flex; gap:8px; border-top:1px solid var(--border); padding-top:12px;">
                            <button class="btn btn-sm btn-outline" onclick="openEditAnnouncementModal('${a.id}')">✏️ Edit</button>
                            <button class="btn btn-sm btn-danger" onclick="deleteAnnouncement('${a.id}')">🗑️ Delete</button>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    } catch (e) {
        console.error(e);
        container.innerHTML = '<p style="text-align:center; color:var(--danger); padding:20px;">Error loading announcements.</p>';
    }
}

function openAnnouncementModal() {
    document.getElementById('announcement-edit-id').value = '';
    document.getElementById('announcement-title').value = '';
    document.getElementById('announcement-category').value = 'general';
    document.getElementById('announcement-content').value = '';
    document.getElementById('announcement-modal-title').textContent = '📢 Add Announcement';
    openModal('announcementModal');
}

async function openEditAnnouncementModal(id) {
    if (userRole !== 'admin') return;
    try {
        const doc = await db.collection('announcements').doc(id).get();
        if (doc.exists) {
            const data = doc.data();
            document.getElementById('announcement-edit-id').value = id;
            document.getElementById('announcement-title').value = data.title;
            document.getElementById('announcement-category').value = data.category || 'general';
            document.getElementById('announcement-content').value = data.content;
            document.getElementById('announcement-modal-title').textContent = '✏️ Edit Announcement';
            openModal('announcementModal');
        }
    } catch (e) { showToast('Error loading announcement', 'danger'); }
}

async function saveAnnouncement() {
    const title = document.getElementById('announcement-title')?.value.trim();
    const category = document.getElementById('announcement-category')?.value;
    const content = document.getElementById('announcement-content')?.value.trim();
    const editId = document.getElementById('announcement-edit-id')?.value;

    if (!title || !content) { showToast('Fill all required fields.', 'warning'); return; }

    try {
        const data = { title, category, content };
        if (editId) {
            await db.collection('announcements').doc(editId).update({ ...data, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
            showToast('Announcement updated!', 'success');
        } else {
            await db.collection('announcements').add({ ...data, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            showToast('Announcement posted!', 'success');
        }
        closeModal('announcementModal');
        loadAnnouncements();
    } catch (e) { showToast('Failed: ' + e.message, 'danger'); }
}

async function deleteAnnouncement(id) {
    if (userRole !== 'admin') return;
    if (!confirm('Are you sure you want to delete this announcement?')) return;
    try {
        await db.collection('announcements').doc(id).delete();
        showToast('Announcement deleted', 'success');
        loadAnnouncements();
    } catch (e) { showToast('Failed to delete', 'danger'); }
}

function initMap() {
    const mapElement = document.getElementById('map');
    if (!mapElement || typeof L === 'undefined') return;

    if (mapInstance) mapInstance.remove();

    mapInstance = L.map('map').setView([13.4253, 123.4184], 16);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    }).addTo(mapInstance);

    L.marker([13.4253, 123.4184]).addTo(mapInstance)
        .bindPopup('<b>Barangay San Juan Hall</b><br>Community Center')
        .openPopup();
}

async function loadAccountPage() {
    if (!currentUser) return;
    try {
        const doc = await db.collection('profiles').doc(currentUser.uid).get();
        if (doc.exists) {
            const data = doc.data();
            const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val || ''; };
            setVal('account-firstname', data.firstName);
            setVal('account-lastname', data.lastName);
            setVal('account-email', data.email || currentUser.email);
            setVal('account-purok', data.purok);
            setVal('account-contact', data.contactNumber);
        }
    } catch (e) { console.error("Account Load Error:", e); }
}
