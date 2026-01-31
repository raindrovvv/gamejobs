/**
 * 게임잡스 - 한국 게임업계 신입/인턴 채용 대시보드
 * Main Application JavaScript
 * 
 * 핵심: 검증된 채용 사이트 링크 제공
 * 가짜 데이터 없이 실제 채용 사이트로 바로 연결
 */

// ===================================
// Global State
// ===================================
const state = {
    jobs: [],
    filteredJobs: [],
    currentView: 'jobs', // 채용공고 탭을 기본으로
    filters: {
        company: '',
        category: '',
        type: '',
        engine: '',
        search: ''
    },
    sort: 'deadline',
    calendar: {
        year: new Date().getFullYear(),
        month: new Date().getMonth()
    }
};

// ===================================
// Constants & Mappings
// ===================================
const FILTER_MAPPINGS = {
    category: {
        '기획': ['기획', 'planning', 'gd', '시스템', '레벨', '밸런스', '퀘스트', '설정', '시나리오', '전투', 'combat'],
        '프로그래밍': ['프로그래밍', '프로그래머', '개발', 'develop', 'engineer', '엔지니어', '클라이언트', 'client', '서버', 'server', '프론트', '백앤드', '소프트웨어', 'sw'],
        '아트': ['아트', 'art', '그래픽', 'graphic', '디자인', 'design', '원화', 'concept', '모델러', 'modeler', '애니', 'anim', '이펙트', 'effect', 'ui', 'ux', 'ta', 'technical'],
        'QA': ['qa', 'q.a', '테스트', 'test', '품질', '검증'],
        '사운드': ['사운드', 'sound', '오디오', 'audio', 'bgm', 'sfx', '음향'],
        '마케팅': ['마케팅', 'market', '광고', '홍보', 'pr', '사업', 'business', 'pm', '서비스'],
        '경영지원': ['경영', '인사', 'hr', '총무', '재무', '회계', '법무', 'ga', '지원'],
        '데이터': ['데이터', 'data', '분석', 'analyst', 'ai', '머신러닝', '딥러닝', 'r&d']
    },
    type: {
        '공채': ['공채', '공개채용'],
        '인턴': ['인턴', 'intern', '체험형'],
        '수시': ['수시', '수시채용', '상시채용', '상시']
    }
};

// ===================================
// DOM Elements
// ===================================
const elements = {
    // Navigation
    navLinks: document.querySelectorAll('.nav-link, .mobile-nav-link, .footer-links a[data-view]'),
    mobileMenuBtn: document.getElementById('mobile-menu-btn'),
    mobileMenu: document.getElementById('mobile-menu'),

    // Theme
    themeToggle: document.getElementById('theme-toggle'),

    // Views
    views: document.querySelectorAll('.view'),

    // Search & Filter
    searchInput: document.getElementById('search-input'),
    searchClear: document.getElementById('search-clear'),
    filterCompany: document.getElementById('filter-company'),
    filterCategory: document.getElementById('filter-category'),
    filterType: document.getElementById('filter-type'),
    filterEngine: document.getElementById('filter-engine'),
    filterReset: document.getElementById('filter-reset'),
    quickTags: document.querySelectorAll('.quick-tag'),
    sortSelect: document.getElementById('sort-select'),

    // Jobs
    jobsGrid: document.getElementById('jobs-grid'),
    noResults: document.getElementById('no-results'),
    loading: document.getElementById('loading'),

    // Stats
    statTotal: document.getElementById('stat-total'),
    statCompanies: document.getElementById('stat-companies'),
    statUrgent: document.getElementById('stat-urgent'),

    // Bookmarks


    // Calendar
    calendarDays: document.getElementById('calendar-days'),
    currentMonth: document.getElementById('current-month'),
    prevMonth: document.getElementById('prev-month'),
    nextMonth: document.getElementById('next-month'),
    todayBtn: document.getElementById('today-btn'),

    // Modal
    modal: document.getElementById('job-modal'),
    modalClose: document.getElementById('modal-close'),
    modalBody: document.getElementById('modal-body')
};

// ===================================
// 검증된 채용 사이트 URL
// ===================================

// 원티드 URL (검증됨)
const WANTED_BASE = 'https://www.wanted.co.kr';
const SARAMIN_BASE = 'https://www.saramin.co.kr';

// 키워드 URL 인코딩
function encodeKorean(text) {
    return encodeURIComponent(text);
}

// ===================================
// External Links Data (검증된 URL만 사용)
// ===================================

