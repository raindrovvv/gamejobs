/**
 * 게임잡스 - 통합 채용 정보 크롤러 (Node.js 버전)
 * 대상: 게임잡, 잡코리아, 사람인, 원티드, 잡플래닛
 */

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const axios = require('axios');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');
require('dotenv').config();

// 설정 (보안을 위해 환경변수 필수 사용)
const API_URL = process.env.SUPABASE_API_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!API_URL || !SUPABASE_KEY) {
    console.error('❌ 에러: SUPABASE_API_URL 또는 SUPABASE_KEY 환경변수가 설정되지 않았습니다.');
    console.error('로컬 실행 시: export SUPABASE_KEY=... / 윈도우: set SUPABASE_KEY=...');
    process.exit(1);
}

async function fetchWithRetry(url, options = {}, retries = 3, backoff = 1000) {
    const isGamejob = url.includes('gamejob.co.kr');
    try {
        const config = {
            timeout: options.timeout || 60000, // 60초로 변경
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
                'Accept-Encoding': 'gzip, deflate, br',
                'Referer': isGamejob ? 'https://www.gamejob.co.kr/' :
                    url.includes('jobkorea.co.kr') ? 'https://www.jobkorea.co.kr/' : 'https://www.google.com/',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                ...options.headers
            },
            ...options
        };
        // DEBUG: 타임아웃 설정 확인
        console.log(`[Fetch] Timeout: ${config.timeout}ms, URL: ${url}`);
        return await axios.get(url, config);
    } catch (e) {
        const status = e.response ? e.response.status : null;
        const isTimeout = e.code === 'ECONNABORTED' || e.message.includes('timeout');

        // 500번대 에러 또는 네트워크 관련 에러(timeout, ENOTFOUND 등)인 경우 재시도
        if (retries > 0 && (isTimeout || !status || status >= 500)) {
            const waitTime = isTimeout ? backoff * 2 : backoff;
            console.warn(`[Retry] ${url} 실패 (${e.code || status}). ${waitTime}ms 후 재시도... (${retries}회 남음)`);
            await sleep(waitTime);
            return fetchWithRetry(url, { ...options, timeout: (options.timeout || 30000) + 10000 }, retries - 1, backoff * 2);
        }
        throw e;
    }
}

// 인코딩 처리를 위한 함수 (게임잡 등 euc-kr 대응용)
async function fetchHtml(url, encoding = 'utf-8') {
    try {
        const res = await fetchWithRetry(url, { responseType: 'arraybuffer' });
        if (!res || !res.data) {
            console.warn(`[Fetch] ${url} 응답 데이터가 비어있습니다.`);
            return '';
        }
        return iconv.decode(res.data, encoding);
    } catch (e) {
        console.error(`[Fetch] ${url} 에러:`, e.message);
        return '';
    }
}

// 링크 정규화 (중복 방지의 핵심)
function normalizeLink(link) {
    if (!link) return '';
    try {
        let url = link.trim();
        // 트레일링 슬래시 제거
        if (url.endsWith('/')) url = url.slice(0, -1);

        // 사람인의 경우 rec_idx가 핵심이므로 이를 포함한 채로 정규화
        if (url.includes('saramin.co.kr')) {
            const match = url.match(/rec_idx=(\d+)/);
            if (match) return `https://www.saramin.co.kr/zf_user/jobs/relay/view?view_type=search&rec_idx=${match[1]}`;
        }

        return url;
    } catch (e) {
        return link;
    }
}

