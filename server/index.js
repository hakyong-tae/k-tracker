const express = require("express");
const puppeteer = require("puppeteer");
const cors = require("cors");

const app = express();
app.use(cors());

const PORT = 3000;

// ✅ 1분 캐시 저장소
const cache = {}; // 예: { "103-1220": { data: {...}, timestamp: Date.now() } }

app.get("/api/myresult/:eventId/:bib", async (req, res) => {
  const { eventId, bib } = req.params;
  const key = `${eventId}-${bib}`;
  const now = Date.now();

  // ✅ 캐시 유효하면 반환
  if (cache[key] && now - cache[key].timestamp < 60 * 1000) {
    return res.json(cache[key].data);
  }

  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--no-first-run",
    "--no-zygote",
    "--deterministic-fetch",
    "--disable-features=IsolateOrigins",
    "--disable-site-isolation-trials"
      ],   executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined

    });

    const page = await browser.newPage();

    await page.goto(`https://myresult.co.kr/${eventId}/${bib}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // DOM 로딩 완료까지 기다림
    await page.waitForSelector(".ant-card-meta-description", { timeout: 15000 });

    const html = await page.content();
    const fs = require("fs");
    fs.writeFileSync("debug.html", html);
    

    const data = await page.evaluate(() => {
      const text = document.body.innerText;
    
      // ✅ [1] 선수 이름 추출
      let name = "";
      const bibLine = Array.from(document.querySelectorAll("div, span, p"))
        .map(el => el.innerText)
        .find(text => text.includes("배번") && text.includes("남자"));
      if (!name) {
  const match = text.match(/(?:하프|Half)[\s\n]+([^\s\n]+)[\s\n]+남자/);
  if (match) name = match[1].trim();
}
      if (bibLine) {
        const match = bibLine.match(/배번\s*\d+\s*-\s*남자\s*-\s*([^\s]+)/);
        if (match) name = match[1].trim();
      }
      
      // ✅ [2] 대회명 추출 (절대 name 변수에 넣지 말기!!)
      let eventTitle = document.querySelector("h1")?.innerText.trim() || "";
    
      // ✅ [3] 날짜
      let eventDate = "";
      const desc = document.querySelector(".ant-card-meta-description")?.innerText.trim();
      if (desc && desc.includes("|")) {
        const parts = desc.split("|");
        eventDate = parts[0]?.trim();
      }
    
      // ✅ [4] 구간 기록
      const rows = Array.from(document.querySelectorAll(".table-row.ant-row"));
      const records = rows.map((row) => {
        const cells = row.querySelectorAll(".ant-col");
        return {
          section: cells[0]?.textContent.trim(),
          checkpointTime: cells[1]?.textContent.trim(),
          sectionTime: cells[2]?.textContent.trim(),
          totalTime: cells[3]?.textContent.trim(),
        };
      });
    
      // ✅ [5] 최종 리턴: name, eventTitle, eventDate 모두 분리!
      return {
        name,
        eventTitle,
        eventDate,
        records,
      };
    });
    

    await browser.close();
     // ✅ 캐시에 저장
    cache[key] = {
      data,
      timestamp: now,
    };

    res.json(data);
  } catch (err) {
    console.error("❌ 크롤링 실패:", err);
    res.status(500).json({ error: "크롤링 실패", detail: err.message });
  }
});

const path = require("path");
const fs = require("fs");

app.get("/races", (req, res) => {
  const jsonPath = path.join(__dirname, "../data/myresult_races_parsed.json");
  if (fs.existsSync(jsonPath)) {
    const data = fs.readFileSync(jsonPath, "utf-8");
    res.json(JSON.parse(data));
  } else {
    res.status(404).json({ error: "Race data not found." });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
