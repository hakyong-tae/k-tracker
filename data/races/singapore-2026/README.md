# Singapore Marathon 2026: full marathon course data

Race day is **Sun 2026-12-06**, flag-off **04:30** (SGT), with a 7 h cut-off counted from when the last starter crosses the start line. Data compiled 2026-10-22.

## What we found
- **The event changed for 2026.** It is now the *BYD Singapore International Marathon presented by adidas*, run by a new organiser. Standard Chartered now sponsors only the 10 km. Official site: https://singaporeinternationalmarathon.com/ (the old singaporemarathon.com only has 2025 content).
- **The 2026 course has been announced.** The official map and elevation profile are on the [BYD Marathon page](https://singaporeinternationalmarathon.com/events/byd-marathon/), stated "accurate as of 17 August 2026 and subject to change". The data here describes the 2026 course, not 2025.
  - Start: F1 Pit Building. Finish: inside the National Stadium.
  - The route goes west to a U-turn on the West Coast Highway (9.5 km) and east to a U-turn in East Coast Park (between 24 and 25 km).
  - Benjamin Sheares Bridge comes at 37.25 km. Official gain/loss is 96.1 m / 94.5 m.
- **No GPX has been published.** The official page links a course *video* called `GPX_Final_091026_1.mp4`, but no GPX file. A search for a community GPX of the 2026 course found nothing.
- **Not published yet:** the Runner's Information Guide, aid-station positions, intermediate cut-offs, pen closing times and bag-deposit hours.

## How `course.gpx` was produced (type: approximated-from-official-map)
1. **Trace the route line.** Downloaded the official route-map JPG to a scratch folder (not copied here). Extracted the orange route line by colour, then used Dijkstra shortest paths between every printed km marker and both U-turns to trace it in order.
2. **Georeference.** Fitted an affine pixel-to-lat/lon transform, first from landmarks, then refined by ICP against OpenStreetMap roads from Overpass. The traced points sit a median of about 6 m from an OSM way (90th percentile about 22 m).
3. **Clean up.** Smoothed (±8 px), simplified (Douglas–Peucker, 2 m), then resampled to 25 m spacing, giving 2,046 points.
4. **Elevation.**
   - `<ele>` holds the **official elevation profile**, digitized from the same map and mapped by distance fraction. It reproduces the printed labels within about 0.7 m: 12.0 m at the start, 4.7 m at Crawford, 18.6 m at the WCH U-turn, 28.5 m on Sheares Bridge and 13.6 m at the finish. Its gain/loss is 91/89 m against the official 96/95 m.
   - Raw Open Topo Data **SRTM30m** values are kept per point as `<cs:srtm30m>` for reference only. SRTM is a surface model, so in Singapore it picks up buildings, water and elevated roads: raw gain is about 2,050 m and values run from −49 to 85 m. That makes it unusable for a profile.
   - OSRM foot routing between waypoints was tried first, but it detoured onto side paths (about 50 km total), so it was dropped in favour of tracing.

**Measured length (haversine):** 42.397 km, which is +0.48% against 42.195 km.

Start and finish check:

| Point | GPX coordinates | Distance from OSM reference |
|---|---|---|
| Start | 1.29286, 103.86399 | ~107 m from the F1 Pit Building centroid. The start line is at the north end of the pit building on Republic Blvd, as the map shows. |
| Finish | 1.30507, 103.87500 | ~98 m from the National Stadium centroid. The finish is inside the stadium. |

The traced distance matches the official km markers within about ±0.15 km up to 24 km. Beyond that it drifts to about +0.6 km, because the markers in the East Coast Park section are placed only approximately (the official profile calls that stretch an "approximate course span").

## What is approximate and should be replaced later
- **The whole track.** Replace it with the official GPX if the organiser publishes one, or with a 2026 race-day recording.
  - Parallel out-and-back carriageways are merged into one line.
  - Small details such as exact U-turn points, the Crawford St/Java Rd turns, the 300 m Marina Barrage two-way stretch and the stadium entry are only as accurate as the map drawing.
- **Some POI km values.** Km values come from the official km markers and profile labels. The East Coast Park U-turn (24.5 km) is read off the map between the 24 and 25 km markers.
- **Aid stations.** None are listed because no positions have been published. Add water, isotonic, gel, medical, toilet and cut-off POIs once the Runner's Information Guide comes out.
- **Notes to re-check in race week:** pen and bag-deposit times, the list of MRT stations open early, and road closures.

## Sources
Official: [BYD Marathon page](https://singaporeinternationalmarathon.com/events/byd-marathon/), [races](https://singaporeinternationalmarathon.com/events/races), [FAQ](https://singaporeinternationalmarathon.com/faqs/), [race-day transport](https://singaporeinternationalmarathon.com/race-day-transport/), [Rules & Regulations PDF (1 Sep 2026)](https://singaporeinternationalmarathon.com/wp-content/uploads/2026/09/2026.09.01-SGIM2026-Rules-and-Regulations-.pdf).

Press: [Sport Plus (trains, Medic Runners)](https://www.sportplus.sg/post/extended-early-morning-train-services-new-safety-measures-announced-for-2026-byd-singapore-interna), [Mothership (route highlights)](https://mothership.sg/2026/08/full-marathon-2026-local-entries-sold-out/), [Little Big Red Dot](https://littlebigreddot.com/singapore-international-marathon-2026-registration-route-fees/).

Weather: [MSS climate of Singapore](https://www.weather.gov.sg/climate-climate-of-singapore/).

Data: road geometry © OpenStreetMap contributors (ODbL); elevation reference from Open Topo Data SRTM30m. Sunrise (06:54) was computed with the NOAA solar algorithm.

The official map image is **not** included here for copyright reasons. Only derived coordinates and facts are stored.