// 신입/인턴 채용 바로가기
// 신입/인턴 채용 바로가기
const JOB_SITE_LINKS = [
    {
        name: '원티드 게임 신입',
        desc: '원티드 게임업계 신입 채용',
        class: 'hot',
        icon: 'fire',
        url: 'https://www.wanted.co.kr/wdlist/518?country=kr&job_sort=job.latest_order&years=0&years=1&years=2'
    },
    {
        name: '사람인 게임 신입',
        desc: '사람인 게임 신입 채용',
        class: 'site',
        icon: 'id-card',
        url: 'https://www.saramin.co.kr/zf_user/search?searchType=search&searchword=%EA%B2%8C%EC%9E%84&panel_type=&search_optional_item=y&search_done=y&panel_count=y&preview=y&recruitPage=1&recruitSort=relation&recruitPageCount=40&inner_com_type=&company_cd=0%2C1%2C2%2C3%2C4%2C5%2C6%2C7%2C9%2C10&show_applied=&quick_apply=&except_read=&ai_head_498=&mainSearch=n&exp_cd=1'
    },
    {
        name: '잡플래닛 게임',
        desc: '잡플래닛 게임업계 채용',
        class: 'site',
        icon: 'star',
        url: 'https://www.jobplanet.co.kr/job_postings?q=%EA%B2%8C%EC%9E%84'
    }
];

// 주요 게임사 - 원티드 검색
const COMPANY_LINKS = [
    {
        name: '크래프톤',
        desc: 'PUBG, 배그, 뉴스테이트',
        class: 'krafton',
        url: 'https://krafton.recruiter.co.kr/app/jobnotice/list'
    },
    {
        name: '넥슨',
        desc: '메이플스토리, 던파',
        class: 'nexon',
        url: 'https://careers.nexon.com/recruit'
    },
    {
        name: '엔씨소프트',
        desc: '리니지, TL, 블소',
        class: 'ncsoft',
        url: 'https://careers.ncsoft.com/apply/list'
    },
    {
        name: '넷마블',
        desc: '세븐나이츠, 일곱개의대죄',
        class: 'netmarble',
        url: 'https://career.netmarble.com/announce'
    },
    {
        name: '컴투스',
        desc: '서머너즈워, 크로니클',
        class: 'com2us',
        url: 'https://com2us.recruiter.co.kr/career/jobs'
    },
    {
        name: 'NHN',
        desc: '한게임',
        class: 'nhn',
        url: 'https://careers.nhn.com/recruits'
    },
    {
        name: '펄어비스',
        desc: '검은사막, 붉은사막',
        class: 'pearl',
        url: 'https://www.pearlabyss.com/ko-KR/Company/Careers/List'
    },
    {
        name: '스마일게이트',
        desc: '로스트아크, 크로스파이어',
        class: 'smilegate',
        url: 'https://careers.smilegate.com/apply/announce'
    },
    {
        name: '카카오게임즈',
        desc: '오딘, 우마무스메',
        class: 'kakao',
        url: 'https://recruit.kakaogames.com/ko/joinjuskr'
    },
    {
        name: '위메이드',
        desc: '미르4, 미르M',
        class: 'wemade',
        url: 'https://recruit.wemade.com/d0pt054k'
    },
    {
        name: '데브시스터즈',
        desc: '쿠키런',
        class: 'devsisters',
        url: 'https://careers.devsisters.com/ko/position'
    },
    {
        name: '시프트업',
        desc: '승리의여신:니케, 스텔라블레이드',
        class: 'shiftup',
        url: 'https://shiftup.co.kr/recruit/recruit.php'
    },
    {
        name: '네오위즈',
        desc: 'P의거짓, 브라운더스트',
        class: 'neowiz',
        url: 'https://www.neowiz.com/kr/career/browse-job'
    },
    {
        name: '그라비티',
        desc: '라그나로크',
        class: 'gravity',
        url: 'https://www.gravity.co.kr/kr/recruit/jobopening/list'
    }
];

// 직무별 검색 링크 (원티드)
// 직무별 검색 링크 (원티드)
const JOB_CATEGORY_LINKS = [
    {
        name: '게임 기획',
        desc: '게임 기획자, 시스템 기획',
        class: 'category',
        icon: 'pencil-ruler',
        url: 'https://www.wanted.co.kr/search?query=%EA%B2%8C%EC%9E%84%20%EA%B8%B0%ED%9A%8D&tab=position'
    },
    {
        name: '게임 프로그래머',
        desc: '클라이언트, 서버 개발자',
        class: 'category',
        icon: 'laptop-code',
        url: 'https://www.wanted.co.kr/search?query=%EA%B2%8C%EC%9E%84%20%ED%94%84%EB%A1%9C%EA%B7%B8%EB%9E%98%EB%A8%B8&tab=position'
    },
    {
        name: '게임 아트/그래픽',
        desc: '원화, 3D, UI 디자이너',
        class: 'category',
        icon: 'palette',
        url: 'https://www.wanted.co.kr/search?query=%EA%B2%8C%EC%9E%84%20%EC%95%84%ED%8A%B8&tab=position'
    },
    {
        name: '게임 사운드',
        desc: '사운드 디자이너',
        class: 'category',
        icon: 'music',
        url: 'https://www.wanted.co.kr/search?query=%EA%B2%8C%EC%9E%84%20%EC%82%AC%EC%9A%B4%EB%93%9C&tab=position'
    },
    {
        name: '게임 QA',
        desc: 'QA 엔지니어, 테스터',
        class: 'category',
        icon: 'bug',
        url: 'https://www.wanted.co.kr/search?query=%EA%B2%8C%EC%9E%84%20QA&tab=position'
    },
    {
        name: '게임 데이터',
        desc: '데이터 분석가',
        class: 'category',
        icon: 'chart-bar',
        url: 'https://www.wanted.co.kr/search?query=%EA%B2%8C%EC%9E%84%20%EB%8D%B0%EC%9D%B4%ED%84%B0&tab=position'
    },
    {
        name: '게임 마케팅',
        desc: '게임 마케터',
        class: 'category',
        icon: 'bullhorn',
        url: 'https://www.wanted.co.kr/search?query=%EA%B2%8C%EC%9E%84%20%EB%A7%88%EC%BC%80%ED%8C%85&tab=position'
    }
];

