/**
 * 게임잡스 - 관리자 페이지 JavaScript
 */

// ===================================
// Global State
// ===================================
const adminState = {
    jobs: [],
    editingId: null,
    tags: [],
    deleteTargetId: null,
    lastSavedData: null,
    pendingAction: null
};

// 주요 회사 목록
const COMPANIES = [
    '크래프톤', '넥슨', '엔씨소프트', '넷마블', '컴투스', 'NHN', '펄어비스',
    '스마일게이트', '데브시스터즈', '시프트업', '블루홀 스튜디오', '넥슨게임즈',
    '위메이드', '카카오게임즈', '호요버스', '라이엇 게임즈', '슈퍼셀',
    '그라비티', '웹젠', '네오위즈', '4:33', '게임빌', '베스파', '미호요'
];

// ===================================
// DOM Elements
// ===================================
const adminElements = {
    // Theme
    themeToggle: document.getElementById('theme-toggle'),

    // Form
    form: document.getElementById('job-form'),
    formTitle: document.getElementById('form-title'),
    resetForm: document.getElementById('reset-form'),
    submitText: document.getElementById('submit-text'),

    // Form inputs
    jobId: document.getElementById('job-id'),
    company: document.getElementById('company'),
    companySuggestions: document.getElementById('company-suggestions'),
    position: document.getElementById('position'),
    jobType: document.getElementById('job-type'),
    category: document.getElementById('category'),
    deadline: document.getElementById('deadline'),
    link: document.getElementById('link'),
    tagsInput: document.getElementById('tags-input'),
    tagsList: document.getElementById('tags-list'),
    description: document.getElementById('description'),
    isActive: document.getElementById('is-active'),

    // Buttons
    previewBtn: document.getElementById('preview-btn'),
    refreshList: document.getElementById('refresh-list'),

    // List
    jobList: document.getElementById('admin-job-list'),
    jobCount: document.getElementById('job-count'),
    adminSearch: document.getElementById('admin-search'),
    adminLoading: document.getElementById('admin-loading'),

    // Modals
    previewModal: document.getElementById('preview-modal'),
    previewClose: document.getElementById('preview-close'),
    previewBody: document.getElementById('preview-body'),
    deleteModal: document.getElementById('delete-modal'),
    cancelDelete: document.getElementById('cancel-delete'),
    confirmDelete: document.getElementById('confirm-delete'),

    // Confirm Leave Modal
    confirmModal: document.getElementById('confirm-modal'),
    saveConfirm: document.getElementById('save-confirm'),
    discardConfirm: document.getElementById('discard-confirm'),
    cancelConfirm: document.getElementById('cancel-confirm'),

    // Toast
    toastContainer: document.getElementById('toast-container')
};

// ===================================
// Initialization
// ===================================
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initForm();
    initCompanySuggestions();
    initTags();
    initModals();
    initConfirmModal(); // New initialization
    initSearch();
    loadJobs();
});

// ===================================
// Theme Management
// ===================================
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);

    adminElements.themeToggle?.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
    });
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);

    const icon = adminElements.themeToggle?.querySelector('i');
    if (icon) {
        icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }
}

// ===================================
// Form Management
// ===================================
function initForm() {
    // Form submit
    adminElements.form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveJob();
    });

    // Reset form (New Job button)
    adminElements.resetForm?.addEventListener('click', resetForm);

    // Preview
    adminElements.previewBtn?.addEventListener('click', showPreview);

    // Refresh list
    adminElements.refreshList?.addEventListener('click', loadJobs);

    // Initialize baseline
    performResetForm();

    // Event Delegation for Job List
    adminElements.jobList?.addEventListener('click', (e) => {
        const btnEdit = e.target.closest('.btn-edit');
        const btnDelete = e.target.closest('.btn-delete');
        const item = e.target.closest('.admin-job-item');

        if (!item) return;
        const id = item.dataset.id;

        if (btnEdit) {
            editJob(id);
        } else if (btnDelete) {
            confirmDeleteJob(id);
        }
    });
}

