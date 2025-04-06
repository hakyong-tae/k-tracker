const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 기본 라우트
app.get("/", (req, res) => {
  res.send("K-TRACKER Server is running!");
});

// 기록 조회 API
app.get("/api/myresult/:eventId/:bib", async (req, res) => {
  const { eventId, bib } = req.params;
  const url = `https://myresult.co.kr/${eventId}/${bib}`;

  try {
    const browser = await puppeteer.launch({
      headless: "new", // Render 호환을 위해 `headless: 'new'` 사용
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle2", timeout: 20000 });

    const result = await page.evaluate(() => {
      const nameEl = document.querySelector("span:has(span:contains('성명')) + span");
      const name = nameEl ? nameEl.textContent.trim() : null;

      const rows = Array.from(document.querySelectorAll("table tbody tr"));
      const records = rows.map((row) => {
        const cells = row.querySelectorAll("td");
        return {
          section: cells[0]?.textContent?.trim(),
          checkpointTime: cells[1]?.textContent?.trim(),
          sectionTime: cells[2]?.textContent?.trim(),
          totalTime: cells[3]?.textContent?.trim(),
        };
      });

      return { name, records };
    });

    await browser.close();
    res.json({ bib, name: result.name, records: result.records });
  } catch (err) {
    console.error("❌ 에러:", err);
    res.status(500).json({ error: "Failed to fetch record." });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