// 언리얼/유니티 엔진 관련 채용 (원티드)
const ENGINE_LINKS = [
    {
        name: '언리얼 엔진',
        desc: 'Unreal Engine 개발자',
        class: 'unreal',
        icon: 'layer-group',
        url: 'https://www.wanted.co.kr/search?query=%EC%96%B8%EB%A6%AC%EC%96%BC&tab=position'
    },
    {
        name: '언리얼 UE5',
        desc: 'UE5 전문 채용',
        class: 'unreal',
        icon: 'cubes',
        url: 'https://www.wanted.co.kr/search?query=UE5&tab=position'
    },
    {
        name: '유니티',
        desc: 'Unity 개발자',
        class: 'unity',
        icon: 'cube',
        url: 'https://www.wanted.co.kr/search?query=%EC%9C%A0%EB%8B%88%ED%8B%B0&tab=position'
    },
    {
        name: '사람인 언리얼',
        desc: '사람인 언리얼 검색',
        class: 'site',
        icon: 'search',
        url: 'https://www.saramin.co.kr/zf_user/search?searchType=search&searchword=%EC%96%B8%EB%A6%AC%EC%96%BC'
    },
    {
        name: '사람인 유니티',
        desc: '사람인 유니티 검색',
        class: 'site',
        icon: 'search',
        url: 'https://www.saramin.co.kr/zf_user/search?searchType=search&searchword=%EC%9C%A0%EB%8B%88%ED%8B%B0'
    }
];

// 서버/클라이언트 구분 검색
// 서버/클라이언트 구분 검색
const DEVELOPER_LINKS = [
    {
        name: '클라이언트 개발자',
        desc: '클라이언트 프로그래머',
        class: 'dev',
        icon: 'desktop',
        url: 'https://www.wanted.co.kr/search?query=%ED%81%B4%EB%9D%BC%EC%9D%B4%EC%96%B8%ED%8A%B8%20%EA%B2%8C%EC%9E%84&tab=position'
    },
    {
        name: '서버 개발자',
        desc: '서버 프로그래머',
        class: 'dev',
        icon: 'server',
        url: 'https://www.wanted.co.kr/search?query=%EC%84%9C%EB%B2%84%20%EA%B2%8C%EC%9E%84&tab=position'
    },
    {
        name: '신입 게임 개발자',
        desc: '신입 키워드 검색',
        class: 'dev',
        icon: 'seedling',
        url: 'https://www.wanted.co.kr/search?query=%EA%B2%8C%EC%9E%84%20%EC%8B%A0%EC%9E%85&tab=position'
    },
    {
        name: '게임 인턴',
        desc: '인턴 채용 검색',
        class: 'dev',
        icon: 'id-badge',
        url: 'https://www.wanted.co.kr/search?query=%EA%B2%8C%EC%9E%84%20%EC%9D%B8%ED%84%B4&tab=position'
    }
];

// ===================================
// Initialization
// ===================================
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initNavigation();
    initSearch();
    initFilters();
    initCalendar();
    initModal();
    initExternalLinks();
    loadJobs();

    // 기본 뷰를 채용공고로 설정 (사용자 요청)
    switchView('jobs');

    // Initial Animations
    if (window.gsap) {
        gsap.from('.header', { y: -70, duration: 0.8, ease: 'power3.out' });
        gsap.from('.hero h1', { opacity: 0, y: 30, duration: 0.8, delay: 0.3, ease: 'back.out(1.7)' });
        gsap.from('.hero p', { opacity: 0, y: 20, duration: 0.8, delay: 0.5, ease: 'power2.out' });
        gsap.from('.search-filter-section', { opacity: 0, y: 20, duration: 0.8, delay: 0.7, ease: 'power2.out' });
    }

    // PWA Service Worker Registration
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(reg => console.log('Service Worker Registered'))
                .catch(err => console.log('Service Worker Error', err));
        });
    }
});

