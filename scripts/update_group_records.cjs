const fs = require("fs");
const path = require("path");
const fetchRecord = require("../scrapers/fetch_myresult_record.cjs");

const groupId = process.argv[2];
const eventId = process.argv[3];

if (!groupId || !eventId) {
  console.error("사용법: node update_group_records.cjs [groupId] [eventId]");
  process.exit(1);
}

const groupFilePath = path.join("data", "groups", `${groupId}.json`);
if (!fs.existsSync(groupFilePath)) {
  console.error(`❌ 그룹 파일이 존재하지 않습니다: ${groupFilePath}`);
  process.exit(1);
}

const groupJson = fs.readFileSync(groupFilePath, "utf8");
const groupData = JSON.parse(groupJson);

(async () => {
  for (const runner of groupData) {
    const bib = runner.bib;
    console.log(`📡 ${bib} 기록 조회 중...`);

    try {
      const record = await fetchRecord(eventId, bib);
      if (!record) {
        console.warn(`⚠️ 기록 없음: ${bib}`);
        continue;
      }

      const savePath = path.join("data", "records", `${eventId}_${bib}.json`);
      fs.mkdirSync(path.dirname(savePath), { recursive: true });
      fs.writeFileSync(savePath, JSON.stringify(record, null, 2));
      console.log(`✅ 저장 완료: ${savePath}\n`);
    } catch (err) {
      console.error(`❌ ${bib} 처리 중 오류 발생:`, err);
    }
  }
})();
