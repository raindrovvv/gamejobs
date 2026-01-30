/**
 * 게임잡스 - 인증 시스템
 */

const Auth = {
    // 비밀번호 확인 (Base64 디코딩 비교)
    verifyPassword(input) {
        try {
            const decoded = atob(window.CONFIG.AUTH.KEY);
            return input === decoded;
        } catch (e) {
            return false;
        }
    },

    // 로그인 처리
    login(password) {
        if (this.verifyPassword(password)) {
            sessionStorage.setItem(window.CONFIG.AUTH.SESSION_KEY, 'true');
            return true;
        }
        return false;
    },

    // 로그아웃
    logout() {
        sessionStorage.removeItem(window.CONFIG.AUTH.SESSION_KEY);
        window.location.href = 'index.html';
    },

    // 인증 상태 확인
    isAuthenticated() {
        return sessionStorage.getItem(window.CONFIG.AUTH.SESSION_KEY) === 'true';
    },

    // 인증이 필요한 페이지 접근 제어
    requireAuth() {
        if (!this.isAuthenticated()) {
            window.location.href = 'index.html';
            return false;
        }
        return true;
    }
};

window.Auth = Auth;
