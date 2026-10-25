# 2026 JTBC Seoul Marathon: full marathon course data

Race day is **Sun 2026-11-01**. Assembly is at **06:30** and the start at **07:30** (KST), the same for the marathon and the 10K. Data compiled 2026-10-25.

## What we found
- **The 2026 marathon course is new.** The official notice of 2026-10-12 ([course notice](http://marathon.jtbc.com/17/?bmode=view&idx=175063425), [course change notice](http://marathon.jtbc.com/17/?bmode=view&idx=175064126)) moves the marathon start to **Gwanghwamun Square** and the finish to **Olympic Park**. The 10K is now a separate course, from Sangam World Cup Park to Yeouido Park.
  - In 2025 the marathon started at Sangam and ran via Yanghwa Bridge, Yeouido, Mapo Bridge and Gwanghwamun to Olympic Park, with an 08:00 start.
  - Some third-party pages still show the old Sangam start.
- **Official facts used:**
  - Times (06:30 assembly, 07:30 start): course notice.
  - Venues: [race info page](http://marathon.jtbc.com/index).
  - Start groups A–H (A = sub-3): [group notice](http://marathon.jtbc.com/17/?bmode=view&idx=173732917).
  - 65 pacers, 2:49 to 5:00: [pacer notice](http://marathon.jtbc.com/17/?bmode=view&idx=175125736).
  - Race-pack pickup at SETEC: [race-pack notice](http://marathon.jtbc.com/17/?bmode=view&idx=173732896).
  - Start-time change from 08:00 to 07:30: [changes notice](http://marathon.jtbc.com/17/?bmode=view&idx=170781622).
- **Official intersection km table.** The official [traffic-control page](http://marathon.jtbc.com/65) embeds a data table with an intersection-by-intersection km list for the marathon, for example: Sungnyemun 1.4, Daerim Sangga U-turn 3.9, Gosanja Bridge U-turn 10.2, Mugyo-dong 15.6, Sinseol-dong 19.7, Gunja Station 25.2, Jamsil Bridge south end 31.0, Hangnyeoul U-turn 35.5, Suseo IC 38.2, Olympic Park junction 42.0 and finish 42.195. The same table gives closure times per section (05:00–13:50 overall). This was the main reference for route order and km checks.
- **Not published yet (as of 2026-10-25):**
  - Official GPX.
  - Elevation profile.
  - Cut-off time. Entry requires being able to finish within 5 hours, and the slowest pacer is 5:00, but no cut-off was found, so `cutoff` is `null`.
  - Water, sponge and medical positions.
  - Bag drop.
- **MyResult event 177** is this race. Its checkpoint coordinates are placeholders, so they were not used for the track. Its listed `time` is 07:30.

## How `course.gpx` was produced (type: approximated-from-official-map)
1. **Read the route order.** Downloaded the official 2026 course map PNG to a scratch folder (not copied here) and read off the order of roads. Cross-checked it against the traffic-control km table:
   - Sejong-daero south to Sungnyemun.
   - Namdaemun-ro to the Bank of Korea, then back up Sogong-ro.
   - Eulji-ro east to the U-turn at Daerim Sangga, back west, then north to Gwanggyo.
   - Cheonggyecheon-ro east on the south bank to the U-turn at Gosanja Bridge, then back west on the north bank to Mugyo-dong.
   - Jong-ro east via Heunginjimun to Sinseol-dong.
   - Cheonho-daero to Gunja Station.
   - Neungdong-ro to Konkuk Univ. Station, then Achasan-ro and Jayang-ro.
   - Jamsil Bridge, then Songpa-daero to Seokchon Lake.
   - Seokchonhosu-ro and Samjeon-ro, then Tancheon Bridge 1.
   - Nambusunhwan-ro west to the U-turn at Hangnyeoul (SETEC), then east to Suseo IC.
   - Yangjae-daero to the Olympic Park junction, finishing about 0.2 km inside the park.
2. **Route on OSM roads.** Downloaded OpenStreetMap trunk, primary, secondary and tertiary roads via Overpass and built an undirected graph. Ran shortest paths between about 30 waypoints placed at the listed junctions and U-turns.
   - The public OSRM car and foot routers were tried first and dropped. Car routing made loops because of one-way and turn rules. Foot routing wandered onto side paths.
   - The road-centreline result was 42.97–43.10 km.
3. **Racing line.** Shortened the centreline to the shortest line that stays within 10 m of it (iterative string-pulling). This is how course measurement cuts corners and tangents on wide Seoul arterials. It gives 42.36 km on 10 m points.
4. **Resample.** Resampled to 25 m spacing, giving 1,696 points.
5. **Elevation.** There is no official profile, so `<ele>` is DEM-based:
   - Takes the mean of Open Topo Data **SRTM30m** and **ASTER30m**.
   - Applies a rolling 30th-percentile filter (±250 m) to suppress buildings.
   - Applies Gaussian smoothing (σ = 200 m).
   - Over the river, both DEMs read the water surface (9 m), so the Jamsil Bridge deck (about 29.7–31.0 km) was interpolated linearly between its banks.
   - Result: 30 m at the start, about 46 m near the Bank of Korea, 15–25 m through Gwangjin and Songpa, about 34 m around 41 km and 24 m at the finish. Gain/loss is about 96/103 m.
   - Treat it as ± several metres. Underpasses such as the Sindap and Garak underpasses are not modelled.

**Measured length:** 42.239 km (haversine, as computed by `race-draft`), which is **+0.10%** against 42.195 km.

**Km check:** Official intersection km values compared with the nearest point of this track, in course order:
- Median difference: +0.12 km.
- Range: −0.30 to +0.45 km.
- 43 of 45 are within 0.35 km.
- The official table looks like it was built from straight segments between intersections, so it runs slightly short in curvy parts.

Detected U-turns are at 3.9, 10.4 and 35.7 km (official: 3.9, 10.2 and 35.5).

| Point | GPX coordinates | Note |
|---|---|---|
| Start | 37.57259, 126.97714 | Sejong-daero by Sejong Center, 0.2 km north of the Sejongno junction (official 0.3 km) |
| Finish | 37.51350, 127.12740 | Inside Olympic Park, ~0.2 km from the Yangjae-daero × Wiryeseong-daero junction. The exact finish line has not been published. |

## What is approximate and should be replaced later
- **The whole track.** Replace it with the official GPX, or with a 2026 race-day recording.
  - Dual carriageways are merged into one line.
  - The exact U-turn points, the Sungnyemun loop, the Gosanja Bridge crossing and the finish line inside Olympic Park are best guesses.
  - The course map draws the Eulji-ro U-turn slightly further east (near Euljiro 4-ga) than the table's "Daerim Sangga". The table was followed.
- **Elevation.** DEM-based, not official. Replace it if the organiser publishes a profile.
- **Aid stations.** None are listed. Add water, sponge, medical and toilet POIs when the race guide comes out.
- **Notes to re-check in race week:** cut-off, bag drop, start-group areas, transport and closures.

## Sources
- Official: [course notice](http://marathon.jtbc.com/17/?bmode=view&idx=175063425), [course change notice](http://marathon.jtbc.com/17/?bmode=view&idx=175064126), [race info](http://marathon.jtbc.com/index), [traffic control](http://marathon.jtbc.com/65), [pacers](http://marathon.jtbc.com/17/?bmode=view&idx=175125736), [group assignment](http://marathon.jtbc.com/17/?bmode=view&idx=173732917), [race pack](http://marathon.jtbc.com/17/?bmode=view&idx=173732896), [changes (start time)](http://marathon.jtbc.com/17/?bmode=view&idx=170781622).
- 2025 course: [Korea JoongAng Daily, 2025-10-30](https://www.koreajoongangdaily.com/korea/popular-marathon-to-crisscross-seoul-districts-bridges-this-sunday/12447497).
- Timing: [MyResult event 177](https://myresult.co.kr/api/event/177).
- Data:
  - Road geometry © OpenStreetMap contributors (ODbL).
  - Elevation from Open Topo Data SRTM30m and ASTER30m.
  - Sunrise (06:56) was computed with the NOAA solar algorithm.

The official map image is **not** included here for copyright reasons. Only derived coordinates and facts are stored.