// ===================================
// Theme Management
// ===================================
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);

    elements.themeToggle?.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
    });
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);

    const icon = elements.themeToggle?.querySelector('i');
    if (icon) {
        icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }
}

// ===================================
// Navigation
// ===================================
function initNavigation() {
    // View switching
    elements.navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const view = link.dataset.view;
            if (view) {
                switchView(view);
                closeMobileMenu();
            }
        });
    });

    // Mobile menu toggle
    elements.mobileMenuBtn?.addEventListener('click', () => {
        const headerHeight = document.querySelector('.header').offsetHeight;
        if (elements.mobileMenu) {
            elements.mobileMenu.style.top = `${headerHeight}px`;
            elements.mobileMenu.classList.toggle('active');
        }
    });

    // Close mobile menu on outside click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.mobile-menu') && !e.target.closest('.mobile-menu-btn')) {
            closeMobileMenu();
        }
    });
}

function switchView(view) {
    state.currentView = view;

    // Update nav links
    elements.navLinks.forEach(link => {
        link.classList.toggle('active', link.dataset.view === view);
    });

    // Update views
    elements.views.forEach(v => {
        v.classList.toggle('active', v.id === `view-${view}`);
    });

    // Scroll to top
    window.scrollTo(0, 0);

    // Render calendar if switching to calendar view
    if (view === 'calendar') {
        renderCalendar();
    }
}

function closeMobileMenu() {
    elements.mobileMenu?.classList.remove('active');
}

// ===================================
// Data Loading
// ===================================
async function loadJobs() {
    showLoading(true);

    try {
        const url = window.CONFIG.API_BASE_URL;
        const isSupabase = !!window.CONFIG.SUPABASE.URL;

        const headers = { 'Content-Type': 'application/json' };
        if (isSupabase) {
            headers['apikey'] = window.CONFIG.SUPABASE.KEY;
            headers['Authorization'] = `Bearer ${window.CONFIG.SUPABASE.KEY}`;
        }

        const response = await fetch(isSupabase ? `${url}?select=*` : url, { headers });
        const result = await response.json();

        // Supabase는 배열을 직접 반환하고, 로컬 API는 {data: []} 형태일 수 있음
        const allJobs = Array.isArray(result) ? result : (result.data || []);
        state.jobs = allJobs.filter(job => job.is_active !== false);
        state.filteredJobs = [...state.jobs];

        updateCompanyFilter();
        updateStats();
        applyFiltersAndRender();
    } catch (error) {
        console.error('Failed to load jobs:', error);
        state.jobs = [];
        state.filteredJobs = [];
    } finally {
        showLoading(false);
    }
}

function showLoading(show) {
    if (elements.loading) {
        elements.loading.style.display = show ? 'block' : 'none';
    }
    if (elements.jobsGrid) {
        elements.jobsGrid.style.display = show ? 'none' : 'grid';
    }
}

// ===================================
// Search & Filter
// ===================================
function initSearch() {
    // Search input
    elements.searchInput?.addEventListener('input', debounce((e) => {
        state.filters.search = e.target.value.trim();
        updateSearchClear();
        applyFiltersAndRender();
    }, 300));

    // Clear search
    elements.searchClear?.addEventListener('click', () => {
        elements.searchInput.value = '';
        state.filters.search = '';
        updateSearchClear();
        applyFiltersAndRender();
    });

    // Quick tags - 원티드 검색으로 연결
    elements.quickTags.forEach(tag => {
        tag.addEventListener('click', () => {
            const tagValue = tag.dataset.tag;
            const encoded = encodeURIComponent(tagValue);
            const url = `https://www.wanted.co.kr/search?query=${encoded}&tab=position`;
            window.open(url, '_blank');
        });
    });
}

function updateSearchClear() {
    if (elements.searchClear) {
        elements.searchClear.style.display = state.filters.search ? 'flex' : 'none';
    }
}

function initFilters() {
    // Company filter
    elements.filterCompany?.addEventListener('change', (e) => {
        state.filters.company = e.target.value;
        applyFiltersAndRender();
    });

    // Category filter
    elements.filterCategory?.addEventListener('change', (e) => {
        state.filters.category = e.target.value;
        applyFiltersAndRender();
    });

    // Type filter
    elements.filterType?.addEventListener('change', (e) => {
        state.filters.type = e.target.value;
        applyFiltersAndRender();
    });

    // Engine filter
    elements.filterEngine?.addEventListener('change', (e) => {
        state.filters.engine = e.target.value;
        applyFiltersAndRender();
    });

    // Sort
    elements.sortSelect?.addEventListener('change', (e) => {
        state.sort = e.target.value;
        applyFiltersAndRender();
    });

    // Reset filters
    elements.filterReset?.addEventListener('click', resetFilters);
}

