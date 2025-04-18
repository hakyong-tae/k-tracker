import fs from 'fs';
import puppeteer from 'puppeteer';

const url = 'https://myresult.co.kr';

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});

const page = await browser.newPage();
await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

const html = await page.content();
fs.mkdirSync('data', { recursive: true });
fs.writeFileSync('data/myresult_snapshot.html', html, 'utf-8');

console.log('✅ puppeteer로 myresult_snapshot.html 저장 완료');
await browser.close();
