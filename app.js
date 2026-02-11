// Configuration
const API_URL = 'https://scheduler-backend-j95s.onrender.com'; // Change this to your deployed backend URL

// State management
let token = localStorage.getItem('token');
let currentUser = null;
let calendar = null;
let currentFilter = 'incomplete';

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    if (token) {
        checkAuth();
    } else {
        showPage('loginPage');
    }
    
    setupEventListeners();
});

// ============= Page Management =============

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
}

function showView(viewId) {
    document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.querySelector(`[data-view="${viewId.replace('View', '')}"]`)?.classList.add('active');
}

function showLoading() {
    document.getElementById('loadingIndicator').classList.add('active');
}

function hideLoading() {
    document.getElementById('loadingIndicator').classList.remove('active');
}

function showMessage(elementId, message, type) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.className = `message ${type} show`;
    setTimeout(() => element.classList.remove('show'), 5000);
}

// ============= Event Listeners =============

function setupEventListeners() {
    // Auth form
    document.getElementById('loginBtn').addEventListener('click', (e) => {
        e.preventDefault();
        login();
    });
    
    document.getElementById('registerBtn').addEventListener('click', (e) => {
        e.preventDefault();
        register();
    });
    
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', logout);
    
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const view = item.dataset.view;
            showView(view + 'View');
            loadViewData(view);
        });
    });
    
    // Add buttons
    document.getElementById('addAssignmentBtn').addEventListener('click', () => openAssignmentModal());
    document.getElementById('addClassBtn').addEventListener('click', () => openClassModal());
    document.getElementById('addMeetingBtn').addEventListener('click', () => openMeetingModal());
    
    // Regenerate schedule
    document.getElementById('regenerateBtn').addEventListener('click', regenerateSchedule);
    
    // Settings form
    document.getElementById('settingsForm').addEventListener('submit', (e) => {
        e.preventDefault();
        saveSettings();
    });
    
    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            loadAssignments();
        });
    });
    
    // Copy meeting link
    document.getElementById('copyLinkBtn').addEventListener('click', () => {
        const input = document.getElementById('meetingLink');
        input.select();
        document.execCommand('copy');
        showMessage('authMessage', 'Link copied to clipboard!', 'success');
    });
    
    // Modal close
    document.querySelector('.modal-close').addEventListener('click', closeModal);
    document.getElementById('modal').addEventListener('click', (e) => {
        if (e.target.id === 'modal') closeModal();
    });
}

// ============= Authentication =============

async function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    try {
        showLoading();
        const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        if (response.ok) {
            const data = await response.json();
            token = data.access_token;
            localStorage.setItem('token', token);
            await checkAuth();
        } else {
            const error = await response.json();
            showMessage('authMessage', error.detail || 'Login failed', 'error');
        }
    } catch (error) {
        showMessage('authMessage', 'Connection error. Is the backend running?', 'error');
    } finally {
        hideLoading();
    }
}

async function register() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    try {
        showLoading();
        const response = await fetch(`${API_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        if (response.ok) {
            showMessage('authMessage', 'Account created! Please login.', 'success');
        } else {
            const error = await response.json();
            showMessage('authMessage', error.detail || 'Registration failed', 'error');
        }
    } catch (error) {
        showMessage('authMessage', 'Connection error. Is the backend running?', 'error');
    } finally {
        hideLoading();
    }
}

async function checkAuth() {
    try {
        const response = await fetch(`${API_URL}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            currentUser = await response.json();
            showDashboard();
        } else {
            logout();
        }
    } catch (error) {
        logout();
    }
}

function logout() {
    token = null;
    currentUser = null;
    localStorage.removeItem('token');
    showPage('loginPage');
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
}

function showDashboard() {
    showPage('dashboardPage');
    document.getElementById('usernameDisplay').textContent = currentUser.username;
    
    // Set meeting link
    const meetingLink = `${window.location.origin}/schedule.html?user=${currentUser.username}`;
    document.getElementById('meetingLink').value = meetingLink;
    
    // Initialize calendar
    initCalendar();
    
    // Load initial data
    loadViewData('calendar');
    loadSettings();
}

// ============= Data Loading =============

function loadViewData(view) {
    switch(view) {
        case 'calendar':
            loadCalendar();
            break;
        case 'assignments':
            loadAssignments();
            break;
        case 'schedule':
            loadClasses();
            break;
        case 'meetings':
            loadMeetings();
            break;
        case 'study-blocks':
            loadStudyBlocks();
            break;
    }
}

