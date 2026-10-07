# l13v.dev

Personal site for [@L13V](https://github.com/L13V) — robotics software and infrastructure.

No build step, no framework. three.js comes from a CDN for the 3D; everything
else is plain files. Serve the folder (`python -m http.server`) to work on it —
straight from disk the page reads fine but browsers won't load the 3D.

```
index.html     the page skeleton
site.css       every style; colours are tokens on :root
site.js        builds the page from projects.js; the scroll engine and every scene
stage.js       three.js: the CAD viewer and the research story (an ES module)
projects.js    ALL the content. This is the file you edit.
media/         photos, video, models and data — one folder per project
CNAME          points Pages at l13v.dev
.nojekyll      stops GitHub running the files through Jekyll
```

## Changing the content

Everything you'd want to edit is in **`projects.js`** — the intro, every project,
the capability lists. Plain lists and text with comments. You never need to open
`index.html` to add a project or reword a sentence.

## Adding a photo or video

1. Put the file in `media/<slug>/` (the slug is listed on each project).
2. Add one line to that project's `media: [ ]`:

```js
img("robot-front.jpg", "Drivetrain assembly, front")
vid("auto.mp4",        "Three-piece auto", "auto-poster.jpg")   // 3rd arg optional
yt ("dQw4w9WgXcQ",     "Qualification match 42")                // just the id
mdl("robot.glb",       "Drag to orbit", "robot-poster.png")     // live 3D
```

The first item in a list is that project's lead image. Thumbnails, the
click-to-enlarge viewer, captions, figure numbers and arrow-key/swipe navigation
are all automatic. See [`media/README.md`](media/README.md) for size guidance.

## The viewer

| | |
|---|---|
| click a plate | enlarge |
| `Esc` | close |
| `←` `→` | previous / next |
| swipe | previous / next, on touch |
| click the backdrop | close |

Images, self-hosted video, YouTube and live 3D models all open in the same
viewer. Video, YouTube and WebGL contexts are destroyed on close, so audio stops
when you'd expect and a model doesn't keep a GPU context alive behind you.

Rico's model lives in its scroll stage; **Explore in 3D** opens the same model
in the viewer with free orbit and zoom. Transparent CAD renders can carry a
backdrop colour — `img("part.webp", "Caption", { bg: "#e4e4e6" })` — so dark
parts don't vanish on the black viewer. See [`media/README.md`](media/README.md)
for how models are exported and compressed.

## How the page moves

One scroll engine (`Engine` in `site.js`) runs a single animation-frame loop.
Scenes are tall sections with a `position: sticky` stage inside. The rule
throughout: **animations play on their own, scrolling speeds them up, and
nothing moves on until you scroll.**

- **Flicks snap.** Wheel and trackpad input is handled by the page: an
  ordinary scroll moves exactly as far as you scrolled, eased over a few
  frames, while a flick — a fast burst — glides to the next resting point
  after where that gesture began (each section, each research chapter, each
  results panel, each card) and absorbs the rest of its momentum, so you can't
  fly past a scene. Keep spinning and it steps on point by point. Keyboard
  scrolling stays native. On touch screens the browser's own scroll snapping
  (`proximity`, `scroll-snap-stop: always`) uses the same points. Points are
  registered with `Snap.add(...)` in `site.js`.
- **Rail and scrollbar** — a dot per project runs down the left edge the
  whole way (hover for names, click to glide there; hidden under 760 px). The
  browser's scrollbar is hidden and replaced by a slim thumb that takes the
  current project's accent; drag it, or click the track to glide.
- **Hero** — the name rises in, then scatters letter by letter as you scroll
  away, over a dot field that radio pulses ripple across (click to send one).
- **Statement** — rises in underneath the scattering name and lights up in
  about a second, faster while you scroll; it starts over if you go back up.
- **01 · Rico** (`stage: "model"`) — rotates in sync with the scroll through
  a full 360° while the `highlights` follow along; dragging nudges the orbit
  and stays where you leave it. **Explore in 3D** opens the free-orbit viewer.
- **02 · UWB** (`stage: "research"`) — a six-chapter 3D story: the node, the
  bench scanned in, pulses to the anchors, range spheres, the least-squares
  solver stepping in (the real Levenberg–Marquardt iterates), then a concrete
  block that inflates A2's sphere and drags the estimate — and the real logged
  fixes with it. Where you've scrolled picks the chapter; the chapter plays
  slowly (7–10 s) and holds on its last frame until you scroll on. Scrolling
  speeds it up; scrolling back rewinds. Below it, the charts, the anchor grid
  and a trial replay are all computed from `media/uwb/trials.js`.
- **The rest** — a deck of cards that stack as you scroll, each with a small
  animation true to the project (or its first picture).
- **Stack** — capability rows that drift on their own and get a push when
  you scroll.

A glide (a flick landing, or an in-page link) never counts as scrolling, so
it doesn't fast-forward the scene it carries you to.

Each project's accent is its own `accent:` in `projects.js`.

WebGL is only created once its section is near the screen, and every canvas
stops drawing while it's off screen.

## Live data

The page renders completely from `projects.js` with no network. On load it also
calls the public GitHub API to add star counts and last-pushed dates to each
project's spec panel. If that fails, nothing is lost — the page was already complete.

## Deploying

Push to `main`. Pages deploys from `main` / `/ (root)`.

The custom domain is `l13v.dev` via `CNAME`. The apex A/AAAA records must point
at GitHub:

```
A     @   185.199.108.153     AAAA  @   2606:50c0:8000::153
A     @   185.199.109.153     AAAA  @   2606:50c0:8001::153
A     @   185.199.110.153     AAAA  @   2606:50c0:8002::153
A     @   185.199.111.153     AAAA  @   2606:50c0:8003::153
```

Set them **DNS-only** (grey cloud) in Cloudflare until GitHub has issued the
certificate — it can't complete the challenge through the proxy. Then tick
**Enforce HTTPS** in Settings → Pages.
