# Standard Chartered Hong Kong Marathon 2027: full marathon course data

Race day is **Sun 2027-01-17**. The marathon starts in three waves (HKT): **Marathon Challenge 06:00**, **Marathon Run 1 06:25**, **Marathon Run 2 06:50**. `startTime` is the first wave. The time limit is **6 hours**. Data compiled 2026-10-26.

## What we found
- **Official race page** ([race information](https://www.hkmarathon.com/race-information)): 42.195 km, quota 18,000, start Nathan Road (Tsim Sha Tsui), finish Victoria Park, 6 h limit, the three waves above.
- **The 2027 course map is published** ([course maps](https://www.hkmarathon.com/course-maps), [marathon map JPG](https://resources.hkmarathon.com/marathon/SCHKM2027_Marathon_Map.jpg)). It shows the same route as the 2026 map in the 2026 Runner's Guide.
- **No elevation profile, cut-offs or aid stations for 2027 yet.** The 2027 Runner's Guide is not out. The site still links the 2026 guides ([Runner's Guide](https://resources.hkmarathon.com/runner-guide/SCHKM2026_Runner%27s%20Guide_Marathon_FINAL_v2.pdf), [Important Notice](https://resources.hkmarathon.com/runner-guide/SCHKM2026_Important%20Notice_Marathon_FINAL_v2.pdf)). Because the route is unchanged, the 2026 guide supplies:
  - The official course profile (page 39). It is vector data in the PDF, so the 43 points (every km plus 42.195) were read exactly from the drawing paths.
  - Six intermediate cut-off points with clock times based on the last wave (06:50).
  - Aid rules: water at the start, finish and course stations; sports drink at stations after 10 km; banana and chocolate at about 25 and 30 km; first aid at every water station. The map marks stations by icon only, with no km values, so only the two food points the text gives in km are POIs. No sponge stations are shown.
- **Road order** comes from the 2027 map and the Transport Department notice for 2026 ([info.gov.hk](https://www.info.gov.hk/gia/general/202601/12/P2026011200455.htm)): Nathan Road → Argyle Street → Lin Cheung Road → West Kowloon Highway → Stonecutters Bridge → Nam Wan Tunnel → Ting Kau Bridge → Cheung Tsing Tunnel → Tsing Kwai Highway → Western Harbour Crossing → Connaught Road West flyover → Lung Wo Road → Expo Drive → Hung Hing Road → Lockhart Road → Percival Street → Hennessy Road → Yee Wo Street → Sugar Street → Victoria Park.
- **No GPX** was found, either official or a public one that needs no login.

## How `course.gpx` was produced (type: approximated-from-official-map)
1. **Read the map.** Downloaded the 2027 map and the 2026 guide to a scratch folder (not copied here). Extracted the magenta route line by colour and georeferenced it (affine fit plus ICP against OSM roads). The fit is good in Tsing Yi and Kwai Chung, but the map is schematic in Kowloon and on Hong Kong Island, so it was used only to read turns and loops:
   - The Lin Cheung Road hairpin.
   - The short hook to a U-turn at the start of the Tsing Ma Bridge.
   - The Tsing Long Highway U-turn ("Turning Point 4").
   - The loop at the Western Harbour Crossing exit in Sai Wan.
   - The three-pass zigzag along Man Kwong Street at the Central Piers.
   - The Expo Drive loop around the Convention Centre.
2. **Route on OSM roads.** Downloaded OSM motorway to tertiary roads (plus minor roads in Central, Wan Chai and Tsim Sha Tsui) from Overpass. Built a directed graph that honours one-way tags, with undirected legs only where the race uses a carriageway against traffic or hops between carriageways. About 60 waypoints were joined by shortest paths with a candidate-snapping (Viterbi) step, and U-turns are straight hops between carriageways. Tunnels and bridges are on the track as OSM tunnel and bridge ways: Nam Wan, Cheung Tsing and Western Harbour Crossing, plus Stonecutters and Ting Kau.
3. **Racing line.** Shortened to the shortest line within 10 m of the road centreline (iterative string pulling), as in the JTBC example. The centreline was 42.75 km.
4. **Resample** to 25 m, giving 1,691 points.
5. **Tune the U-turns.** Two U-turn points are not fixed by the map: the Lin Cheung Road hairpin and the Tsing Ma hook tip. They were tuned so that:
   - The total is close to 42.195 km.
   - Profile landmarks line up: the Stonecutters Bridge crest (official 10–11 km), the Cheung Tsing Tunnel (22–24 km) and the harbour-tunnel low point (34 km).
6. **Elevation.** `<ele>` is the official 2026 profile mapped by distance fraction (official km = track distance × 42.195 / track length), with PCHIP interpolation, which does not overshoot.
   - No surface DEM is used. That keeps the Western Harbour Crossing at its official -29.5 m instead of the sea surface, and the bridge decks at their official heights.
   - Range is -29.5 to 77.0 m. Start 13.7 m, finish 5.2 m. Gain/loss is 170/177 m as measured by `race-draft` (176/185 m on the raw 1 km points).
   - Between 1 km samples the shape is interpolated, so short ramps and dips are smoothed.

**Measured length:** 42.164 km (haversine, `race-draft`), which is **-0.07%** against 42.195 km. `race-draft` checks: distance ok, start-finish ok.

**Km checks:**
- **Against the 2026 cut-off times.** At the cut-off places, the track km and the 2026 cut-off times (elapsed from the 06:50 wave) imply a steady 8:26–8:50 /km. A 6 h finish needs 8:32 /km.

  | Cut-off | Track km | Time allowed |
  |---|---|---|
  | CP1 Cherry St × Lin Cheung Rd | 4.0 | 35 min |
  | CP2 Turning Point 4, Tsing Long Hwy | 18.1 | 2:40 |
  | CP3 Tsing Kwai Hwy Exit 4 | 27.7 | 4:00 |
  | CP4 WHC toll plaza | 32.6 | 4:35 |
  | CP5 Connaught Rd West flyover | 35.9 | 5:10 |
  | CP6 Hung Hing Rd × Marsh Rd | 40.8 | 5:50 |

  The steady pace suggests the track's km values at those places are about right.
- **Against the official profile:**
  - Stonecutters Bridge spans 9.67–11.02 km here, crest about 10.35 (profile peak between 10 and 11).
  - Cheung Tsing Tunnel is 22.3–24.0 (profile: 53 m at 22, 23 m at 24).
  - The Western Harbour Crossing tunnel is about 33.0–34.9, with the official low point at 34 and the Hong Kong-side exit near 35.
  - The Ting Kau U-turn is at 18.1 here. The symmetric profile suggests about 18.5, so this part may be about 0.4 km early.
- **Against the map's km bubbles** (pointer tips georeferenced): within about ±0.5 km. The bubbles on a schematic map are only indicative. The 5 km bubble sits at the Cherry Street junction, which would make the hairpin longer, but that conflicts with both the profile and the CP1 time, so the profile and cut-off times were followed.

| Point | GPX coordinates | Note |
|---|---|---|
| Start | 22.30051, 114.17193 | Nathan Road just north of Granville Road (2026 start line near The One/The Mira). Within about 60 m. |
| Finish | 22.28115, 114.18880 | Inside Victoria Park on the path along Causeway Road, about 190 m east of the Sugar Street entry (from the 2026 finish-area plan) |

## What is approximate and should be replaced later
- **The whole track.** Replace it with the official GPX or a 2027 race-day recording.
  - Parallel carriageways are merged.
  - The exact U-turn points are best guesses: Lin Cheung Road at about 3.5 km, the Tsing Ma Bridge approach at about 15.5 km and Tsing Long Highway at about 18.1 km.
  - Also best guesses: which Central Piers streets the three zigzag passes use, the Expo Drive loop, and the finish line.
- **Elevation.** This is the 2026 profile at 1 km resolution, not 2027 data. Replace it if a 2027 profile or GPX comes out.
- **POIs.**
  - Cut-offs, food points and wave rules are 2026 values. Check them against the 2027 Runner's Guide.
  - Cut-off km values were placed on this track from the named locations.
  - Water, sports-drink and medical stations are not POIs because no km values are published. Add them when the 2027 guide lists positions.
- **Notes to re-check in race week:** 2027 MTR early trains and special buses, bag deposit times, the Expo venue and the cut-off times.

## Sources
- Official:
  - [Race information](https://www.hkmarathon.com/race-information), [course maps](https://www.hkmarathon.com/course-maps), [2027 marathon map](https://resources.hkmarathon.com/marathon/SCHKM2027_Marathon_Map.jpg), [important dates](https://www.hkmarathon.com/important-dates).
  - 2026 [Runner's Guide](https://resources.hkmarathon.com/runner-guide/SCHKM2026_Runner%27s%20Guide_Marathon_FINAL_v2.pdf) and [Important Notice](https://resources.hkmarathon.com/runner-guide/SCHKM2026_Important%20Notice_Marathon_FINAL_v2.pdf).
  - 2027 press releases of [4 Sep 2026](https://resources.hkmarathon.com/file/Standard%20Chartered%20Hong%20Kong%20Marathon%202027%20Main%20race%20quota%20reaches%20record%20high%20of%2078,000%20Brand-new%20%E2%80%9C5km%20Harbourfront%20Run%E2%80%9D.pdf) and [15 Oct 2026](https://resources.hkmarathon.com/file/Standard%20Chartered%20Hong%20Kong%20Marathon%202027%20Main%20race%20registration%20reaches%20a%20record%20high%20of%20over%20140,000%20entries.pdf).
- Government: [Transport Department road closures for 2026](https://www.info.gov.hk/gia/general/202601/12/P2026011200455.htm). Weather: [HKO 1991–2020 normals](https://www.hko.gov.hk/en/cis/normal/1991_2020/normals.htm).
- Data:
  - Road geometry © OpenStreetMap contributors (ODbL).
  - Sunrise (07:05) and civil dawn (06:41) were computed with the NOAA solar algorithm.

The official map images and guide PDFs are **not** included here for copyright reasons. Only derived coordinates and facts are stored.
