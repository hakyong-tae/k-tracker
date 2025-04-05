// scrapers/parse_debug_record.cjs
const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('./data/debug_record.html', 'utf-8');
const $ = cheerio.load(html);

// ✅ 대회명 추출
const raceTitle = $('div.ant-card-meta-title').first().text().trim();

// ✅ 이름, 성별, 배번호 추출 (카드 내부 구조 활용)
let name = '', gender = '', bib = '';
const nameElem = $('.card-player .ant-card-meta-title').first();
const infoElem = $('.card-player .ant-card-meta-description').first();

if (nameElem.length) name = nameElem.text().trim();
if (infoElem.length) {
  const rawText = infoElem.text().trim(); // "여자 | #218"
  const parts = rawText.split('|').map((x) => x.trim());
  if (parts.length === 2) {
    gender = parts[0];
    bib = parts[1].replace('#', '');
  }
}

// ✅ 실제 기록은 div.table-row.ant-row 안에 존재함
const rows = $('div.table-row.ant-row');
if (!rows.length) {
  console.log('❌ 기록 행을 찾지 못했습니다.');
  process.exit(1);
}

const records = [];

rows.each((_, row) => {
  const cells = $(row).find('div.ant-col.ant-col-6');
  if (cells.length >= 4) {
    const section = $(cells[0]).text().trim();            // 체크포인트 명
    const checkpointTime = $(cells[1]).text().trim();     // 통과 시각
    const sectionTime = $(cells[2]).text().trim();        // 해당 구간 소요 시간
    const totalTime = $(cells[3]).text().trim();          // 누적 시간

    const [hh = '00', mm = '00', ss = '00'] = totalTime.split(':');
    const totalMinutes = Math.round(parseInt(hh) * 60 + parseInt(mm) + parseInt(ss) / 60);

    records.push({
      section,
      checkpointTime,
      sectionTime,
      totalTime,
      totalMinutes
    });
  }
});

const result = { raceTitle, name, bib, gender, records };
fs.mkdirSync('./data', { recursive: true });
fs.writeFileSync('./data/parsed_from_snapshot.json', JSON.stringify(result, null, 2));
console.log('✅ debug_record.html → parsed_from_snapshot.json 저장 완료!');