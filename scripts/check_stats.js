const axios = require('axios');

async function check() {
    const URL = 'https://mtfrnwqhklezedkmhatk.supabase.co/rest/v1/job-postings';
    const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10ZnJud3Foa2xlemVka21oYXRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3MzY4OTIsImV4cCI6MjA4NTMxMjg5Mn0.J8rXEnatfH5jmNpVInf_YzFqknF8PLib0vAPsdBaXMI';

    try {
        const res = await axios.get(URL, {
            headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}` }
        });
        const jobs = res.data;
        console.log(`Total Jobs in DB: ${jobs.length}`);

        const companies = jobs.map(j => j.company);
        const uniqueRaw = new Set(companies).size;

        const normalized = companies.map(name => {
            return (name || '')
                .replace(/\(주\)/g, '')
                .replace(/주식회사/g, '')
                .replace(/㈜/g, '')
                .replace(/\(유\)/g, '')
                .replace(/\(사\)/g, '')
                .replace(/\s+/g, '')
                .trim();
        });
        const uniqueNorm = new Set(normalized).size;

        console.log(`Unique Companies (Raw): ${uniqueRaw}`);
        console.log(`Unique Companies (Normalized): ${uniqueNorm}`);

        if (uniqueRaw === jobs.length && jobs.length > 1) {
            console.log('Suspicious: Every single job has a unique company name string.');
            console.log('Sample companies:', companies.slice(0, 10));
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

check();
