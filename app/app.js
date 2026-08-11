const firebaseConfig = {
    apiKey: "AIzaSyCUn_OVro6-NBfIAn0SAcGZeV25HqiCvlc",
    authDomain: "barangay-san-juan.firebaseapp.com",
    projectId: "barangay-san-juan",
    storageBucket: "barangay-san-juan.firebasestorage.app",
    messagingSenderId: "987977241267",
    appId: "1:987977241267:web:4685a282641fce2ccad6c6",
    measurementId: "G-5XWG6ET1CE"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

const pathName = window.location.pathname;
const currentPage = pathName.substring(pathName.lastIndexOf('/') + 1) || 'index.html';
const isAuthPage = currentPage === 'login.html' || currentPage === 'signup.html';

document.addEventListener('DOMContentLoaded', () => {
    initAuthObserver();
    initFormListeners();
    initDropdownToggle();
});

function initAuthObserver() {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            if (isAuthPage) {
                window.location.href = 'index.html';
            } else {
                await loadUserProfile(user);
                initModuleData();
            }
        } else {
            if (!isAuthPage) {
                window.location.href = 'login.html';
            }
        }
    });
}

function initFormListeners() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);

    const signupForm = document.getElementById('signup-form');
    if (signupForm) signupForm.addEventListener('submit', handleSignup);

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

    const summonForm = document.getElementById('summon-form');
    if (summonForm) summonForm.addEventListener('submit', handleCreateSummon);

    const courtForm = document.getElementById('court-hearing-form');
    if (courtForm) courtForm.addEventListener('submit', handleCreateCourtHearing);

    const complaintForm = document.getElementById('complaint-form');
    if (complaintForm) complaintForm.addEventListener('submit', handleCreateComplaint);

    const clearanceForm = document.getElementById('clearance-form');
    if (clearanceForm) clearanceForm.addEventListener('submit', handleRequestClearance);
}

function initModuleData() {
    if (document.getElementById('summon-list')) loadSummons();
    if (document.getElementById('court-hearings-list')) loadCourtHearings();
    if (document.getElementById('complaint-list')) loadComplaints();
    if (document.getElementById('dashboard-stats')) loadDashboardStats();
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();

    try {
        await auth.signInWithEmailAndPassword(email, password);
        window.location.href = 'index.html';
    } catch (error) {
        showToast(getReadableErrorMessage(error.code), 'error');
    }
}