function resetFilters() {
    state.filters = {
        company: '',
        category: '',
        type: '',
        engine: '',
        search: ''
    };

    if (elements.searchInput) elements.searchInput.value = '';
    if (elements.filterCompany) elements.filterCompany.value = '';
    if (elements.filterCategory) elements.filterCategory.value = '';
    if (elements.filterType) elements.filterType.value = '';
    if (elements.filterEngine) elements.filterEngine.value = '';

    updateSearchClear();
    applyFiltersAndRender();
}

function updateCompanyFilter() {
    const companies = [...new Set(state.jobs.map(job => job.company))].sort();

    if (elements.filterCompany) {
        const currentValue = elements.filterCompany.value;
        elements.filterCompany.innerHTML = '<option value="">전체</option>';

        companies.forEach(company => {
            const option = document.createElement('option');
            option.value = company;
            option.textContent = company;
            elements.filterCompany.appendChild(option);
        });

        elements.filterCompany.value = currentValue;
    }
}

function applyFiltersAndRender() {
    // Apply filters
    state.filteredJobs = state.jobs.filter(job => {
        const jobText = (job.position + ' ' + (job.category || '') + ' ' + (job.job_type || '') + ' ' + (job.tags || []).join(' ')).toLowerCase();

        // Company filter
        if (state.filters.company && (!job.company || !job.company.toLowerCase().includes(state.filters.company.toLowerCase()))) {
            return false;
        }

        // Category filter
        if (state.filters.category) {
            const keywords = FILTER_MAPPINGS.category[state.filters.category];
            if (keywords) {
                const hasMatch = keywords.some(k => jobText.includes(k.toLowerCase()));
                if (!hasMatch) return false;
            } else {
                // Fallback for '기타' or unmapped categories
                if (!job.category || !job.category.toLowerCase().includes(state.filters.category.toLowerCase())) {
                    return false;
                }
            }
        }

        // Type filter
        if (state.filters.type) {
            const filterType = state.filters.type;
            const keywords = FILTER_MAPPINGS.type[filterType];

            if (keywords) {
                const hasMatch = keywords.some(k => jobText.includes(k.toLowerCase()));
                // Special handling: '수시' is often default/implied if not 'intern' or 'public recruit'
                if (filterType === '수시') {
                    // If searching for '수시', we accept it if it matches keywords OR if it doesn't match '공채'/'인턴' explicitly
                    // But strictly, let's stick to positive matches first.
                    // A lot of jobs are just '신입', so '수시' filter should catch '신입' (added to keywords).
                    if (!hasMatch) return false;
                } else {
                    if (!hasMatch) return false;
                }
            } else {
                if (!job.job_type || !job.job_type.toLowerCase().includes(filterType.toLowerCase())) {
                    return false;
                }
            }
        }

        // Engine filter
        if (state.filters.engine) {
            const engine = state.filters.engine;
            const tags = job.tags || [];
            // Combine all searchable text for engine detection
            const textToSearch = (job.position + ' ' + (job.description || '') + ' ' + tags.join(' ')).toLowerCase();

            if (engine === '기타/자체엔진') {
                // Check if neither Unreal nor Unity keywords are present
                const hasUnreal = textToSearch.includes('언리얼') || textToSearch.includes('unreal');
                const hasUnity = textToSearch.includes('유니티') || textToSearch.includes('unity');

                if (hasUnreal || hasUnity) {
                    return false;
                }
            } else {
                // Check for specific engine keywords
                const targetKeywords = engine === '언리얼' ? ['언리얼', 'unreal'] : ['유니티', 'unity'];
                const hasMatch = targetKeywords.some(keyword => textToSearch.includes(keyword));
                if (!hasMatch) return false;
            }
        }

        // Search filter
        if (state.filters.search) {
            const searchLower = state.filters.search.toLowerCase();
            const searchableText = [
                job.company,
                job.position,
                job.category,
                job.job_type,
                job.description,
                ...(job.tags || [])
            ].join(' ').toLowerCase();

            if (!searchableText.includes(searchLower)) {
                return false;
            }
        }

        // Only show active jobs
        if (job.is_active === false) {
            return false;
        }

        return true;
    });

    // Apply sorting
    sortJobs();

    // Update stats
    updateStats();

    // Render jobs
    renderJobs();

    // Update calendar if visible
    if (state.currentView === 'calendar') {
        renderCalendar();
    }
}

function sortJobs() {
    state.filteredJobs.sort((a, b) => {
        switch (state.sort) {
            case 'deadline':
                const deadlineA = a.deadline ? new Date(a.deadline) : new Date('2099-12-31');
                const deadlineB = b.deadline ? new Date(b.deadline) : new Date('2099-12-31');
                return deadlineA - deadlineB;
            case 'latest':
                const createdA = a.created_at || 0;
                const createdB = b.created_at || 0;
                return createdB - createdA;
            case 'company':
                return (a.company || '').localeCompare(b.company || '');
            default:
                return 0;
        }
    });
}

