const puppeteer = require("puppeteer");
const fs = require("fs");

async function fetchRecord(eventId, bib) {
  const browser = await puppeteer.launch({ 
    headless: "new",
    defaultViewport: { width: 1366, height: 768 }
  });
  const page = await browser.newPage();
  const url = `https://myresult.co.kr/${eventId}/${bib}`;

  console.log(`🔍 ${bib} 기록 조회 중...`);

  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    
    // 페이지가 로드될 때까지 기다림 (더 일반적인 선택자 사용)
    await page.waitForSelector("body", { timeout: 15000 });
    
    // 스크린샷 저장 (디버깅용)
    await page.screenshot({ path: "data/page_screenshot.png", fullPage: true });
    
    // 페이지 HTML 저장 (디버깅용)
    const html = await page.content();
    fs.writeFileSync("data/debug_record.html", html);

    // 페이지 소스 확인을 위한 디버깅 정보
    const pageText = await page.evaluate(() => document.body.innerText);
    fs.writeFileSync("data/page_text.txt", pageText);

    // 기본 정보 추출 (정규식과 선택자 모두 시도)
    const basicInfo = await page.evaluate(() => {
      // 대회명과 날짜 추출 (여러 선택자 시도)
      const eventTitle = document.querySelector("h1, h2, .event-title, .ant-typography")?.textContent?.trim() || "";
      const eventDate = document.querySelector("h3, .event-date, p.ant-typography")?.textContent?.trim() || "";
      
      // 전체 페이지 텍스트 가져오기
      const fullText = document.body.innerText;
      
      // 이름 추출 시도 (여러 방법)
      // 이름 추출 시도 (여러 방법)
// 이름 추출
let name = "";
const nameMatch = fullText.match(/(?:하프|Half)[\s\n]+([^\s\n]+)[\s\n]+남자/) ||
                  fullText.match(/이름[:\s]+([^\s\n]+)/);
if (nameMatch) name = nameMatch[1].trim();



      
      // 정규식으로 시도 (이름 패턴)
      if (!name) {
        const nameMatch = fullText.match(/Half\s+([\w\s]+?)\s+남자/) || 
                          fullText.match(/하프\s+([\w\s]+?)\s+남자/) ||
                          fullText.match(/풀\s+([\w\s]+?)\s+남자/) ||
                          fullText.match(/([\w\s]+?)\s+#\d+/);
        if (nameMatch) name = nameMatch[1].trim();
      }
      
      // 배번 추출
      let bib = "";
      const bibEl = document.querySelector(".ant-card-meta-description, .bib-number");
      if (bibEl) {
        const bibText = bibEl.textContent;
        const bibMatch = bibText.match(/#(\d+)/) || bibText.match(/배번\s*:?\s*(\d+)/);
        if (bibMatch) bib = bibMatch[1];
      }
      // 정규식으로 시도
      if (!bib) {
        const bibMatch = fullText.match(/#(\d+)/) || 
                        fullText.match(/배번\s*:?\s*(\d+)/);
        if (bibMatch) bib = bibMatch[1];
      }
      
      // 총 기록 추출
      let totalTime = "";
      const timeEl = document.querySelector(".time, .total-time, .finish-time");
      if (timeEl) {
        totalTime = timeEl.textContent.trim();
      }
      // 정규식으로 시도
      if (!totalTime) {
        const timeMatch = fullText.match(/대회기록\s*(\d{2}:\d{2}:\d{2})/) || 
                          fullText.match(/완주시간\s*(\d{2}:\d{2}:\d{2})/) ||
                          fullText.match(/총기록\s*(\d{2}:\d{2}:\d{2})/);
        if (timeMatch) totalTime = timeMatch[1];
      }
      
      // 페이스 추출
      let pace = "";
      const paceEl = document.querySelector(".pace, .pace-value");
      if (paceEl) {
        pace = paceEl.textContent.trim();
      }
      // 정규식으로 시도
      if (!pace) {
        const paceMatch = fullText.match(/페이스\s*(\d{2}:\d{2})\s*min\/km/) ||
                         fullText.match(/페이스\s*(\d{2}'\d{2}\")/);
        if (paceMatch) pace = paceMatch[1] + " min/km";
      }
      
      // 순위 추출
      let rank = "";
      const rankMatch = fullText.match(/전체[^\d]*([\d,]+)[^\d]*위/) || 
                        fullText.match(/코스 전체순위[^\d]*([\d,]+)[^\d]*위/);
      if (rankMatch) rank = rankMatch[1];
      
      // 성별 순위 추출
      let genderRank = "";
      const genderRankMatch = fullText.match(/성별[^\d]*([\d,]+)[^\d]*위/) ||
                             fullText.match(/코스 성별순위[^\d]*([\d,]+)[^\d]*위/);
      if (genderRankMatch) genderRank = genderRankMatch[1];
      
      // 대회명이 없는 경우 URL에서 추출 시도
      if (!eventTitle) {
        const pageUrl = window.location.href;
        const urlMatch = pageUrl.match(/myresult\.co\.kr\/(\d+)/);
        if (urlMatch) {
          const eventIdFromUrl = urlMatch[1];
          if (eventIdFromUrl === "103") {
            return {
              eventTitle: "2025 고양특례시 하프마라톤",
              eventDate: "2025-04-06 (일)",
              name, bib, totalTime, pace, rank, genderRank
            };
          }
        }
      }
      
      return {
        eventTitle, eventDate, name, bib, totalTime, pace, rank, genderRank
      };
    });
    
    // 구간 기록 추출 (기존 코드 활용)
    const recordsData = await page.evaluate(() => {
      const records = [];
      
      // 테이블에서 데이터 찾기
      const rows = document.querySelectorAll("table tr");
      
      for (let i = 1; i < rows.length; i++) { // 첫 번째 행은 헤더이므로 건너뜀
        const cells = rows[i].querySelectorAll("td");
        
        if (cells.length >= 4) {
          records.push({
            section: cells[0].textContent.trim(),
            checkpointTime: cells[1].textContent.trim(),
            sectionTime: cells[2].textContent.trim(),
            lapTime: cells[3].textContent.trim()
          });
        }
      }
      
      // 테이블이 없는 경우 정규식으로 데이터 추출
      if (records.length === 0) {
        const fullText = document.body.innerText;
        
        // 각 구간 데이터 추출을 위한 정규식 패턴
        const sections = ["출발", "5K", "10K", "제1반환점", "15K", "제2반환점", "20K", "도착"];
        
        for (const section of sections) {
          // 각 구간에 대한 데이터를 찾기 위한 패턴
          const pattern = new RegExp(`${section}[\\s\\n]+([0-9:]+)[\\s\\n]+([0-9:-]+)[\\s\\n]+([0-9:-]+)`);
          const match = fullText.match(pattern);
          
          if (match) {
            records.push({
              section: section,
              checkpointTime: match[1].trim(),
              sectionTime: match[2].trim(),
              lapTime: match[3].trim()
            });
          }
        }
      }
      
      return records;
    });
    
    // 기본 정보와 구간 기록 병합
    const finalData = {
      ...basicInfo,
      records: recordsData
    };
    
   
    
    await browser.close();
    return finalData;
    
  } catch (error) {
    console.error('오류 발생:', error);
    await browser.close();
    throw error;
  }
}

module.exports = fetchRecord;