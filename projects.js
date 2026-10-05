/* ============================================================================
   CONTENT — the only file you edit to change the site.
   ============================================================================

   ADDING A PHOTO OR VIDEO
   -----------------------
   1. Put the file in  media/<slug>/   (slug is listed on each project below).
   2. Add one line to that project's `media: [ ]`:

        img("robot-front.jpg", "Drivetrain assembly, front")
        vid("auto.mp4",        "Three-piece auto", "auto-poster.jpg")
        yt ("dQw4w9WgXcQ",     "Qualification match 42")

   The first item becomes the project's lead image.

   PLACEHOLDERS
   ------------
   Until you add real media, empty plates are drawn so the layout reads as
   intended. Each project's `placeholders:` number says how many to draw.
   When you've added your photos, set SHOW_PLACEHOLDERS to false — or just
   delete the `placeholders` line from that project.
   ========================================================================= */

const SHOW_PLACEHOLDERS = true;

/* helpers — leave these alone */
const img = (file, caption) => ({ type: "image", file, caption });
const vid = (file, caption, poster) => ({ type: "video", file, caption, poster });
const yt = (id, caption) => ({ type: "youtube", id, caption });
/* mdl() is a live 3D model (.glb) you can orbit. Models are lit exactly the way
   the Ramtech-Web CAD viewer lights them, so nothing needs configuring.
   The third argument is an options object if you ever need to deviate:
     poster    still image shown while it loads, e.g. "robot-poster.png"
     exposure  overrides the calibrated 0.45. Lower is darker.
     env       how much the studio light fills it in, 0–1. Default 1.
   Keep .glb files under ~6 MB — see media/README.md. */
const mdl = (file, caption, opts) =>
  Object.assign({ type: "model", file, caption }, opts || {});

const SITE = {
  name: "Liev Dorfman",
  handle: "L13V",
  role: "Robotics software & infrastructure",
  team: "FRC 59 · RAMTECH",
  location: "",
  /* The opening statement — the first thing anyone reads, set large. */
  intro:
    "I write the software that makes physical things move, then build the " +
    "infrastructure that keeps it running.",
  /* A phrase from `intro` to pick out in the accent gradient. The surname in
     the big heading already carries the gradient, so this is off by default —
     set it to a phrase from `intro` above if you want it back. */
  highlight: "",
  intro2:
    "Competition robots in Java. A Linux image that boots straight into a TV " +
    "dashboard. DNS that manages itself. A swarm of drones that fly on cue. " +
    "Most of it ends with something happening in a room.",
  links: [
    { label: "GitHub", href: "https://github.com/L13V" },
    { label: "dorfman.net", href: "https://dorfman.net" },
  ],
};

