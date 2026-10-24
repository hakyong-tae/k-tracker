---
name: add-race
description: K-TRACKER에 대회 코스 페이지를 추가한다. 사용자가 GPX 파일과 대회 이름(또는 공식 사이트)을 주며 "대회 추가", "GPX 넣었어", "코스 페이지 만들어줘", "add a race" 등을 말하면 사용. GPX 검증 → 공식 정보 조사 → OSM 지명 초안 → 구간 팁·급수·알아둘 것 작성(한/영) → 로컬 확인 → 사용자 OK 후 운영 반영.
---

# K-TRACKER 대회 추가 / Add a race

한 번 만든 페이지는 모든 방문자가 저장된 내용을 그대로 본다. 사이트에는 AI가 없고, 사람이 읽는 부분만 이 스킬로 한 번 쓴다.

작업 폴더: 이 레포 루트(`k-tracker-course`). Node: `~/.nvm/versions/node/v23.11.0/bin`.

## 0. 받을 것

- GPX 파일 (공식 GPX, 또는 사용자가 작년에 뛴 가민/스트라바 기록)
- 대회 이름 또는 공식 사이트 주소
- 없으면 물어볼 것: 종목(full/half/10k), 연도

## 1. 슬러그와 폴더

- 슬러그: 영문 소문자-연도, 예 `chuncheon-2026`, `tokyo-2027`. 이미 있으면 사용자에게 확인.
- `data/races/<slug>/course.gpx`로 복사. 원본 파일명이 무엇이든 이 이름으로.

## 2. GPX 검증 + 사실 초안

```bash
node scripts/race-draft.ts data/races/<slug>/course.gpx --distance full --out .cache/<slug>-draft.json
```

- `checks`의 `distance`가 `error`(±3% 초과)면 멈추고 사용자에게 알린다. 다른 종목 GPX이거나 워밍업이 섞였을 수 있다.
- `elevationSource`가 `none`이면 관리자 화면 업로드처럼 DEM으로 채워야 한다. 도심(빌딩)에서는 SRTM이 크게 튀므로 공식 고도표가 있으면 그것을 우선.
- 초안에는 5km 구간별 도로·지역·다리 이름(OSM Nominatim, 초당 1회, `.cache/geocode.json` 캐시), 오르막(`climbPlaces`), 반환점 후보(`turnaroundPlaces`)가 들어 있다. **힌트일 뿐**이니 공식 정보와 교차 확인한다. 반환점 후보에는 급커브가 섞인다.

## 3. 공식 정보 조사

공식 사이트·요강(PDF)·공지에서 찾고 URL을 `sources`에 남긴다.

- 날짜, 종목별 출발 시각(`startTime`, 현지), 시간대(`timezone`, IANA), 국가(`country`), 제한 시간(`cutoff`)
- 급수·스포츠음료·간식·젤·의료 위치(km). **공개되지 않았으면 지어내지 말고** `notes`에 "요강 공개 후 추가"라고 적는다.
- 출발 구역·짐 보관·교통(첫차·셔틀)·날씨 특성·주의 사항
- 대회명 변경, 코스 변경 여부(작년 GPX를 쓴다면 올해 코스와 같은지 반드시 확인)

## 4. race.json 작성

`data/races/singapore-2026/race.json`이 완성 예시다. 형식은 `src/shared/validate.ts`의 `sanitizeMeta`가 기준.

```json
{
  "slug": "<slug>",
  "name": { "ko": "...", "en": "..." },
  "date": "YYYY-MM-DD", "startTime": "HH:MM", "timezone": "Asia/Seoul", "country": "KR",
  "city": { "ko": "...", "en": "..." },
  "distance": "full", "officialUrl": "https://...", "cutoff": "5:00",
  "courseSource": { "type": "official-gpx | community-gpx | approximated-from-official-map", "url": "...",
                    "note": { "ko": "...", "en": "..." } },
  "pois": [ { "km": 4, "type": "turnaround", "name": { "ko": "1차 반환점", "en": "1st U-turn" } } ],
  "segments": [ { "fromKm": 0, "toKm": 5, "title": { "ko": "...", "en": "..." }, "tip": { "ko": "...", "en": "..." } } ],
  "notes": { "ko": ["..."], "en": ["..."] },
  "sources": ["https://..."],
  "live": { "provider": "myresult", "eventId": "176" }
}
```

글쓰기 규칙:

- **구간 제목**: 그 5km에서 지나는 주요 지점 2~4개를 화살표로. 예 `공지천교 → 삼천사거리 → 송암스포츠타운`.
- **구간 팁**: 한 문장, 많아야 두 문장. 지형(오르막 길이·높이, 다리, 반환), 바람·그늘·노면, 페이스 조언. 초안의 `gain`/`maxGrade`/`climbs`를 근거로 숫자를 쓴다.
- **공식 문장 복사 금지**: 공식 코스 설명은 사실만 참고하고 문장은 새로 쓴다(저작권). 지도 이미지·로고는 넣지 않는다.
- 한국어는 자연스러운 존댓말, 영어는 짧고 평이하게. 한/영 내용이 같아야 한다.
- 근사 경로면 `courseSource.type`을 `approximated-…`로 두면 페이지에 경고가 자동 표시된다.

### 실시간 추적 연결 (국내 대회)

- MyResult: `https://k-tracker-vit.pages.dev/api/live/races?provider=myresult` 에서 대회명으로 `id`를 찾는다.
- SPCT: `...?provider=spct` 에서 `id`(EVENT_NO).
- 스마트칩(smartchip.co.kr)은 robots.txt가 자동 수집을 금지하므로 **접근하지 않는다**. `live`를 비워 둔다.
- 찾으면 `"live": {"provider": "myresult", "eventId": "<id>"}`. 대회 페이지에 "실시간 응원" 버튼이 생기고 트래커 목록에 코스 칩이 붙는다.

## 5. 로컬 확인

```bash
npm run db:migrate                      # 로컬 DB가 비어 있으면
npm run seed -- data/races/<slug>       # 검사 결과(distance/start-finish)가 출력됨
```

preview 서버(`.claude/launch.json`의 `k-tracker`, 포트 8788)로 `/r/<slug>`를 열어 확인:

- 375px 폭에서 가로 스크롤 없음, 콘솔 에러 없음
- 고도 그래프 라벨이 겹치지 않음, 구간 9개(풀) 팁이 지형과 맞음
- 페이스 탭 스플릿, 날씨 탭(예보 또는 예년)이 뜸
- `live`가 있으면 "실시간 응원" 버튼이 맞는 대회로 감

스크린샷과 함께 사용자에게 보여주고 **승인을 받는다.**

## 6. 운영 반영 (승인 후)

```bash
npm run seed -- data/races/<slug> --remote
```

코드 변경이 없으면 배포는 필요 없다(페이지는 D1 데이터로 렌더링). 코드도 바꿨다면:

```bash
npx vite build && npx wrangler pages deploy dist --project-name k-tracker --branch main --commit-dirty=true
```

운영 주소 `https://k-tracker-vit.pages.dev/r/<slug>` 를 열어 200과 내용을 확인한다.

## 7. 마무리

- `data/races/<slug>/README.md`에 GPX 출처, 측정 거리, 근사 여부, 공식 GPX가 나오면 교체할 것을 적는다.
- `git add data/races/<slug>` 후 커밋. 푸시는 사용자 요청이 있을 때만.
- 메모리 `project_k_tracker_course_preview.md`의 대회 목록에 한 줄 추가.
