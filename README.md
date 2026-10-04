# l13v.dev

Personal site for [@L13V](https://github.com/L13V) — robotics software and infrastructure.

No build step, no dependencies, no framework. Open `index.html` in a browser and it works.

```
index.html     the page — styles, layout and behaviour
projects.js    ALL the content. This is the file you edit.
media/         screenshots, video and diagrams, one folder per project
CNAME          points Pages at l13v.dev
.nojekyll      stops GitHub running the files through Jekyll
```

## Changing the content

Everything you'd want to edit lives in **`projects.js`** — your intro, the stat
tiles, every project, the toolbox lists. It's plain lists and text with comments
explaining each part. You never have to open `index.html` to add a project or
change a sentence.

## Adding a screenshot or a video

1. Drop the file in `media/<slug>/` (the slug is in each project's entry).
2. Add one line to that project's `media: [ ]` list:

```js
img("robot-front.jpg", "Competition robot, front view")
vid("auto.mp4",        "Three-piece auto", "auto-poster.jpg")   // 3rd arg = optional poster
yt ("dQw4w9WgXcQ",     "Qualification match 42")                // just the YouTube id
```

That's the whole job. Thumbnails, the click-to-enlarge viewer, arrow-key and
swipe navigation, captions and a counter all come for free.

The first item in a project's list is its cover thumbnail. A project with an
empty list just shows no gallery — nothing breaks. See
[`media/README.md`](media/README.md) for file-size guidance.

## The viewer

Click any thumbnail to open it full-screen.

| | |
|---|---|
| `Esc` | close |
| `←` `→` | previous / next |
| swipe | previous / next, on touch |
| click the backdrop | close |

Images, self-hosted video and YouTube all open in the same viewer. Video and
YouTube are torn down on close, so audio stops when you'd expect it to.

## Skins

Three complete visual identities, switchable from the nav and remembered per
visitor in `localStorage`:

| Skin | Look |
|---|---|
| **Terminal** | Phosphor-green CRT with a scanline overlay (default) |
| **Minimal** | Editorial serif display, follows the visitor's light/dark preference |
| **Arcade** | Pixel type on deep purple, hard offset shadows |

To change the default, edit `data-skin="crt"` on the `<html>` tag.

Colours and type are defined once as custom properties at the top of the
`<style>` block — one `:root` group per skin. Nothing below them hardcodes a
colour, so retheming means editing those blocks and nothing else.

## Live data

The page renders completely from `projects.js` with no network at all. On load
it also calls the public GitHub API to refresh star counts, last-pushed dates,
the repo count and your top language. The label by "Selected work" reads
**Live from GitHub** when that succeeded and **Static snapshot** when it didn't.

Results cache for six hours in `localStorage`. The API allows 60 unauthenticated
requests per hour per visitor IP, which is far more than this needs — and if it
fails the page is still complete.

## Deploying

Push to `main`. Pages is already set to deploy from `main` / `/ (root)`.

The custom domain is `l13v.dev` via the `CNAME` file. For it to resolve, the
apex A/AAAA records at your registrar must point at GitHub:

```
A     @   185.199.108.153     AAAA  @   2606:50c0:8000::153
A     @   185.199.109.153     AAAA  @   2606:50c0:8001::153
A     @   185.199.110.153     AAAA  @   2606:50c0:8002::153
A     @   185.199.111.153     AAAA  @   2606:50c0:8003::153
```

Set them to **DNS-only** (grey cloud) in Cloudflare, at least until GitHub has
issued the certificate — it can't complete the HTTP challenge through the proxy.
Once the DNS check passes, tick **Enforce HTTPS** in Settings → Pages.
