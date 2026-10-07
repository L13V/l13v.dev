# media/

Screenshots and videos for the site. One folder per project, named after that
project's `slug` in [`../projects.js`](../projects.js).

```
media/
  2026_59/       FRC 59 2026 robot
  uwb/           UWB localization research (models, trial data, CAD renders)
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
| `mdl` | `.glb` | a live 3D model you can orbit; third argument is an options object (below) |

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

`2026_59/rico-2026.glb` is Rico, the 2026 robot. It arrived at **12.6 MB** and
ships at **4.9 MB**:

```bash
npx @gltf-transform/cli optimize in.glb out.glb     --compress draco --simplify true --simplify-error 0.0006
```

Draco beats meshopt by roughly 2× on this model, so prefer it. Raise
`--simplify-error` for a smaller file, lower it to keep more detail. Anything
much over ~6 MB starts to feel slow on a phone.

The viewer decodes **both** Draco and meshopt, so either is safe to re-export
with.

### Lighting

`mdl()`'s third argument tunes it per model, and anything you set there wins:

| option | what it does |
|---|---|
| `exposure` | brightness. `1` is as authored, `0.38` is what Rico uses, `0.2` is very dark |
| `env` | how much the neutral studio light fills it in, `0`–`1`. Lower keeps shadows dark and lets the model's own lights do the work |
| `poster` | a still shown while it loads |

Set nothing and it falls back to one of two cases, decided automatically:

- a model that **ships its own lights** (authored in Blender, Spline, etc.) is
  rendered at exposure 1.0 with its materials untouched — whoever lit it meant
  it to look that way
- a **raw CAD export**, which is flat colour with no lighting of its own, gets
  the Ramtech-Web calibration: exposure 0.45 and base colours scaled 0.82,
  measured against SolidWorks' own renders rather than chosen by eye

So dropping in a SolidWorks export still looks right, and so does an artist's
scene. Neither needs a setting changed.

## uwb/

Everything the research section draws comes from here:

| file | what it is |
|---|---|
| `node.glb` | one UWB node (`UWB_Assem.glb`), 328 KB → 27 KB with Draco |
| `rig.glb` | the bench with all four anchors (`Environment_Assem.glb`), 3.5 MB → 66 KB |
| `trials.js` | all 21 canonical trials: every logged fix as an error in mm, plus each trial's summary |
| `*.webp` | the CAD renders shown under "See the hardware" |
| `dorfman-2026-uwb-lunar-localization.pdf` | the paper, built from `conference_101719.tex`; `paper:` in `projects.js` links it |

Both models were compressed the same way as Rico:

```bash
npx @gltf-transform/cli optimize Environment_Assem.glb rig.glb --compress draco --simplify true --simplify-error 0.0004
npx @gltf-transform/cli optimize UWB_Assem.glb node.glb --compress draco --simplify true --simplify-error 0.0002
```

The SolidWorks export stops at the tripod-holder clamps, so the two carbon
masts that carry A1 and A3 are drawn by `stage.js`, not loaded.

`trials.js` was generated from the research `Results/` folder: the final take
of each material × anchor cell (25 recordings → 21 trials, as in the paper),
errors in mm in the paper's frame. The charts, the regression and the replay
all compute from it, so the numbers on the page can't drift from the data —
the fit comes out at RMSE ≈ 5.8 cm + 0.998·Δd, r = 0.92, exactly as published.
