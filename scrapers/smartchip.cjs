const puppeteer = require('puppeteer');
const fs = require('fs');

async function main() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('https://www.smartchip.co.kr/Search_Record.html', {
    waitUntil: 'networkidle2',
    timeout: 15000, // 15초 제한
  });

  console.log('🌐 페이지 로드 완료. iframe 로딩 대기 중...');

  const targetFrame = await new Promise((resolve, reject) => {
    const maxWait = 10000; // 10초까지만 기다림
    const start = Date.now();

    const check = () => {
      const frames = page.frames();
      const recordFrame = frames.find(f => f.url().includes('Record_List.html'));

      if (recordFrame) {
        console.log('✅ iframe 로딩 성공!');
        resolve(recordFrame);
      } else if (Date.now() - start > maxWait) {
        reject(new Error('❌ iframe 로딩 실패 (10초 초과)'));
      } else {
        setTimeout(check, 300);
      }
    };

    check();
  });

  const races = await targetFrame.evaluate(() => {
    const select = document.querySelector('select[name="usedata"]');
    if (!select) return [];
    return Array.from(select.querySelectorAll('option'))
      .filter(opt => opt.value && opt.value !== '0')
      .map(opt => ({
        site: 'smartchip',
        name: opt.textContent.trim(),
        usedata: opt.value.trim()
      }));
  });

  fs.mkdirSync('./data', { recursive: true });
  fs.writeFileSync('./data/smartchip_races.json', JSON.stringify(races, null, 2));
  console.log(`🎉 대회 ${races.length}개 저장 완료!`);

  await browser.close();
}

main().catch(console.error);
