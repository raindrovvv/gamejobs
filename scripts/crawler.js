/**
 * 게임잡스 - 통합 채용 정보 크롤러 (Node.js 버전)
 * 대상: 게임잡, 잡코리아, 사람인, 원티드, 잡플래닛
 */

const axios = require('axios');
const cheerio = require('cheerio');
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
    try {
        const config = {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                ...options.headers
            },
            ...options
        };
        return await axios.get(url, config);
    } catch (e) {
        const status = e.response ? e.response.status : null;
        // 500번대 에러 또는 네트워크 관련 에러(timeout, ENOTFOUND 등)인 경우 재시도
        if (retries > 0 && (!status || status >= 500)) {
            console.warn(`[Retry] ${url} 실패 (${status || e.code}). 재시도 중... (${retries}회 남음)`);
            await new Promise(resolve => setTimeout(resolve, backoff));
            return fetchWithRetry(url, options, retries - 1, backoff * 2);
        }
        throw e;
    }
}

// 인코딩 처리를 위한 함수 (게임잡 등 euc-kr 대응용)
async function fetchHtml(url, encoding = 'utf-8') {
    try {
        const res = await fetchWithRetry(url, { responseType: 'arraybuffer' });
        return res.data.toString(encoding);
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
        '쇼핑몰', '커머스', '물류', '택배', '병원', '남동발전', '카지노', '저축은행',
        '광고대행', 'ae', '기업브랜딩', '마케팅전문'
    ],

    isValid(job) {
        const company = (job.company || '').toLowerCase();
        const position = (job.position || '').toLowerCase();
        const text = company + position;

        // 규칙 1: 제외 키워드가 하나라도 있으면 무조건 탈락
        if (this.EXCLUDE.some(term => text.includes(term.toLowerCase()))) return false;

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

    // 2. 사람인 - 1~30페이지 수집 (약 1,500개 공고 검사)
    async crawlSaramin() {
        console.log('Crawling Saramin (Parallel Pages 1-30)...');
        const pages = Array.from({ length: 30 }, (_, i) => i + 1);
        const tasks = pages.map(async (page) => {
            try {
                const url = `https://www.saramin.co.kr/zf_user/search/recruit?searchword=%EA%B2%8C%EC%9E%84%20%EC%8B%A0%EC%9E%85&exp_cd=1&sort=date&recruitPage=${page}`;
                const html = await fetchHtml(url);
                const $ = cheerio.load(html);
                const pageJobs = [];

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

                    if (Filter.isValid(job)) pageJobs.push(job);
                });
                return pageJobs;
            } catch (e) {
                return [];
            }
        });

        const results = await Promise.all(tasks);
        return results.flat();
    },

    // 3. 게임잡 - 1~30페이지 수집
    async crawlGamejob() {
        console.log('Crawling Gamejob (Pages 1-30)...');
        const jobs = [];
        try {
            for (let page = 1; page <= 30; page++) {
                const url = `https://www.gamejob.co.kr/List_GI/GIB_List.asp?Part_No=0&Search_Word=%BD%C5%C0%D4&GI_Page=${page}`;
                const html = await fetchHtml(url);
                const $ = cheerio.load(html);

                $('.list tr[class^="row"]').each((i, el) => {
                    const company = $(el).find('.col-company a').text().trim();
                    const position = $(el).find('.col-subject a').text().trim();
                    if (!company) return;
                    const normalizedLink = normalizeLink('https://www.gamejob.co.kr' + $(el).find('.col-subject a').attr('href'));
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
            }
            return jobs;
        } catch (e) {
            console.error('Gamejob Error:', e.message);
            return jobs;
        }
    },

    // 4. 게임잡 - 직무별 채용공고 (사용자 요청 추가)
    async crawlGamejobDuty() {
        console.log('Crawling Gamejob Duty List...');
        const jobs = [];
        try {
            // 직무 1번 (프로그래밍 등 주요 직무) 수집
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

    // 4. 잡코리아 - 1~30페이지 수집
    async crawlJobKorea() {
        console.log('Crawling JobKorea (Pages 1-30)...');
        const jobs = [];
        try {
            for (let page = 1; page <= 30; page++) {
                const url = `https://www.jobkorea.co.kr/Search/?stext=%EA%B2%8C%EC%9E%84%20%EC%8B%A0%EC%9E%85&tabType=recruit&Page_No=${page}`;
                const html = await fetchHtml(url);
                const $ = cheerio.load(html);

                $('.list-post .post').each((i, el) => {
                    const company = $(el).find('.name').text().trim();
                    const position = $(el).find('.title').text().trim();
                    const rawLink = 'https://www.jobkorea.co.kr' + $(el).find('.title').attr('href');
                    const deadline = DateUtils.parse($(el).find('.date').text().trim());

                    const job = {
                        company, position,
                        link: normalizeLink(rawLink),
                        deadline,
                        job_type: '신입', category: '기타', tags: ['잡코리아'], is_active: true
                    };

                    if (Filter.isValid(job)) {
                        jobs.push(job);
                    }
                });
            }
            return jobs;
        } catch (e) {
            console.error('JobKorea Error:', e.message);
            return jobs;
        }
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

                // [커리어]로 시작하는 게시글만 파싱
                if (text.includes('[커리어]') && href && href.includes('cmsboardview.do')) {
                    const fullLink = 'https://sbs.sogang.ac.kr' + href;

                    // 제목 파싱: [커리어] 회사명 공고명 (~마감일)
                    // 예: [커리어] (주)넥슨코리아 2024년 하반기 채용 (~10/4)
                    const match = text.match(/\[커리어\]\s*(.+?)\s+(.+?)\s*\((~.*?)\)/);
                    let company = '';
                    let position = text.replace('[커리어]', '').trim();
                    let deadlineText = '';

                    if (match) {
                        company = match[1].trim();
                        position = match[2].trim();
                        deadlineText = match[3].trim();
                    } else {
                        // 패턴이 매칭되지 않을 경우를 대비한 기본적인 분리
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

                    // Filter.isValid를 통해 게임 관련 공고(넥슨 등)만 걸러냄
                    if (Filter.isValid(job)) {
                        jobs.push(job);
                    }
                }
            });
            console.log(`Sogang: ${jobs.length} jobs found after filtering`);
            return jobs;
        } catch (e) {
            console.error('Sogang Error:', e.message);
            return jobs;
        }
    },

    // 데이터 동기화 - 벌크 업서트 처리를 통한 리소스 최적화
    async sync(jobs) {
        console.log(`[Sync] 총 ${jobs.length}개의 수집된 공고 분석 중...`);

        // 1. 수집된 리스트 자체의 중복 제거
        const uniqueColl = [];
        const seenLinks = new Set();
        const seenKeys = new Set(); // (회사명 + 공고명) 중복 방지
        let internalDupCount = 0;

        for (const j of jobs) {
            const nl = normalizeLink(j.link);
            if (!nl) continue;

            // 키 생성 시 공백 제거 및 소문자화 (매우 강력한 중복 방지)
            const cleanCompany = (j.company || '').replace(/\s+/g, '').toLowerCase();
            const cleanPosition = (j.position || '').replace(/\s+/g, '').toLowerCase();
            const key = `${cleanCompany}|${cleanPosition}`;

            if (seenLinks.has(nl) || seenKeys.has(key)) {
                internalDupCount++;
                continue;
            }

            uniqueColl.push({ ...j, link: nl });
            seenLinks.add(nl);
            seenKeys.add(key);
        }

        console.log(`[Sync] 내부 중복(링크/제목) ${internalDupCount}건 제거됨. (고유 공고: ${uniqueColl.length}건)`);

        let existingLinks = new Set();
        try {
            const res = await api.get('/', {
                params: { select: 'link' },
                headers: { 'Range': '0-999' }
            });
            const data = res.data;
            const jobsList = Array.isArray(data) ? data : (data.data || []);
            existingLinks = new Set(jobsList.map(j => normalizeLink(j.link)).filter(l => l));
            console.log(`[Sync] DB내 기존 데이터 ${existingLinks.size}건 확인됨.`);
        } catch (e) {
            console.error('[Sync] 기존 목록 조회 에러:', e.response ? JSON.stringify(e.response.data) : e.message);
        }

        if (uniqueColl.length === 0) {
            console.log('[Sync] 수집된 새로운 공고가 없습니다.');
            return;
        }

        console.log(`[Sync] ${uniqueColl.length}개의 공고를 벌크 업서트(${existingLinks.size > 0 ? '갱신 포함' : '신규 전용'}) 중...`);

        // 벌크 처리를 통해 네트워크 라운드트립 감소 (성능 개선)
        const BATCH_SIZE = 50;
        let successCount = 0;

        for (let i = 0; i < uniqueColl.length; i += BATCH_SIZE) {
            const batch = uniqueColl.slice(i, i + BATCH_SIZE);
            try {
                // Supabase upsert: link를 기준으로 중복 시 업데이트
                await api.post('', batch);
                successCount += batch.length;
                console.log(`[Sync] Progress: ${successCount}/${uniqueColl.length} 동기화 완료`);
            } catch (e) {
                console.error(`[Sync] Batch ${i / BATCH_SIZE + 1} 에러:`, e.response ? JSON.stringify(e.response.data) : e.message);
                // 배치 실패 시 1개씩 재시도하는 Fallback (안정성 강화)
                if (batch.length > 1) {
                    console.warn('[Sync] 배치가 실패하여 개별 동기화로 전환합니다...');
                    for (const item of batch) {
                        try { await api.post('', [item]); successCount++; }
                        catch (innerErr) { console.error(`[Sync] 개별 항목 에러: ${item.company} | ${item.position}`); }
                    }
                }
            }
        }

        console.log(`[Sync] 최종 성공: ${successCount}건 처리 완료.`);

        // 4. 만료된 공고 자동 처리 (마감일 지난 것들)
        await this.cleanup();
    },

    // 만료 공고 비활성화 및 아주 오래된 데이터 삭제
    async cleanup() {
        console.log('[Cleanup] 만료된 공고 및 오래된 데이터 정리 중...');
        try {
            const today = new Date().toISOString().split('T')[0];

            // 1. 마감기한이 지난 공고 비활성화 (is_active = false)
            // Supabase에 직접 쿼리: deadline < today AND is_active = true
            const deactivateRes = await api.patch('',
                { is_active: false },
                { params: { deadline: `lt.${today}`, is_active: 'eq.true' } }
            );
            console.log('[Cleanup] 마감 기한이 지난 공고를 비활성화했습니다.');

            // 2. 너무 오래된 공고 삭제 (예: 마감된 지 30일 이상 지난 데이터)
            const archiveDate = new Date();
            archiveDate.setDate(archiveDate.getDate() - 30);
            const archiveStr = archiveDate.toISOString().split('T')[0];

            const deleteOldRes = await api.delete('', {
                params: { deadline: `lt.${archiveStr}`, is_active: 'eq.false' }
            });
            console.log(`[Cleanup] 마감된 지 30일이 지난 오래된 데이터를 정리했습니다.`);

        } catch (e) {
            console.error('[Cleanup] 에러:', e.response ? JSON.stringify(e.response.data) : e.message);
        }
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
