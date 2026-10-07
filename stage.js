/* ============================================================================
   3D — every WebGL view on the page.

   window.__mount3D(host, url, opts)   a CAD model in a plate or the viewer.
       opts.scrub    the page's scroll turns it instead of the pointer; the
                     handle's setView({ az, el, zoom }) moves the camera.
   window.__mountUWB(host, opts)       the research story: the tag, the rig,
                     ranging, spheres, the solver and the obstruction, all
                     driven by handle.setProgress(0…1).

   Lighting follows the Ramtech-Web CAD viewer: a RoomEnvironment studio IBL
   with neutral tone mapping, and base colours scaled 0.82 on load because
   powder-coated parts export as pure 1.0 white and otherwise clip to one blob.
   ========================================================================= */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";

const VIEWER_EXPOSURE = 0.5;
const BASE_COLOR_SCALE = 0.82;
const CLEAR_TRANSPARENCY = 0.8;   // SolidWorks transparency for clear polycarbonate
const MATTE_ROUGHNESS = 0.8;      // what Ramtech-Web's converter writes for every part
const METAL_MIN_ROUGHNESS = 0.3;  // mirror-polished metals only flash at one angle; this keeps a visible sheen
const DRACO_PATH = "https://cdn.jsdelivr.net/npm/three@0.183.0/examples/jsm/libs/draco/";

/* one decoder for every viewer: the WASM is fetched once */
const draco = new DRACOLoader().setDecoderPath(DRACO_PATH);
const loader = new GLTFLoader().setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder);

// glTF-Transform palette textures store each part's roughness (G) and
// metalness (B) as texels. Authored metals (gold, steel) keep their finish;
// every non-metal texel is made converter-matte.
const mrCache = new Map();
function matteNonMetals(tex) {
  if (mrCache.has(tex)) return mrCache.get(tex);
  const im = tex.image, c = document.createElement("canvas");
  c.width = im.width; c.height = im.height;
  const x = c.getContext("2d");
  x.drawImage(im, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height);
  const g = Math.round(MATTE_ROUGHNESS * 255);
  const gm = Math.round(METAL_MIN_ROUGHNESS * 255);
  for (let i = 0; i < d.data.length; i += 4) {
    if (d.data[i + 2] < 128) d.data[i + 1] = g;
    else d.data[i + 1] = Math.max(d.data[i + 1], gm);
  }
  x.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c);
  for (const k of ["flipY", "colorSpace", "wrapS", "wrapT", "magFilter", "minFilter", "channel", "rotation", "matrixAutoUpdate"]) t[k] = tex[k];
  t.offset.copy(tex.offset); t.repeat.copy(tex.repeat); t.center.copy(tex.center); t.matrix.copy(tex.matrix);
  mrCache.set(tex, t);
  return t;
}

/* Normalise a CAD export to what a Ramtech-Web conversion contains. */
function normalizeCAD(root, extra) {
  const seen = new Set();
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (const mat of (Array.isArray(o.material) ? o.material : [o.material])) {
      if (!mat || seen.has(mat)) continue;
      seen.add(mat);
      if (mat.color) mat.color.multiplyScalar(BASE_COLOR_SCALE);
      mat.normalMap = null;
      if (mat.metalnessMap && mat.metalnessMap.image) {
        mat.metalnessMap = mat.roughnessMap = matteNonMetals(mat.metalnessMap);
        mat.metalness = 1;
        mat.roughness = 1;
      } else if (mat.metalness > 0.5) {
        // polished aluminium and the like keep a sheen, just not a mirror
        mat.metalnessMap = mat.roughnessMap = null;
        mat.roughness = Math.max(mat.roughness, METAL_MIN_ROUGHNESS);
      } else {
        mat.metalnessMap = mat.roughnessMap = null;
        mat.metalness = 0;
        mat.roughness = MATTE_ROUGHNESS;
      }
      if (mat.isMeshPhysicalMaterial) {
        // clear parts as alpha-blended colour, not physical transmission,
        // which renders frosted grey at roughness 0.8
        if (mat.transmission > 0) {
          mat.opacity = 1 - CLEAR_TRANSPARENCY * mat.transmission;
          mat.transmission = 0;
          mat.transparent = true;
          mat.depthWrite = false;
          mat.side = THREE.DoubleSide;
        }
        mat.sheen = 0; mat.clearcoat = 0; mat.specularIntensity = 1;
      }
      if (extra) extra(mat);
      mat.needsUpdate = true;
    }
  });
}

/* The story's dark stage needs a narrower range than a white studio: lift the
   near-black parts (masts, battery) so they read against the page, and pull
   the white bench down so it doesn't glare. Works on glTF-Transform palette
   textures, one texel per material. */