// ===================================
// Helper Functions
// ===================================
function getHeaders() {
    const config = window.CONFIG || {};
    const headers = { 'Content-Type': 'application/json' };
    if (config.SUPABASE?.KEY) {
        headers['apikey'] = config.SUPABASE.KEY;
        headers['Authorization'] = `Bearer ${config.SUPABASE.KEY}`;
    }
    return headers;
}

function getFormData() {
    return {
        company: adminElements.company.value.trim(),
        position: adminElements.position.value.trim(),
        job_type: adminElements.jobType.value,
        category: adminElements.category.value,
        deadline: adminElements.deadline.value || '',
        link: adminElements.link.value.trim(),
        tags: [...adminState.tags].sort().join(','),
        description: adminElements.description.value.trim(),
        isActive: adminElements.isActive.checked
    };
}

function hasUnsavedChanges() {
    if (!adminState.lastSavedData) return false;
    const current = getFormData();
    return JSON.stringify(current) !== JSON.stringify(adminState.lastSavedData);
}

function executePendingAction() {
    const action = adminState.pendingAction;
    if (!action) return;

    if (action.type === 'edit') {
        performEditJob(action.id);
    } else if (action.type === 'reset') {
        performResetForm();
    }

    adminState.pendingAction = null;
}

// ===================================
// Core Logic
// ===================================
async function saveJob(skipReset = false) {
    // Disable submit button during processing
    const submitBtn = adminElements.form.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 저장 중...';
    }

    const jobData = {
        company: adminElements.company.value.trim(),
        position: adminElements.position.value.trim(),
        job_type: adminElements.jobType.value,
        category: adminElements.category.value,
        deadline: adminElements.deadline.value || null,
        link: adminElements.link.value.trim() || null,
        tags: [...adminState.tags],
        // description: adminElements.description.value.trim() || null, // DB schema missing this column
        is_active: adminElements.isActive.checked
    };

    try {
        let response;
        const config = window.CONFIG || {};
        const baseUrl = config.API_BASE_URL;
        const isSupabase = !!config.SUPABASE?.URL;
        const fetchUrl = isSupabase ? baseUrl : 'tables/job_postings'; // Fallback

        if (adminState.editingId) {
            // Update existing job
            const queryParam = getSupabaseQueryParam(adminState.editingId);

            response = await fetch(`${fetchUrl}?${queryParam}`, {
                method: 'PATCH',
                headers: getHeaders(),
                body: JSON.stringify(jobData)
            });
            showToast('공고가 수정되었습니다.', 'success');
        } else {
            // Create new job
            response = await fetch(fetchUrl, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(jobData)
            });
            showToast('공고가 등록되었습니다.', 'success');
        }

        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`Failed to save job: ${errBody}`);
        }

        if (!skipReset) performResetForm();
        loadJobs();
        return true;
    } catch (error) {
        console.error('Failed to save job:', error);

        // Handle unique constraint violation (duplicate link)
        if (error.message.includes('23505') || error.message.includes('unique constraint')) {
            showToast('이미 등록된 공고 링크입니다.', 'error');
        } else {
            showToast(`저장 중 오류가 발생했습니다: ${error.message}`, 'error');
        }
        return false;
    } finally {
        // Re-enable submit button
        const submitBtn = adminElements.form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = adminState.editingId ? '수정하기' : '등록하기';
        }
    }
}

function editJob(jobId) {
    if (String(adminState.editingId) === String(jobId)) {
        adminElements.form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
    }

    if (hasUnsavedChanges()) {
        adminState.pendingAction = { type: 'edit', id: jobId };
        adminElements.confirmModal.classList.add('active');
    } else {
        performEditJob(jobId);
    }
}

