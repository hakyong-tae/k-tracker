# Tokyo Marathon 2027: full marathon course data

Race day is **Sun 2027-03-07**. The marathon starts at **09:10** and the wheelchair marathon at **09:05** (JST). The cut-off is **7 hours from the gun** (course closes 16:10). Data compiled 2026-10-26.

## What we found
- **Facts confirmed on the official 2027 site:**
  - Date, start times and cut-off: [race information](https://www.marathon.tokyo/en/about/outline/) and [entry information](https://www.marathon.tokyo/en/participants/guideline/).
  - Route: Tokyo Metropolitan Government Building, Suidobashi, Ueno-hirokoji, Kanda, Nihombashi, Asakusa Kaminarimon, Ryogoku, Monzen-nakacho, Ginza, Tamachi, Hibiya, then the finish at Tokyo Station / Gyoko-dori. The course is certified by JAAF, AIMS and World Athletics.
  - The [course page](https://www.marathon.tokyo/en/about/course/) has a km-by-km location table with expected passing times. Its turning points are at 10.6 km (Ueno-hirokoji), 23.95 km (Tomioka Hachimangu) and 37.5 km (Tamachi Station).
  - Eight provisional cut-off points are given in an image on the entry information page ([checkpoints_2027_en.png](https://www.marathon.tokyo/en/participants/guideline/checkpoints_2027_en.png)).
  - EXPO and packet pick-up: 4–6 March 2027 at Tokyo Big Sight South Halls, in person only, with a photo-ID check ([EXPO page](https://www.marathon.tokyo/en/expo/), [FAQ](https://www.marathon.tokyo/en/faq/)).
- **Is it the 2026 course?** No separate 2027 course map has been published. The downloadable map is still `illustmap_2026en.pdf`, and the illustrated map on the 2027 page shows the same route. Everything published for 2027 matches the 2026 course exactly: the location table, the three turning points, and all eight cut-off km values (4.9, 9.2, 15.4, 20.9, 24.7, 29.2, 33.5 and 38.5). So this page uses the 2026 course line. Re-check it when the 2027 Runner Guidebook comes out (mid-February 2027).
  - The caller's brief mentioned Shinagawa. That was the old turnaround: the 2020 map turns further south, near Shinagawa. The current course turns at Tamachi (Daiichi Keihin, Shiba 5-chome) at 37.5 km.
- **No GPX file is published.** The organiser does publish a **Google My Maps** called "東京マラソン2026 Tokyo Marathon 2026 Course Map" ([viewer](https://www.google.com/maps/d/viewer?mid=1jGYjkrF_m5K3rWgYJu1XqyMbjHPq2pQ)). It is linked from the official course page, where the embed is currently commented out in the HTML. It is public and needs no login, and its KML export holds:
  - the route line;
  - 43 km markers and the halfway point;
  - 15 aid stations, 19 medical stations, 46 toilets and 8 cut-off points.
- **2026 aid-station contents** come from the official notice of 2026-02-24 ([notice](https://www.marathon.tokyo/en/news/detail/news_20260224112134.html), [aid table PDF](https://www.marathon.tokyo/news/detail/images/1fef9875cea3b2cc4490051220009148e5c8f7e3.pdf)):
  - Water at all 15 stations.
  - Sports drink at 5, 10, 15, 20, 25, 30, 35 and 40 km.
  - Sponges at 20, 25 and 30 km.
  - Food (pickled plum, chocolate, cream-filled roll, doll-shaped cake) at 22, 27 and 38 km.
  - Sponsor food ("OMOTENASHI AID") at 17, 22, 27, 32 and 38 km.
  - The 2027 positions and contents are not published yet.
- **Not published yet (as of 2026-10-26):** the 2027 Runner Guidebook, 2027 aid and medical positions, road closures, start blocks and gate times, and finish-area details.

## How `course.gpx` was produced (type: `official-gpx`, converted from the organiser's KML)
1. **Download.** Downloaded the My Maps KML (`/maps/d/kml?mid=…&forcekml=1`) to a scratch folder (not copied here).
   - The route line is stored as two LineStrings, both drawn in reverse: finish → Ueno-hirokoji (32.28 km) and Ueno-hirokoji → start (10.00 km).
   - Reversed both and joined them at the shared Ueno-hirokoji vertex (gap 0 m), giving 4,026 vertices and 42.278 km.
2. **Resample.** Resampled to 25 m spacing, giving 1,693 points. Nothing was smoothed or moved.
3. **Elevation.** `<ele>` holds the **official elevation profile** (`images/image-course.jpg` on the course page), digitised and mapped by distance fraction.
   - Read the top of the yellow fill in each pixel column. The axes were calibrated from the 0/20/40 m grid lines and the START/FINISH ticks, and checked against the km labels (linear, about 19.8 px/km).
   - Applied a 3-pixel moving average.
   - Result: 41.5 m at the start, 33.6 m at 3 km, 21.4 m at Akebonobashi (3.75 km), 14.3 m at 5 km and 5.6 m at 7 km. After that it stays at 3–10 m. The bridge humps are Kuramae Bridge at 20 and 28 km (about 9.8 m) and smaller rises at 14.2, 22.1, 25.8 and 31.1 km.
   - Accuracy is about ±1 m from the chart resolution. The KML also carries its own `z` values. Those are about 1–2 m lower than the chart along the whole course but have the same shape (40.3 m at the start, 12.3 m at 5 km, 3.2 m at 7 km), so the true values may be a metre or two lower.
   - `race-draft` (after the site's 75 m smoothing): gain/loss 45/81 m, range 2.7–41.5 m.

**Measured length:** 42.187 km (haversine on the 25 m points, as computed by `race-draft`), which is **−0.02%** against 42.195 km. The raw KML line is 42.278 km (+0.20%); 25 m chords cut a little off the curves and U-turns.

**Km check:** All 43 km markers and the halfway point from the same map were projected onto the track:
- Every marker sits 0–3 m from the line.
- The distance-along-track error is **−0.02 to +0.02 km** for every marker except 24 km. That one is 50 m past the Tomioka U-turn and snaps to the other carriageway (−0.09 km).
- Detected U-turns: 10.55, 23.95 and 37.51 km (official 10.6, 23.95 and 37.5).
- The provisional cut-off points project to 4.92, 9.20, 15.44, 20.95, 24.75, 29.18, 33.56 and 38.52 km (official 4.9 to 38.5).

| Point | GPX coordinates | Note |
|---|---|---|
| Start | 35.689939, 139.692341 | Tocho-dori in front of the Tokyo Metropolitan Government Building, 22 m from the map's START pin |
| Finish | 35.682239, 139.762115 | Gyoko-dori at Marunouchi Naka-dori, about 2 m from the map's FINISH pin |

## POIs (68)
- **Landmarks (13) and turnarounds (3):** Km values are taken from the official location table where it names the spot (for example, Kuramae Bridge at 20.0 and 28.0, and Hibiya at 41.0/41.1). Otherwise they are projections of the landmark onto the track (Kaminarimon 18.2, Nihombashi 13.3, Ginza 4-chome 33.4).
- **Cut-offs (8):** The official 2027 provisional km values, with their times.
- **Aid (31 entries):** 15 water, 8 sports drink, 3 sponge and 5 food. The km values are the 2026 aid-station pins projected onto the track; every pin sits within 2 m of the line. The organiser names them by round km ("5 km Aid Station"), but the pins sit a little later, for example 5.2, 7.5 and 20.5 km. The water POIs are labelled "(2026 position)".
- **Medical (13):** The 2026 course medical-station pins projected onto the track: 5.0, 11.3, 15.5, 21.0, 23.2, 24.8, 26.9, 29.2, 31.5, 33.5, 35.9, 37.9 and 40.5 km. Some pins are 60–130 m off the road, on side streets, so their km values are approximate. The start and finish medical points are not listed.
- **Toilets:** None are listed (there are 46 in 2026). The official site has a separate toilet PDF.

## What is approximate and should be replaced later
- **The 2027 line.** The track is the organiser's 2026 line. Replace it if a 2027 map or GPX differs.
  - Out-and-back sections are drawn as the organiser drew them (mostly separate carriageways).
  - The line is drawn on My Maps, so expect metre-level offsets.
- **Elevation.** It is a digitised chart, accurate to about ±1–2 m.
- **Aid and medical positions and contents.** These are 2026 values. Update them from the 2027 Runner Guidebook (mid-February 2027).
- **Notes to re-check in race week:** start blocks and gates, bag check and pick-up, road closures, the finish Meet Area, and weather.
- **`courseSource.type`** is `official-gpx` because the geometry is the organiser's own route file, not a tracing of a map image. If you prefer to flag it as derived, change it to `approximated-from-official-map`; the page then shows its "approximate" warning.

## Sources
- Official 2027:
  - [course map and location table](https://www.marathon.tokyo/en/about/course/)
  - [race information](https://www.marathon.tokyo/en/about/outline/)
  - [entry information and cut-offs](https://www.marathon.tokyo/en/participants/guideline/) ([cut-off image](https://www.marathon.tokyo/en/participants/guideline/checkpoints_2027_en.png))
  - [EXPO](https://www.marathon.tokyo/en/expo/)
  - [FAQ](https://www.marathon.tokyo/en/faq/)
- Official 2026:
  - [My Maps course map (KML)](https://www.google.com/maps/d/viewer?mid=1jGYjkrF_m5K3rWgYJu1XqyMbjHPq2pQ)
  - [aid-station notice](https://www.marathon.tokyo/en/news/detail/news_20260224112134.html) and [aid table PDF](https://www.marathon.tokyo/news/detail/images/1fef9875cea3b2cc4490051220009148e5c8f7e3.pdf)
  - [heat advisory](https://www.marathon.tokyo/en/news/detail/news_20260226165153.html)
  - [program guidebook notice](https://www.marathon.tokyo/en/news/detail/news_20260206155423.html)
- Weather: [JMA daily normals for Tokyo, March (1991–2020)](https://www.data.jma.go.jp/obd/stats/etrn/view/nml_sfc_d.php?prec_no=44&block_no=47662&year=&month=3&day=&view=). The normals for 7 March are a low of 3.9 °C and a high of 12.9 °C. Sunrise (06:05) was computed with the NOAA solar algorithm (`src/shared/geo.ts`).
- Place-name hints from OpenStreetMap Nominatim (© OpenStreetMap contributors, ODbL), used only by `race-draft`.

The official map images, PDFs and KML are **not** included here. Only the derived coordinates and facts are stored.