const toneCache = new Map();
function retone(tex, lo, hi) {
  if (!tex || !tex.image) return tex;
  if (toneCache.has(tex)) return toneCache.get(tex);
  const im = tex.image, c = document.createElement("canvas");
  c.width = im.width; c.height = im.height;
  const x = c.getContext("2d");
  x.drawImage(im, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < d.data.length; i += 4) {
    const r = d.data[i] / 255, g = d.data[i + 1] / 255, b = d.data[i + 2] / 255;
    const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const sat = Math.max(r, g, b) - Math.min(r, g, b);
    let k = 1;
    if (L < lo) k = (lo + L * 0.5) / Math.max(L, 0.02);
    else if (L > hi && sat < 0.15) k = (hi + (L - hi) * 0.25) / L;
    d.data[i] = Math.min(255, r * k * 255 + (L < 0.02 ? lo * 255 : 0));
    d.data[i + 1] = Math.min(255, g * k * 255 + (L < 0.02 ? lo * 255 : 0));
    d.data[i + 2] = Math.min(255, b * k * 255 + (L < 0.02 ? lo * 255 : 0));
  }
  x.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c);
  for (const k of ["flipY", "colorSpace", "wrapS", "wrapT", "magFilter", "minFilter", "channel"]) t[k] = tex[k];
  toneCache.set(tex, t);
  return t;
}

function disposeTree(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of ms) { if (m.map) m.map.dispose(); m.dispose(); }
  });
}

/* Run fn while the host is on screen, and not at all while it isn't. */
function whileVisible(host, onChange) {
  if (!("IntersectionObserver" in window)) { onChange(true); return () => {}; }
  const io = new IntersectionObserver((es) => { for (const e of es) onChange(e.isIntersecting); }, { rootMargin: "120px" });
  io.observe(host);
  return () => io.disconnect();
}

const smooth = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => Math.min(1, Math.max(0, t));
const lerp = (a, b, t) => a + (b - a) * t;
const span = (p, a, b) => clamp01((p - a) / (b - a));

/* ============================================================================
   CAD viewer
   ========================================================================= */