function performEditJob(jobId) {
    // Find job by ID or Link
    const job = adminState.jobs.find(j => String(j.id) === String(jobId) || j.link === jobId);
    if (!job) {
        console.error(`[Admin] Job not found: ${jobId}`);
        return;
    }

    adminState.editingId = jobId;

    // Fill form
    adminElements.jobId.value = jobId;
    adminElements.company.value = job.company || '';
    adminElements.position.value = job.position || '';
    adminElements.jobType.value = job.job_type || '';
    adminElements.category.value = job.category || '';
    adminElements.deadline.value = job.deadline ? job.deadline.split('T')[0] : '';
    adminElements.link.value = job.link || '';
    adminElements.description.value = job.description || '';
    adminElements.isActive.checked = job.is_active !== false;

    // Set tags
    adminState.tags = [...(job.tags || [])];
    renderTags();

    // Update baseline
    adminState.lastSavedData = getFormData();

    // Update UI
    adminElements.formTitle.innerHTML = '<i class="fas fa-edit"></i> 공고 수정';
    adminElements.submitText.textContent = '수정하기';
    adminElements.resetForm.style.display = 'inline-flex';

    // Visual Feedback: Highlight form
    const formSection = document.querySelector('.admin-form-section');
    formSection.classList.add('editing-active');
    setTimeout(() => formSection.classList.add('pulse'), 100);

    // Scroll to form
    adminElements.form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetForm() {
    if (hasUnsavedChanges()) {
        adminState.pendingAction = { type: 'reset' };
        adminElements.confirmModal.classList.add('active');
    } else {
        performResetForm();
    }
}

function performResetForm() {
    adminState.editingId = null;
    adminState.tags = [];

    adminElements.form.reset();
    adminElements.jobId.value = '';
    adminElements.isActive.checked = true;
    renderTags();

    // Update baseline
    adminState.lastSavedData = getFormData();

    adminElements.formTitle.innerHTML = '<i class="fas fa-plus-circle"></i> 새 공고 등록';
    adminElements.submitText.textContent = '등록하기';
    adminElements.resetForm.style.display = 'none';

    // Remove highlight
    document.querySelector('.admin-form-section').classList.remove('editing-active', 'pulse');
}

// ===================================
// Company Suggestions
// ===================================
function initCompanySuggestions() {
    adminElements.company?.addEventListener('input', (e) => {
        const value = e.target.value.toLowerCase();
        if (value.length < 1) {
            adminElements.companySuggestions.classList.remove('active');
            return;
        }

        const matches = COMPANIES.filter(c => c.toLowerCase().includes(value));
        if (matches.length > 0) {
            adminElements.companySuggestions.innerHTML = matches
                .slice(0, 5)
                .map(c => `<div class="company-suggestion">${c}</div>`)
                .join('');
            adminElements.companySuggestions.classList.add('active');
        } else {
            adminElements.companySuggestions.classList.remove('active');
        }
    });

    adminElements.companySuggestions?.addEventListener('click', (e) => {
        if (e.target.classList.contains('company-suggestion')) {
            adminElements.company.value = e.target.textContent;
            adminElements.companySuggestions.classList.remove('active');
        }
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.form-group')) {
            adminElements.companySuggestions?.classList.remove('active');
        }
    });
}

// ===================================
// Tags Management
// ===================================
function initTags() {
    // Input enter key
    adminElements.tagsInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addTag(adminElements.tagsInput.value);
            adminElements.tagsInput.value = '';
        }
    });

    // Quick tag buttons
    document.querySelectorAll('.quick-tag-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            addTag(btn.dataset.tag);
        });
    });
}

function addTag(tag) {
    tag = tag.trim();
    if (!tag || adminState.tags.includes(tag)) return;

    adminState.tags.push(tag);
    renderTags();
}

function removeTag(tag) {
    adminState.tags = adminState.tags.filter(t => t !== tag);
    renderTags();
}

function renderTags() {
    adminElements.tagsList.innerHTML = adminState.tags
        .map(tag => `
            <span class="tag-item">
                ${escapeHtml(tag)}
                <button type="button" onclick="removeTag('${escapeHtml(tag)}')">&times;</button>
            </span>
        `)
        .join('');
}