// 데이터 필터링 유틸리티
const Filter = {
    // 1. 반드시 포함되어야 하는 게임 산업 키워드 (장르, 엔진, 주요 기업 등 확장)
    CONTEXT: [
        '게임', 'game', '엔진', '언리얼', '유니티', 'unreal', 'unity', 'cocos',
        'rpg', 'fps', 'mmo', 'tps', 'aos', '모바일게임', '캐주얼게임', '그래픽스',
        '넥슨', '넷마블', '엔씨', '크래프톤', '펄어비스', '스마일게이트', '컴투스', '카카오게임즈',
        '위메이드', '웹젠', '그라비티', '데브시스터즈', '시프트업', '조이시티', '액션스퀘어'
    ],

    // 2. 역할 키워드
    ROLES: ['개발', '기획', '아트', '그래픽', '원화', 'QA', '테스터', '프로그래머', '디렉터', '디자이너', '모델러', '애니메이터', '클라이언트', '서버', '이펙터', '엔지니어'],

    // 3. 절대 포함되면 안 되는 비게임 산업 키워드 (철저 배제)
    EXCLUDE: [
        '의료', '바이오', '금융', '은행', '증권', '보험', '회계', '세무',
        '반도체', '자율주행', '하드웨어', '제조', '건설', '공사', '공단', '병원', '약사',
        '쇼핑몰', '커머스', '물류', '택배', '남동발전', '카지노', '저축은행',
        '광고대행', 'ae', '기업브랜딩', '마케팅전문'
    ],

    // 4. 경력직 배제 키워드 (신입 대상이 아닌 경우)
    EXCLUDE_SENIOR: [
        '미들급', '리드급', '시니어', 'senior', 'lead', '팀장', '파트장', '원화가(경력)', '개발(경력)',
        '실장', '디렉터', 'director', '전문가', 'expert', '경력직', '경력채용', '경력 5년', '경력 3년',
        '경력 4년', '경력 6년', '경력 7년', '경력 8년', '경력 10년', 'manager'
    ],

    isValid(job) {
        const company = (job.company || '').toLowerCase();
        const position = (job.position || '').toLowerCase();
        const text = company + position;

        // 규칙 1: 제외 키워드가 하나라도 있으면 무조건 탈락
        if (this.EXCLUDE.some(term => text.includes(term.toLowerCase()))) return false;

        // 규칙 1-1: 경력직 키워드 배제
        if (this.EXCLUDE_SENIOR.some(term => text.includes(term.toLowerCase()))) return false;

        // 규칙 1-2: X년차 이상 배제 (RegEx)
        const yearMatch = text.match(/(\d+)\s*년/);
        if (yearMatch) {
            const years = parseInt(yearMatch[1], 10);
            // 4년 이상이면 무조건 배제 (1~3년까지만 신입/경력 혼합으로 간주)
            if (years >= 4) return false;
            // 2~3년인데 '신입'이나 '인턴' 키워드가 없으면 배제
            if (years >= 2 && !text.includes('신입') && !text.includes('인턴')) return false;
        }

        // 규칙 2: 게임 관련 컨텍스트가 반드시 하나는 있어야 함
        const hasContext = this.CONTEXT.some(term => {
            const lowTerm = term.toLowerCase();
            // '엔씨'가 '씨엔씨'로 오인되는 것 방지
            if (lowTerm === '엔씨') {
                return text.includes('엔씨') && !text.includes('씨엔씨');
            }
            return text.includes(lowTerm);
        });
        if (!hasContext) return false;

        // 규칙 3: 역할 관련 키워드가 하나는 있어야 함 (기획, 개발 등)
        const hasRole = this.ROLES.some(term => text.includes(term.toLowerCase()));
        return hasRole;
    }
};

// 날짜 처리 유틸리티
const DateUtils = {
    parse(text) {
        if (!text) return null;
        const now = new Date();
        now.setHours(0, 0, 0, 0); // 시간 초기화
        const year = now.getFullYear();

        // 1. YYYY-MM-DD 또는 YYYY.MM.DD 형식 (Full Date)
        const fullDateMatch = text.match(/(\d{4})[\/\.\-](\d{1,2})[\/\.\-](\d{1,2})/);
        if (fullDateMatch) {
            const y = fullDateMatch[1];
            const m = fullDateMatch[2].padStart(2, '0');
            const d = fullDateMatch[3].padStart(2, '0');
            return `${y}-${m}-${d}`;
        }

        // 2. 상대 날짜 처리 (D-Day, D-N, 오늘마감, 내일마감)
        const dMatch = text.match(/D-(\d+)/i);
        if (text.toLowerCase().includes('d-day') || text.includes('오늘')) {
            return this.formatDateObj(now);
        }
        if (text.includes('내일')) {
            const tmr = new Date(now);
            tmr.setDate(now.getDate() + 1);
            return this.formatDateObj(tmr);
        }
        if (dMatch) {
            const daysToAdd = parseInt(dMatch[1], 10);
            const target = new Date(now);
            target.setDate(now.getDate() + daysToAdd);
            return this.formatDateObj(target);
        }

        // 3. MM/DD 또는 MM.DD 형식 추출 (예: 02/13, ~ 02.13(금))
        // 주의: YYYY-MM-DD 패턴에 걸리지 않도록 연도 부분(\d{4})이 앞에 없는 경우만 매칭되도록 조정 가능하지만, 
        // 위에서 먼저 Full Date를 처리했으므로 충돌 위험이 줄어듦.
        const match = text.match(/(\d{1,2})[\/\.\-월\s](\d{1,2})/);
        if (match) {
            const m = match[1].padStart(2, '0');
            const d = match[2].padStart(2, '0');

            // 만약 현재가 12월인데 1월 공고라면 내년으로 처리하는 로직
            let targetYear = year;
            if (now.getMonth() === 11 && m === '01') targetYear++;

            return `${targetYear}-${m}-${d}`;
        }

        if (text.includes('채용시') || text.includes('상시')) return null;

        return null;
    },

    formatDateObj(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    },

    // UI 로직에서 NaN 출력을 방지하기 위한 포맷터
    format(val) {
        return val || '채용시 마감';
    }
};

