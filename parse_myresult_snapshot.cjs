// parse_myresult_snapshot.cjs
const cheerio = require("cheerio");
const fs = require("fs");

const rawhtml = fs.readFileSync("data/myresult_snapshot.html", "utf-8");
const $ = cheerio.load(rawhtml);

const races = [];
$(".ant-list-item").each((i, el) => {
  const $li = $(el);
  const title = $li.find(".ant-list-item-meta-title a").text().trim();
  const href = $li.find(".ant-list-item-meta-title a").attr("href");
  const idMatch = href?.match(/\/(\d+)/);
  const id = idMatch ? idMatch[1] : null;

  const descText = $li.find(".ant-list-item-meta-description").text().trim();
  let date = null;
  let location = null;

  if (descText && descText.includes(" / ")) {
    const [datetimePart, locationPart] = descText.split(" / ");
    date = datetimePart.trim(); // 전체 날짜+시간 문자열 사용
    location = locationPart.trim();
  }

  if (id && title) {
    races.push({ id, name: title, date, location });
  }
});

fs.writeFileSync("data/myresult_races_parsed.json", JSON.stringify(races, null, 2), "utf-8");
console.log(`✅ ${races.length}개 대회 파싱 완료`);