// ===================================
// Job List
// ===================================
async function loadJobs() {
    if (!adminElements.adminLoading) return;

    adminElements.adminLoading.style.display = 'block';
    adminElements.jobList.style.display = 'none';

    try {
        const config = window.CONFIG || {};
        const baseUrl = config.API_BASE_URL;
        const isSupabase = !!config.SUPABASE?.URL;

        // Use basic select if Supabase, otherwise just the URL
        const fetchUrl = isSupabase ? `${baseUrl}?select=*` : baseUrl;

        console.log(`[Admin] Fetching from: ${fetchUrl}`);

        const response = await fetch(fetchUrl, {
            method: 'GET',
            headers: getHeaders()
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Admin] Fetch Error: ${response.status} ${response.statusText}`, errorText);
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        console.log(`[Admin] Loaded ${Array.isArray(result) ? result.length : 'unknown'} jobs`);

        adminState.jobs = Array.isArray(result) ? result : (result.data || []);
        renderJobList();
    } catch (error) {
        console.error('[Admin] Failed to load jobs:', error);
        showToast(`공고 목록을 불러오는데 실패했습니다: ${error.message}`, 'error');
    } finally {
        adminElements.adminLoading.style.display = 'none';
        adminElements.jobList.style.display = 'flex';
    }
}

function renderJobList(filter = '') {
    let jobs = [...adminState.jobs];

    // Apply filter
    if (filter) {
        const filterLower = filter.toLowerCase();
        jobs = jobs.filter(job =>
            (job.company || '').toLowerCase().includes(filterLower) ||
            (job.position || '').toLowerCase().includes(filterLower)
        );
    }

    // Sort by created_at desc
    jobs.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));

    adminElements.jobCount.textContent = jobs.length;

    if (jobs.length === 0) {
        adminElements.jobList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>등록된 공고가 없습니다.</p>
            </div>
        `;
        return;
    }

    adminElements.jobList.innerHTML = jobs.map(job => {
        const deadline = job.deadline ? new Date(job.deadline).toLocaleDateString('ko-KR') : '채용시 마감';
        const uniqueId = job.id || job.link; // Fallback to link if id is missing

        return `
            <div class="admin-job-item ${job.is_active === false ? 'inactive' : ''}" data-id="${escapeHtml(uniqueId)}">
                <div class="job-item-info">
                    <div class="job-item-company">${escapeHtml(job.company || '')}</div>
                    <div class="job-item-title">${escapeHtml(job.position || '')}</div>
                    <div class="job-item-meta">
                        <span>${job.job_type || '수시'}</span>
                        <span>${job.category || '기타'}</span>
                        <span>마감: ${deadline}</span>
                    </div>
                </div>
                <div class="job-item-actions">
                    <button class="btn-edit" title="수정">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-delete" title="삭제">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function initSearch() {
    adminElements.adminSearch?.addEventListener('input', debounce((e) => {
        renderJobList(e.target.value);
    }, 300));
}

// ===================================
// Delete Job
// ===================================
function confirmDeleteJob(jobId) {
    adminState.deleteTargetId = jobId;
    adminElements.deleteModal?.classList.add('active');
}

async function deleteJob() {
    if (!adminState.deleteTargetId) return;

    try {
        const config = window.CONFIG || {};
        const baseUrl = config.API_BASE_URL;
        const fetchUrl = config.SUPABASE?.URL ? baseUrl : 'tables/job_postings';

        // Determine identifier type
        const queryParam = getSupabaseQueryParam(adminState.deleteTargetId);

        const response = await fetch(`${fetchUrl}?${queryParam}`, {
            method: 'DELETE',
            headers: getHeaders()
        });

        if (!response.ok) {
            throw new Error('Failed to delete job');
        }

        showToast('공고가 삭제되었습니다.', 'success');
        adminElements.deleteModal?.classList.remove('active');
        adminState.deleteTargetId = null;

        // If editing the deleted job, reset form
        if (adminState.editingId === adminState.deleteTargetId) {
            resetForm();
        }

        loadJobs();
    } catch (error) {
        console.error('Failed to delete job:', error);
        showToast('삭제 중 오류가 발생했습니다.', 'error');
    }
}

// ===================================
// Modals
// ===================================
function initModals() {
    // Preview modal
    adminElements.previewClose?.addEventListener('click', () => {
        adminElements.previewModal?.classList.remove('active');
    });

    document.querySelector('#preview-modal .modal-overlay')?.addEventListener('click', () => {
        adminElements.previewModal?.classList.remove('active');
    });

    // Delete modal
    adminElements.cancelDelete?.addEventListener('click', () => {
        adminElements.deleteModal?.classList.remove('active');
        adminState.deleteTargetId = null;
    });

    adminElements.confirmDelete?.addEventListener('click', deleteJob);

    document.querySelector('#delete-modal .modal-overlay')?.addEventListener('click', () => {
        adminElements.deleteModal?.classList.remove('active');
        adminState.deleteTargetId = null;
    });
}

function showPreview() {
    const job = {
        company: adminElements.company.value.trim() || '회사명',
        position: adminElements.position.value.trim() || '포지션명',
        job_type: adminElements.jobType.value || '수시',
        category: adminElements.category.value || '기타',
        deadline: adminElements.deadline.value || null,
        link: adminElements.link.value.trim() || null,
        tags: [...adminState.tags],
        description: adminElements.description.value.trim() || null
    };

    const deadlineText = job.deadline
        ? new Date(job.deadline).toLocaleDateString('ko-KR')
        : '채용시 마감';

    adminElements.previewBody.innerHTML = `
        <div class="modal-company">
            <i class="fas fa-building"></i>
            ${escapeHtml(job.company)}
        </div>
        <h2 class="modal-title">${escapeHtml(job.position)}</h2>
        <div class="modal-meta">
            <span class="modal-meta-item">
                <i class="fas fa-tag"></i>
                ${escapeHtml(job.job_type)}
            </span>
            <span class="modal-meta-item">
                <i class="fas fa-folder"></i>
                ${escapeHtml(job.category)}
            </span>
            <span class="modal-meta-item">
                <i class="fas fa-clock"></i>
                ${deadlineText}
            </span>
        </div>
        ${job.tags.length > 0 ? `
            <div class="modal-tags">
                ${job.tags.map(tag => `<span class="modal-tag">${escapeHtml(tag)}</span>`).join('')}
            </div>
        ` : ''}
        ${job.description ? `
            <div class="modal-description">
                ${escapeHtml(job.description)}
            </div>
        ` : ''}
        <div class="modal-actions">
            ${job.link ? `
                <a href="${escapeHtml(job.link)}" target="_blank" class="btn btn-primary">
                    <i class="fas fa-external-link-alt"></i>
                    공고 페이지로 이동
                </a>
            ` : ''}
            <button class="btn btn-secondary" onclick="document.getElementById('preview-modal').classList.remove('active')">
                닫기
            </button>
        </div>
    `;

    adminElements.previewModal?.classList.add('active');
}

// ===================================
// Toast Messages
// ===================================
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon;
    switch (type) {
        case 'success':
            icon = 'fa-check-circle';
            break;
        case 'error':
            icon = 'fa-exclamation-circle';
            break;
        default:
            icon = 'fa-info-circle';
    }

    toast.innerHTML = `
        <i class="fas ${icon}"></i>
        <p>${escapeHtml(message)}</p>
    `;

    adminElements.toastContainer?.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ===================================
// Utility Functions
// ===================================
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getSupabaseQueryParam(idOrLink) {
    // Determine if identifier is an ID (number) or Link (string url)
    // Note: empty string/null check should be done by caller or considered valid 0 handling if needed
    const isId = !isNaN(Number(idOrLink)) && idOrLink !== '' && idOrLink !== null;
    return isId ? `id=eq.${idOrLink}` : `link=eq.${idOrLink}`;
}


// Make functions globally accessible
window.editJob = editJob;
window.resetForm = resetForm;
window.removeTag = removeTag;
window.confirmDeleteJob = confirmDeleteJob;
window.loadJobs = loadJobs;

// ===================================
// Confirm Modal Initialization
// ===================================
function initConfirmModal() {
    adminElements.saveConfirm?.addEventListener('click', async () => {
        const success = await saveJob(true); // skipReset = true
        if (success) {
            adminElements.confirmModal.classList.remove('active');
            executePendingAction();
        }
    });

    adminElements.discardConfirm?.addEventListener('click', () => {
        adminElements.confirmModal.classList.remove('active');
        executePendingAction(); // Proceed without saving
    });

    adminElements.cancelConfirm?.addEventListener('click', () => {
        adminElements.confirmModal.classList.remove('active');
        adminState.pendingAction = null;
    });

    document.querySelector('#confirm-modal .modal-overlay')?.addEventListener('click', () => {
        adminElements.confirmModal.classList.remove('active');
        adminState.pendingAction = null;
    });
}