function updateStats() {
    const total = state.filteredJobs.length;

    // 회사명 정규화 후 카운트 ( (주), 주식회사, 영어명칭 등 중복 방지 )
    const companiesSet = new Set(state.filteredJobs.map(job => {
        return (job.company || '')
            .replace(/\(주\)/g, '')
            .replace(/주식회사/g, '')
            .replace(/㈜/g, '')
            .replace(/\(유\)/g, '')
            .replace(/\(사\)/g, '')
            .replace(/\(.+?\)/g, '') // 괄호 안의 영문명 등 제거 (예: (NEXON) -> 제거)
            .replace(/\[.+?\]/g, '') // 대괄호 내용 제거
            .replace(/\s+/g, '')
            .trim();
    }));
    const companies = companiesSet.size;
    const now = new Date();
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const urgent = state.filteredJobs.filter(job => {
        if (!job.deadline) return false;
        const deadline = new Date(job.deadline);
        return deadline >= now && deadline <= threeDaysLater;
    }).length;

    if (elements.statTotal) elements.statTotal.textContent = total;
    if (elements.statCompanies) elements.statCompanies.textContent = companies;
    if (elements.statUrgent) elements.statUrgent.textContent = urgent;
}

// ===================================
// Job Card Utilities
// ===================================
function isUrgentDate(deadlineStr) {
    if (!deadlineStr) return false;
    const deadline = new Date(deadlineStr);
    const now = new Date();
    const diff = deadline - now;
    return diff > 0 && diff <= 3 * 24 * 60 * 60 * 1000;
}

function isPastDate(deadlineStr) {
    if (!deadlineStr) return false;
    return new Date(deadlineStr) < new Date();
}

function formatDateLabel(deadlineStr) {
    if (!deadlineStr) return '채용시 마감';
    const deadline = new Date(deadlineStr);
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    if (deadline < now) return '마감됨';

    const diffDays = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return '오늘 마감';
    if (diffDays === 1) return '내일 마감';
    if (diffDays <= 7) return `D-${diffDays}`;

    return formatDate(deadline);
}

function getCompanyClass(companyName) {
    const name = (companyName || '').toLowerCase();
    if (name.includes('크래프톤')) return 'krafton';
    if (name.includes('넥슨')) return 'nexon';
    if (name.includes('엔씨')) return 'ncsoft';
    if (name.includes('넷마블')) return 'netmarble';
    if (name.includes('컴투스')) return 'com2us';
    if (name.includes('nhn')) return 'nhn';
    if (name.includes('펄어비스')) return 'pearl';
    if (name.includes('스마일게이트')) return 'smilegate';
    return 'default';
}

// ===================================
// Job Cards Rendering
// ===================================
function renderJobs() {
    if (!elements.jobsGrid) return;

    if (state.filteredJobs.length === 0) {
        elements.jobsGrid.innerHTML = '';
        elements.noResults.style.display = 'block';

        if (state.jobs.length === 0) {
            elements.noResults.innerHTML = `
                <i class="fas fa-info-circle"></i>
                <h3>등록된 채용 공고가 없습니다</h3>
                <p>채용 사이트에서 직접 최신 공고를 확인해보세요.</p>
            `;
        } else {
            elements.noResults.innerHTML = `
                <i class="fas fa-search"></i>
                <h3>필터 결과가 없습니다</h3>
                <p>다른 키워드나 필터를 선택해보세요.</p>
                <button class="btn btn-outline" style="margin-top:15px" onclick="resetFilters()">필터 초기화</button>
            `;
        }
        return;
    }

    elements.noResults.style.display = 'none';

    // HTML 문자열 결합 (성능 최적화)
    const cardsHtml = state.filteredJobs.map((job, index) => createJobCard(job, index)).join('');
    elements.jobsGrid.innerHTML = cardsHtml;

    // GSAP 애니메이션
    if (window.gsap) {
        gsap.fromTo('.job-card',
            { opacity: 0, y: 15 },
            { opacity: 1, y: 0, duration: 0.3, stagger: 0.03, ease: 'power2.out' }
        );
    }
}

// 이벤트 위임 처리 (카드 클릭 핸들러)
elements.jobsGrid?.addEventListener('click', (e) => {
    const card = e.target.closest('.job-card');
    const jobLink = e.target.closest('.job-link');

    // 링크 클릭이 아니고 카드 자체 클릭인 경우에만 상세 모달 오픈
    if (card && !jobLink) {
        const index = parseInt(card.dataset.index);
        const job = state.filteredJobs[index];
        if (job) {
            openJobModal(job);
        }
    }
});

