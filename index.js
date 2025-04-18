console.log("🔥 API SERVER ENTRY POINT IS RUNNING");

const express = require("express");
const puppeteer = require("puppeteer-core");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;
const cache = {}; // 1분 캐시

app.get("/", (req, res) => {
  res.send("✅ K-Tracker API is alive!");
});

app.get("/api/myresult/:eventId/:bib", async (req, res) => {
  const { eventId, bib } = req.params;
  const key = `${eventId}-${bib}`;
  const now = Date.now();

  if (cache[key] && now - cache[key].timestamp < 60 * 1000) {
    return res.json(cache[key].data);
  }

  try {
    const browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--single-process",
        "--no-zygote"
      ],
    });

    const page = await browser.newPage();
    const url = `https://myresult.co.kr/${eventId}/${bib}`;
    console.log(`🚀 크롤링 시작: ${url}`);

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector(".ant-card-meta-description", { timeout: 15000 });

    const html = await page.content();
    fs.writeFileSync("debug.html", html); // 디버그용

    const data = await page.evaluate(() => {
      const text = document.body.innerText;

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

      let eventTitle = document.querySelector("h1")?.innerText.trim() || "";
      let eventDate = "";
      const desc = document.querySelector(".ant-card-meta-description")?.innerText.trim();
      if (desc && desc.includes("|")) {
        const parts = desc.split("|");
        eventDate = parts[0]?.trim();
      }

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

      return { name, eventTitle, eventDate, records };
    });

    await browser.close();
    cache[key] = { data, timestamp: now };
    res.json(data);
  } catch (err) {
    console.error("❌ 크롤링 실패:", err);
    res.status(500).json({ error: "크롤링 실패", detail: err.message });
  }
});

app.get("/races", (req, res) => {
  const jsonPath = path.join(__dirname, "data/myresult_races_parsed.json");
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
