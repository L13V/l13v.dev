# media/

Screenshots and videos for the site. One folder per project, named after that
project's `slug` in [`../projects.js`](../projects.js).

```
media/
  2026_59/       FRC 59 2026 robot
  ramusic/       spotify-tv-jam + RAMTECH OS
  tello-edus/    drone swarm toolkit
  2025_59_v2/    FRC 59 2025 robot
  dorf-dns/      DNS tooling
  l13v-dev/      this site
```

Only folders that already hold a file exist in the repo — git doesn't track empty
directories. Uploading into a new one through GitHub's web UI creates it for you:
go to `github.com/L13V/l13v.dev/upload/main/media/<slug>` and drop the file there.

## Adding something

1. Drop the file in the matching folder.
2. Open `projects.js`, find that project, add **one line** to its `media: [ ]` list:

```js
img("robot-front.jpg", "Competition robot, front view")
vid("auto.mp4",        "Three-piece auto", "auto-poster.jpg")
yt ("dQw4w9WgXcQ",     "Qualification match 42")
```

3. Commit. The thumbnail, the click-to-enlarge viewer, arrow-key navigation and
   the caption all happen on their own.

The **first** item in the list is the project's cover thumbnail, so lead with
your best one.

## What works

| Helper | For | Notes |
|---|---|---|
| `img` | `.jpg` `.png` `.gif` `.webp` `.svg` | |
| `vid` | `.mp4` `.webm` | third argument is an optional poster image; without one the browser shows the first frame |
| `yt` | YouTube | pass just the id from `youtube.com/watch?v=`**`THIS_PART`** |
| `mdl` | `.glb` | a live 3D model you can orbit; third argument is the still shown while it loads |

## Sizes

GitHub Pages serves these as plain static files with no resizing, and a repo is
not a CDN. Keep images under about **2 MB** (1600px wide is plenty) and video
under about **25 MB**. For anything longer than a clip, put it on YouTube and
use `yt(...)` instead — it streams properly and costs you nothing.

GitHub blocks individual files over 100 MB outright.

## Already here

`2026_59/architecture.svg` and `ramusic/dataflow.svg` are diagrams of how those
two systems actually fit together. Delete them if you'd rather lead with photos —
nothing depends on them.

## 3D models

`mdl()` renders a real WebGL viewer in the plate — drag to orbit, scroll to zoom,
and an **Expand** button opens it full screen. It idles with a slow spin that
stops for good the moment you take hold of it.

`2026_59/robot-ms2025.glb` came out of the Ramtech-Web SolidWorks extractor at
**36.8 MB**, which is far too heavy to put on a page. It ships at **2.7 MB**:

```bash
npx @gltf-transform/cli optimize in.glb out.glb     --compress meshopt --simplify true --simplify-error 0.0004
```

That is a 93% reduction and the assembly still reads correctly at viewer size.
Raise `--simplify-error` for a smaller file, lower it to keep more detail.
Anything much over ~5 MB will feel slow on a phone.

The viewer decodes meshopt-compressed geometry, so keep `--compress meshopt`
when you re-export. Lighting is carried over from the Ramtech-Web CAD viewer,
where exposure was calibrated against SolidWorks' own renders — don't adjust it
by eye.

> **Note:** the model currently on the 2026 project is the **MS2025** assembly,
> because that is the only robot export in Ramtech-Web. Drop a 2026 export into
> `media/2026_59/` and change the one `mdl(...)` line in `projects.js`.
