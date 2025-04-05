// scripts/update_group_records.cjs
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const groupName = process.argv[2];
if (!groupName) {
  console.log('❗ 사용법: node update_group_records.cjs [groupName]');
  process.exit(1);
}

const groupPath = path.join(__dirname, `../data/groups/${groupName}.json`);
if (!fs.existsSync(groupPath)) {
  console.log(`❌ 그룹 파일이 존재하지 않습니다: ${groupPath}`);
  process.exit(1);
}

const group = JSON.parse(fs.readFileSync(groupPath, 'utf-8'));
const { eventId, runners } = group;

const recordsDir = path.join(__dirname, `../data/records`);
fs.mkdirSync(recordsDir, { recursive: true });

for (const runner of runners) {
  if (!runner.bib) continue;
  console.log(`📡 ${runner.bib} 기록 조회 중...`);
  try {
    const fetchScript = path.join(__dirname, 'fetch_myresult_record.cjs');
    execSync(`node ${fetchScript} ${eventId} ${runner.bib}`, { stdio: 'inherit' });

    const parseScript = path.join(__dirname, 'parse_debug_record.cjs');
    execSync(`node ${parseScript}`, { stdio: 'inherit' });

    const parsed = fs.readFileSync(path.join(__dirname, '../data/parsed_from_snapshot.json'), 'utf-8');
    fs.writeFileSync(path.join(recordsDir, `${eventId}_${runner.bib}.json`), parsed);
    console.log(`✅ 저장 완료: records/${eventId}_${runner.bib}.json\n`);
  } catch (err) {
    console.error(`❌ 실패: ${runner.bib}`, err.message);
  }
}
