// 📁 render/index.js
// MyResult 공식 API 프록시용 Express 서버

const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");
const app = express();

const PORT = process.env.PORT || 3000;

app.use(cors());

// ✅ MyResult 대회 목록 프록시
app.get("/api/proxy/myresult-races", async (req, res) => {
  try {
    const response = await fetch("https://myresult.co.kr/api/event/");
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("/myresult-races fetch error:", err);
    res.status(500).json({ error: "Failed to fetch races from MyResult." });
  }
});

// ✅ MyResult 선수 기록 프록시
app.get("/api/proxy/myresult-record", async (req, res) => {
  const { eventId, bibNo } = req.query;
  if (!eventId || !bibNo) return res.status(400).json({ error: "Missing eventId or bibNo" });

  try {
    const url = `https://myresult.co.kr/api/event/${eventId}/player/${bibNo}`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("/myresult-record fetch error:", err);
    res.status(500).json({ error: "Failed to fetch record from MyResult." });
  }
});

app.get("/", (req, res) => {
  res.send("MyResult Proxy API is running");
});

app.listen(PORT, () => {
  console.log(`✅ Render Proxy Server running on port ${PORT}`);
});
