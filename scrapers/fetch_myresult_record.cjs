const puppeteer = require("puppeteer");
const fs = require("fs");
const cheerio = require("cheerio");

async function fetchRecord(eventId, bib) {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  const url = `https://myresult.co.kr/${eventId}/${bib}`;

  console.log(`🔍 ${bib} 기록 조회 중...`);

  await page.goto(url, { waitUntil: "networkidle2", timeout: 20000 });
  await new Promise((res) => setTimeout(res, 3000));

  const html = await page.content(); // 👉 HTML 먼저 가져오기

  // ✅ HTML 저장 (디버깅용)
  fs.writeFileSync("data/debug_record.html", html);

  // ✅ HTML 파싱
  const $ = cheerio.load(html);
  const name = $(".ant-descriptions-title").text().trim();
  const bibNumber = $(".ant-descriptions-item-content").first().text().trim();
  const gender = $(".ant-descriptions-item-content").eq(1).text().trim();

  const records = [];
  $(".ant-table-wrapper table tbody tr").each((i, row) => {
    const cells = $(row).find("td");
    const section = $(cells[0]).text().trim();
    const checkpointTime = $(cells[1]).text().trim();
    const sectionTime = $(cells[2]).text().trim();
    const totalTime = $(cells[3]).text().trim();

    const [hh = "00", mm = "00", ss = "00"] = totalTime.split(":");
    const totalMinutes =
      totalTime !== "-" ? Math.round(+hh * 60 + +mm + +ss / 60) : null;

    records.push({ section, checkpointTime, sectionTime, totalTime, totalMinutes });
  });

  await browser.close();

  return {
    name,
    bib: bibNumber,
    gender,
    records,
  };
}

module.exports = fetchRecord;
