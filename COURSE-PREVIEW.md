# K-TRACKER 코스 미리보기 / Course preview

GPX 하나로 대회 코스 페이지를 만들고, 누구나 코스를 제보하면 관리자가 승인해 공개하는 기능.
기존 K-TRACKER(실시간 기록 추적, `public/*.html`)와 같은 사이트에 붙어 있다.

## 구조

| 경로 | 역할 |
|---|---|
| `functions/` | Cloudflare Pages Functions. 페이지 SSR(검색 노출), API, 관리자 |
| `functions/r/[slug].ts` | 대회 페이지 `/r/singapore-2026` |
| `functions/r/[slug]/band.ts` | 페이스 밴드 인쇄 `/r/<slug>/band?t=4:00` |
| `functions/api/submit.ts` | 공개 코스 제보 (시간당 IP별 5건 제한, 허니팟) |
| `functions/api/admin/*` | 승인·반려·대회 편집 (쿠키 로그인 필요) |
| `functions/api/weather.ts` | 9일 이내면 MET Norway 예보, 그 전엔 NASA POWER 최근 5년 같은 날 평균 |
| `src/shared/` | GPX 파싱, 코스 리샘플(25 m), 경사 반영 스플릿, 검증. 브라우저·서버·시드 스크립트 공용 |
| `src/client/` | 코스 주행 화면(캔버스), 고도 그래프, 지도(MapLibre+OpenFreeMap), 제보·관리 UI |
| `migrations/` | D1 스키마 (races, submissions, cache) |
| `data/races/<slug>/` | 직접 올리는 대회 원본 (race.json + course.gpx) |

무료 플랜 CPU 한도(요청당 10 ms) 때문에 GPX 계산은 브라우저에서 하고, 서버는 결과를 검증·저장만 한다.

## 로컬 실행

```bash
npm install
npm run db:migrate
npm run seed -- data/races/singapore-2026
npm run dev            # http://localhost:8788
```

- 관리자: `/admin` (비밀번호는 `.dev.vars`의 `ADMIN_PASSWORD`)
- 테스트: `npm test` (단위), `npm run typecheck`, `npm run smoke` (dev 서버 띄운 상태에서 E2E)

## 대회 올리는 방법

1. **관리자 화면**: `/admin` → 새 대회 → GPX 업로드 → 정보 입력 → 공개
2. **파일로**: `data/races/<slug>/race.json` + `course.gpx` 작성 → `npm run seed -- data/races/<slug>` (`--remote`면 운영 DB)
3. **제보 승인**: 누구나 `/submit`에서 제보 → `/admin` 대기 목록에서 검사 결과·미리보기 확인 → 승인/반려

GPX 웨이포인트(`<wpt>`)에 water/급수 같은 이름이 있으면 급수 위치로 자동 변환된다.
GPX 거리와 공식 거리 차이가 3% 이내면 km 표시를 공식 거리에 맞춰 보정한다(`scale`).

## 배포 (Cloudflare, 무료로 시작)

```bash
npx wrangler login
npx wrangler d1 create k-tracker          # 출력된 database_id를 wrangler.toml에 넣기
npx wrangler r2 bucket create k-tracker-gpx
npm run db:migrate:remote
npx wrangler pages project create k-tracker --production-branch main
npx wrangler pages secret put ADMIN_PASSWORD --project-name k-tracker
npm run deploy
npm run seed -- data/races/singapore-2026 --remote
```

배포 후 Pages 설정에서 `SITE_URL`을 실제 주소로 바꾼다(canonical·sitemap에 쓰임).

### 비용

| 항목 | 무료 한도 | 넘으면 |
|---|---|---|
| Pages 정적 파일 | 무제한 | — |
| Functions(Workers) 요청 | 하루 10만 | Workers Paid 월 $5 |
| D1 | 5 GB, 하루 읽기 500만 행 | 사용량 과금 |
| R2 (GPX 원본) | 10 GB, 송신 무료 | 사용량 과금 |
| 지도 타일 OpenFreeMap | 무료, 상업 이용 가능 | — |
| 날씨 MET Norway / NASA POWER | 무료, 상업 이용 가능(출처 표기) | — |
| 도메인 | — | 연 약 $10 (애드센스 신청 시 필요) |

### 수익화 스위치

환경변수를 넣기 전엔 아무것도 보이지 않는다.
- `ADSENSE_CLIENT=ca-pub-…` → 대회 페이지 중간·하단, 홈에 광고 슬롯
- `AGODA_CID=…` → 대회 페이지에 "대회장 근처 숙소" 제휴 링크 (링크 형식은 Agoda 파트너 포털에서 확인 후 조정)

## 실시간 기록 추적 (기존 K-TRACKER)

옛 Fly.io 백엔드를 사이트 안의 서버 함수로 옮겼다. 화면은 `public/event.html`, `group_register.html`, `group_viewer.html` 그대로.

| 경로 | 내용 |
|---|---|
| `/api/live/races?provider=myresult` | MyResult 공개 대회 목록 3페이지(30개). D1에 20분 저장, 업체 장애 시 마지막 목록 |
| `/api/live/races?provider=spct` | SPCT(time.spct.kr) 대회 목록 3페이지 |
| `/api/live/record?provider=spct&event=&bib=` | SPCT 배번 기록(구간·완주·순위). 1분 캐시 |
| `/api/live/record?provider=myresult&event=&bib=` | MyResult 공개 기록 페이지(서버 렌더링 HTML)의 구간표를 읽음. JSON API는 키가 필요해져서 안 씀 |

- 화면 링크의 `source=smartchip`은 역사적 이름이고 실제로는 SPCT다.
- 파서는 `src/shared/live.ts`, 테스트 픽스처는 `tests/fixtures/`(이름은 가명 처리).
- 수익화 전에 SPCT·MyResult에 데이터 이용 허락 또는 제휴를 받는 걸 권장. 두 곳 모두 robots.txt는 없다.

## 데이터 출처·라이선스 주의

- 코스맵 이미지·대회 로고는 올리지 않는다. GPX 좌표와 사실 정보만.
- 싱가포르 2026 GPX는 공식 코스맵을 따라 그린 근사 경로다(`data/races/singapore-2026/README.md`). 공식 GPX가 나오면 교체.
- 지도·근사 경로 일부는 © OpenStreetMap contributors (ODbL). 푸터에 표기됨.
- 날씨 출처는 페이지에 자동 표기된다.