function createJobCard(job, index) {
    const isUrgent = isUrgentDate(job.deadline);
    const isPast = isPastDate(job.deadline);
    const tags = job.tags || [];

    return `
        <article class="job-card ${isUrgent ? 'urgent' : ''} ${isPast ? 'past' : ''}" data-index="${index}">
            <div class="job-card-header">
                <div class="company-badge-mini ${getCompanyClass(job.company)}"></div>
                <span class="company-name">${escapeHtml(job.company)}</span>
                <span class="job-type-badge">${escapeHtml(job.job_type || '수시')}</span>
            </div>
            <h3 class="job-title">${escapeHtml(job.position)}</h3>
            <div class="job-meta">
                <span class="category-tag"><i class="fas fa-folder"></i> ${escapeHtml(job.category || '기타')}</span>
                <span class="deadline-tag ${isUrgent ? 'urgent' : ''}">
                    <i class="fas fa-clock"></i> ${formatDateLabel(job.deadline)}
                </span>
            </div>
            <div class="job-tags">
                ${tags.slice(0, 3).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
            </div>
        </article>
    `;
}

// 글로벌 토스트 표시 함수
function showGlobalToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-exclamation-circle';

    toast.innerHTML = `
        <i class="fas ${icon}"></i>
        <p>${escapeHtml(message)}</p>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 300);
    }, window.CONFIG?.UI?.TOAST_DURATION || 3000);
}
window.showGlobalToast = showGlobalToast;

// ===================================
// Modal
// ===================================
function initModal() {
    // Close modal on overlay click
    document.querySelector('.modal-overlay')?.addEventListener('click', closeModal);

    // Close modal on close button click
    elements.modalClose?.addEventListener('click', closeModal);

    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && elements.modal?.classList.contains('active')) {
            closeModal();
        }
    });
}

function openJobModal(job) {
    const deadline = job.deadline ? new Date(job.deadline) : null;
    const now = new Date();
    const isUrgent = deadline && (deadline - now) <= 3 * 24 * 60 * 60 * 1000 && deadline >= now;

    const deadlineText = deadline
        ? formatDate(deadline) + (isUrgent ? ' (마감 임박!)' : '')
        : '채용시 마감';

    const tags = job.tags || [];

    elements.modalBody.innerHTML = `
        <div class="modal-company">
            <i class="fas fa-building"></i>
            ${escapeHtml(job.company || '회사명 미정')}
        </div>
        <h2 class="modal-title">${escapeHtml(job.position || '포지션 미정')}</h2>
        <div class="modal-meta">
            <span class="modal-meta-item">
                <i class="fas fa-tag"></i>
                ${escapeHtml(job.job_type || '수시')}
            </span>
            <span class="modal-meta-item">
                <i class="fas fa-folder"></i>
                ${escapeHtml(job.category || '기타')}
            </span>
            <span class="modal-meta-item ${isUrgent ? 'urgent' : ''}">
                <i class="fas fa-clock"></i>
                ${deadlineText}
            </span>
        </div>
        ${tags.length > 0 ? `
            <div class="modal-tags">
                ${tags.map(tag => `<span class="modal-tag">${escapeHtml(tag)}</span>`).join('')}
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
            <button class="btn btn-secondary" onclick="closeModal()">
                닫기
            </button>
        </div>
    `;

    elements.modal?.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    elements.modal?.classList.remove('active');
    document.body.style.overflow = '';
}

// ===================================
// Calendar
// ===================================
function initCalendar() {
    elements.prevMonth?.addEventListener('click', () => {
        state.calendar.month--;
        if (state.calendar.month < 0) {
            state.calendar.month = 11;
            state.calendar.year--;
        }
        renderCalendar();
    });

    elements.nextMonth?.addEventListener('click', () => {
        state.calendar.month++;
        if (state.calendar.month > 11) {
            state.calendar.month = 0;
            state.calendar.year++;
        }
        renderCalendar();
    });

    elements.todayBtn?.addEventListener('click', () => {
        const today = new Date();
        state.calendar.year = today.getFullYear();
        state.calendar.month = today.getMonth();
        renderCalendar();
    });
}

