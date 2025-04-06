const fs = require("fs");
const path = require("path");

const filesToCopy = [
  "myresult_races_parsed.json",
  // 필요시 더 추가
];

for (const file of filesToCopy) {
  const src = path.join("data", file);
  const dest = path.join("public", "data", file);

  fs.mkdirSync(path.dirname(dest), { recursive: true });

  if (fs.existsSync(src)) {
    fs.copyFileSync('./data/myresult_races_parsed.json', './docs/data/myresult_races_parsed.json');
    console.log(`✅ 복사 완료: ${file}`);
  } else {
    console.warn(`⚠️ 원본 파일 없음: ${file}`);
  }
}
