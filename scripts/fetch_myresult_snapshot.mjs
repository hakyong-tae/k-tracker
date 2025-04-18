// scripts/fetch_myresult_snapshot.mjs
import fs from 'fs';
import axios from 'axios';

const url = 'https://myresult.co.kr';

try {
  const response = await axios.get(url);

  fs.mkdirSync('data', { recursive: true }); // data 폴더 없으면 생성
  fs.writeFileSync('data/myresult_snapshot.html', response.data, 'utf-8');

  console.log('✅ myresult_snapshot.html 저장 완료');
} catch (err) {
  console.error('❌ HTML 다운로드 실패:', err.message);
}