const PROJECTS = [
  {
    slug: "2026_59",
    repo: "2026_59",
    title: "FRC 59 — 2026 competition robot",
    kind: "Robot code",
    period: "2026",
    status: "In season",
    lead: true,                 /* gets the big plate at the top of the page */
    placeholders: 2,
    summary:
      "A swerve drivetrain, a two-stage shooter and a full intake path, written " +
      "against AdvantageKit's IO pattern — so every subsystem has a simulated " +
      "twin and every match replays from its log.",
    specs: [
      ["Drive", "Swerve · 4 modules"],
      ["Control", "WPILib + AdvantageKit"],
      ["Motors", "Phoenix 6 · TalonFX / TalonFXS"],
      ["Sensing", "PhotonVision · NavX / Pigeon 2"],
      ["Auto", "PathPlanner"],
      ["Language", "Java"],
    ],
    notes: [
      "Every subsystem talks to an interface, never to hardware directly. The same code drives a real TalonFX or a simulation, decided at startup.",
      "Odometry is sampled on its own Phoenix thread rather than the main robot loop, so pose updates arrive faster than the 20 ms tick.",
      "An AutoSystemsCheck command exercises every mechanism in the pit before a match, instead of finding a dead motor on the field.",
    ],
    links: [{ label: "Source", href: "https://github.com/L13V/2026_59" }],
    media: [
      /* Live 3D — drag to orbit, scroll to zoom.
         Rico, the 2026 robot. Compressed from 12.6 MB to 4.9 MB; see
         media/README.md for the exact command if you re-export it. */
      mdl("rico-2026.glb", "Rico — the 2026 robot. Drag to orbit, scroll to zoom"),
      img("architecture.svg", "Subsystem layout — each one behind an IO interface, with a simulated implementation beside the real one"),
      // Match footage and robot photos go here, e.g.:
      // yt("VIDEO_ID", "Qualification match 42"),
      // img("robot-front.jpg", "Competition robot, front view"),
    ],
  },

  {
    slug: "ramusic",
    repo: "ramusic",
    title: "spotify-tv-jam + RAMTECH OS",
    kind: "Full stack",
    period: "2026",
    status: "v1.0.15",
    placeholders: 2,
    summary:
      "A full-screen listening-party dashboard for a TV, and the operating system " +
      "it boots into. Guests scan a QR on screen, land in the Spotify Jam, and " +
      "every song they add appears in the queue with their name on it.",
    specs: [
      ["Stack", "Node.js · Spotify Web API"],
      ["Auth", "PKCE — no client secret"],
      ["Reach", "localtunnel + LAN HTTPS"],
      ["Ships as", "Bootable x86_64 image"],
      ["Extras", "USB writer · device manager"],
      ["Releases", "16"],
    ],
    notes: [
      "The Jam QR is served over a public tunnel, so a guest joins from mobile data without ever touching your Wi-Fi.",
      "Changing any setting needs a 6-digit code shown only on the TV — you have to be in the room. Five wrong tries locks that address out for five minutes.",
      "Exposure is scoped on purpose: the dashboard and Jam redirect are public, while the access token and every transport control stay on the LAN.",
    ],
    links: [
      { label: "Source", href: "https://github.com/L13V/ramusic" },
      { label: "Releases", href: "https://github.com/L13V/ramusic/releases" },
    ],
    media: [
      img("dataflow.svg", "Trust boundary — what a guest can reach through the tunnel, and what never leaves the house"),
    ],
  },

  {
    slug: "tello-edus",
    repo: "Tello-EDUs",
    title: "Tello EDU swarming toolkit",
    kind: "Robotics",
    period: "2024",
    status: "Complete",
    placeholders: 2,
    summary:
      "Menu-driven control for three DJI Tello EDU drones on a shared swarm " +
      "network — scripted liftoff, choreographed shows, and the safety controls " +
      "you want when three aircraft are in the air indoors.",
    specs: [
      ["Fleet", "3 × Tello EDU"],
      ["Network", "Swarm mode"],
      ["Control", "Menu-driven, no code needed"],
      ["Safety", "Emergency land · drop · pause"],
      ["Language", "Python"],
    ],
    notes: [
      "Drones are addressed individually or as a group, so a routine can split the formation and bring it back together.",
      "Emergency landing, drop and pause are first-class commands rather than afterthoughts — the things you reach for when a show goes wrong.",
    ],
    links: [{ label: "Source", href: "https://github.com/L13V/Tello-EDUs" }],
    media: [],
  },

  {
    slug: "2025_59_v2",
    repo: "2025_59_V2",
    title: "FRC 59 — 2025 competition robot",
    kind: "Robot code",
    period: "2025",
    status: "Season complete",
    placeholders: 1,
    summary:
      "Last season's competition code, and the two offseason rewrites that " +
      "followed it. The groundwork the 2026 architecture was built on.",
    specs: [
      ["Control", "WPILib"],
      ["Auto", "PathPlanner"],
      ["Sim", "Maple-sim physics"],
      ["Follow-ups", "OS2025_59 · 2025-Mango"],
      ["Language", "Java"],
    ],
    notes: [
      "Vision targeting was brought into the drivetrain loop here, which is what made the 2026 IO-layer rewrite worth doing.",
    ],
    links: [
      { label: "Source", href: "https://github.com/L13V/2025_59_V2" },
      { label: "Offseason", href: "https://github.com/L13V/OS2025_59" },
    ],
    media: [],
  },

  {
    slug: "dorf-dns",
    repo: "dorf-dns",
    title: "dorf-dns",
    kind: "Infrastructure",
    period: "2024",
    status: "In use",
    placeholders: 0,
    summary:
      "Shell tooling that manages DNS records from a terminal instead of a " +
      "provider dashboard — because hand-editing a zone is how you get a typo " +
      "in production.",
    specs: [
      ["Scope", "Record create / update"],
      ["Interface", "Command line"],
      ["Size", "Two scripts, readable end to end"],
      ["Language", "Shell"],
    ],
    notes: [],
    links: [{ label: "Source", href: "https://github.com/L13V/dorf-dns" }],
    media: [],
  },

  {
    slug: "l13v-dev",
    repo: "l13v.dev",
    title: "l13v.dev",
    kind: "Web",
    period: "2026",
    status: "This page",
    placeholders: 0,
    summary:
      "This site. One page, no build step, no dependencies — it renders fully " +
      "offline from a content file and enriches itself from the GitHub API when " +
      "it can reach it.",
    specs: [
      ["Build", "None — static HTML"],
      ["Content", "One editable data file"],
      ["Media", "Images · video · YouTube"],
      ["Hosting", "GitHub Pages"],
    ],
    notes: [],
    links: [{ label: "Source", href: "https://github.com/L13V/l13v.dev" }],
    media: [],
  },
];

/* Grouped capability lists, shown as a spec table near the end. */
const STACK = [
  ["Robotics", "Java · WPILib · AdvantageKit · Phoenix 6 · PathPlanner · PhotonVision · AdvantageScope"],
  ["Infrastructure", "Proxmox VE · Docker · Debian · Caddy · Cloudflare · RustDesk · ntfy"],
  ["Software", "JavaScript · Node.js · Python · Bash · PowerShell"],
  ["Hardware", "Bambu Lab · OrcaSlicer · DJI Tello EDU · 3D-printed fixtures"],
];

/* Short closing notes. Keep to three. */
const BENCH = [
  ["FRC field systems", "Cheesy Arena and Freezy Arena field management — scoring, AV and the event network that has to not fall over on a Saturday morning."],
  ["Self-hosting", "Proxmox helper scripts, LXC templates, Jellyfin with custom theming, and DNS that answers for the whole house."],
  ["Fabrication", "Printed robot parts and fixtures, and the occasional bracket that exists only because nothing off the shelf fit."],
];