// 전역 API 인스턴스 (수정됨)
const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates', // Supabase 벌크 업서트 지원
        ...(SUPABASE_KEY ? {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
        } : {})
    }
});

const Crawler = {
    // 1. 원티드 (API 기반) - 대량 수집 (0~1000위까지)
    async crawlWanted() {
        console.log('Crawling Wanted (Game Development - Max Scale)...');
        const jobs = [];
        try {
            // 422 에러 방지를 위해 가장 확실한 '게임 개발(518)' 태그 하나만 사용
            const tags = '518';
            for (let offset = 0; offset <= 900; offset += 100) {
                const url = `https://www.wanted.co.kr/api/v4/jobs?country=kr&tag_type_ids=${tags}&years=0&limit=100&offset=${offset}`;
                // API 매너 딜레이
                await sleep(500 + Math.random() * 500);
                const res = await axios.get(url, { timeout: 10000 });
                if (!res.data || !res.data.data) continue;

                const rawJobs = res.data.data.map(item => ({
                    company: item.company.name,
                    position: item.position,
                    link: normalizeLink(`https://www.wanted.co.kr/wd/${item.id}`),
                    deadline: DateUtils.parse(item.due_time),
                    job_type: '수시',
                    category: '프로그래밍',
                    tags: ['원티드', '게임', '신입'],
                    is_active: true
                }));
                jobs.push(...rawJobs.filter(job => Filter.isValid(job)));
            }
            return jobs;
        } catch (e) {
            console.error('Wanted Error:', e.response ? e.response.status : e.message);
            return jobs;
        }
    },

    // 2. 사람인 - 주요 게임사 검색 및 일반 검색 병행
    async crawlSaramin() {
        console.log('Crawling Saramin (Target Companies + General)...');
        const TARGET_COMPANIES = [
            '넥슨코리아', '엔씨소프트', '넷마블', '크래프톤', '펄어비스', '스마일게이트', '컴투스', '카카오게임즈',
            '웹젠', '그라비티', '네오위즈', '위메이드', '데브시스터즈', '시프트업', '라인게임즈', '하이브IM',
            '넥슨게임즈', '엔픽셀', '원더피플', '베스파', '액션스퀘어', '조이시티', '엑스엘게임즈'
        ];

        const searchQueries = ['게임 신입', ...TARGET_COMPANIES];
        const allJobs = [];

        for (const query of searchQueries) {
            const isCompanySearch = TARGET_COMPANIES.includes(query);
            const maxPage = isCompanySearch ? 1 : 5; // 페이지 수 축소하여 매너 크롤링

            console.log(`[Saramin] Searching for '${query}' (Pages 1-${maxPage})...`);

            for (let page = 1; page <= maxPage; page++) {
                try {
                    // robots.txt 준수 딜레이
                    await sleep(1500 + Math.random() * 1000);

                    const encodedQuery = encodeURIComponent(query);
                    const url = `https://www.saramin.co.kr/zf_user/search/recruit?searchword=${encodedQuery}&exp_cd=1&sort=date&recruitPage=${page}`;
                    const html = await fetchHtml(url);
                    const $ = cheerio.load(html);

                    $('.item_recruit').each((i, el) => {
                        const company = $(el).find('.corp_name a').text().trim();
                        const position = $(el).find('.job_tit a').text().trim();
                        const link = normalizeLink('https://www.saramin.co.kr' + $(el).find('.job_tit a').attr('href'));
                        const deadlineText = $(el).find('.date').text().trim();

                        const job = {
                            company, position, link,
                            deadline: DateUtils.parse(deadlineText),
                            job_type: '신입', category: '기타', tags: ['사람인'], is_active: true
                        };

                        if (Filter.isValid(job)) allJobs.push(job);
                    });
                } catch (e) {
                    console.error(`[Saramin] Query '${query}' Page ${page} Error:`, e.message);
                }
            }
        }
        return allJobs;
    },

    // 3. 게임잡 - 직무별 수집 (신입)
    async crawlGamejob() {
        console.log('Crawling Gamejob (Duty-based for Newcomers)...');
        const jobs = [];
        const duties = [0, 1, 2, 3, 4, 5, 6, 7];
        const seenLinks = new Set();

        for (const duty of duties) {
            console.log(`[Gamejob] Crawling Duty: ${duty}...`);
            try {
                await sleep(2000 + Math.random() * 1000);

                const url = `https://www.gamejob.co.kr/List_GI/GIB_List.asp?Part_No=${duty}&Search_Word=%BD%C5%C0%D4`;
                const html = await fetchHtml(url, 'euc-kr');
                const $ = cheerio.load(html);

                $('.list tr[class^="row"]').each((i, el) => {
                    const company = $(el).find('.col-company a').text().trim();
                    const position = $(el).find('.col-subject a').text().trim();
                    if (!company) return;

                    const href = $(el).find('.col-subject a').attr('href');
                    if (!href) return;

                    const normalizedLink = normalizeLink('https://www.gamejob.co.kr' + href);
                    if (seenLinks.has(normalizedLink)) return;
                    seenLinks.add(normalizedLink);

                    const job = {
                        company,
                        position,
                        link: normalizedLink,
                        deadline: DateUtils.parse($(el).find('.col-date').text().trim()),
                        job_type: '신입',
                        category: '게임',
                        tags: ['게임잡'],
                        is_active: true
                    };

                    if (Filter.isValid(job)) {
                        jobs.push(job);
                    }
                });
            } catch (e) {
                console.error(`[Gamejob] Duty ${duty} Error:`, e.message);
            }
        }
        return jobs;
    },

    // 4. 게임잡 - 직무별 채용공고 (추가 목록)
    async crawlGamejobDuty() {
        console.log('Crawling Gamejob Duty List...');
        const jobs = [];
        try {
            await sleep(1000);
            const url = `https://www.gamejob.co.kr/Recruit/joblist?menucode=duty&duty=1`;
            const html = await fetchHtml(url);
            const $ = cheerio.load(html);

            $('.list.cf li').each((i, el) => {
                const li = $(el);
                const company = li.find('.company strong').text().trim();
                const position = li.find('.description a strong').text().trim() || li.find('.description a').text().trim();
                const path = li.find('.description a').attr('href');

                if (!company || !position || !path) return;

                const link = normalizeLink('https://www.gamejob.co.kr' + path);
                const deadlineText = li.find('.dday').text().trim();

                const job = {
                    company,
                    position,
                    link,
                    deadline: DateUtils.parse(deadlineText),
                    job_type: '신입/경력',
                    category: '게임',
                    tags: ['게임잡'],
                    is_active: true
                };

                if (Filter.isValid(job)) {
                    jobs.push(job);
                }
            });
            return jobs;
        } catch (e) {
            console.error('Gamejob Duty Error:', e.message);
            return jobs;
        }
    },

    async crawlJobKorea() {
        console.log('Crawling JobKorea (Improved - Multiple Queries)...');

        const searchQueries = [
            { query: '언리얼', duty: '' },
            { query: '유니티', duty: '' },
            { query: 'Unreal', duty: '' },
            { query: 'Unity', duty: '' },
            { query: 'Client Programmer', duty: '' },
            { query: 'Server Programmer', duty: '' },
            { query: 'Game Developer', duty: '' },
            { query: '게임', duty: '1000240' }
        ];

        const allJobs = [];
        const seenLinks = new Set();

        for (const item of searchQueries) {
            const query = item.query;
            const duty = item.duty;
            const maxPage = 3;

            console.log(`[JobKorea] Searching for '${query}'${duty ? ` (duty: ${duty})` : ''} (Pages 1-${maxPage})...`);

            for (let page = 1; page <= maxPage; page++) {
                try {
                    const encodedQuery = encodeURIComponent(query);
                    const url = `https://www.jobkorea.co.kr/recruit/joblist?stext=${encodedQuery}${duty ? `&duty=${duty}` : ''}&careerType=1&Page_No=${page}`;

                    await sleep(2000 + Math.random() * 1000);

                    const html = await fetchHtml(url);
                    const $ = cheerio.load(html);

                    let items = $('.devloopArea');
                    if (items.length === 0) items = $('a[href*="/Recruit/GI_Read"]').closest('li');
                    if (items.length === 0) items = $('.list-default .list-post');

                    if (items.length === 0) continue;

                    items.each((i, el) => {
                        try {
                            const post = $(el);
                            const allGiLinks = post.find('a[href*="/Recruit/GI_Read"]');
                            if (allGiLinks.length === 0) return;

                            let titleEl = allGiLinks.last();
                            let href = titleEl.attr('href');
                            let position = titleEl.text().trim().replace(/\s+/g, ' ');

                            if (!position && allGiLinks.length > 1) {
                                titleEl = allGiLinks.eq(allGiLinks.length - 2);
                                href = titleEl.attr('href');
                                position = titleEl.text().trim().replace(/\s+/g, ' ');
                            }

                            if (!href || !position) return;

                            const link = normalizeLink('https://www.jobkorea.co.kr' + href);
                            if (seenLinks.has(link)) return;
                            seenLinks.add(link);

                            let company = post.find('img').attr('alt')?.replace(' 썸네일', '') ||
                                post.find('.name').text().trim() ||
                                post.find('a[href*="/Recruit/Co_Read"]').first().text().trim();

                            if (!company || company.length < 2) {
                                const link0Text = post.find('a').eq(0).text().trim();
                                const link1Text = post.find('a').eq(1).text().trim();
                                company = (link0Text && link0Text !== position) ? link0Text :
                                    (link1Text && link1Text !== position) ? link1Text : "";
                            }

                            if (!company) company = "잡코리아 채용";

                            const deadlineText = post.find('.deadline').text().trim() ||
                                post.find('.date').text().trim() ||
                                post.find('span:contains("~")').text().trim();

                            const job = {
                                company,
                                position,
                                link,
                                deadline: DateUtils.parse(deadlineText),
                                job_type: '신입',
                                category: '기타',
                                tags: ['잡코리아'],
                                is_active: true
                            };

                            const posLower = position.toLowerCase();
                            if (posLower.includes('기획')) job.category = '기획';
                            else if (['클라이언트', '서버', '개발', '프로그래머', '언리얼', '유니티', 'c++', 'c#'].some(k => posLower.includes(k))) job.category = '프로그래밍';
                            else if (['아트', '그래픽', '디자인', '모델러', '이펙트'].some(k => posLower.includes(k))) job.category = '아트';

                            if (Filter.isValid(job)) {
                                allJobs.push(job);
                            }
                        } catch (innerE) { }
                    });
                } catch (e) {
                    console.error(`[JobKorea] Page ${page} Error:`, e.message);
                }
            }
        }
        return allJobs;
    },

    // 5. 서강대학교 경영대학 채용정보
    async crawlSogang() {
        console.log('Crawling Sogang Univ (Career Board)...');
        const jobs = [];
        try {
            const url = `https://sbs.sogang.ac.kr/front/cmsboardlist.do?currentPage=1&bbsConfigFK=2020&siteId=sbs`;
            const html = await fetchHtml(url);
            const $ = cheerio.load(html);

            $('a').each((i, el) => {
                const text = $(el).text().trim();
                const href = $(el).attr('href');

                if (text.includes('[커리어]') && href && href.includes('cmsboardview.do')) {
                    const fullLink = 'https://sbs.sogang.ac.kr' + href;
                    const match = text.match(/\[커리어\]\s*(.+?)\s+(.+?)\s*\((~.*?)\)/);
                    let company = '';
                    let position = text.replace('[커리어]', '').trim();
                    let deadlineText = '';

                    if (match) {
                        company = match[1].trim();
                        position = match[2].trim();
                        deadlineText = match[3].trim();
                    } else {
                        const parts = position.split(' ');
                        if (parts.length > 1) {
                            company = parts[0];
                            position = parts.slice(1).join(' ');
                        } else {
                            company = '대학교 게시판';
                        }
                    }

                    const job = {
                        company,
                        position,
                        link: normalizeLink(fullLink),
                        deadline: DateUtils.parse(deadlineText),
                        job_type: '수시/공채',
                        category: '기타',
                        tags: ['대학교', '서강대'],
                        is_active: true
                    };

                    if (Filter.isValid(job)) {
                        jobs.push(job);
                    }
                }
            });
            return jobs;
        } catch (e) {
            console.error('Sogang Error:', e.message);
            return jobs;
        }
    },

    async sync(jobs) {
        console.log(`[Sync] 총 ${jobs.length}개의 수집된 공고 분석 중...`);
        const uniqueMap = new Map();
        let internalDupCount = 0;

        for (const j of jobs) {
            const nl = normalizeLink(j.link);
            if (!nl) continue;

            const cleanCompany = (j.company || '').replace(/\s+/g, '').toLowerCase();
            const cleanPosition = (j.position || '').replace(/\s+/g, '').toLowerCase();
            const key = `${cleanCompany}|${cleanPosition}`;

            if (uniqueMap.has(nl) || Array.from(uniqueMap.values()).some(v => v.key === key)) {
                internalDupCount++;
                continue;
            }

            uniqueMap.set(nl, { ...j, link: nl, key: key });
        }

        const uniqueColl = Array.from(uniqueMap.values()).map(({ key, ...job }) => job);
        console.log(`[Sync] 내부 중복(링크/제목) ${internalDupCount}건 제거됨. (고유 공고: ${uniqueColl.length}건)`);

        let existingLinks = new Set();
        try {
            const res = await api.get('', {
                params: { select: 'link' },
                headers: { 'Range': '0-999' }
            });
            const data = res.data;
            const jobsList = Array.isArray(data) ? data : (data.data || []);
            existingLinks = new Set(jobsList.map(j => normalizeLink(j.link)).filter(l => l));
        } catch (e) {
            console.error('[Sync] 기존 목록 조회 에러:', e.message);
        }

        if (uniqueColl.length === 0) return;

        const BATCH_SIZE = 50;
        let successCount = 0;

        for (let i = 0; i < uniqueColl.length; i += BATCH_SIZE) {
            const batch = uniqueColl.slice(i, i + BATCH_SIZE);
            try {
                await api.post('', batch);
                successCount += batch.length;
                console.log(`[Sync] Progress: ${successCount}/${uniqueColl.length} 동기화 완료`);
            } catch (e) {
                console.warn('[Sync] 배치가 실패하여 개별 동기화로 전환합니다...');
                for (const item of batch) {
                    try { await api.post('', [item]); successCount++; } catch (err) { }
                }
            }
        }
        await this.cleanup();
    },

    async cleanup() {
        console.log('[Cleanup] 만료된 공고 정리 중...');
        try {
            const today = new Date().toISOString().split('T')[0];
            await api.patch('', { is_active: false }, { params: { deadline: `lt.${today}`, is_active: 'eq.true' } });
            const archiveDate = new Date();
            archiveDate.setDate(archiveDate.getDate() - 30);
            const archiveStr = archiveDate.toISOString().split('T')[0];
            await api.delete('', { params: { deadline: `lt.${archiveStr}`, is_active: 'eq.false' } });
        } catch (e) { }
    }
};

async function main() {
    const allJobs = [];

    const wanted = await Crawler.crawlWanted();
    console.log(`Wanted: ${wanted.length} jobs`);
    allJobs.push(...wanted);

    const gamejob = await Crawler.crawlGamejob();
    console.log(`Gamejob: ${gamejob.length} jobs`);
    allJobs.push(...gamejob);

    const gamejobDuty = await Crawler.crawlGamejobDuty();
    console.log(`Gamejob Duty: ${gamejobDuty.length} jobs`);
    allJobs.push(...gamejobDuty);

    const saramin = await Crawler.crawlSaramin();
    console.log(`Saramin: ${saramin.length} jobs`);
    allJobs.push(...saramin);

    const jobkorea = await Crawler.crawlJobKorea();
    console.log(`JobKorea: ${jobkorea.length} jobs`);
    allJobs.push(...jobkorea);

    const sogang = await Crawler.crawlSogang();
    console.log(`Sogang: ${sogang.length} jobs`);
    allJobs.push(...sogang);

    await Crawler.sync(allJobs);
}

main();
