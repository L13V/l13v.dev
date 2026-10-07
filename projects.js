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

   The first item becomes the project's lead image. A transparent render can
   ask for a backdrop: img("part.webp", "Caption", { bg: "#e7e7e9" }).

   SHOWING CODE
   ------------
   A project with a `code:` block gets a "Read the code" button. Each excerpt
   is a real file and line range, fetched from GitHub at the pinned commit, so
   the line numbers always match what the "on GitHub" link opens. To move to
   newer code, change `ref` and re-check the line ranges.

   HOW A PROJECT IS LAID OUT
   -------------------------
   `stage: "model"`     a pinned 3D scene the scroll turns, with `highlights`
                        coming in around it (Rico).
   `stage: "research"`  the full research story: a scroll-driven 3D chapter
                        sequence, then charts built from the trial data (UWB).
   anything else        a card in the stack further down the page.
   ========================================================================= */

/* helpers — leave these alone */
const img = (file, caption, opts) => Object.assign({ type: "image", file, caption }, opts || {});
const vid = (file, caption, poster) => ({ type: "video", file, caption, poster });
const yt = (id, caption, opts) => Object.assign({ type: "youtube", id, caption }, opts || {});
/* mdl() is a live 3D model (.glb) you can orbit. Models are lit exactly the way
   the Ramtech-Web CAD viewer lights them, so nothing needs configuring.
   The third argument is an options object if you ever need to deviate:
     poster    still image shown while it loads, e.g. "robot-poster.png"
     exposure  overrides the default 0.5. Lower is darker.
     env       how much the studio light fills it in, 0–1. Default 1.
     ao        false turns off the screen-space contact shadows.
     spin      false keeps it still instead of slowly orbiting.
   Keep .glb files under ~6 MB — see media/README.md. */
const mdl = (file, caption, opts) =>
  Object.assign({ type: "model", file, caption }, opts || {});

const SITE = {
  name: "Liev Dorfman",
  handle: "L13V",
  role: "Robotics software & infrastructure",
  location: "",
  /* The opening statement. It lights up word by word as you scroll; the
     `highlight` phrase is set in the italic accent. */
  intro:
    "I write the software that makes physical things move, then build the " +
    "infrastructure that keeps it running.",
  highlight: "physical things move",
  intro2:
    "Competition robots in Java. Radio localization for lunar rovers. A Linux " +
    "image that boots straight into a TV dashboard. DNS that manages itself. " +
    "Most of it ends with something happening in a room.",
  links: [
    { label: "GitHub", href: "https://github.com/L13V" },
    { label: "dorfman.net", href: "https://dorfman.net" },
  ],
};

/* CAD renders are transparent PNGs; they read best on the light grey they were rendered against */
const CAD = { bg: "#e4e4e6" };

