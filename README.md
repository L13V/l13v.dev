# l13v.dev

Personal site for [@L13V](https://github.com/L13V) — robotics software and infrastructure.

No build step, no dependencies, no framework. Open `index.html` and it works.

```
index.html     the page — styles, layout, behaviour
projects.js    ALL the content. This is the file you edit.
media/         photos, video and diagrams — one folder per project
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

### Placeholders

Each project has a `placeholders:` count — how many empty plates to reserve, so
the layout reads correctly before the photos exist. Once yours are in, set
`SHOW_PLACEHOLDERS = false` at the top of `projects.js` and every remaining
placeholder disappears at once.

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

A `mdl()` plate is interactive in place — drag to orbit, scroll to zoom — with
an **Expand** button for the full-screen view. Its WebGL context is built only
when the plate nears the screen, with a timed fallback in case intersection
callbacks never arrive. See [`media/README.md`](media/README.md) for how the
model is exported and compressed.

## Design notes

One identity, dark only — deliberately, not by omission. Every colour is set
explicitly, so the page doesn't depend on the visitor's theme.

Each project carries its own accent from a fixed set of six (`--a-red`,
`--a-cyan`, `--a-lime`, `--a-violet`, `--a-amber`, `--a-blue`) applied through a
single `--pa` custom property. That's what colours the section rule, the figure
numbers, the status chip, the note numbers and the hover states. To recolour a
project, change its position in the list or edit the `ACCENTS` array.

Motion is deliberate and all of it respects `prefers-reduced-motion`:

- the hero fades up in sequence on load
- sections rise in as you reach them, with a 3-second failsafe that reveals
  everything in case an observer never fires — a reveal animation must never be
  the reason something is unreadable
- a scroll-progress bar across the top
- the tech ticker scrolls and pauses on hover; with reduced motion it becomes a
  static wrapped list

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