window.__mount3D = function (host, url, opts) {
  opts = opts || {};
  const scrub = !!opts.scrub;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, scrub ? 1.75 : 2));
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement;
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  host.appendChild(canvas);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  if (typeof opts.env === "number") scene.environmentIntensity = opts.env;

  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 1000);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.autoRotateSpeed = 1.6;
  const spin = opts.spin !== false && !scrub;
  controls.autoRotate = false;
  if (scrub) controls.enabled = false;

  let dirty = true;
  const markDirty = () => { dirty = true; };

  // Restore eases back to the opening shot and picks the spin up again.
  let restore = null, home = null, tween = null;
  if (!scrub) {
    restore = document.createElement("button");
    restore.type = "button";
    restore.className = "model-reset";
    restore.setAttribute("aria-label", "Restore the starting view");
    restore.innerHTML = '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2.2 6.6A3.9 3.9 0 1 0 3.3 3.2"/><path d="M2.4 1.6v2.1h2.1"/></svg>Restore';
    host.appendChild(restore);
    controls.addEventListener("start", () => {
      tween = null;
      controls.autoRotate = false;
      if (home) restore.classList.add("on");
    });
    restore.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!home) return;
      restore.classList.remove("on");
      tween = { t0: performance.now(), pos: camera.position.clone(), tgt: controls.target.clone() };
    });
  }

  // Scrubbed: a drag turns the robot on top of where the scroll has it, and
  // when you let go it coasts to a stop and stays there — no spring back.
  const nudge = { v: 0, held: false, x: 0, base: 0, w: 0, t: 0 };
  const offHost = [];
  const listen = (t, type, fn, o) => { t.addEventListener(type, fn, o); offHost.push(() => t.removeEventListener(type, fn, o)); };
  const canManipulate = opts.manipulate !== false && scrub && (typeof window === "undefined" || !window.matchMedia || window.matchMedia("(hover:hover) and (pointer:fine)").matches);
  if (canManipulate) {
    listen(canvas, "pointerdown", (e) => {
      if (e.pointerType === "touch") return;
      nudge.held = true; nudge.x = e.clientX; nudge.base = nudge.v; nudge.w = 0; nudge.t = performance.now();
      canvas.setPointerCapture(e.pointerId); host.classList.add("held");
    });
    listen(canvas, "pointermove", (e) => {
      if (!nudge.held) return;
      const now = performance.now(), v = nudge.base + (e.clientX - nudge.x) / Math.max(host.clientWidth, 1) * Math.PI * 1.4;
      // the drag's own speed, smoothed, so letting go can carry it on
      nudge.w = lerp(nudge.w, (v - nudge.v) / Math.max(0.008, (now - nudge.t) / 1000), 0.35);
      nudge.v = v; nudge.t = now;
      markDirty();
    });
    const up = () => {
      if (!nudge.held) return;
      nudge.held = false; host.classList.remove("held");
      if (performance.now() - nudge.t > 90) nudge.w = 0;   // held still before letting go
      nudge.w = Math.max(-5, Math.min(5, nudge.w));
      start();
    };
    listen(canvas, "pointerup", up);
    listen(canvas, "pointercancel", up);
  }

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const gtao = opts.ao !== false ? new GTAOPass(scene, camera, 1, 1) : null;
  if (gtao) composer.addPass(gtao);
  composer.addPass(new OutputPass());

  let fit = null;        // framing, recomputed whenever the plate changes shape
  const view = { az: 0, el: 0, zoom: 1 };

  const resize = () => {
    const w = host.clientWidth || 1, h = host.clientHeight || 1;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    if (gtao) gtao.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (fit) fit.refit();
    markDirty();
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  let raf = 0, disposed = false, root = null, visible = false, loaded = false;
  const offVis = whileVisible(host, (v) => { visible = v; if (v) { markDirty(); start(); } });
  function start() { if (!raf && !disposed && loaded) raf = requestAnimationFrame(tick); }

  function placeScrubbed() {
    const az = fit.az0 + view.az + nudge.v;
    const el = Math.max(-0.2, Math.min(1.35, fit.elev + view.el));
    const d = fit.dist * view.zoom;
    camera.position.set(
      fit.center.x + d * Math.cos(el) * Math.sin(az),
      fit.center.y + d * Math.sin(el),
      fit.center.z + d * Math.cos(el) * Math.cos(az));
    camera.lookAt(fit.center);
  }

  let lastTick = 0;
  function tick(now) {
    raf = 0;
    const dt = lastTick ? Math.min(0.05, (now - lastTick) / 1000) : 0.016;
    lastTick = now;
    if (disposed || !visible) { lastTick = 0; return; }
    let moving = false;
    if (scrub) {
      if (!nudge.held && Math.abs(nudge.w) > 0.01) { nudge.v += nudge.w * dt; nudge.w *= Math.exp(-dt * 2.2); moving = true; }
      else if (!nudge.held) nudge.w = 0;
      if (dirty || moving) { placeScrubbed(); composer.render(); dirty = false; }
    } else {
      if (tween) {
        const t = Math.min((now - tween.t0) / 700, 1), e = 1 - Math.pow(1 - t, 3);
        camera.position.lerpVectors(tween.pos, home.pos, e);
        controls.target.lerpVectors(tween.tgt, home.tgt, e);
        if (t === 1) { tween = null; controls.autoRotate = spin; }
      }
      controls.update(); composer.render();
    }
    raf = requestAnimationFrame(tick);
  }

  loader.load(
    url,
    (gltf) => {
      if (disposed) return;
      root = gltf.scene;
      renderer.toneMappingExposure = typeof opts.exposure === "number" ? opts.exposure : VIEWER_EXPOSURE;
      normalizeCAD(root);
      scene.add(root);

      // precise: the quick box unions each rotated part's local box
      const box = new THREE.Box3().setFromObject(root, true);
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      const center = box.getCenter(new THREE.Vector3());
      const dir = new THREE.Vector3(0.55, 0.42, 0.72).normalize();

      // Fit the model's actual shape, not its bounding sphere or box, sampled
      // from its vertices, for every angle of the orbit.
      const pts = [], v = new THREE.Vector3();
      root.traverse((o) => {
        const pos = o.isMesh && o.geometry && o.geometry.attributes.position;
        if (!pos) return;
        const step = Math.max(1, Math.floor(pos.count / 3000));
        for (let i = 0; i < pos.count; i += step) {
          pts.push(v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).sub(center).clone());
        }
      });
      const up = new THREE.Vector3(0, 1, 0);
      const elev = Math.asin(dir.y), az0 = Math.atan2(dir.x, dir.z);
      const MARGIN = opts.margin || 1.12, STEPS = 72;
      const basis = (az) => {
        const d = new THREE.Vector3(Math.cos(elev) * Math.sin(az), Math.sin(elev), Math.cos(elev) * Math.cos(az));
        const r = new THREE.Vector3().crossVectors(up, d).normalize();
        return { d, r, u: new THREE.Vector3().crossVectors(d, r) };
      };
      const fitFor = (az) => {
        const tanV = Math.tan((camera.fov * Math.PI) / 360), tanH = tanV * camera.aspect;
        const { d, r, u } = basis(az);
        let need = 0;
        for (const p of pts) {
          const z = p.dot(d);
          need = Math.max(need, Math.abs(p.dot(r)) / tanH + z, Math.abs(p.dot(u)) / tanV + z);
        }
        return need || sphere.radius * 2;
      };
      // Seen from above, a robot's silhouette sits low around its box centre.
      // Lift the orbit's pivot so the opening shot is centred top to bottom.
      {
        const D = fitFor(az0), { d, u } = basis(az0);
        let lo = Infinity, hi = -Infinity;
        for (const p of pts) { const y = p.dot(u) / (D - p.dot(d)); lo = Math.min(lo, y); hi = Math.max(hi, y); }
        const dy = ((lo + hi) / 2) * D / Math.cos(elev);
        center.y += dy;
        for (const p of pts) p.y -= dy;
      }
      fit = {
        center, elev, az0, dist: 1,
        refit() {
          let widest = 0;
          for (let k = 0; k < STEPS; k++) widest = Math.max(widest, fitFor((k / STEPS) * Math.PI * 2));
          this.dist = Math.max(fitFor(az0) * MARGIN, widest * 1.02);
          camera.near = Math.max(this.dist / 1000, 1e-4);
          camera.far = this.dist * 12;
          camera.updateProjectionMatrix();
        }
      };
      fit.refit();

      if (scrub) {
        placeScrubbed();
      } else {
        controls.target.copy(center);
        camera.position.copy(center).add(dir.clone().multiplyScalar(fit.dist));
        controls.update();
        home = { pos: camera.position.clone(), tgt: center.clone() };
        controls.autoRotate = spin;
        // In the page flow a wheel over the plate scrolls the page; zoom arms
        // on a click inside it.
        if (opts.clickToZoom) {
          controls.enableZoom = false;
          listen(host, "pointerdown", () => { controls.enableZoom = true; });
          listen(host, "pointerleave", (e) => { if (e.pointerType === "mouse") controls.enableZoom = false; });
        }
      }
      if (gtao) {
        gtao.updateGtaoMaterial({
          radius: Math.max(sphere.radius * 0.16, 0.02),
          distanceExponent: 1,
          thickness: Math.max(sphere.radius * 0.16, 0.02),
          scale: 1.6,
          samples: 16
        });
      }
      loaded = true;
      host.classList.add("ready");
      markDirty();
      start();
    },
    undefined,
    () => {
      if (disposed) return;
      host.classList.add("failed");
      const s = host.querySelector(".model-load span");
      if (s) s.textContent = "3D unavailable";
    }
  );

  return {
    setView(v) {
      if (v.az != null) view.az = v.az;
      if (v.el != null) view.el = v.el;
      if (v.zoom != null) view.zoom = v.zoom;
      markDirty();
      start();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      offVis();
      controls.dispose();
      if (restore) restore.remove();
      offHost.forEach((f) => f());
      if (root) disposeTree(root);
      scene.environment?.dispose();
      pmrem.dispose();
      composer.dispose();
      renderer.dispose();
      canvas.remove();
    }
  };
};

