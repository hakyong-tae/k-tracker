// scrapers/myresult.cjs
const puppeteer = require('puppeteer');
const fs = require('fs');

async function main() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('https://myresult.co.kr/', {
    waitUntil: 'networkidle2',
    timeout: 15000
  });

  console.log('🌐 MyResult 페이지 로드 완료. 대회 목록 추출 중...');

  const content = await page.content();
  fs.writeFileSync('./data/myresult_snapshot.html', content);
  

  const races = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a.raceBtn'));
    return links.map(link => {
      const href = link.getAttribute('href');
      const eventId = href.replace(/^\//, '');
      const name = link.textContent.trim();
      return {
        site: 'myresult',
        name,
        eventId,
        url: `https://myresult.co.kr/${eventId}`
      };
    });
  });

  fs.mkdirSync('./data', { recursive: true });
  fs.writeFileSync('./data/myresult_races.json', JSON.stringify(races, null, 2));

  console.log(`✅ MyResult: ${races.length}개 대회 저장 완료.`);

  await browser.close();
}

main().catch(console.error);
