# 2027 Seoul Marathon (97th Dong-A Marathon): full marathon course data

Race day is **Sun 2027-03-21** (confirmed on the official site). Assembly is **06:30 (planned)**. The 2027 start time has not been announced; `startTime` is **07:30**, the 2026 start time. Data compiled 2026-10-26.

## What we found
- **Date: confirmed.** 2027-03-21 is stated on:
  - the [overview page](https://seoul-marathon.com/96) ("2027 서울마라톤 겸 제97회 동아마라톤", 2027년 3월 21일 일요일);
  - the [rules page](https://seoul-marathon.com/95);
  - the [registration schedule notice](https://seoul-marathon.com/94/?bmode=view&idx=171044053);
  - the English [overview](https://en.seoul-marathon.com/83) and [overseas registration notice](https://en.seoul-marathon.com/60/?bmode=view&idx=173536131).
- **2027 course: not published.** The [course page](https://seoul-marathon.com/91) says "추후 공개 예정" (to be published). The 2027 rules list the full-marathon assembly at Gwanghwamun Square (planned) and the 10K at Jamsil Sports Complex (planned), the same as 2026. **This page therefore uses the 2026 course** (2026-03-15, Gwanghwamun Square → Jamsil Sports Complex East Gate).
- **Start time.** The 2027 rules give only the 06:30 assembly time. In 2026 the start moved from 08:00 to **07:30** for both the marathon and the 10K, on Seoul city guidance ([notice 2026-02-10](https://seoul-marathon.com/94/?bmode=view&idx=169959408)). The 2026 course map also shows "7:30 AM START".
- **Cut-off: 5:00.** The 2027 rules say the 5-hour marathon limit (1:30 for the 10K) is strictly enforced, and roads reopen behind distance-based cut-offs. No per-point cut-offs are published for 2027.
  - The 2026 traffic-control table lists reopening times per intersection, for example: 10.1 km 09:10, 21.2 km 10:28, 30.2 km 11:31, 37.6 km 12:22 and 40 km 12:40.
  - These are in the notes as a reference only. No `cutoff` POIs were added.
- **Aid stations** (2027 rules, matching the 2026 course map; these are the only km values used for aid):
  - Water and sports drink (Pocari Sweat) every 5 km (5–40 km, 8 stations) and at the finish.
  - Sponges every 5 km from 7.5 km (7.5–37.5 km).
  - Snacks at 20 and 30 km. Items and locations may change.
  - The [2026 water-station notice](https://seoul-marathon.com/94/?bmode=view&idx=170393902) adds that each station was about 135 m long with 25 tables, with Pocari Sweat first and water after it.
  - Medical support is described only as being at key points, so no medical km are given. The 2026 map shows toilets near the stations; these were not added as POIs.
- **Other 2026 facts used in the notes:**
  - [Venue layout](https://seoul-marathon.com/94/?bmode=view&idx=170394406): corrals along Sejong-daero behind the elite start line (Hall of Fame, then A–G). The finish is on the road along the east side of the complex, north of the Sports Complex junction.
  - [Bag drop](https://seoul-marathon.com/94/?bmode=view&idx=170394678): drop at Gwanghwamun 06:00–07:00, collect at Jamsil 10:00–13:30.
  - [Traffic control](https://seoul-marathon.com/94/?bmode=view&idx=170393832): roads closed 05:00–14:30.
  - [Regional shuttles](https://seoul-marathon.com/94/?bmode=view&idx=170264147).
  - The 2026 course map notes a split at the Sindap underpass (about 25.5 km): elites run over it and masters run through it.
- **Timing / live tracking.** 2026 results were published on Runarchive ([notice](https://seoul-marathon.com/94/?bmode=view&idx=170424840), record.runarchive.com).
  - Searched `k-tracker-vit.pages.dev/api/live/races` with `provider=myresult` and `provider=spct`. Neither lists a Seoul Marathon / Dong-A Marathon event for 2027, so `live` is `null`.
  - smartchip.co.kr was not accessed (its robots.txt forbids automated access).

## How `course.gpx` was produced (type: approximated-from-official-map)
1. **Read the route order and km.**
   - Downloaded the official 2026 course map (`cdn.imweb.me/thumbnail/20260211/534cd5ecdeb2f.jpg`, linked from the [archived course page](https://web.archive.org/web/20260215053043/https://seoul-marathon.com/91)) to a scratch folder. It is not copied here.
   - Downloaded the images of the [2026 traffic-control notice](https://seoul-marathon.com/94/?bmode=view&idx=170393832). One of them is a **full-course table of 78 intersections with km**, from 광화문광장 (0) to 잠실종합운동장 동문 (FINISH). That table fixed the route order and the km checks.
   - Route in order:
     - Sejong-daero south to the Sungnyemun junction (1.2 km), then a hairpin onto Namdaemun-ro.
     - Bank of Korea (1.8), then east on Eulji-ro from Euljiro 1-ga (2.1).
     - A loop around DDP (4.3–5.5): east on Eulji-ro, north on Eulji-ro 45-gil, west on Majang-ro, then south on Jangchungdan-ro.
     - Eulji-ro back west to City Hall (8.1), Mugyo-ro to Mojeon Bridge (8.3), then east on Cheonggyecheon-ro from Gwanggyo (8.7).
     - Cheonggye 2-ga to 9-ga, then a U-turn across Gosanja Bridge (13.8–13.9).
     - West on the opposite bank back to Gwanggyo (18.8), then Mugyo-dong (19.05) and the Jongno-gu Office junction (19.1).
     - Jong-ro east to Heunginjimun (21.8) and the Sinseol-dong junction (23.1).
     - Cheonho-daero via Sindap (25.5) and Janghanpyeong (27.3) to Gunja Bridge (28.2) and Gunja Station (28.9).
     - Neungdong-ro to Children's Grand Park Station (29.8).
     - Gwangnaru-ro west via Hwayang (30.2–30.4) to the Seongdong Bridge junction (32.6), then left over the bridge.
     - Ttukseom Station (33.05) and the Seoul Forest entrance (33.6), then Ttukseom-ro east via Yeongdong Bridge north end (35.3) to Jamsil Bridge north end (37.6).
     - Jamsil Bridge to the south end (39.7) and Jamsil Station (40.0).
     - Olympic-ro west via Jamsil Saenae (41.2) to the Sports Complex junction (41.9).
     - North about 0.3 km to the East Gate finish.
2. **Route on OSM roads.**
   - Downloaded OpenStreetMap trunk, primary, secondary, tertiary and unclassified roads (and their links) via Overpass, and built an undirected graph.
   - Ran shortest paths between 34 routing waypoints at turns. Waypoints snap only to main-road nodes to avoid spurs.
   - Sungnyemun is joined with a straight hairpin between the Sejong-daero and Namdaemun-ro nodes. The official km (1.2 → 1.8) rule out a full loop around the gate.
   - Road-centreline length: 42.93 km.
3. **Racing line.** Shortened the centreline to the shortest line that stays within 10 m of it (iterative string-pulling, same as the JTBC 2026 track).
4. **Resample.** Resampled to 25 m spacing, giving 1,689 points.
5. **Elevation: digitised from the official 2026 elevation chart** (the small "코스 고도 Elevation" panel on the course map).
   - Read the red line column by column, with the y scale from the chart's 0/10/20/30 m gridlines and the x scale from its 0–42 km ticks.
   - Mapped it onto this track by distance scaled to 42.195 km.
   - Applied a ±150 m rolling median and Gaussian smoothing (σ = 100 m), then a +1 m offset so the start and finish match the chart's labels (30.3 m and 14 m).
   - Result: 30.4 m at the start, about 34 m near Sungnyemun (the chart labels 35.3 m), about 12 m at 10 km, about 30 m at 15 km, 11–16 m from 19 to 35 km, about 26 m at 37 km, a drop to about 14 m at 38 km and 14 m at the finish.
   - `race-draft` gain/loss is 58/74 m.

**Measured length:** 42.098 km (haversine, as computed by `race-draft`), which is **−0.23%** against 42.195 km.

**Km check:** 61 of the 78 intersection km values in the official 2026 traffic-control table (those that could be placed on the map without doubt), compared with the nearest point of this track in course order:
- Median difference: −0.01 km.
- Range: −0.19 to +0.23 km.
- 58 of 61 are within 0.2 km.

The detected U-turn is at 13.78 km (official: Gosanja Bridge south end 13.8, north end 13.9).

| Point | GPX coordinates | Note |
|---|---|---|
| Start | 37.57169, 126.97717 | Sejong-daero in front of the US Embassy, about 0.12 km north of the Sejongno junction (official 0.115 km) |
| Finish | 37.51426, 127.07784 | Road along the east side of Jamsil Sports Complex, about 0.27 km north of the Sports Complex junction (official 0.295 km). The exact line was not published. |

## What is approximate or doubtful
- **The 2027 course itself.** Everything here is the 2026 course. Check it against the 2027 course map when it is published (and against any official GPX).
- **Track details:**
  - Dual carriageways are merged into one line.
  - The exact Sungnyemun turn, the shape of the DDP loop, the bank used on each leg of Cheonggyecheon-ro, the Gosanja U-turn point and the finish line are best guesses.
  - Some official table gaps don't match real road distances. For example, the Bank of Korea → Euljiro 1-ga gap is listed as 0.3 km but is about 0.45 km on the ground. The total was matched instead of every gap.
- **Elevation.**
  - The official chart is small (about 1 px = 1 m vertically and 75 m horizontally) and looks like measured, noisy data.
  - It disagrees with SRTM/ASTER terrain data (low-percentile filtered) by more than 10 m in places. Examples: Jong-ro around 20 km (chart about 11 m, DEM about 30 m) and the peak at about 15 km on the Cheonggyecheon return (chart about 30 m, DEM about 20 m).
  - The correlation between the two is only about 0.4. The official chart was used as instructed, but treat elevation as a rough guide. The overall relief is small (about 10–34 m).
- **Start time.** 07:30 is the 2026 value; confirm when the 2027 race guide comes out.
- **Not published for 2027 yet:** course map, start time, per-point cut-offs, bag drop, corrals, medical points and toilets.

## Sources
- 2027 official:
  - [overview](https://seoul-marathon.com/96)
  - [rules (유의사항)](https://seoul-marathon.com/95)
  - [course page (to be published)](https://seoul-marathon.com/91)
  - [registration schedule](https://seoul-marathon.com/94/?bmode=view&idx=171044053)
  - [English overview](https://en.seoul-marathon.com/83)
  - [overseas registration](https://en.seoul-marathon.com/60/?bmode=view&idx=173536131)
- 2026 official:
  - [archived course page with the 2026 map](https://web.archive.org/web/20260215053043/https://seoul-marathon.com/91)
  - [traffic control with the km table](https://seoul-marathon.com/94/?bmode=view&idx=170393832)
  - [water stations](https://seoul-marathon.com/94/?bmode=view&idx=170393902)
  - [venue layout](https://seoul-marathon.com/94/?bmode=view&idx=170394406)
  - [start & bag drop](https://seoul-marathon.com/94/?bmode=view&idx=170394678)
  - [start-time change](https://seoul-marathon.com/94/?bmode=view&idx=169959408)
  - [shuttles](https://seoul-marathon.com/94/?bmode=view&idx=170264147)
  - [results (Runarchive)](https://seoul-marathon.com/94/?bmode=view&idx=170424840)
- Data:
  - Road geometry © OpenStreetMap contributors (ODbL).
  - DEM comparison from Open Topo Data SRTM30m and ASTER30m.
  - Sunrise (06:36) and civil dawn (06:10) were computed with the NOAA solar algorithm.

The official map images are **not** included here for copyright reasons. Only derived coordinates and facts are stored.