/* ============================================================================
   The research story
   ========================================================================= */

/* A soft round glow, drawn once and shared by every sprite. */
let glowTex = null;
function glow() {
  if (glowTex) return glowTex;
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const x = c.getContext("2d");
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.18, "rgba(255,255,255,.85)");
  g.addColorStop(0.42, "rgba(255,255,255,.22)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}
function sprite(color, size) {
  const m = new THREE.SpriteMaterial({ map: glow(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const s = new THREE.Sprite(m);
  s.scale.setScalar(size);
  return s;
}
/* A thin glowing rod between two points; set(a, b, t) draws it t of the way. */
function beam(color, radius) {
  const geo = new THREE.CylinderGeometry(radius, radius, 1, 10, 1, true);
  geo.translate(0, 0.5, 0);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const m = new THREE.Mesh(geo, mat);
  const Y = new THREE.Vector3(0, 1, 0), d = new THREE.Vector3();
  m.set = (a, b, t) => {
    d.subVectors(b, a);
    const len = d.length();
    m.position.copy(a);
    m.quaternion.setFromUnitVectors(Y, d.normalize());
    m.scale.set(1, Math.max(len * t, 1e-4), 1);
    m.visible = t > 0.001;
  };
  return m;
}

const SPHERE_VS = `
varying vec3 vN; varying vec3 vV; varying vec3 vW;
void main(){
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vec4 mv = viewMatrix * w;
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const SPHERE_FS = `
uniform vec3 uColor; uniform float uOpacity; uniform float uTime; uniform float uRadius; uniform vec3 uCenter;
varying vec3 vN; varying vec3 vV; varying vec3 vW;
void main(){
  float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
  // latitude rings ride outward, like the pulse that drew the sphere
  float h = (vW.y - uCenter.y) / max(uRadius, 1e-3);
  float ring = smoothstep(0.92, 1.0, abs(sin((h * 9.0 - uTime * 0.6) * 3.14159)));
  float a = (0.018 + f * 0.42 + ring * 0.05) * uOpacity;
  gl_FragColor = vec4(uColor * (0.75 + f * 0.6), a);
}`;

const POINTS_VS = `
attribute vec3 aFrom; attribute vec3 aTo;
uniform float uMix; uniform float uSize; uniform float uPx;
void main(){
  vec3 p = mix(aFrom, aTo, uMix);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uSize * uPx / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const POINTS_FS = `
uniform vec3 uA; uniform vec3 uB; uniform float uMix; uniform float uOpacity;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.1, d) * uOpacity;
  gl_FragColor = vec4(mix(uA, uB, uMix), a);
}`;

/* paper frame (x right, y deep, z up, metres) → the rig model's frame */
const W = (p) => new THREE.Vector3(p[0] - 0.022, p[2] + 0.096, -(p[1] + 0.055));

/* Levenberg–Marquardt exactly as the paper writes it (Eqs. 2–4), recording
   every iterate so the scroll can step through them. */
function solveLM(anchors, ranges, start) {
  const iters = [start.slice()];
  let p = start.slice(), lambda = 1e-2;
  const cost = (q) => anchors.reduce((s, a, i) => s + Math.pow(Math.hypot(q[0] - a[0], q[1] - a[1], q[2] - a[2]) - ranges[i], 2), 0);
  for (let k = 0; k < 24; k++) {
    const JtJ = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], Jtr = [0, 0, 0];
    anchors.forEach((a, i) => {
      const dx = p[0] - a[0], dy = p[1] - a[1], dz = p[2] - a[2], n = Math.hypot(dx, dy, dz) || 1e-9;
      const J = [dx / n, dy / n, dz / n], r = n - ranges[i];
      for (let u = 0; u < 3; u++) { Jtr[u] += J[u] * r; for (let w = 0; w < 3; w++) JtJ[u][w] += J[u] * J[w]; }
    });
    const A = JtJ.map((row, u) => row.map((v, w) => v + (u === w ? lambda : 0)));
    const D = solve3(A, Jtr);
    const q = [p[0] - D[0], p[1] - D[1], p[2] - D[2]];
    if (cost(q) < cost(p)) { p = q; lambda *= 0.3; iters.push(p.slice()); }
    else lambda *= 4;
    if (Math.hypot(D[0], D[1], D[2]) < 1e-5) break;
  }
  return iters;
}
function solve3(A, b) {
  const det = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const d = det(A) || 1e-12;
  return [0, 1, 2].map((c) => det(A.map((row, r) => row.map((v, k) => (k === c ? b[r] : v)))) / d);
}

window.__mountUWB = function (host, opts) {
  const data = opts.data;
  const COL = opts.colors.map((c) => new THREE.Color(c));
  const RED = new THREE.Color("#fc6255");

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 0.85;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.localClippingEnabled = true;
  const canvas = renderer.domElement;
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  host.appendChild(canvas);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.9;
  const key = new THREE.DirectionalLight("#ffffff", 0.9);
  key.position.set(1.5, 3, 2.5);
  scene.add(key);

  const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 60);

  /* ── geometry from the paper ── */
  const A = data.anchors;                               // paper frame, metres
  const T = data.truth;
  const AW = A.map(W), TW = W(T);
  const trueD = A.map((a) => Math.hypot(a[0] - T[0], a[1] - T[1], a[2] - T[2]));
  const RIGC = new THREE.Vector3(0.77, 0.74, -0.39);
  const find = (mat, a) => data.trials.find((t) => t.mat === mat && t.a === a);
  const base = find("baseline", null), hit = find("concrete", 2);
  const BLOCKED = 2;
  const biasM = hit.bias / 100;

  /* the clip plane that scans the rig into view, bottom to top */
  const scan = new THREE.Plane(new THREE.Vector3(0, -1, 0), -1);
  const scanRing = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 1.4),
    new THREE.MeshBasicMaterial({ color: COL[0], transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
  );
  scanRing.rotation.x = -Math.PI / 2;
  scanRing.position.set(0.77, 0, -0.38);
  scene.add(scanRing);

  /* a faint dot floor under the bench */
  const floorMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uO: { value: 0 } },
    vertexShader: "varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: `uniform float uO; varying vec2 vP;
      void main(){ vec2 g = abs(fract(vP * 8.0) - 0.5); float d = length(g);
        float dot = smoothstep(0.09, 0.04, d);
        float fade = smoothstep(2.6, 0.4, length(vP));
        gl_FragColor = vec4(vec3(0.62,0.78,0.86), dot * fade * 0.32 * uO); }`
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0.77, -0.75, -0.38);
  scene.add(floor);

  /* ── models ── */
  const rig = new THREE.Group(), tag = new THREE.Group();
  scene.add(rig, tag);
  const stand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.006, 0.006, 1, 12),
    new THREE.MeshStandardMaterial({ color: "#2a2d33", roughness: 0.6, metalness: 0.3, clippingPlanes: [scan] })
  );
  scene.add(stand);

  /* ── signal layer ── */
  const sig = new THREE.Group();
  scene.add(sig);
  const anchorGlow = AW.map((p, i) => { const s = sprite(COL[i], 0.12); s.position.copy(p); sig.add(s); return s; });
  const anchorFlash = AW.map((p, i) => { const s = sprite(COL[i], 0.3); s.position.copy(p); sig.add(s); return s; });
  const tagGlow = sprite(new THREE.Color("#ffffff"), 0.1); tagGlow.position.copy(TW); sig.add(tagGlow);
  /* chapter two: the tag's pulses ringing outward */
  const ringTex = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 256;
    const x = c.getContext("2d");
    const g = x.createRadialGradient(128, 128, 108, 128, 128, 125);
    g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.75, "rgba(255,255,255,1)"); g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const rings = [0, 1, 2].map(() => {
    const r = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex, color: COL[0], transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, opacity: 0 }));
    r.position.copy(TW); sig.add(r); return r;
  });
  const beams = AW.map((_, i) => { const b = beam(COL[i], 0.0024); sig.add(b); return b; });
  const pulsesOut = AW.map((_, i) => { const s = sprite(COL[i], 0.06); sig.add(s); return s; });
  const pulsesBack = AW.map((_, i) => { const s = sprite(COL[i], 0.05); sig.add(s); return s; });

  const sphereGeo = new THREE.SphereGeometry(1, 96, 64);
  const spheres = AW.map((p, i) => {
    const m = new THREE.Mesh(sphereGeo, new THREE.ShaderMaterial({
      vertexShader: SPHERE_VS, fragmentShader: SPHERE_FS, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.FrontSide,
      uniforms: { uColor: { value: COL[i].clone() }, uOpacity: { value: 0 }, uTime: { value: 0 }, uRadius: { value: 1 }, uCenter: { value: p.clone() } }
    }));
    m.position.copy(p); m.renderOrder = 2; sig.add(m);
    return m;
  });
  const meet = sprite(new THREE.Color("#ffffff"), 0.22); meet.position.copy(TW); sig.add(meet);

  /* the solver's walk, from a cold start up by the tall anchor */
  const iters = solveLM(A, trueD, [0.25, 0.55, 1.05]).map(W);
  const cand = sprite(new THREE.Color("#ffffff"), 0.1); sig.add(cand);
  const trailGeo = new THREE.BufferGeometry().setFromPoints(iters);
  const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, toneMapped: false }));
  sig.add(trail);
  const stepDots = iters.map((p) => { const s = sprite(new THREE.Color("#ffffff"), 0.035); s.position.copy(p); sig.add(s); return s; });

  /* every logged fix: the clear baseline, then concrete on A2 */
  const N = Math.max(base.n, hit.n);
  const from = new Float32Array(N * 3), to = new Float32Array(N * 3);
  for (let k = 0; k < N; k++) {
    const b = k % base.n, h = k % hit.n;
    from.set([TW.x + base.ex[b] / 1000, TW.y + base.ez[b] / 1000, TW.z - base.ey[b] / 1000], k * 3);
    to.set([TW.x + hit.ex[h] / 1000, TW.y + hit.ez[h] / 1000, TW.z - hit.ey[h] / 1000], k * 3);
  }
  const cloudGeo = new THREE.BufferGeometry();
  cloudGeo.setAttribute("position", new THREE.BufferAttribute(from.slice(), 3));
  cloudGeo.setAttribute("aFrom", new THREE.BufferAttribute(from, 3));
  cloudGeo.setAttribute("aTo", new THREE.BufferAttribute(to, 3));
  const cloudMat = new THREE.ShaderMaterial({
    vertexShader: POINTS_VS, fragmentShader: POINTS_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uMix: { value: 0 }, uSize: { value: 0.016 }, uPx: { value: 800 }, uOpacity: { value: 0 },
      uA: { value: new THREE.Color("#bff5e6") }, uB: { value: RED.clone() } }
  });
  const cloud = new THREE.Points(cloudGeo, cloudMat);
  cloud.frustumCulled = false;
  sig.add(cloud);
  const mean = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length / 1000;
  const EST = new THREE.Vector3(TW.x + mean(hit.ex), TW.y + mean(hit.ez), TW.z - mean(hit.ey));
  const estGlow = sprite(RED, 0.13); estGlow.position.copy(EST); sig.add(estGlow);
  const errBeam = beam(RED, 0.003); sig.add(errBeam);

  /* the obstruction: a concrete block on the bench, ~5 cm from the tag,
     ~10 cm deep along the A2 link, tall enough to stand across it */
  const u = new THREE.Vector3().subVectors(AW[BLOCKED], TW).setY(0).normalize();
  const side = new THREE.Vector3(-u.z, 0, u.x);
  const blockAt = TW.clone().addScaledVector(u, 0.1).setY(0.16);
  const block = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.32, 0.1),
    new THREE.MeshStandardMaterial({ color: "#5d5a55", roughness: 0.95, metalness: 0 })
  );
  block.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(new THREE.Vector3(), u, new THREE.Vector3(0, 1, 0)));
  const blockEdges = new THREE.LineSegments(new THREE.EdgesGeometry(block.geometry), new THREE.LineBasicMaterial({ color: "#fc6255", transparent: true, opacity: 0.8, toneMapped: false }));
  block.add(blockEdges);
  scene.add(block);

  /* ── loading ── */
  let loaded = false, disposed = false;
  const load = (url) => new Promise((res, rej) => loader.load(url, (g) => res(g.scene), undefined, rej));
  const ready = Promise.all([load(opts.base + "rig.glb"), load(opts.base + "node.glb")]).then(([r, n]) => {
    if (disposed) return;
    const tone = (m) => { if (m.map) m.map = retone(m.map, 0.34, 0.5); };
    normalizeCAD(r, (m) => { tone(m); m.clippingPlanes = [scan]; m.clipShadows = true; });
    rig.add(r);
    // The CAD export stops at the tripod-holder clamps; the carbon masts that
    // carry A1 and A3 up to their heights were only ever in the renders.
    const mastMat = new THREE.MeshStandardMaterial({ color: "#3b3e46", roughness: 0.45, metalness: 0.2, clippingPlanes: [scan] });
    [[1.54, -0.05, 0.87], [-0.02, -0.71, 1.51]].forEach(([x, z, caseY]) => {
      const top = caseY - 0.0885, bot = -0.02;
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.0065, 0.0065, top - bot, 16), mastMat);
      mast.position.set(x, (top + bot) / 2, z);
      rig.add(mast);
    });
    normalizeCAD(n, tone);
    // centre the tag's case on the surveyed tag position, upright, face to the front
    const box = new THREE.Box3().setFromObject(n, true);
    const c = box.getCenter(new THREE.Vector3());
    n.position.sub(c);
    tag.add(n);
    tag.position.copy(TW);
    tag.rotation.y = -0.35;
    const h = box.max.y - box.min.y;
    const bottom = TW.y - h / 2;
    stand.scale.set(1, Math.max(bottom, 0.01), 1);
    stand.position.set(TW.x, bottom / 2, TW.z);
    tagGlow.position.set(TW.x, TW.y + h * 0.18, TW.z);
    loaded = true;
    host.classList.add("ready");
  }, () => { host.classList.add("failed"); });

  /* ── camera path ── */
  const tmpT = new THREE.Vector3();
  const D2R = Math.PI / 180;
  const MID = TW.clone().lerp(RIGC, 0.45);
  const FOCUS = TW.clone().lerp(EST, 0.5).lerp(AW[BLOCKED], 0.12);
  // [p, target, azimuth°, elevation°, distance, wide (how much of the bench is in shot)]
  const KEYS = [
    [0.00, TW, -62, 4, 0.72, 0],
    [0.13, TW, -18, 8, 0.62, 0],
    [0.27, TW, 28, 12, 0.56, 0],
    [0.30, TW, 34, 14, 0.6, 0],
    [0.42, RIGC, 30, 20, 3.7, 1],
    [0.47, RIGC, 32, 21, 3.65, 1],
    [0.61, RIGC, 58, 26, 3.75, 1],
    [0.66, MID, 50, 25, 3.55, 1],
    [0.77, MID, 28, 25, 3.35, 1],
    [0.82, FOCUS, 22, 31, 2.75, 1],
    [1.00, FOCUS, -6, 40, 2.55, 1],
  ];
  function cameraAt(p, aspect) {
    let i = 0;
    while (i < KEYS.length - 2 && p > KEYS[i + 1][0]) i++;
    const a = KEYS[i], b = KEYS[i + 1];
    const t = smooth(span(p, a[0], b[0]));
    tmpT.lerpVectors(a[1], b[1], t);
    const az = lerp(a[2], b[2], t) * D2R, el = lerp(a[3], b[3], t) * D2R;
    let dist = Math.exp(lerp(Math.log(a[4]), Math.log(b[4]), t));
    const wide = lerp(a[5], b[5], t);
    // a portrait screen can't fit the 1.6 m bench at the same distance
    if (aspect < 1.25) dist *= lerp(1, Math.min(2.3, 1.45 / aspect), wide);
    camera.position.set(
      tmpT.x + dist * Math.cos(el) * Math.sin(az),
      tmpT.y + dist * Math.sin(el),
      tmpT.z + dist * Math.cos(el) * Math.cos(az));
    camera.lookAt(tmpT);
  }

  /* ── sizing ── the subject sits right of the text column on wide screens
     and above the caption on narrow ones */
  let W_ = 1, H_ = 1;
  const resize = () => {
    W_ = host.clientWidth || 1; H_ = host.clientHeight || 1;
    renderer.setSize(W_, H_, false);
    camera.aspect = W_ / H_;
    const wide = W_ > 900;
    const shiftX = wide ? -Math.round(W_ * 0.17) : 0;
    const shiftY = wide ? -Math.round(H_ * 0.05) : Math.round(H_ * 0.12);
    camera.setViewOffset(W_, H_, shiftX, shiftY, W_, H_);
    camera.updateProjectionMatrix();
    cloudMat.uniforms.uPx.value = H_ * renderer.getPixelRatio() * 0.9;
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  /* ── the timeline ── */
  let P = 0;
  const v3 = new THREE.Vector3(), out = { anchors: [], tag: null, est: null, block: null, cand: null };
  const project = (p) => {
    v3.copy(p).project(camera);
    return { x: (v3.x * 0.5 + 0.5) * W_, y: (-v3.y * 0.5 + 0.5) * H_, on: v3.z < 1 && v3.z > -1 };
  };

  function apply(p, time) {
    // 1 · scan the bench in
    const reveal = smooth(span(p, 0.3, 0.41));
    const scanY = lerp(-0.12, 1.78, reveal);
    scan.constant = scanY;
    scanRing.position.y = scanY;
    scanRing.material.opacity = reveal > 0 && reveal < 1 ? 0.06 * Math.sin(reveal * Math.PI) : 0;
    stand.material.clippingPlanes = reveal < 1 ? [scan] : null;
    floorMat.uniforms.uO.value = smooth(span(p, 0.33, 0.45));

    // 2 · ranging: rods draw out, pulses run while the chapter is up
    const ranging = span(p, 0.4, 0.47);
    const rangingOn = p > 0.4 && p < 0.66;
    const sphereIn = span(p, 0.47, 0.58);
    const obstruct = span(p, 0.8, 0.86);         // block slides in
    const inflate = smooth(span(p, 0.85, 0.9));  // A2 range grows
    const drift = smooth(span(p, 0.88, 0.96));   // the estimate follows

    AW.forEach((aw, i) => {
      const lit = smooth(span(p, 0.36 + i * 0.012, 0.42 + i * 0.012));
      anchorGlow[i].material.opacity = lit;
      anchorGlow[i].scale.setScalar(0.1 + 0.03 * Math.sin(time * 2 + i));
      const draw = smooth(clamp01(ranging * 1.6 - i * 0.15));
      const fadeLate = 1 - span(p, 0.6, 0.66) * 0.75;
      beams[i].set(TW, aw, draw);
      const blocked = i === BLOCKED ? obstruct : 0;
      beams[i].material.color.copy(COL[i]).lerp(RED, blocked);
      beams[i].material.opacity = 0.75 * fadeLate + (i === BLOCKED ? 0.2 * blocked : 0);

      // a pulse out to the anchor and its reply back, staggered per anchor
      const cyc = ((time * 0.55 + i * 0.17) % 1);
      const go = cyc < 0.45 ? cyc / 0.45 : -1, back = cyc > 0.5 && cyc < 0.95 ? (cyc - 0.5) / 0.45 : -1;
      const showPulse = rangingOn && draw > 0.98;
      pulsesOut[i].visible = showPulse && go >= 0;
      pulsesBack[i].visible = showPulse && back >= 0;
      if (go >= 0) pulsesOut[i].position.lerpVectors(TW, aw, go);
      if (back >= 0) pulsesBack[i].position.lerpVectors(aw, TW, back);
      const arrive = showPulse && cyc > 0.43 && cyc < 0.6 ? 1 - Math.abs(cyc - 0.47) / 0.13 : 0;
      anchorFlash[i].material.opacity = Math.max(0, arrive) * 0.9 * lit;
      anchorFlash[i].scale.setScalar(0.18 + 0.2 * Math.max(0, arrive));

      // 3 · spheres, radius = the range; A2's swells by the measured bias
      const grow = smooth(clamp01(sphereIn * 1.5 - i * 0.16));
      const r = trueD[i] + (i === BLOCKED ? biasM * inflate : 0);
      spheres[i].scale.setScalar(Math.max(r * grow, 1e-3));
      spheres[i].material.uniforms.uRadius.value = r;
      const dim = p > 0.62 ? lerp(1, 0.28, span(p, 0.62, 0.68)) : 1;
      const hot = i === BLOCKED ? lerp(1, 3.4, inflate) : 1;
      spheres[i].material.uniforms.uOpacity.value = grow * dim * hot * (i === BLOCKED || p < 0.8 ? 1 : lerp(1, 0.5, obstruct));
      spheres[i].material.uniforms.uColor.value.copy(COL[i]).lerp(RED, i === BLOCKED ? inflate : 0);
      spheres[i].material.uniforms.uTime.value = time;
      spheres[i].visible = grow > 0.002;
    });
    const ringOn = smooth(span(p, 0.12, 0.17)) * (1 - smooth(span(p, 0.29, 0.34)));
    rings.forEach((r, k) => {
      const ph = (time * 0.55 + k / 3) % 1;
      r.visible = ringOn > 0.001;
      r.position.copy(tagGlow.position);
      r.scale.setScalar(0.03 + ph * 0.7);
      r.material.opacity = Math.pow(1 - ph, 1.6) * 0.85 * ringOn;
    });
    const met = smooth(span(p, 0.55, 0.6)) * (1 - span(p, 0.62, 0.66));
    meet.material.opacity = met;
    meet.scale.setScalar(0.12 + 0.12 * met + 0.03 * Math.sin(time * 3));
    tagGlow.material.opacity = smooth(span(p, 0.36, 0.42)) * (0.6 + 0.4 * Math.sin(time * 4)) * (1 - span(p, 0.62, 0.66) * 0.5);

    // 4 · the solver walks in, one accepted step at a time
    const walk = span(p, 0.635, 0.735);
    const fpos = walk * (iters.length - 1);
    const k = Math.min(iters.length - 2, Math.floor(fpos));
    const f = smooth(clamp01((fpos - k) * 1.6));
    const walking = p > 0.62 && p < 0.8;
    cand.visible = walking;
    if (walking) cand.position.lerpVectors(iters[k], iters[k + 1], f);
    cand.material.opacity = span(p, 0.62, 0.64) * (1 - span(p, 0.76, 0.8));
    cand.scale.setScalar(0.08 + 0.02 * Math.sin(time * 6));
    trail.material.opacity = 0.5 * span(p, 0.63, 0.65) * (1 - span(p, 0.76, 0.8));
    trailGeo.setDrawRange(0, walking ? k + 2 : 0);
    stepDots.forEach((s, j) => { s.material.opacity = j <= k + 1 ? 0.8 * trail.material.opacity * 2 : 0; });

    // 5 · the real logged fixes, clear line then concrete on A2
    cloudMat.uniforms.uOpacity.value = smooth(span(p, 0.72, 0.77));
    cloudMat.uniforms.uMix.value = drift;
    estGlow.material.opacity = drift;
    errBeam.set(TW, EST, drift);
    errBeam.material.opacity = 0.9 * drift;

    // 6 · the block
    block.visible = p > 0.79;
    const slide = 1 - Math.pow(1 - obstruct, 3);
    block.position.copy(blockAt).addScaledVector(side, (1 - slide) * 0.9);
    blockEdges.material.opacity = 0.25 + 0.6 * inflate;

    out.anchors = AW.map((aw) => project(aw));
    out.anchors.forEach((a, i) => { a.on = a.on && anchorGlow[i].material.opacity > 0.4; });
    out.tag = project(TW);
    out.est = project(EST); out.est.on = out.est.on && drift > 0.6;
    out.block = project(block.position.clone().setY(0.34)); out.block.on = out.block.on && obstruct > 0.7;
    out.cand = project(cand.position); out.cand.on = walking && cand.material.opacity > 0.5;
    out.step = walking ? Math.min(iters.length - 1, k + (f > 0.5 ? 1 : 0)) : 0;
    out.steps = iters.length - 1;
    out.inflate = inflate; out.drift = drift; out.w = W_;
  }

  let raf = 0, visible = false;
  const offVis = whileVisible(host, (v) => { visible = v; if (v && !raf) raf = requestAnimationFrame(tick); });
  function tick(now) {
    raf = 0;
    if (disposed || !visible) return;
    const t = now / 1000;
    cameraAt(P, camera.aspect);
    camera.updateMatrixWorld();
    apply(P, t);
    renderer.render(scene, camera);
    if (opts.onFrame) opts.onFrame(out);
    raf = requestAnimationFrame(tick);
  }

  return {
    ready,
    setProgress(p) { P = p; },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect(); offVis();
      disposeTree(scene);
      scene.environment?.dispose();
      pmrem.dispose();
      renderer.dispose();
      canvas.remove();
    }
  };
};

document.dispatchEvent(new Event("three-ready"));
