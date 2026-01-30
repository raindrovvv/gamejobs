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
        URL: 'https://mtfrnwqhklezedkmhatk.supabase.co',
        KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10ZnJud3Foa2xlemVka21oYXRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3MzY4OTIsImV4cCI6MjA4NTMxMjg5Mn0.J8rXEnatfH5jmNpVInf_YzFqknF8PLib0vAPsdBaXMI',
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
    }
};

window.CONFIG = CONFIG;