function renderCalendar() {
    if (!elements.calendarDays) return;

    const { year, month } = state.calendar;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Update month title
    if (elements.currentMonth) {
        elements.currentMonth.textContent = `${year}년 ${month + 1}월`;
    }

    // Get first day of month and total days
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay();
    const totalDays = lastDay.getDate();

    // Get previous month's last days
    const prevLastDay = new Date(year, month, 0).getDate();

    // Get jobs with deadlines
    const jobsByDate = {};
    state.filteredJobs.forEach(job => {
        if (!job.deadline) return;
        const deadline = new Date(job.deadline);
        if (deadline.getFullYear() === year && deadline.getMonth() === month) {
            const day = deadline.getDate();
            if (!jobsByDate[day]) jobsByDate[day] = [];
            jobsByDate[day].push(job);
        }
    });

    // Render calendar days
    let html = '';

    // Previous month's days
    for (let i = startDay - 1; i >= 0; i--) {
        const day = prevLastDay - i;
        html += `<div class="calendar-day other-month"><span class="day-number">${day}</span></div>`;
    }

    // Current month's days
    for (let day = 1; day <= totalDays; day++) {
        const date = new Date(year, month, day);
        const isToday = date.getTime() === today.getTime();
        const isSunday = date.getDay() === 0;
        const isSaturday = date.getDay() === 6;
        const jobs = jobsByDate[day] || [];

        let classes = ['calendar-day'];
        if (isToday) classes.push('today');
        if (isSunday) classes.push('sunday');
        if (isSaturday) classes.push('saturday');

        let eventsHtml = '';
        if (jobs.length > 0) {
            const displayJobs = jobs.slice(0, 3);
            eventsHtml = `
                <div class="day-events">
                    ${displayJobs.map(job => {
                const deadline = new Date(job.deadline);
                const isUrgent = (deadline - today) <= 3 * 24 * 60 * 60 * 1000;
                return `<div class="day-event ${isUrgent ? 'urgent' : ''}" title="${escapeHtml(job.company)}: ${escapeHtml(job.position)}">${escapeHtml(job.company)}</div>`;
            }).join('')}
                    ${jobs.length > 3 ? `<div class="day-event">+${jobs.length - 3}건</div>` : ''}
                </div>
            `;
        }

        html += `
            <div class="${classes.join(' ')}" data-date="${year}-${month + 1}-${day}">
                <span class="day-number">${day}</span>
                ${eventsHtml}
            </div>
        `;
    }

    // Next month's days
    const remainingDays = 42 - (startDay + totalDays);
    for (let day = 1; day <= remainingDays; day++) {
        html += `<div class="calendar-day other-month"><span class="day-number">${day}</span></div>`;
    }

    elements.calendarDays.innerHTML = html;

    // Add click handlers for days with events
    elements.calendarDays.querySelectorAll('.calendar-day').forEach(dayEl => {
        const events = dayEl.querySelectorAll('.day-event');
        if (events.length > 0) {
            dayEl.style.cursor = 'pointer';
            dayEl.addEventListener('click', () => {
                const dateStr = dayEl.dataset.date;
                if (dateStr) {
                    const [y, m, d] = dateStr.split('-').map(Number);
                    const jobs = jobsByDate[d] || [];
                    if (jobs.length === 1) {
                        openJobModal(jobs[0]);
                    } else if (jobs.length > 1) {
                        showDayJobsModal(new Date(y, m - 1, d), jobs);
                    }
                }
            });
        }
    });
}

function showDayJobsModal(date, jobs) {
    elements.modalBody.innerHTML = `
        <h2 class="modal-title">
            <i class="fas fa-calendar-day"></i>
            ${formatDate(date)} 마감 공고
        </h2>
        <div class="day-jobs-list">
            ${jobs.map(job => `
                <div class="day-job-item-wrapper" style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px;">
                    <div class="day-job-item" style="flex: 1;">
                        <div class="day-job-company">${escapeHtml(job.company)}</div>
                        <div class="day-job-position">${escapeHtml(job.position)}</div>
                        <div class="day-job-category">${escapeHtml(job.category)}</div>
                    </div>
                    ${job.link ? `
                    <a href="${escapeHtml(job.link)}" target="_blank" class="btn btn-sm btn-outline" style="white-space: nowrap; padding: 8px 12px; height: auto;" title="공고 보기">
                        <i class="fas fa-external-link-alt"></i>
                    </a>
                    ` : ''}
                </div>
            `).join('')}
        </div>
        <div class="modal-actions" style="margin-top: 20px;">
            <button class="btn btn-secondary" onclick="closeModal()">닫기</button>
        </div>
    `;

    elements.modal?.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// ===================================
// External Links Management
// ===================================
function initExternalLinks() {
    renderExternalLinks('company-links', COMPANY_LINKS, 'gamepad');
    renderExternalLinks('job-site-links', JOB_SITE_LINKS, 'briefcase');
    renderExternalLinks('job-category-links', JOB_CATEGORY_LINKS, 'folder');
    renderExternalLinks('engine-links', ENGINE_LINKS, 'cube');
    renderExternalLinks('developer-links', DEVELOPER_LINKS, 'code');
}

function renderExternalLinks(containerId, links, defaultIcon) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = links.map(link => {
        const iconInfo = link.icon ? link.icon : defaultIcon;
        return `
        <a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer" class="link-card ${link.class}">
            <div class="link-icon"><i class="fas fa-${iconInfo}"></i></div>
            <div class="link-info">
                <h3>${escapeHtml(link.name)}</h3>
                <p>${escapeHtml(link.desc)}</p>
            </div>
            <i class="fas fa-external-link-alt"></i>
        </a>
    `}).join('');
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
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
}

// Make functions globally accessible for inline handlers
window.closeModal = closeModal;
window.openJobModal = openJobModal;
window.state = state;