const PROJECTS = [
  {
    slug: "2026_59",
    repo: "2026_59",
    name: "Rico",               /* optional; with a logo, the logo stands in for it in the heading */
    title: "2026 FIRST Robotics Robot",
    kind: "Robot code",
    period: "2026",
    status: "In season",
    stage: "model",
    accent: "#ffc21a",
    logo: "rico-logo.webp",     /* optional, from media/<slug>/ — leads the heading */
    summary:
      "Swerve drive and a turreted shooter that keeps firing while the robot " +
      "moves. Written against AdvantageKit's IO pattern, so every subsystem has " +
      "a simulated twin and every match replays from its log.",
    /* Called out around the robot as the scroll turns it. Keep to four. */
    highlights: [
      ["Swerve drive", "Four independently steered modules."],
      ["Shoots on the move", "The robot's own velocity is taken out of every shot."],
      ["Turret · hood · flywheel", "Drag-corrected launch speed, clamped to what the motor can hold."],
      ["A simulated twin", "Every subsystem sits behind an IO layer; every match replays from its log."],
    ],
    specs: [
      ["Drive", "Swerve · 4 modules"],
      ["Control", "WPILib + AdvantageKit"],
      ["Shooter", "Turret · hood · flywheel"],
      ["Motors", "Phoenix 6 · TalonFX / TalonFXS"],
      ["Sensing", "PhotonVision · Limelight · Pigeon 2"],
      ["Auto", "PathPlanner"],
      ["Language", "Java"],
    ],
    notes: [],                  /* the detail lives in the code viewer */
    links: [],                  /* the code viewer links to the repo */
    /* "See it in action" — footage opens in the media viewer, on the match.
       Shorts are portrait, so mark them { vertical: true }. `group` sorts the
       viewer's side list into headed sections. */
    action: [
      yt("bhpbFQyv97c", "Robot reveal", { label: "REVEAL", group: "Robot" }),
      yt("XTC8Qh_Npd8", "Final 2, South Florida Regional", { label: "MATCH", group: "Robot" }),
      yt("2cPXvFHHiM4", "Autonomous routine", { label: "AUTO", vertical: true, group: "Programming highlights" }),
    ],
    code: {
      group: "Programming highlights",   /* where its diagrams go in the media viewer */
      repo: "L13V/2026_59",
      ref: "8472469e7a3e07686f2de451cba5eaad9be3431f",
      root: "src/main/java/org/ramtech/frc2026/",
      files: [
        {
          title: "Architecture",
          image: "media/2026_59/architecture.svg",
          note: "Each subsystem sits behind an IO interface, with a simulated implementation beside the real one. Commands never touch hardware directly.",
        },
        {
          title: "Shooting on the move",
          path: "subsystems/shooter/ShotCalculator.java",
          lines: [288, 318],
          note: "The robot's own velocity is rotated into the target's frame and taken out of the shot, so Rico aims where the ball will be, not where the hub is.",
        },
        {
          title: "Correcting for drag",
          path: "subsystems/shooter/ShotCalculator.java",
          lines: [363, 386],
          note: "A drag estimate raises the launch speed, which is then turned into flywheel RPS from the wheel and gear ratios and clamped to what the motor can hold.",
        },
        {
          title: "Turret wrap",
          path: "subsystems/shooter/ShotCalculator.java",
          lines: [137, 159],
          note: "The turret can't spin forever. Each new aim takes the shortest way round, and unwinds a full turn when it would run into a soft limit.",
        },
        {
          title: "The IO seam",
          path: "subsystems/shooter/flywheel/FlywheelIO.java",
          lines: [6, 52],
          note: "Hardware sits behind an interface whose inputs and outputs are logged. TalonFX and simulation both implement it, which is what makes log replay exact.",
        },
        {
          title: "Pit check",
          path: "commands/AutoSystemsCheck.java",
          lines: [19, 43],
          note: "One command drives, sweeps the turret and hood to both soft limits, spins the flywheel and runs every roller — before a match, not during one.",
        },
      ],
    },
    media: [
      /* Compressed from 12.6 MB to 4.9 MB; see media/README.md for the exact
         command if you re-export it. The poster is a still of the viewer's
         opening shot, so the hand-off to the live model doesn't jump. */
      mdl("rico-2026.glb", "Rico — the 2026 robot. Drag to orbit, click then scroll to zoom", { poster: "rico-poster.webp" }),
    ],
  },

  {
    slug: "uwb",
    repo: null,                 /* the firmware and server aren't public */
    name: "UWB",
    title: "Ultra-wideband localization for lunar rovers",
    kind: "Research",
    period: "2026",
    status: "IEEE-format paper",
    stage: "research",
    accent: "#5cd0b3",
    /* The opening of the research section. */
    kicker: "University of Florida · SSTP research",
    headline: "Centimeters, on the Moon.",
    summary:
      "There's no GPS on the lunar surface, and dead reckoning drifts as wheels " +
      "slip in regolith. Ultra-wideband radio can place a rover to the " +
      "centimeter — until something gets between it and an anchor. I built a " +
      "four-anchor rig and measured exactly how much.",
    paperTitle: "Evaluating UWB TWR-Based Localization for Lunar Rovers Under Physical Obstructions",
    paper: "dorfman-2026-uwb-lunar-localization.pdf",   /* from media/uwb/; linked from the title and the tail */
    paperPages: 7,
    /* The scroll story. Six chapters, in order; the 3D scene is choreographed
       to them, so keep the count and the order. */
    chapters: [
      {
        title: "No GPS on the Moon.",
        body: "No satellite constellation serves the lunar surface, and dead reckoning drifts as wheels slip on regolith. A rover building a base needs its position to the centimeter, from infrastructure it carries in.",
      },
      {
        title: "A radio with a stopwatch.",
        body: "Ultra-wideband sends pulses a couple of nanoseconds wide. Time one round trip to an anchor and you have the distance. Every node pairs an ESP32-S3 with a Qorvo DW3000 in a 3D-printed enclosure.",
        eq: "d = c · Δt ⁄ 2",
        chips: ["Qorvo DW3000", "ESP32-S3", "Channel 9 · 8 GHz", "6.8 Mbps", "Double-sided TWR"],
      },
      {
        title: "Four anchors. One tag.",
        body: "Anchors stand at four deliberately different heights around a 1.56 m bench, so height can be observed at all. The tag ranges to each of them and solves its own position on board, nine times a second.",
        chips: ["GDOP 2.02", "9.2 Hz fixes", "Wi-Fi telemetry"],
      },
      {
        title: "Every range is a sphere.",
        body: "A range says how far, never which way. Each one puts the tag somewhere on a sphere around its anchor. Three spheres meet at two points; the fourth picks one.",
        eq: "(x − xᵢ)² + (y − yᵢ)² + (z − zᵢ)² = dᵢ²",
      },
      {
        title: "Least squares finds the point.",
        body: "Real ranges are noisy, so the spheres never quite meet. A warm-started Levenberg–Marquardt solver walks to the point that disagrees with all four the least. On a clear line: 5.1 cm.",
        eq: "p* = argmin Σ rᵢ(p)²",
      },
      {
        title: "Then something gets in the way.",
        body: "A concrete block on one link and the pulse arrives late. That range swells, its sphere grows, and the solver — which never lost the signal — quietly moves the tag.",
      },
    ],
    /* Materials, in the order the charts list them. Colours run cool to hot. */
    materials: [
      { id: "baseline", label: "Clear line", short: "Clear", color: "#8ea4bf" },
      { id: "empty-container", label: "Empty container", short: "Empty", color: "#f3dc84", density: "~2" },
      { id: "foil", label: "Aluminium foil", short: "Foil", color: "#f5c04f", density: "~2" },
      { id: "sand", label: "Sand (regolith analog)", short: "Sand", color: "#f59a45", density: "~1500" },
      { id: "paver", label: "Paver stone", short: "Paver", color: "#f06d3d", density: "~2000" },
      { id: "concrete", label: "Concrete block", short: "Concrete", color: "#ec4b3f", density: "~2100" },
    ],
    /* Anchor colours, from the presentation's animations. */
    anchorColors: ["#5cd0b3", "#ffe94d", "#ff862f", "#d147bd"],
    findings: [
      {
        verdict: "Supported",
        title: "Density drives it.",
        body: "Error climbed with material class — sand, then paver, then concrete at 47.8 cm, nine times the clear baseline.",
      },
      {
        verdict: "Rejected",
        title: "Reflectivity doesn't.",
        body: "Foil, the most reflective thing tested, beat every solid: two 16 µm layers add almost no path. It mostly raised the scatter, not the bias.",
      },
      {
        verdict: "Lunar",
        title: "Regolith costs decimeters.",
        body: "Sand, the regolith analog, pushed error to 17.3 cm — enough to matter for a rover shadowed by, or half-buried in, the surface.",
      },
      {
        verdict: "Next",
        title: "Catch the late link.",
        body: "The damage lives in one link's bias, so flag and de-weight any range whose residual departs from the rest — and avoid short anchor baselines in any direction.",
      },
    ],
    specs: [
      ["Nodes", "Makerfabs MaUWB ESP32-S3"],
      ["Radio", "Qorvo DW3000 · ch 9 · 6.8 Mbps"],
      ["Ranging", "Double-sided two-way ranging"],
      ["Solver", "On-board Levenberg–Marquardt"],
      ["Telemetry", "Wi-Fi → Python server · 9.2 Hz"],
      ["Firmware", "PlatformIO · OTA updates"],
      ["Trials", "21 · 5 materials × 4 anchors + clear"],
    ],
    notes: [],
    links: [],
    media: [
      img("uwb_assem.webp", "One node: MaUWB ESP32-S3 in its printed enclosure, OLED telemetry up top", CAD),
      img("env.webp", "The anchor constellation — four nodes at deliberately non-coplanar heights", CAD),
      img("clamp.webp", "Edge clamp that screws onto a bench corner to hold a node or a mast", CAD),
      img("tripod_clamp.webp", "Mast clamp, in place on the bench", CAD),
      img("adapter.webp", "Dovetail adapter for mounting a node", CAD),
    ],
  },

  {
    slug: "ramusic",
    repo: "ramusic",
    title: "spotify-tv-jam + RAMTECH OS",
    kind: "Full stack",
    period: "2026",
    status: "v1.0.15",
    accent: "#a3e635",
    motif: "media",
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
    accent: "#a78bfa",
    motif: "swarm",
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
    accent: "#ff5d6c",
    motif: "path",
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
    accent: "#60a5fa",
    motif: "records",
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
    accent: "#22d3ee",
    motif: "minimap",
    summary:
      "This site. No build step and no framework — a content file, a scroll " +
      "engine, and three.js for the scenes. It renders fully offline and " +
      "enriches itself from the GitHub API when it can reach it.",
    specs: [
      ["Build", "None — static files"],
      ["Content", "One editable data file"],
      ["Motion", "Scroll-driven, sticky scenes"],
      ["3D", "three.js · Draco"],
      ["Hosting", "GitHub Pages"],
    ],
    notes: [],
    links: [{ label: "Source", href: "https://github.com/L13V/l13v.dev" }],
    media: [],
  },
];

/* Grouped capability lists. Each row scrolls across the page. */
const STACK = [
  ["Robotics", "Java · WPILib · AdvantageKit · Phoenix 6 · PathPlanner · PhotonVision · AdvantageScope"],
  ["Embedded", "ESP32-S3 · Qorvo DW3000 · PlatformIO · OTA firmware · SolidWorks"],
  ["Infrastructure", "Proxmox VE · Docker · Debian · Caddy · Cloudflare · RustDesk · ntfy"],
  ["Software", "JavaScript · Node.js · Python · three.js · Bash · PowerShell"],
  ["Hardware", "Bambu Lab · OrcaSlicer · DJI Tello EDU · 3D-printed fixtures"],
];

/* Short closing notes. Keep to three. */
const BENCH = [
  ["FRC field systems", "Cheesy Arena and Freezy Arena field management — scoring, AV and the event network that has to not fall over on a Saturday morning."],
  ["Self-hosting", "Proxmox helper scripts, LXC templates, Jellyfin with custom theming, and DNS that answers for the whole house."],
  ["Fabrication", "Printed robot parts and fixtures, and the occasional bracket that exists only because nothing off the shelf fit."],
];
