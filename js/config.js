/**
 * 게임잡스 - 설정 및 보안 구성
 * 
 * 주의: 이 파일은 클라이언트 측에서 실행되므로 완벽한 보안을 제공하지 않습니다.
 * 민감한 작업은 반드시 서버 사이드 검증이 필요합니다.
 */

const CONFIG = {
    // 관리자 세션 정보 (단순 마스킹 처리)
    AUTH: {
        // 'spc1121'의 Base64 인코딩 버전
        KEY: 'c3BjMTEyMQ==',
        SESSION_KEY: 'gamejobs_admin_auth'
    },

    // Supabase 연동 정보 (무료 클라우드 DB)
    // 실제 사용 시 Supabase 프로젝트 생성 후 아래 값을 채워주세요.
    SUPABASE: {
        URL: '{{SUPABASE_URL}}',
        KEY: '{{SUPABASE_KEY}}',
        TABLE_NAME: 'job-postings'
    },

    // API 베이스 주소 (로컬 또는 Supabase)
    get API_BASE_URL() {
        return this.SUPABASE.URL
            ? `${this.SUPABASE.URL}/rest/v1/${this.SUPABASE.TABLE_NAME}`
            : 'tables/job_postings';
    },

    // UI 설정
    UI: {
        ANIMATION_SPEED: 300,
        TOAST_DURATION: 3000
    },

    // 분석 도구 (GA4)
    ANALYTICS: {
        // 구글 애널리틱스 측정 ID (예: G-ABC1234567)
        // 측정 ID가 없으면 로드되지 않습니다.
        GA4_ID: 'G-VWR293KCYJ'
    }
};

window.CONFIG = CONFIG;
