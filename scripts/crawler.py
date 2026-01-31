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
                jobs.append({
                    'company': item['company']['name'],
                    'position': item['position'],
                    'link': f"https://www.wanted.co.kr/wd/{item['id']}",
                    'deadline': item.get('due_time'),
                    'job_type': '수시',
                    'category': '프로그래밍',
                    'tags': ['원티드', '게임', '신입'],
                    'is_active': True
                })
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
                    position_el = item.select_one('.job_tit a')
                    position = position_el.text.strip()
                    link = "https://www.saramin.co.kr" + position_el['href']
                    deadline = self.parse_date(item.select_one('.date').text)
                    
                    jobs.append({
                        'company': company,
                        'position': position,
                        'link': link,
                        'deadline': deadline,
                        'job_type': '신입',
                        'category': '기타',
                        'tags': ['사람인', '게임'],
                        'is_active': True
                    })
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
                    
                    jobs.append({
                        'company': company,
                        'position': position,
                        'link': link,
                        'deadline': deadline,
                        'job_type': '인턴/신입',
                        'category': '게임',
                        'tags': ['게임잡'],
                        'is_active': True
                    })
                except: continue
        except Exception as e:
            print(f"Gamejob error: {e}")
        return jobs

    def fetch_jobkorea(self):
        """잡코리아 웹 스크래핑"""
        print("Crawling JobKorea...")
        jobs = []
        try:
            # careerType=1: 신입
            url = "https://www.jobkorea.co.kr/Search/?stext=%EA%B2%8C%EC%9E%84%20%EC%8B%A0%EC%9E%85&careerType=1"
            res = requests.get(url, headers=self.headers)
            soup = BeautifulSoup(res.text, 'html.parser')
            items = soup.select('.list-default .list-post')
            
            for item in items:
                try:
                    company = item.select_one('.name').text.strip()
                    pos_el = item.select_one('.title')
                    position = pos_el.text.strip()
                    link = "https://www.jobkorea.co.kr" + pos_el['href']
                    
                    # 마감일 추출
                    date_el = item.select_one('.date')
                    deadline = self.parse_date(date_el.text) if date_el else None
                    
                    jobs.append({
                        'company': company,
                        'position': position,
                        'link': link,
                        'deadline': deadline,
                        'job_type': '신입',
                        'category': '게임',
                        'tags': ['잡코리아', '게임'],
                        'is_active': True
                    })
                except: continue
        except Exception as e:
            print(f"JobKorea error: {e}")
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
