/* ============================================================================
   CONTENT FILE — this is the only file you need to edit to update the site.
   Nothing here is code you have to understand; it's all lists and text.
   ============================================================================

   HOW TO ADD A SCREENSHOT OR VIDEO
   --------------------------------
   1. Drop the file into  media/<slug>/   where <slug> is the project's
      "slug" below (e.g. media/2026_59/robot.jpg).
   2. Add one line to that project's `media: [ ... ]` list:

        img("robot.jpg",            "Caption shown under the image")
        vid("auto.mp4",             "Caption", "auto-poster.jpg")
        yt ("dQw4w9WgXcQ",          "Caption")

      img  = a picture (.jpg .png .gif .webp .svg)
      vid  = a video file you host yourself (.mp4 .webm) — the third argument
             is an optional poster image shown before it plays
      yt   = a YouTube video — the first argument is the id from the URL
             (youtube.com/watch?v=THIS_PART)

   3. Commit. That's it — the thumbnail, the click-to-enlarge viewer, the
      captions and the arrow-key navigation all happen automatically.

   Order matters: the first item in the list is the one used as the project's
   cover thumbnail. Keep files reasonably sized — under ~2 MB for images and
   ~25 MB for video, or GitHub Pages gets slow.

   A project with an empty media list simply shows no gallery. Nothing breaks.
   ========================================================================= */

/* Small helpers so each media line stays short. Don't edit these. */
const img = (file, caption) => ({ type: "image", file, caption });
const vid = (file, caption, poster) => ({ type: "video", file, caption, poster });
const yt = (id, caption) => ({ type: "youtube", id, caption });

/* ---------------------------------------------------------------------------
   SITE-WIDE TEXT
   ------------------------------------------------------------------------ */
const SITE = {
  name: "Liev Dorfman",
  handle: "L13V",
  tagline: "Robotics software · Infrastructure",
  // The sentence under your name. Keep it to two or three lines.
  intro:
    "I write the software that makes physical things move, then build the " +
    "infrastructure that keeps it running. Competition robots in Java, a Linux " +
    "image that boots straight into a TV dashboard, DNS that manages itself, " +
    "and a swarm of drones that fly on cue.",
  intro2:
    "Most of what I make ends with something happening in a room — a drivetrain " +
    "turning, a drone lifting off, a screen coming to life.",
  links: [
    { label: "GitHub", href: "https://github.com/L13V" },
    { label: "dorfman.net", href: "https://dorfman.net" },
  ],
  // Shown in the strip under the intro. `live` pulls the number from GitHub.
  stats: [
    { live: "repos", value: "12", label: "Public repos" },
    { live: "years", value: "6", label: "Years on GitHub" },
    { value: "4", label: "Robot seasons" },
    { live: "lang", value: "Java", label: "Most-used language" },
  ],
};

/* ---------------------------------------------------------------------------
   PROJECTS — newest / most important first.
   ------------------------------------------------------------------------ */