async function handleSignup(e) {
    e.preventDefault();
    const fullName = document.getElementById('fullname').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    const confirmPassword = document.getElementById('confirm-password').value.trim();

    if (password !== confirmPassword) {
        showToast('Passwords do not match.', 'error');
        return;
    }

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        await user.updateProfile({ displayName: fullName });

        await db.collection('users').doc(user.uid).set({
            uid: user.uid,
            fullName: fullName,
            email: email,
            role: 'Resident',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        window.location.href = 'index.html';
    } catch (error) {
        showToast(getReadableErrorMessage(error.code), 'error');
    }
}

async function handleLogout() {
    try {
        await auth.signOut();
        window.location.href = 'login.html';
    } catch (error) {
        showToast('Failed to log out. Try again.', 'error');
    }
}

async function handleCreateSummon(e) {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    const caseNumber = document.getElementById('summon-case-num').value.trim();
    const respondentName = document.getElementById('summon-respondent').value.trim();
    const scheduleDate = document.getElementById('summon-date').value;
    const venue = document.getElementById('summon-venue').value.trim();

    try {
        await db.collection('summons').add({
            caseNumber: caseNumber,
            respondentName: respondentName,
            complainantId: user.uid,
            scheduleDate: scheduleDate,
            venue: venue,
            status: 'Issued',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showToast('Summon issued successfully!', 'success');
        e.target.reset();
        loadSummons();
    } catch (error) {
        showToast('Failed to issue summon.', 'error');
    }
}

async function loadSummons() {
    const listElement = document.getElementById('summon-list');
    if (!listElement) return;

    try {
        const snapshot = await db.collection('summons').orderBy('createdAt', 'desc').get();
        listElement.innerHTML = '';

        if (snapshot.empty) {
            listElement.innerHTML = '<p class="text-muted">No active summons issued.</p>';
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            const item = document.createElement('div');
            item.className = 'complaint-item';
            item.innerHTML = `
                <div>
                    <strong>Case #${data.caseNumber}</strong> - ${data.respondentName}
                    <p style="font-size: 0.85rem; color: var(--text-muted);">
                        Date: ${data.scheduleDate} | Venue: ${data.venue}
                    </p>
                </div>
                <span class="badge badge-warning">${data.status}</span>
            `;
            listElement.appendChild(item);
        });
    } catch (error) {
        console.error('Error fetching summons:', error);
    }
}

async function handleCreateCourtHearing(e) {
    e.preventDefault();
    const caseTitle = document.getElementById('court-case-title').value.trim();
    const hearingType = document.getElementById('court-hearing-type').value;
    const hearingDate = document.getElementById('court-hearing-date').value;
    const officerInCharge = document.getElementById('court-officer').value.trim();

    try {
        await db.collection('court_hearings').add({
            caseTitle: caseTitle,
            type: hearingType,
            hearingDate: hearingDate,
            officerInCharge: officerInCharge,
            status: 'Scheduled',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showToast('Court/Lupon hearing scheduled.', 'success');
        e.target.reset();
        loadCourtHearings();
    } catch (error) {
        showToast('Failed to schedule hearing.', 'error');
    }
}

async function loadCourtHearings() {
    const listElement = document.getElementById('court-hearings-list');
    if (!listElement) return;

    try {
        const snapshot = await db.collection('court_hearings').orderBy('hearingDate', 'asc').get();
        listElement.innerHTML = '';

        if (snapshot.empty) {
            listElement.innerHTML = '<p class="text-muted">No scheduled court hearings.</p>';
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            const item = document.createElement('div');
            item.className = 'complaint-item';
            item.innerHTML = `
                <div>
                    <strong>${data.caseTitle}</strong> (${data.type})
                    <p style="font-size: 0.85rem; color: var(--text-muted);">
                        Hearing Date: ${data.hearingDate} | Presiding: ${data.officerInCharge}
                    </p>
                </div>
                <span class="badge badge-info">${data.status}</span>
            `;
            listElement.appendChild(item);
        });
    } catch (error) {
        console.error('Error fetching court hearings:', error);
    }
}

async function handleCreateComplaint(e) {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    const category = document.getElementById('complaint-category').value;
    const details = document.getElementById('complaint-details').value.trim();

    try {
        await db.collection('complaints').add({
            userId: user.uid,
            category: category,
            details: details,
            status: 'Pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showToast('Complaint submitted.', 'success');
        e.target.reset();
        loadComplaints();
    } catch (error) {
        showToast('Failed to submit complaint.', 'error');
    }
}

async function loadComplaints() {
    const listElement = document.getElementById('complaint-list');
    if (!listElement) return;

    try {
        const snapshot = await db.collection('complaints').orderBy('createdAt', 'desc').get();
        listElement.innerHTML = '';

        if (snapshot.empty) {
            listElement.innerHTML = '<p class="text-muted">No complaints reported.</p>';
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            const item = document.createElement('div');
            item.className = 'complaint-item';
            item.innerHTML = `
                <div>
                    <strong>${data.category}</strong>
                    <p style="font-size: 0.85rem; margin-top:4px;">${data.details}</p>
                </div>
                <span class="badge">${data.status}</span>
            `;
            listElement.appendChild(item);
        });
    } catch (error) {
        console.error('Error loading complaints:', error);
    }
}

async function handleRequestClearance(e) {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    const documentType = document.getElementById('clearance-type').value;
    const purpose = document.getElementById('clearance-purpose').value.trim();

    try {
        await db.collection('clearance_requests').add({
            userId: user.uid,
            documentType: documentType,
            purpose: purpose,
            status: 'Processing',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showToast('Request submitted successfully.', 'success');
        e.target.reset();
    } catch (error) {
        showToast('Failed to send request.', 'error');
    }
}

async function loadDashboardStats() {
    try {
        const complaintsSnap = await db.collection('complaints').get();
        const summonsSnap = await db.collection('summons').get();
        const hearingsSnap = await db.collection('court_hearings').get();

        const countComplaints = document.getElementById('stat-complaints-count');
        const countSummons = document.getElementById('stat-summons-count');
        const countHearings = document.getElementById('stat-hearings-count');

        if (countComplaints) countComplaints.textContent = complaintsSnap.size;
        if (countSummons) countSummons.textContent = summonsSnap.size;
        if (countHearings) countHearings.textContent = hearingsSnap.size;
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
    }
}

async function loadUserProfile(user) {
    try {
        const doc = await db.collection('users').doc(user.uid).get();
        let userData = {
            fullName: user.displayName || user.email.split('@')[0],
            role: 'Resident'
        };

        if (doc.exists) {
            userData = { ...userData, ...doc.data() };
        }

        updateUIElements(userData);
    } catch (error) {
        console.error('Error fetching user profile:', error);
    }
}

function updateUIElements(data) {
    const nameElements = document.querySelectorAll('.user-name');
    const roleElements = document.querySelectorAll('.user-role');
    const avatarElements = document.querySelectorAll('.user-avatar, .dropdown-avatar');

    const initials = data.fullName
        ? data.fullName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)
        : 'U';

    nameElements.forEach(el => el.textContent = data.fullName);
    roleElements.forEach(el => el.textContent = data.role);
    avatarElements.forEach(el => el.textContent = initials);
}

function initDropdownToggle() {
    const trigger = document.querySelector('.user-profile-trigger');
    const dropdown = document.querySelector('.profile-dropdown');

    if (trigger && dropdown) {
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('show');
        });

        document.addEventListener('click', () => {
            if (dropdown.classList.contains('show')) {
                dropdown.classList.remove('show');
            }
        });
    }
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) {
        alert(message);
        return;
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `
        background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#2563eb'};
        color: #ffffff;
        padding: 12px 16px;
        border-radius: 6px;
        margin-top: 8px;
        font-size: 0.875rem;
        box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
        transition: opacity 0.3s ease;
    `;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function getReadableErrorMessage(code) {
    switch (code) {
        case 'auth/invalid-email':
            return 'Invalid email address format.';
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
            return 'Invalid email or password.';
        case 'auth/email-already-in-use':
            return 'This email address is already registered.';
        case 'auth/weak-password':
            return 'Password must be at least 6 characters long.';
        default:
            return 'An unexpected error occurred. Please try again.';
    }
}
