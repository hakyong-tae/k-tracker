// run.js 파일
const fetchRecord = require('/Users/hytae/k-tracker/scrapers/fetch_runner_record.cjs');

const eventId = 103;  // 대회 ID
const bib = 1222;     // 선수 배번

fetchRecord(eventId, bib)
  .then(result => {
    console.log("선수 데이터:", result);  // 크롤링된 선수 데이터 출력
  })
  .catch(err => {
    console.error("크롤링 중 오류 발생:", err);
  });
