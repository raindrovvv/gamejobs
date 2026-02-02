import requests
from bs4 import BeautifulSoup
import json
import re
from datetime import datetime

class JobCrawler:
    def __init__(self, api_url):
        self.api_url = api_url
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*'
        }
        self.senior_keywords = [
            '미들급', '리드급', '시니어', 'senior', 'lead', '팀장', '파트장', '실장', 
            '디렉터', 'director', '전문가', 'expert', '경력직', '경력채용', 'manager'
        ]

    def is_valid_job(self, job):
        """신입/인턴 여부 검증 필터"""
        company = job.get('company', '').lower()
        position = job.get('position', '').lower()
        text = company + " " + position
        
        # 1. 시니어 키워드 체크
        if any(k in text for k in self.senior_keywords):
            return False
            
        # 2. 연차 체크 (4년 이상 배제)
        year_match = re.search(r'(\d+)\s*년', text)
        if year_match:
            years = int(year_match.group(1))
            # 4년 이상이면 무조건 배제 (1~3년까지만 허용)
            if years >= 4: return False
            # 2~3년인데 '신입'이나 '인턴' 키워드가 없으면 배제
            if years >= 2 and '신입' not in text and '인턴' not in text:
                return False
                
        return True

    def fetch_wanted(self):
        """원티드 API 이용 크롤링"""
        print("Crawling Wanted...")
        jobs = []
        try:
            # 518: 게임 개발 태그, years=0: 신입
            url = "https://www.wanted.co.kr/api/v4/jobs?country=kr&tag_type_ids=518&years=0&limit=20"
            res = requests.get(url, headers=self.headers)
            data = res.json()
            
            for item in data.get('data', []):
                job_item = {
                    'company': item['company']['name'],
                    'position': item['position'],
                    'link': f"https://www.wanted.co.kr/wd/{item['id']}",
                    'deadline': item.get('due_time'),
                    'job_type': '수시',
                    'category': '프로그래밍',
                    'tags': ['원티드', '게임', '신입'],
                    'is_active': True
                }
                if self.is_valid_job(job_item):
                    jobs.append(job_item)
        except Exception as e:
            print(f"Wanted error: {e}")
        return jobs

    def fetch_saramin(self):
        """사람인 웹 스크래핑"""
        print("Crawling Saramin...")
        jobs = []
        try:
            url = "https://www.saramin.co.kr/zf_user/search/recruit?searchword=%EA%B2%8C%EC%9E%84+%EC%8B%A0%EC%9E%85&exp_cd=1"
            res = requests.get(url, headers=self.headers)
            soup = BeautifulSoup(res.text, 'html.parser')
            items = soup.select('.item_recruit')
            
            for item in items:
                try:
                    company = item.select_one('.corp_name a').text.strip()
                    pos_el = item.select_one('.job_tit a')
                    position = pos_el.text.strip()
                    link = "https://www.saramin.co.kr" + pos_el['href']
                    deadline = self.parse_date(item.select_one('.date').text)
                    
                    job_item = {
                        'company': company,
                        'position': position,
                        'link': link,
                        'deadline': deadline,
                        'job_type': '신입',
                        'category': '기타',
                        'tags': ['사람인', '게임'],
                        'is_active': True
                    }
                    if self.is_valid_job(job_item):
                        jobs.append(job_item)
                except: continue
        except Exception as e:
            print(f"Saramin error: {e}")
        return jobs

    def fetch_gamejob(self):
        """게임잡 웹 스크래핑"""
        print("Crawling Gamejob...")
        jobs = []
        try:
            url = "https://www.gamejob.co.kr/List_GI/GIB_List.asp?Part_No=0&Search_Word=%BD%C5%C0%D4"
            res = requests.get(url, headers=self.headers)
            res.encoding = 'euc-kr'
            soup = BeautifulSoup(res.text, 'html.parser')
            rows = soup.select('.list tr[class^="row"]')
            
            for row in rows:
                try:
                    company = row.select_one('.col-company a').text.strip()
                    pos_el = row.select_one('.col-subject a')
                    position = pos_el.text.strip()
                    link = "https://www.gamejob.co.kr" + pos_el['href']
                    deadline = self.parse_date(row.select_one('.col-date').text)
                    
                    job_item = {
                        'company': company,
                        'position': position,
                        'link': link,
                        'deadline': deadline,
                        'job_type': '인턴/신입',
                        'category': '게임',
                        'tags': ['게임잡'],
                        'is_active': True
                    }
                    if self.is_valid_job(job_item):
                        jobs.append(job_item)
                except: continue
        except Exception as e:
            print(f"Gamejob error: {e}")
        return jobs

    def fetch_jobkorea(self):
        """잡코리아 웹 스크래핑 (개선됨)"""
        print("Crawling JobKorea...")
        jobs = []
        
        # 검색 URL 목록 (신입 전용 필터 적용: careerType=1)
        # 1000240: 게임기획/개발/운영 직무 코드
        base_urls = [
            "https://www.jobkorea.co.kr/Search/?stext=언리얼&careerType=1&tabType=recruit",
            "https://www.jobkorea.co.kr/Search/?stext=유니티&careerType=1&tabType=recruit",
            "https://www.jobkorea.co.kr/Search/?stext=게임&duty=1000240&careerType=1&tabType=recruit"
        ]

        seen_links = set()

        for base_url in base_urls:
            print(f"  Searching: {base_url}...")
            # 페이지네이션 (1~3페이지)
            for page in range(1, 4):
                try:
                    target_url = f"{base_url}&Page_No={page}"
                    res = requests.get(target_url, headers=self.headers)
                    if res.status_code != 200:
                        continue
                        
                    soup = BeautifulSoup(res.text, 'html.parser')
                    
                    # 잡코리아 기본 채용 공고 리스트 선택자
                    items = soup.select('.list-default .list-post')
                    if not items:
                        break # 아이템이 없으면 다음 URL로

                    for item in items:
                        try:
                            # 링크 및 제목 추출
                            post_link_el = item.select_one('.post-list-info a.title')
                            if not post_link_el:
                                post_link_el = item.select_one('.title') # Fallback
                            
                            if not post_link_el: continue

                            href = post_link_el.get('href')
                            if not href or '/Recruit/GI_Read' not in href:
                                continue
                                
                            link = "https://www.jobkorea.co.kr" + href
                            
                            if link in seen_links:
                                continue
                            seen_links.add(link)

                            position = post_link_el.get('title') or post_link_el.text.strip()
                            
                            # 회사명 추출
                            company_el = item.select_one('.post-list-corp .name')
                            if not company_el:
                                company_el = item.select_one('.name') # Fallback
                            company = company_el.text.strip() if company_el else "잡코리아 채용"

                            # 마감일 추출
                            date_el = item.select_one('.post-list-info .date')
                            if not date_el:
                                date_el = item.select_one('.date')
                            
                            deadline = None
                            if date_el:
                                date_text = date_el.text.strip()
                                # "~ 02/09(일)" 형식 파싱
                                deadline = self.parse_date(date_text)

                            # 카테고리 추론
                            category = '기타'
                            pos_lower = position.lower()
                            if '기획' in pos_lower: category = '기획'
                            elif any(k in pos_lower for k in ['클라이언트', '서버', '개발', '프로그래머', '언리얼', '유니티', 'c++', 'c#']): category = '프로그래밍'
                            elif any(k in pos_lower for k in ['아트', '그래픽', '디자인', '모델러', '이펙트']): category = '아트'
                            elif 'pm' in pos_lower or '사업' in pos_lower: category = '마케팅'

                            job_item = {
                                'company': company,
                                'position': position,
                                'link': link,
                                'deadline': deadline,
                                'job_type': '신입', # 필터가 신입이므로 강제 지정
                                'category': category,
                                'tags': ['잡코리아', '게임'],
                                'is_active': True
                            }
                            
                            if self.is_valid_job(job_item):
                                jobs.append(job_item)
                        except Exception as e:
                            # print(f"  Info extraction error: {e}")
                            continue

                except Exception as e:
                    print(f"  Page error: {e}")
                    continue
                    
        print(f"  > JobKorea: Found {len(jobs)} jobs")
        return jobs

    def parse_date(self, text):
        now = datetime.now()
        match = re.search(r'(\d{2})/(\d{2})', text)
        if match:
            return f"{now.year}-{match.group(1)}-{match.group(2)}"
        return None

    def sync_to_db(self, jobs):
        # API_URL이 절대 경로여야 파이썬에서 호출 가능합니다.
        # 예: http://localhost:3000/tables/job_postings
        if not self.api_url.startswith('http'):
            print("Error: API_URL must be a full URL (starting with http)")
            return

        print("Fetching existing jobs to check duplicates...")
        existing_links = set()
        try:
            res = requests.get(self.api_url)
            if res.status_code == 200:
                data = res.json()
                if isinstance(data, dict) and 'data' in data:
                    existing_links = {job.get('link') for job in data['data'] if job.get('link')}
                elif isinstance(data, list): # Handle case where API returns a list directly
                    existing_links = {job.get('link') for job in data if job.get('link')}
        except Exception as e:
            print(f"Warning: Could not fetch existing jobs: {e}")

        print(f"Processing {len(jobs)} jobs...")
        success_count = 0
        skipped_count = 0
        
        for job in jobs:
            if job.get('link') in existing_links:
                skipped_count += 1
                continue
                
            try:
                # API 구조에 맞게 데이터 전송
                res = requests.post(self.api_url, json=job)
                if res.status_code in [200, 201]:
                    success_count += 1
                    existing_links.add(job.get('link')) # Add to existing_links to prevent duplicates within the same run
            except Exception as e:
                print(f"Error syncing job: {e}")
        print(f"Done! Successfully synced {success_count} jobs, Skipped {skipped_count} duplicates.")

def main():
    # 이 부분은 실제 구동 환경의 URL로 변경해야 합니다.
    # 대시보드가 실행 중인 서버 주소와 포트를 입력하세요.
    TARGET_API = "http://localhost:3000/tables/job_postings"
    
    crawler = JobCrawler(TARGET_API)
    
    all_data = []
    all_data.extend(crawler.fetch_wanted())
    all_data.extend(crawler.fetch_saramin())
    all_data.extend(crawler.fetch_gamejob())
    all_data.extend(crawler.fetch_jobkorea())
    
    crawler.sync_to_db(all_data)

if __name__ == "__main__":
    main()
