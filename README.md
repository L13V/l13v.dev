# l13v.dev

Personal site for [@L13V](https://github.com/L13V) — robotics software and infrastructure.

A single self-contained `index.html`. No build step, no dependencies to install.
It ships with three switchable visual skins:

| Skin | Look |
|---|---|
| **Terminal** | Phosphor-green CRT with scanline overlay (default) |
| **Minimal** | Light/dark editorial layout, serif display type |
| **Arcade** | Pixel-type cabinet styling with hard offset shadows |

The visitor's choice persists in `localStorage`.

## Data

Project cards render from a static list inside `index.html`, so the page is complete
with no network. On load it also calls the public GitHub API to refresh star counts,
last-pushed dates, repo count and top language, caching the result for six hours.
If that call fails the static snapshot stays and the label reads "Static snapshot"
instead of "Live from GitHub".

To edit the project cards, change the `PROJECTS` array near the top of the `<script>` block.

## Deploying

Push to `main`, then in **Settings → Pages** set the source to `main` / `/ (root)`.
`CNAME` points the site at `l13v.dev`, so add these DNS records at your registrar:

```
A     @   185.199.108.153
A     @   185.199.109.153
A     @   185.199.110.153
A     @   185.199.111.153
AAAA  @   2606:50c0:8000::153
AAAA  @   2606:50c0:8001::153
AAAA  @   2606:50c0:8002::153
AAAA  @   2606:50c0:8003::153
```

Add a `CNAME` record for `www` pointing to `l13v.github.io` if you want the `www` host too.
Once DNS resolves, tick **Enforce HTTPS** in the Pages settings.

`.nojekyll` keeps GitHub Pages from running the file through Jekyll.