async function loadAssignments() {
    try {
        showLoading();
        const params = currentFilter !== 'all' ? `?completed=${currentFilter === 'completed'}` : '';
        const response = await fetch(`${API_URL}/api/assignments${params}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const assignments = await response.json();
            renderAssignments(assignments);
        }
    } catch (error) {
        console.error('Error loading assignments:', error);
    } finally {
        hideLoading();
    }
}

function renderAssignments(assignments) {
    const container = document.getElementById('assignmentsList');
    
    if (assignments.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📚</div>
                <p>No assignments yet. Create your first one!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = assignments.map(assignment => `
        <div class="item-card">
            <div class="item-header">
                <div>
                    <h3 class="item-title">${assignment.title}</h3>
                    <div class="item-meta">
                        <span>📁 ${assignment.category}</span>
                        <span>📅 Due: ${new Date(assignment.due_date).toLocaleDateString()}</span>
                        ${assignment.estimated_time_minutes ? `<span>⏱️ Est: ${assignment.estimated_time_minutes} min</span>` : ''}
                        ${assignment.completed ? `<span class="badge badge-completed">Completed</span>` : ''}
                        <span class="badge badge-priority-${assignment.priority}">
                            ${['Low', 'Medium', 'High'][assignment.priority - 1]} Priority
                        </span>
                    </div>
                </div>
                <div class="item-actions">
                    ${!assignment.completed ? `
                        <button class="btn btn-secondary" onclick="completeAssignment(${assignment.id})">
                            ✓ Complete
                        </button>
                    ` : ''}
                    <button class="btn btn-secondary" onclick="deleteAssignment(${assignment.id})">
                        🗑️ Delete
                    </button>
                </div>
            </div>
            ${assignment.description ? `<p>${assignment.description}</p>` : ''}
        </div>
    `).join('');
}

async function loadClasses() {
    try {
        showLoading();
        const response = await fetch(`${API_URL}/api/classes`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const classes = await response.json();
            renderClasses(classes);
        }
    } catch (error) {
        console.error('Error loading classes:', error);
    } finally {
        hideLoading();
    }
}

function renderClasses(classes) {
    const container = document.getElementById('classesList');
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    if (classes.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🎓</div>
                <p>No classes scheduled. Add your first class!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = classes.map(cls => `
        <div class="item-card">
            <div class="item-header">
                <div>
                    <h3 class="item-title">${cls.title}</h3>
                    <div class="item-meta">
                        <span>📅 ${days[cls.day_of_week]}</span>
                        <span>⏰ ${cls.start_time} - ${cls.end_time}</span>
                    </div>
                </div>
                <div class="item-actions">
                    <button class="btn btn-secondary" onclick="deleteClass(${cls.id})">
                        🗑️ Delete
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

async function loadMeetings() {
    try {
        showLoading();
        const response = await fetch(`${API_URL}/api/meetings`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const meetings = await response.json();
            renderMeetings(meetings);
        }
    } catch (error) {
        console.error('Error loading meetings:', error);
    } finally {
        hideLoading();
    }
}

function renderMeetings(meetings) {
    const container = document.getElementById('meetingsList');
    
    if (meetings.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🤝</div>
                <p>No meetings scheduled.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = meetings.map(meeting => `
        <div class="item-card">
            <div class="item-header">
                <div>
                    <h3 class="item-title">${meeting.title}</h3>
                    <div class="item-meta">
                        <span>📅 ${new Date(meeting.start_time).toLocaleString()}</span>
                        ${meeting.attendee_name ? `<span>👤 ${meeting.attendee_name}</span>` : ''}
                        ${!meeting.created_by_owner ? `<span class="badge badge-priority-1">Booked via link</span>` : ''}
                    </div>
                </div>
                <div class="item-actions">
                    <button class="btn btn-secondary" onclick="deleteMeeting(${meeting.id})">
                        🗑️ Delete
                    </button>
                </div>
            </div>
            ${meeting.description ? `<p>${meeting.description}</p>` : ''}
        </div>
    `).join('');
}

async function loadStudyBlocks() {
    try {
        showLoading();
        const response = await fetch(`${API_URL}/api/study-blocks`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const blocks = await response.json();
            renderStudyBlocks(blocks);
        }
    } catch (error) {
        console.error('Error loading study blocks:', error);
    } finally {
        hideLoading();
    }
}

function renderStudyBlocks(blocks) {
    const container = document.getElementById('studyBlocksList');
    
    if (blocks.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📖</div>
                <p>No study blocks generated yet. Add some assignments and they'll appear automatically!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = blocks.map(block => `
        <div class="item-card">
            <div class="item-header">
                <div>
                    <h3 class="item-title">Study: ${block.assignment_title}</h3>
                    <div class="item-meta">
                        <span>📅 ${new Date(block.start_time).toLocaleString()}</span>
                        <span>⏱️ ${Math.round((new Date(block.end_time) - new Date(block.start_time)) / 60000)} min</span>
                        <span>📁 ${block.assignment_category}</span>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

async function loadSettings() {
    try {
        const response = await fetch(`${API_URL}/api/preferences`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const settings = await response.json();
            document.getElementById('wakeTime').value = settings.wake_time;
            document.getElementById('bedTime').value = settings.bedtime;
            document.getElementById('studyBlockDuration').value = settings.default_study_block_minutes;
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

async function saveSettings() {
    const settings = {
        wake_time: document.getElementById('wakeTime').value,
        bedtime: document.getElementById('bedTime').value,
        default_study_block_minutes: parseInt(document.getElementById('studyBlockDuration').value)
    };
    
    try {
        showLoading();
        const response = await fetch(`${API_URL}/api/preferences`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(settings)
        });
        
        if (response.ok) {
            showMessage('authMessage', 'Settings saved successfully!', 'success');
        }
    } catch (error) {
        showMessage('authMessage', 'Error saving settings', 'error');
    } finally {
        hideLoading();
    }
}

// ============= Calendar =============

function initCalendar() {
    const calendarEl = document.getElementById('calendar');
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        height: 'auto',
        events: loadCalendarEvents,
        eventClick: handleEventClick
    });
}

async function loadCalendar() {
    if (calendar) {
        await calendar.refetchEvents();
        calendar.render();
    }
}

async function loadCalendarEvents(info, successCallback, failureCallback) {
    try {
        const start = info.start.toISOString();
        const end = info.end.toISOString();
        
        const response = await fetch(`${API_URL}/api/calendar?start_date=${start}&end_date=${end}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            const events = data.events.map(event => {
                let color = '#D4754E';
                if (event.type === 'class') color = '#1E3A5F';
                if (event.type === 'meeting') color = '#7A9B76';
                if (event.type === 'study_block') color = '#E89572';
                
                return {
                    id: event.id,
                    title: event.title,
                    start: event.start_time,
                    end: event.end_time,
                    backgroundColor: color,
                    borderColor: color,
                    extendedProps: {
                        type: event.type,
                        ...event
                    }
                };
            });
            successCallback(events);
        } else {
            failureCallback();
        }
    } catch (error) {
        failureCallback();
    }
}

function handleEventClick(info) {
    const event = info.event.extendedProps;
    alert(`${info.event.title}\n\nType: ${event.type}\nTime: ${new Date(info.event.start).toLocaleString()}`);
}

// ============= Modals =============

function openModal(title, content) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = content;
    document.getElementById('modal').classList.add('active');
}

function closeModal() {
    document.getElementById('modal').classList.remove('active');
}

function openAssignmentModal() {
    const content = `
        <form id="assignmentForm" class="form">
            <div class="form-group">
                <label>Title</label>
                <input type="text" id="assignmentTitle" required>
            </div>
            <div class="form-group">
                <label>Category</label>
                <input type="text" id="assignmentCategory" value="General">
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea id="assignmentDescription"></textarea>
            </div>
            <div class="form-group">
                <label>Due Date</label>
                <input type="datetime-local" id="assignmentDueDate" required>
            </div>
            <div class="form-group">
                <label>Priority</label>
                <select id="assignmentPriority">
                    <option value="1">Low</option>
                    <option value="2" selected>Medium</option>
                    <option value="3">High</option>
                </select>
            </div>
            <div class="form-group">
                <label>Estimated Time (minutes)</label>
                <input type="number" id="assignmentEstTime" min="0" placeholder="Leave blank for auto-estimate">
            </div>
            <button type="submit" class="btn btn-primary">Create Assignment</button>
        </form>
    `;
    
    openModal('New Assignment', content);
    
    document.getElementById('assignmentForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await createAssignment();
    });
}

async function createAssignment() {
    const assignment = {
        title: document.getElementById('assignmentTitle').value,
        category: document.getElementById('assignmentCategory').value,
        description: document.getElementById('assignmentDescription').value,
        due_date: new Date(document.getElementById('assignmentDueDate').value).toISOString(),
        priority: parseInt(document.getElementById('assignmentPriority').value),
        estimated_time_minutes: document.getElementById('assignmentEstTime').value ? 
            parseInt(document.getElementById('assignmentEstTime').value) : null
    };
    
    try {
        showLoading();
        const response = await fetch(`${API_URL}/api/assignments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(assignment)
        });
        
        if (response.ok) {
            closeModal();
            loadAssignments();
            loadCalendar();
            loadStudyBlocks();
        }
    } catch (error) {
        console.error('Error creating assignment:', error);
    } finally {
        hideLoading();
    }
}

async function completeAssignment(id) {
    const actualTime = prompt('How long did this assignment take? (minutes, or leave blank)');
    
    try {
        showLoading();
        const response = await fetch(`${API_URL}/api/assignments/${id}/complete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                actual_time_minutes: actualTime ? parseInt(actualTime) : null
            })
        });
        
        if (response.ok) {
            loadAssignments();
            loadCalendar();
            loadStudyBlocks();
        }
    } catch (error) {
        console.error('Error completing assignment:', error);
    } finally {
        hideLoading();
    }
}

async function deleteAssignment(id) {
    if (!confirm('Delete this assignment?')) return;
    
    try {
        showLoading();
        await fetch(`${API_URL}/api/assignments/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        loadAssignments();
        loadCalendar();
        loadStudyBlocks();
    } catch (error) {
        console.error('Error deleting assignment:', error);
    } finally {
        hideLoading();
    }
}

function openClassModal() {
    const content = `
        <form id="classForm" class="form">
            <div class="form-group">
                <label>Class Name</label>
                <input type="text" id="className" required>
            </div>
            <div class="form-group">
                <label>Day of Week</label>
                <select id="classDay" required>
                    <option value="0">Monday</option>
                    <option value="1">Tuesday</option>
                    <option value="2">Wednesday</option>
                    <option value="3">Thursday</option>
                    <option value="4">Friday</option>
                    <option value="5">Saturday</option>
                    <option value="6">Sunday</option>
                </select>
            </div>
            <div class="form-group">
                <label>Start Time</label>
                <input type="time" id="classStartTime" required>
            </div>
            <div class="form-group">
                <label>End Time</label>
                <input type="time" id="classEndTime" required>
            </div>
            <button type="submit" class="btn btn-primary">Add Class</button>
        </form>
    `;
    
    openModal('Add Class', content);
    
    document.getElementById('classForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await createClass();
    });
}

async function createClass() {
    const classData = {
        title: document.getElementById('className').value,
        day_of_week: parseInt(document.getElementById('classDay').value),
        start_time: document.getElementById('classStartTime').value,
        end_time: document.getElementById('classEndTime').value
    };
    
    try {
        showLoading();
        const response = await fetch(`${API_URL}/api/classes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(classData)
        });
        
        if (response.ok) {
            closeModal();
            loadClasses();
            loadCalendar();
            loadStudyBlocks();
        }
    } catch (error) {
        console.error('Error creating class:', error);
    } finally {
        hideLoading();
    }
}

async function deleteClass(id) {
    if (!confirm('Delete this class?')) return;
    
    try {
        showLoading();
        await fetch(`${API_URL}/api/classes/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        loadClasses();
        loadCalendar();
        loadStudyBlocks();
    } catch (error) {
        console.error('Error deleting class:', error);
    } finally {
        hideLoading();
    }
}

function openMeetingModal() {
    const content = `
        <form id="meetingForm" class="form">
            <div class="form-group">
                <label>Title</label>
                <input type="text" id="meetingTitle" required>
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea id="meetingDescription"></textarea>
            </div>
            <div class="form-group">
                <label>Start Time</label>
                <input type="datetime-local" id="meetingStartTime" required>
            </div>
            <div class="form-group">
                <label>End Time</label>
                <input type="datetime-local" id="meetingEndTime" required>
            </div>
            <div class="form-group">
                <label>Attendee Name (optional)</label>
                <input type="text" id="meetingAttendeeName">
            </div>
            <button type="submit" class="btn btn-primary">Create Meeting</button>
        </form>
    `;
    
    openModal('New Meeting', content);
    
    document.getElementById('meetingForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await createMeeting();
    });
}

async function createMeeting() {
    const meeting = {
        title: document.getElementById('meetingTitle').value,
        description: document.getElementById('meetingDescription').value,
        start_time: new Date(document.getElementById('meetingStartTime').value).toISOString(),
        end_time: new Date(document.getElementById('meetingEndTime').value).toISOString(),
        attendee_name: document.getElementById('meetingAttendeeName').value || null
    };
    
    try {
        showLoading();
        const response = await fetch(`${API_URL}/api/meetings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(meeting)
        });
        
        if (response.ok) {
            closeModal();
            loadMeetings();
            loadCalendar();
            loadStudyBlocks();
        }
    } catch (error) {
        console.error('Error creating meeting:', error);
    } finally {
        hideLoading();
    }
}

async function deleteMeeting(id) {
    if (!confirm('Delete this meeting?')) return;
    
    try {
        showLoading();
        await fetch(`${API_URL}/api/meetings/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        loadMeetings();
        loadCalendar();
        loadStudyBlocks();
    } catch (error) {
        console.error('Error deleting meeting:', error);
    } finally {
        hideLoading();
    }
}

async function regenerateSchedule() {
    try {
        showLoading();
        const response = await fetch(`${API_URL}/api/study-blocks/regenerate`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            loadStudyBlocks();
            loadCalendar();
            alert('Schedule regenerated successfully!');
        }
    } catch (error) {
        console.error('Error regenerating schedule:', error);
    } finally {
        hideLoading();
    }
}