const PROJECTS = [
  {
    slug: "2026_59",
    repo: "2026_59",
    title: "FRC 59 — 2026 competition robot",
    kind: "Robotics",
    period: "2026 season",
    status: "active",
    statusLabel: "In season",
    summary:
      "Robot code for FRC Team 59 (RAMTECH). A swerve drivetrain, a two-stage " +
      "shooter and a full intake path, written against AdvantageKit's IO pattern " +
      "so every subsystem has a simulated twin and every match can be replayed " +
      "from its log.",
    highlights: [
      "Swerve drive where each module sits behind a <code>ModuleIO</code> interface — TalonFX, TalonFXS and simulation implementations swap without touching control code",
      "Gyro abstracted the same way, so the robot runs on either a NavX or a Pigeon 2",
      "Odometry sampled on a dedicated <code>PhoenixOdometryThread</code> rather than the main loop, for higher-rate pose updates",
      "Shooter split into independent flywheel and hood subsystems, aimed by a <code>ShotCalculator</code>",
      "Intake and indexer as separate subsystems, each with a sim implementation for bench testing",
      "<code>AutoSystemsCheck</code> command that exercises every mechanism before a match",
      "PathPlanner for autonomous routines, PhotonVision for target tracking",
    ],
    tech: ["Java", "WPILib", "AdvantageKit", "Phoenix 6", "PathPlanner", "PhotonVision", "REVLib", "YAMS", "Gradle"],
    links: [{ label: "Source", href: "https://github.com/L13V/2026_59" }],
    media: [
      img("architecture.svg", "Subsystem layout — every hardware subsystem sits behind an IO interface with a simulated implementation alongside the real one"),
      // Add match footage and robot photos here, e.g.:
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
    status: "shipping",
    statusLabel: "v1.0.15 · 16 releases",
    summary:
      "A full-screen listening-party dashboard for a TV, and the operating " +
      "system it boots into. Guests scan a QR code on screen, land in the " +
      "Spotify Jam, and every song they add shows up in the queue with their " +
      "name on it.",
    highlights: [
      "Now playing with full-bleed album art, a live progress bar, and an <b>Up next</b> queue tagged with who added each track",
      "The Jam QR is generated automatically and served over a public tunnel, so guests can join from mobile data instead of having to be on the Wi-Fi",
      "Spotify sign-in uses PKCE — no client secret ever touches the device; the server exchanges and refreshes the tokens itself",
      "A 6-digit code shown <i>only on the TV</i> gates every settings change, so you have to be in the room; five wrong attempts locks the address out",
      "Deliberately scoped exposure: the dashboard and Jam redirect are public, while the access token and all transport controls stay on the LAN",
      "Loads Spotify's Web Playback SDK so the TV itself appears as a Connect device named <b>TV Jam</b>",
      "Ships as a bootable x86_64 disk image with a one-click USB writer and a device-manager web UI — not just an app you install",
    ],
    tech: ["JavaScript", "Node.js", "Spotify Web API", "Docker", "Shell", "PowerShell", "Linux"],
    links: [
      { label: "Source", href: "https://github.com/L13V/ramusic" },
      { label: "Releases", href: "https://github.com/L13V/ramusic/releases" },
    ],
    media: [
      img("dataflow.svg", "How the TV, the guest's phone and Spotify connect — and which routes are reachable from outside the network"),
      // Screenshots of the dashboard would land here, e.g.:
      // img("dashboard.png", "The TV dashboard mid-party"),
      // vid("jam-join.mp4", "Scanning the Jam QR from a phone", "jam-join-poster.jpg"),
    ],
  },

  {
    slug: "tello-edus",
    repo: "Tello-EDUs",
    title: "Tello EDU swarming toolkit",
    kind: "Robotics",
    period: "2024",
    status: "done",
    statusLabel: "Complete",
    summary:
      "Menu-driven control for a swarm of three DJI Tello EDU drones on a shared " +
      "swarm network — scripted liftoff, choreographed shows, and the safety " +
      "controls you want when three aircraft are in the air indoors.",
    highlights: [
      "Drives three Tello EDUs together over a swarm network",
      "Choreographed show routines, with drones addressed individually or as a group",
      "Emergency landing, drop and pause controls as first-class commands",
      "Menu system so a show can be run without touching the code",
    ],
    tech: ["Python", "DJI Tello SDK", "UDP"],
    links: [{ label: "Source", href: "https://github.com/L13V/Tello-EDUs" }],
    media: [
      // Drone footage belongs here — this is the one that most deserves a video:
      // vid("swarm-show.mp4", "Three-drone show routine", "swarm-poster.jpg"),
    ],
  },

  {
    slug: "2025_59_v2",
    repo: "2025_59_V2",
    title: "FRC 59 — 2025 competition robot",
    kind: "Robotics",
    period: "2025 season",
    status: "done",
    statusLabel: "Season complete",
    summary:
      "Last season's competition code, plus the offseason rewrites that followed " +
      "it in OS2025_59 and 2025-Mango. The groundwork the 2026 architecture was " +
      "built on.",
    highlights: [
      "PathPlanner autonomous routines",
      "Vision targeting brought into the drivetrain loop",
      "Maple-sim physics simulation for testing without hardware",
      "Carried forward into two offseason rewrites",
    ],
    tech: ["Java", "WPILib", "PathPlanner", "Maple-sim", "Gradle"],
    links: [
      { label: "Source", href: "https://github.com/L13V/2025_59_V2" },
      { label: "Offseason rewrite", href: "https://github.com/L13V/OS2025_59" },
    ],
    media: [],
  },

  {
    slug: "dorf-dns",
    repo: "dorf-dns",
    title: "dorf-dns",
    kind: "Infrastructure",
    period: "2024",
    status: "done",
    statusLabel: "In use",
    summary:
      "Shell tooling that manages DNS records from the command line instead of " +
      "clicking through a provider dashboard — because editing a zone by hand is " +
      "how you end up with a typo in production.",
    highlights: [
      "Create and update records straight from a terminal",
      "A companion script for resolving and checking record ids",
      "Small enough to read end to end before you trust it with a zone",
    ],
    tech: ["Shell", "DNS", "Automation"],
    links: [{ label: "Source", href: "https://github.com/L13V/dorf-dns" }],
    media: [],
  },

  {
    slug: "l13v-dev",
    repo: "l13v.dev",
    title: "l13v.dev",
    kind: "Web",
    period: "2026",
    status: "shipping",
    statusLabel: "You're on it",
    summary:
      "This site. One self-contained page with three switchable visual skins, no " +
      "build step and no dependencies — it pulls its own live numbers from the " +
      "GitHub API and falls back to a static snapshot when that's unavailable.",
    highlights: [
      "Three complete visual identities — terminal, minimal and arcade — switchable live and remembered per visitor",
      "Project galleries with a keyboard-navigable viewer for images, self-hosted video and YouTube",
      "Renders fully without network access, then enriches itself from the GitHub API",
      "Single HTML file plus a content file; deploys straight from the repo root",
    ],
    tech: ["HTML", "CSS", "JavaScript", "GitHub Pages"],
    links: [{ label: "Source", href: "https://github.com/L13V/l13v.dev" }],
    media: [],
  },
];

/* ---------------------------------------------------------------------------
   TOOLBOX — the grouped lists further down the page.
   ------------------------------------------------------------------------ */
const STACK = [
  {
    group: "Robotics",
    items: [
      ["Java", "every competition robot"],
      ["WPILib + AdvantageKit", "logging and replay"],
      ["Phoenix 6 / REVLib", "motor control"],
      ["PathPlanner", "autonomous routines"],
      ["PhotonVision", "target tracking"],
      ["AdvantageScope", "telemetry review"],
    ],
  },
  {
    group: "Infrastructure",
    items: [
      ["Proxmox VE", "the whole homelab"],
      ["Docker", "everything shippable"],
      ["Linux / Debian", "and a lot of shell"],
      ["RustDesk", "self-hosted remote access"],
      ["ntfy", "push notifications"],
      ["Caddy + Cloudflare", "edge and TLS"],
    ],
  },
  {
    group: "Software & hardware",
    items: [
      ["JavaScript / Node.js", "dashboards and services"],
      ["Python", "control and scripting"],
      ["Bash / PowerShell", "glue that has to survive"],
      ["Bambu Lab + OrcaSlicer", "printed parts"],
      ["DJI Tello EDU", "drone swarms"],
      ["Git", "and too many branches"],
    ],
  },
];

/* ---------------------------------------------------------------------------
   ALSO ON THE BENCH — smaller interests, no repo needed.
   ------------------------------------------------------------------------ */
const BENCH = [
  {
    title: "FRC field systems",
    body: "Cheesy Arena and Freezy Arena field management — scoring, AV and the event network that has to not fall over on Saturday morning.",
  },
  {
    title: "Self-hosting",
    body: "Proxmox helper scripts, LXC templates, Jellyfin with custom theming, and a DNS setup that answers for the whole house.",
  },
  {
    title: "Fabrication",
    body: "Printed robot parts and fixtures, custom slicer profiles for Bambu hardware, and the occasional bracket that only exists because nothing off the shelf fit.",
  },
];
