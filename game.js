/*
 * MOON MOUNTIE MORT
 * The year is 2112. Help Mort of the Royal Canadian Moon Police juggle
 * Buford T. Bilgewater's stolen glass globes until Moon Mechanic Milo
 * fixes the teleporter. Happy Moon Canada Day!
 */
(() => {
  'use strict';

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------
  const W = 960, H = 540;
  const GROUND = 474;
  const PLAY_L = 24, PLAY_R = 760;       // globes bounce off these walls (Mort can walk past PLAY_R)
  const TX = 838;                         // teleporter centre
  const BOX_X = 924;                      // globe collection box
  const MAX_CARRY = 2;
  const GAME_OVER_DELAY = 0.15;           // just long enough to see the final crash
  const GLOBE_GRAVITY = 230;              // low lunar gravity, nice and floaty
  const MORT_GRAVITY = 1150;
  const MORT_SPEED = 430;
  const JUMP_V = 470;
  const BUMP_V = 300;                     // base pop speed when Mort's hat hits a globe
  const BUMP_LIFT = 0.2;                  // share of Mort's upward jump speed added to the pop
  const HAT_TOP = 96;                     // hat height above Mort's feet
  const HAT_HALF = 30;
  const CAD_TO_USD = 0.6;
  const START_LIVES = 5;
  const MAX_LIVES = 9;
  const EXTRA_LIFE_EVERY = 500;          // every $500 CAD: one maple leaf + one pair of moon shoes
  const START_SHOES = 3;
  const MAX_SHOES = 9;
  const SHOES_TIME = 10;
  const SHOES_BOOST = 2;
  const SHOE_BTN = { x: 16, y: 84, w: 112, h: 34 }; // HUD button for touch / mouse
  const FONT = '"Press Start 2P", "Courier New", monospace';
  const HIGH_KEY = 'moonMountieMort.highScore';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const TAU = Math.PI * 2;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const money = (n) => '$' + Math.round(n).toLocaleString('en-CA');
  const usd = (n) => Math.round(n * CAD_TO_USD);

  function loadHigh() {
    try { return parseInt(localStorage.getItem(HIGH_KEY), 10) || 0; } catch (e) { return 0; }
  }
  function saveHigh(v) {
    try { localStorage.setItem(HIGH_KEY, String(v)); } catch (e) { /* storage unavailable */ }
  }

  // ---------------------------------------------------------------------------
  // Drawing helpers
  // ---------------------------------------------------------------------------
  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function ell(c, x, y, rx, ry, rot = 0) {
    c.beginPath();
    c.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, TAU);
  }

  const LEAF = [
    [0, -1], [0.12, -0.75], [0.3, -0.82], [0.25, -0.35], [0.5, -0.55], [0.55, -0.42],
    [0.85, -0.48], [0.75, -0.2], [0.9, -0.1], [0.5, 0.2], [0.55, 0.38], [0.08, 0.3],
    [0.06, 0.75], [-0.06, 0.75], [-0.08, 0.3], [-0.55, 0.38], [-0.5, 0.2], [-0.9, -0.1],
    [-0.75, -0.2], [-0.85, -0.48], [-0.55, -0.42], [-0.5, -0.55], [-0.25, -0.35],
    [-0.3, -0.82], [-0.12, -0.75],
  ];

  function mapleLeaf(c, x, y, s, color, rot = 0) {
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    c.scale(s, s);
    c.beginPath();
    LEAF.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py)));
    c.closePath();
    c.fillStyle = color;
    c.fill();
    c.restore();
  }

  function star(c, x, y, r, color, rot = 0, points = 5, inner = 0.45) {
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    c.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const rr = i % 2 ? r * inner : r;
      const a = (i / (points * 2)) * TAU - Math.PI / 2;
      c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    c.closePath();
    c.fillStyle = color;
    c.fill();
    c.restore();
  }

  function text(c, s, x, y, size, color, align = 'center', stroke = 'rgba(8,6,28,0.92)') {
    c.font = `${size}px ${FONT}`;
    c.textAlign = align;
    c.textBaseline = 'middle';
    if (stroke) {
      c.lineJoin = 'round';
      c.lineWidth = Math.max(3, size / 3.2);
      c.strokeStyle = stroke;
      c.strokeText(s, x, y);
    }
    c.fillStyle = color;
    c.fillText(s, x, y);
  }

  function panel(c, x, y, w, h, alpha = 0.78) {
    c.save();
    roundRect(c, x, y, w, h, 14);
    const g = c.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, `rgba(28,22,78,${alpha})`);
    g.addColorStop(1, `rgba(12,10,40,${alpha})`);
    c.fillStyle = g;
    c.fill();
    c.lineWidth = 3;
    c.strokeStyle = 'rgba(160,190,255,0.55)';
    c.stroke();
    roundRect(c, x + 5, y + 5, w - 10, h - 10, 10);
    c.lineWidth = 1;
    c.strokeStyle = 'rgba(255,90,90,0.45)';
    c.stroke();
    c.restore();
  }

  // ---------------------------------------------------------------------------
  // Canvas sizing + pre-rendered background layers
  // ---------------------------------------------------------------------------
  let scale = 1;
  const skyLayer = document.createElement('canvas');
  const landLayer = document.createElement('canvas');

  function resize() {
    const s = Math.min(window.innerWidth / W, window.innerHeight / H);
    const cw = Math.max(1, Math.floor(W * s));
    const ch = Math.max(1, Math.floor(H * s));
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    scale = canvas.width / W;
    renderLayers();
  }

  function renderLayers() {
    for (const [layer, fn] of [[skyLayer, renderSky], [landLayer, renderLand]]) {
      layer.width = canvas.width;
      layer.height = canvas.height;
      const c = layer.getContext('2d');
      c.setTransform(scale, 0, 0, scale, 0, 0);
      fn(c);
    }
  }

  function renderSky(c) {
    const r = mulberry32(2112);
    let g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#04051a');
    g.addColorStop(0.4, '#151447');
    g.addColorStop(0.7, '#352770');
    g.addColorStop(1, '#6a4a92');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);

    for (let i = 0; i < 240; i++) {
      const x = r() * W, y = r() * H * 0.72, s = r() * 1.3 + 0.3;
      const tint = r();
      c.globalAlpha = 0.25 + r() * 0.75;
      c.fillStyle = tint < 0.12 ? '#ffd9a8' : tint < 0.3 ? '#b8dcff' : '#ffffff';
      c.beginPath();
      c.arc(x, y, s, 0, TAU);
      c.fill();
    }
    c.globalAlpha = 1;
    for (let i = 0; i < 6; i++) {
      const x = r() * W, y = r() * 220;
      star(c, x, y, 3 + r() * 2, 'rgba(255,255,255,0.8)', 0, 4, 0.2);
    }

    drawEarth(c, 690, 92, 44);

    // horizon glow
    g = c.createLinearGradient(0, 260, 0, 420);
    g.addColorStop(0, 'rgba(255,140,200,0)');
    g.addColorStop(1, 'rgba(255,150,210,0.25)');
    c.fillStyle = g;
    c.fillRect(0, 260, W, 160);
  }

  function drawEarth(c, x, y, R) {
    let g = c.createRadialGradient(x, y, R * 0.9, x, y, R * 2);
    g.addColorStop(0, 'rgba(110,180,255,0.4)');
    g.addColorStop(1, 'rgba(110,180,255,0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(x, y, R * 2, 0, TAU);
    c.fill();

    c.save();
    c.beginPath();
    c.arc(x, y, R, 0, TAU);
    c.clip();
    g = c.createRadialGradient(x - R * 0.35, y - R * 0.35, R * 0.1, x, y, R);
    g.addColorStop(0, '#6cc0ff');
    g.addColorStop(1, '#1747a0');
    c.fillStyle = g;
    c.fillRect(x - R, y - R, R * 2, R * 2);
    c.fillStyle = '#4caf6c';
    const blobs = [[-14, -18, 18, 11, 0.3], [-6, -4, 9, 14, 0.2], [14, 10, 10, 16, -0.4], [22, -20, 10, 6, 0.6], [-24, 16, 8, 5, 0]];
    for (const [bx, by, rx, ry, rot] of blobs) { ell(c, x + bx, y + by, rx, ry, rot); c.fill(); }
    c.fillStyle = 'rgba(255,255,255,0.9)';
    ell(c, x - 6, y - R + 4, 22, 6); c.fill(); // ice cap
    c.strokeStyle = 'rgba(255,255,255,0.45)';
    c.lineWidth = 3;
    c.lineCap = 'round';
    for (const [a, b, d] of [[-30, -2, 24], [-10, 22, 30], [6, -10, 18]]) {
      c.beginPath(); c.moveTo(x + a, y + b); c.quadraticCurveTo(x + a + d / 2, y + b - 6, x + a + d, y + b); c.stroke();
    }
    g = c.createLinearGradient(x - R, y - R, x + R, y + R);
    g.addColorStop(0, 'rgba(0,0,20,0)');
    g.addColorStop(0.55, 'rgba(0,0,20,0.1)');
    g.addColorStop(1, 'rgba(0,0,20,0.75)');
    c.fillStyle = g;
    c.fillRect(x - R, y - R, R * 2, R * 2);
    c.restore();
  }

  function drawRange(c, r, o) {
    const pts = [];
    let x = -80;
    while (x < W + 80) {
      const h = o.minH + r() * (o.maxH - o.minH);
      pts.push([x, o.base - h]);
      x += o.step[0] + r() * (o.step[1] - o.step[0]);
      pts.push([x, o.base - h * (0.15 + 0.3 * r())]);
      x += o.step[0] * 0.6 + r() * o.step[0];
    }
    const g = c.createLinearGradient(0, o.base - o.maxH, 0, o.base + 30);
    g.addColorStop(0, o.top);
    g.addColorStop(1, o.bottom);
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(-80, H);
    pts.forEach((p) => c.lineTo(p[0], p[1]));
    c.lineTo(W + 80, H);
    c.closePath();
    c.fill();

    c.fillStyle = o.snow;
    for (let i = 0; i < pts.length - 1; i += 2) {
      const p = pts[i];
      const prev = pts[i - 1] || [p[0] - 70, o.base];
      const next = pts[i + 1];
      const t = 0.3;
      const lx = lerp(p[0], prev[0], t), ly = lerp(p[1], prev[1], t);
      const rx = lerp(p[0], next[0], t), ry = lerp(p[1], next[1], t);
      c.beginPath();
      c.moveTo(p[0], p[1]);
      c.lineTo(rx, ry);
      for (let k = 1; k < 4; k++) {
        const kx = lerp(rx, lx, k / 4), ky = lerp(ry, ly, k / 4);
        c.lineTo(kx, ky + (k % 2 ? -7 : 2));
      }
      c.lineTo(lx, ly);
      c.closePath();
      c.fill();
    }
  }

  function pine(c, x, y, h) {
    const w = h * 0.42;
    c.fillStyle = '#4a2f22';
    c.fillRect(x - 2.5, y - h * 0.14, 5, h * 0.14);
    for (let i = 0; i < 3; i++) {
      const ty = y - h * 0.12 - i * h * 0.24;
      const tw = w * (1 - i * 0.24);
      const th = h * 0.42;
      c.fillStyle = i % 2 ? '#1f5a5c' : '#1a4b52';
      c.beginPath(); c.moveTo(x - tw, ty); c.lineTo(x + tw, ty); c.lineTo(x, ty - th); c.closePath(); c.fill();
      c.fillStyle = 'rgba(240,246,255,0.95)';
      c.beginPath();
      c.moveTo(x - tw, ty);
      c.quadraticCurveTo(x - tw * 0.4, ty - 7, x, ty - 3);
      c.quadraticCurveTo(x + tw * 0.4, ty - 7, x + tw, ty);
      c.quadraticCurveTo(x, ty - 1, x - tw, ty);
      c.fill();
      c.beginPath(); c.moveTo(x - tw * 0.3, ty - th * 0.7); c.lineTo(x + tw * 0.3, ty - th * 0.7); c.lineTo(x, ty - th); c.closePath(); c.fill();
    }
  }

  function dome(c, x, y, rw, rh) {
    let g = c.createRadialGradient(x - rw * 0.3, y - rh * 0.6, 4, x, y, rw);
    g.addColorStop(0, 'rgba(220,240,255,0.55)');
    g.addColorStop(1, 'rgba(120,170,255,0.25)');
    // little houses inside
    c.fillStyle = '#5b3a6e';
    c.fillRect(x - rw * 0.55, y - rh * 0.45, rw * 0.3, rh * 0.45);
    c.fillRect(x + rw * 0.1, y - rh * 0.6, rw * 0.35, rh * 0.6);
    c.fillStyle = '#ffd36b';
    for (let i = 0; i < 3; i++) c.fillRect(x - rw * 0.5 + i * 6, y - rh * 0.35, 3, 3);
    for (let i = 0; i < 3; i++) c.fillRect(x + rw * 0.15 + i * 7, y - rh * 0.45, 3, 4);
    c.fillStyle = g;
    c.beginPath(); c.ellipse(x, y, rw, rh, 0, Math.PI, TAU); c.fill();
    c.strokeStyle = 'rgba(230,245,255,0.8)';
    c.lineWidth = 1.5;
    c.stroke();
    c.beginPath();
    c.ellipse(x, y, rw * 0.5, rh, 0, Math.PI, TAU);
    c.moveTo(x - rw, y - rh * 0.5);
    c.strokeStyle = 'rgba(230,245,255,0.3)';
    c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.6)';
    ell(c, x - rw * 0.45, y - rh * 0.6, rw * 0.18, rh * 0.08, -0.6); c.fill();
    g = c.createLinearGradient(0, y - 4, 0, y + 4);
    g.addColorStop(0, '#9aa2c8'); g.addColorStop(1, '#5d6390');
    c.fillStyle = g;
    c.fillRect(x - rw - 3, y - 3, rw * 2 + 6, 6);
  }

  function cabin(c, x, y, w, h) {
    c.fillStyle = '#6b3e24';
    c.fillRect(x - w / 2, y - h, w, h);
    c.strokeStyle = 'rgba(40,20,10,0.5)';
    c.lineWidth = 1;
    for (let i = 1; i < 5; i++) { c.beginPath(); c.moveTo(x - w / 2, y - h + (h / 5) * i); c.lineTo(x + w / 2, y - h + (h / 5) * i); c.stroke(); }
    c.fillStyle = '#4a2a1a';
    c.fillRect(x + w * 0.2, y - h - 16, 7, 16);
    c.fillStyle = '#3a2a3e';
    c.beginPath(); c.moveTo(x - w / 2 - 6, y - h); c.lineTo(x, y - h - h * 0.75); c.lineTo(x + w / 2 + 6, y - h); c.closePath(); c.fill();
    c.fillStyle = '#f4f8ff';
    c.beginPath(); c.moveTo(x - w / 2 - 7, y - h + 1); c.lineTo(x, y - h - h * 0.78); c.lineTo(x + w / 2 + 7, y - h + 1);
    c.lineTo(x + w / 2, y - h + 4); c.lineTo(x, y - h - h * 0.6); c.lineTo(x - w / 2, y - h + 4); c.closePath(); c.fill();
    const g = c.createRadialGradient(x - w * 0.18, y - h * 0.5, 1, x - w * 0.18, y - h * 0.5, 22);
    g.addColorStop(0, 'rgba(255,210,110,0.6)'); g.addColorStop(1, 'rgba(255,210,110,0)');
    c.fillStyle = g; c.fillRect(x - w * 0.18 - 22, y - h * 0.5 - 22, 44, 44);
    c.fillStyle = '#ffcf6b';
    c.fillRect(x - w * 0.18 - 6, y - h * 0.5 - 6, 12, 11);
    c.fillStyle = '#6b3e24';
    c.fillRect(x - w * 0.18 - 0.75, y - h * 0.5 - 6, 1.5, 11);
  }

  function flag(c, x, y) {
    c.fillStyle = '#c7cbe0';
    c.fillRect(x - 1.5, y, 3, GROUND - y);
    c.fillStyle = '#ffd36b';
    c.beginPath(); c.arc(x, y, 3, 0, TAU); c.fill();
    const fw = 36, fh = 18, fx = x + 2, fy = y + 2;
    c.fillStyle = '#ffffff'; c.fillRect(fx, fy, fw, fh);
    c.fillStyle = '#e3242b';
    c.fillRect(fx, fy, fw / 4, fh);
    c.fillRect(fx + fw * 0.75, fy, fw / 4, fh);
    mapleLeaf(c, fx + fw / 2, fy + fh / 2, 6, '#e3242b');
  }

  function renderLand(c) {
    c.clearRect(0, 0, W, H);
    const r = mulberry32(1867);
    drawRange(c, r, { base: 360, minH: 70, maxH: 160, step: [40, 90], top: '#7a7fd0', bottom: '#3a3478', snow: 'rgba(232,238,255,0.92)' });
    drawRange(c, r, { base: 404, minH: 40, maxH: 100, step: [50, 110], top: '#9ea6e6', bottom: '#4e4894', snow: '#f3f6ff' });

    let g = c.createLinearGradient(0, 400, 0, GROUND);
    g.addColorStop(0, '#e2e9ff');
    g.addColorStop(1, '#9ba6dc');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(0, H);
    for (let x = 0; x <= W; x += 16) c.lineTo(x, 420 + Math.sin(x * 0.011) * 12 + Math.sin(x * 0.027 + 1) * 6);
    c.lineTo(W, H);
    c.closePath();
    c.fill();

    dome(c, 190, 438, 48, 40);
    dome(c, 610, 436, 36, 30);
    cabin(c, 360, 440, 46, 30);
    cabin(c, 520, 444, 36, 24);
    const trees = [[60, 452, 62], [102, 458, 44], [262, 450, 56], [300, 458, 40], [440, 452, 60], [470, 460, 38], [680, 452, 58], [720, 458, 42], [760, 452, 52], [940, 448, 60]];
    for (const [x, y, h] of trees) pine(c, x, y, h);

    // bunting between two flag poles
    flag(c, 40, 300);
    flag(c, 740, 300);
    c.strokeStyle = 'rgba(230,230,255,0.7)';
    c.lineWidth = 1.2;
    const sag = (t) => 304 + Math.sin(t * Math.PI) * 46;
    c.beginPath();
    for (let i = 0; i <= 40; i++) { const t = i / 40; c.lineTo(lerp(41, 739, t), sag(t)); }
    c.stroke();
    for (let i = 1; i < 24; i++) {
      const t = i / 24, t2 = (i + 0.6) / 24;
      const x1 = lerp(41, 739, t), y1 = sag(t), x2 = lerp(41, 739, t2), y2 = sag(t2);
      c.fillStyle = i % 2 ? 'rgba(227,36,43,0.9)' : 'rgba(255,255,255,0.9)';
      c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.lineTo((x1 + x2) / 2, (y1 + y2) / 2 + 14); c.closePath(); c.fill();
    }

    // welcome sign
    c.fillStyle = '#4a2f22';
    c.fillRect(136, 408, 4, 40);
    c.fillRect(246, 408, 4, 40);
    roundRect(c, 120, 384, 146, 38, 5);
    c.fillStyle = '#7a4a2a';
    c.fill();
    c.strokeStyle = '#3d2214';
    c.lineWidth = 2;
    c.stroke();
    c.fillStyle = '#f4f8ff';
    c.fillRect(122, 382, 142, 4);
    text(c, 'NEW NEWFOUNDLAND', 193, 397, 7, '#ffe9b0', 'center', null);
    text(c, 'PENGUINS WELCOME!', 193, 411, 7, '#ffe9b0', 'center', null);

    // ground
    g = c.createLinearGradient(0, GROUND - 8, 0, H);
    g.addColorStop(0, '#f7f9ff');
    g.addColorStop(0.35, '#d7def8');
    g.addColorStop(1, '#a3aee0');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(0, H);
    for (let x = 0; x <= W; x += 12) c.lineTo(x, GROUND - 2 + Math.sin(x * 0.05) * 1.5);
    c.lineTo(W, H);
    c.closePath();
    c.fill();
    // craters - we're still on the moon after all
    const craters = [[90, 506, 34, 7], [300, 520, 46, 8], [520, 500, 26, 5], [660, 522, 40, 7], [870, 512, 30, 6]];
    for (const [x, y, rx, ry] of craters) {
      c.fillStyle = 'rgba(120,130,190,0.35)';
      ell(c, x, y, rx, ry); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.55)';
      ell(c, x + 2, y + ry * 0.45, rx * 0.85, ry * 0.45); c.fill();
    }
    for (let i = 0; i < 70; i++) {
      c.fillStyle = `rgba(255,255,255,${0.4 + r() * 0.6})`;
      c.fillRect(r() * W, GROUND + 4 + r() * (H - GROUND - 6), 1.5, 1.5);
    }
  }

  // Aurora strips are pre-rendered once and stretched each frame.
  const AURORA = [
    { y: 128, amp: 22, f: 0.006, sp: 0.35, h: 95, col: [80, 255, 170], a: 0.55 },
    { y: 160, amp: 26, f: 0.004, sp: -0.28, h: 75, col: [110, 160, 255], a: 0.45 },
    { y: 100, amp: 16, f: 0.009, sp: 0.55, h: 60, col: [210, 120, 255], a: 0.35 },
  ].map((b) => {
    const s = document.createElement('canvas');
    s.width = 4; s.height = 64;
    const c = s.getContext('2d');
    const g = c.createLinearGradient(0, 0, 0, 64);
    const [R, G, B] = b.col;
    g.addColorStop(0, `rgba(${R},${G},${B},0)`);
    g.addColorStop(0.7, `rgba(${R},${G},${B},0.18)`);
    g.addColorStop(0.92, `rgba(${R},${G},${B},0.5)`);
    g.addColorStop(1, `rgba(${R},${G},${B},0)`);
    c.fillStyle = g;
    c.fillRect(0, 0, 4, 64);
    b.strip = s;
    return b;
  });

  function drawAurora(c, t) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (const b of AURORA) {
      for (let x = 0; x < W; x += 6) {
        const yy = b.y + Math.sin(x * b.f + t * b.sp) * b.amp + Math.sin(x * b.f * 2.3 + t * b.sp * 1.7) * b.amp * 0.4;
        c.globalAlpha = b.a * (0.55 + 0.45 * Math.sin(x * 0.017 + t * 1.1 + b.y));
        c.drawImage(b.strip, x, yy - b.h, 7, b.h);
      }
    }
    c.restore();
  }

  // ---------------------------------------------------------------------------
  // Sound (tiny WebAudio synth - no assets needed)
  // ---------------------------------------------------------------------------
  const Sound = {
    ac: null, master: null, muted: false, noiseBuf: null,
    init() {
      if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ac = new AC();
      this.master = this.ac.createGain();
      this.master.gain.value = 0.32;
      this.master.connect(this.ac.destination);
      const len = this.ac.sampleRate;
      this.noiseBuf = this.ac.createBuffer(1, len, this.ac.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    },
    ok() { return this.ac && !this.muted; },
    tone(f, d, { type = 'square', vol = 0.2, to = null, delay = 0, attack = 0.005 } = {}) {
      if (!this.ok()) return;
      const t = this.ac.currentTime + delay;
      const o = this.ac.createOscillator(), g = this.ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, t);
      if (to) o.frequency.exponentialRampToValueAtTime(to, t + d);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + d + 0.05);
    },
    noise(d, { vol = 0.2, freq = 2000, q = 1, delay = 0, type = 'bandpass' } = {}) {
      if (!this.ok()) return;
      const t = this.ac.currentTime + delay;
      const s = this.ac.createBufferSource(), f = this.ac.createBiquadFilter(), g = this.ac.createGain();
      s.buffer = this.noiseBuf;
      f.type = type; f.frequency.value = freq; f.Q.value = q;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      s.connect(f); f.connect(g); g.connect(this.master);
      s.start(t, Math.random() * 0.5); s.stop(t + d + 0.05);
    },
  };

  const PENTA = [523, 587, 659, 784, 880, 1047, 1175, 1319];
  const sfx = {
    bump(n) {
      const f = PENTA[n % PENTA.length];
      Sound.tone(f, 0.12, { type: 'square', vol: 0.12, to: f * 1.5 });
      Sound.tone(f * 2, 0.08, { type: 'triangle', vol: 0.1 });
    },
    wall() { Sound.tone(1900, 0.06, { type: 'sine', vol: 0.06 }); },
    throw() {
      Sound.noise(0.2, { vol: 0.1, freq: 1400, q: 0.8 });
      Sound.tone(260, 0.18, { type: 'triangle', vol: 0.08, to: 620 });
    },
    smash() {
      Sound.noise(0.45, { vol: 0.35, freq: 3500, type: 'highpass' });
      Sound.noise(0.2, { vol: 0.25, freq: 400, q: 0.7 });
      for (let i = 0; i < 6; i++) Sound.tone(rand(2200, 4200), 0.15, { type: 'sine', vol: 0.06, delay: 0.03 + i * 0.045 });
    },
    stun() {
      Sound.noise(0.12, { vol: 0.3, freq: 250, q: 0.6 });
      Sound.tone(180, 0.35, { type: 'triangle', vol: 0.25, to: 520 });
      for (let i = 0; i < 4; i++) Sound.tone(1400 - i * 180, 0.1, { type: 'square', vol: 0.06, delay: 0.12 + i * 0.08 });
    },
    shoes() {
      Sound.noise(0.35, { vol: 0.15, freq: 5000, type: 'highpass' });
      [523, 784, 1047, 1568].forEach((f, i) => Sound.tone(f, 0.1, { type: 'square', vol: 0.07, delay: i * 0.05 }));
    },
    caught() {
      Sound.tone(660, 0.08, { type: 'triangle', vol: 0.14 });
      Sound.tone(990, 0.1, { type: 'triangle', vol: 0.1, delay: 0.06 });
    },
    deposit(n) {
      [784, 988, 1175, 1568].slice(0, 2 + n).forEach((f, i) => Sound.tone(f, 0.12, { type: 'square', vol: 0.08, delay: i * 0.06 }));
    },
    jump() { Sound.tone(300, 0.14, { type: 'square', vol: 0.06, to: 620 }); },
    laugh() {
      Sound.tone(300, 0.13, { type: 'sawtooth', vol: 0.09, to: 210 });
      Sound.tone(290, 0.13, { type: 'sawtooth', vol: 0.09, to: 200, delay: 0.17 });
    },
    teleport() {
      Sound.tone(180, 1.4, { type: 'sawtooth', vol: 0.06, to: 1500, attack: 0.1 });
      Sound.tone(360, 1.4, { type: 'sine', vol: 0.12, to: 2600, attack: 0.1 });
    },
    saved(i) { Sound.tone(880 * Math.pow(2, i / 12), 0.15, { type: 'triangle', vol: 0.12 }); },
    oneUp() { [523, 659, 784, 1047, 1319].forEach((f, i) => Sound.tone(f, 0.12, { type: 'square', vol: 0.08, delay: i * 0.07 })); },
    start() { [392, 523, 659, 784].forEach((f, i) => Sound.tone(f, 0.16, { type: 'square', vol: 0.09, delay: i * 0.09 })); },
    gameOver() {
      // Buford wins: "O say can you see, by the dawn's early light"
      const b = 0.3;
      const notes = [[392, 0.75], [330, 0.25], [262, 1], [330, 1], [392, 1], [523, 2], [659, 0.75], [587, 0.25], [523, 1], [330, 1], [370, 1], [392, 2]];
      let t = 0;
      for (const [f, d] of notes) {
        Sound.tone(f, d * b * 0.95, { type: 'square', vol: 0.08, delay: t });
        Sound.tone(f / 2, d * b * 0.95, { type: 'triangle', vol: 0.1, delay: t });
        t += d * b;
      }
    },
    oCanada() {
      // "O Canada! Our home and native land!"
      const b = 0.34;
      const notes = [[659, 1.5], [784, 1.125], [784, 0.375], [523, 2.5], [587, 0.5], [659, 0.5], [698, 0.5], [784, 0.5], [880, 0.5], [587, 2.5]];
      let t = 0;
      for (const [f, d] of notes) {
        Sound.tone(f, d * b * 0.95, { type: 'square', vol: 0.08, delay: t });
        Sound.tone(f / 2, d * b * 0.95, { type: 'triangle', vol: 0.1, delay: t });
        t += d * b;
      }
    },
  };

  // ---------------------------------------------------------------------------
  // Game state
  // ---------------------------------------------------------------------------
  const state = {
    mode: 'title', modeT: 0, t: 0,
    level: 1, score: 0, high: loadHigh(), newHigh: false,
    lives: START_LIVES, nextLife: EXTRA_LIFE_EVERY, shoes: START_SHOES, shoesT: 0,
    globes: [], particles: [], popups: [],
    progress: 0, repairTime: 30,
    stats: { bumps: 0, stuns: 0, saved: 0 }, bonus: 0,
    shake: 0, hitstop: 0, overT: 0,
    paused: false, demo: false, bumpCombo: 0,
  };

  const mort = { x: 300, y: GROUND, vx: 0, vy: 0, onGround: true, facing: 1, walkT: 0, squash: 0, armUp: 0, carry: [] };
  const buford = { x: 420, y: -80, baseY: 112, vx: 0, targetX: 400, retarget: 0, throwT: 1, windup: 0, stun: 0, spin: 0, leaving: false, flap: 0, grin: 0 };
  const milo = { x: 772, t: 0, lastHit: 0 };

  const flakes = Array.from({ length: 80 }, () => ({ x: rand(0, W), y: rand(0, H), r: rand(0.7, 2.2), s: rand(12, 34), ph: rand(0, TAU) }));

  const input = { left: false, right: false, jumpBuf: 0, pointer: false, px: 0, lastInput: 0 };

  function setMode(m) { state.mode = m; state.modeT = 0; }

  function maxActive() { return Math.min(2 + Math.floor((state.level - 1) * 0.6), 7); }
  function throwInterval() { return rand(1.5, 2.6) * Math.max(0.45, 1 - (state.level - 1) * 0.08); }
  function flyingCount() { return state.globes.filter((g) => g.state === 'fly').length; }

  function startGame(demo = false) {
    Object.assign(state, {
      score: 0, lives: START_LIVES, nextLife: EXTRA_LIFE_EVERY, shoes: START_SHOES, shoesT: 0, level: 1, newHigh: false, demo, overT: 0,
    });
    mort.x = 300; mort.vx = 0; mort.y = GROUND; mort.vy = 0;
    if (!demo) sfx.start();
    startLevel();
  }

  function startLevel() {
    state.globes = [];
    state.progress = 0;
    state.repairTime = Math.min(25 + state.level * 5, 60);
    state.stats = { caught: 0, bumps: 0, delivered: 0, stuns: 0, saved: 0 };
    state.boxCount = 0;
    mort.carry = [];
    state.bumpCombo = 0;
    Object.assign(buford, { x: rand(250, 550), y: -90, vx: 0, stun: 0, windup: 0, throwT: 0.8, leaving: false, retarget: 0 });
    buford.targetX = buford.x;
    setMode('intro');
  }

  function addScore(n) {
    state.score += n;
    while (state.score >= state.nextLife) {
      state.nextLife += EXTRA_LIFE_EVERY;
      const leaf = state.lives < MAX_LIVES, shoes = state.shoes < MAX_SHOES;
      if (leaf) state.lives++;
      if (shoes) state.shoes++;
      if (leaf || shoes) {
        popup(mort.x, mort.y - 160, leaf && shoes ? 'EXTRA LEAF + MOON SHOES!' : leaf ? 'EXTRA LEAF!' : 'EXTRA MOON SHOES!', '#7dffb0', 10, 1.8);
        sfx.oneUp();
      }
    }
    if (!state.demo && state.score > state.high) {
      state.high = state.score;
      state.newHigh = true;
    }
  }

  function popup(x, y, str, color, size = 10, life = 1.1) {
    state.popups.push({ x, y, text: str, color, size, life, max: life });
  }

  function spawn(p) {
    if (state.particles.length > 700) return;
    state.particles.push(Object.assign({ x: 0, y: 0, vx: 0, vy: 0, life: 1, max: 1, size: 3, color: '#fff', g: 0, type: 'dot', rot: 0, vr: 0, drag: 0 }, p, { max: p.life || 1 }));
  }

  // ---------------------------------------------------------------------------
  // Globes
  // ---------------------------------------------------------------------------
  const GLOBE_HUES = [190, 285, 330, 45, 150, 210];

  function throwGlobe() {
    const b = buford;
    const g = {
      x: b.x + 18, y: b.y - 46, r: 15,
      vx: rand(-1, 1) * Math.min(110 + state.level * 10, 180), vy: rand(-170, -70),
      hue: GLOBE_HUES[Math.floor(Math.random() * GLOBE_HUES.length)],
      rot: rand(0, TAU), bumped: false, state: 'fly', age: 0,
    };
    // keep throws heading somewhere catchable
    if (g.x < 160) g.vx = Math.abs(g.vx);
    if (g.x > PLAY_R - 160) g.vx = -Math.abs(g.vx);
    state.globes.push(g);
    b.throwT = throwInterval();
    sfx.throw();
  }

  function bumpGlobe(g) {
    const hy = mort.y - HAT_TOP;
    const off = clamp((g.x - mort.x) / HAT_HALF, -1, 1);
    const lift = Math.max(0, -mort.vy) * BUMP_LIFT;
    g.vy = -(BUMP_V + lift + rand(-12, 12));
    g.vx = off * 150 + mort.vx * 0.15;
    g.y = hy - g.r;
    g.bumped = true;
    mort.squash = 1;
    mort.armUp = 0.35;
    state.stats.bumps++;
    state.bumpCombo++;
    addScore(5);
    popup(g.x, g.y - 20, '+$5', '#ffe066', 10, 0.9);
    sfx.bump(state.bumpCombo);
    for (let i = 0; i < 10; i++) {
      const a = rand(Math.PI, TAU);
      spawn({ x: g.x, y: hy, vx: Math.cos(a) * rand(60, 160), vy: Math.sin(a) * rand(60, 160), life: rand(0.3, 0.6), color: `hsl(${g.hue},100%,80%)`, size: rand(1.5, 3), type: 'spark', drag: 3 });
    }
  }

  function mortSpeed() { return state.shoesT > 0 ? MORT_SPEED * SHOES_BOOST : MORT_SPEED; }

  function activateShoes() {
    if (!inGame() || state.shoesT > 0 || state.shoes <= 0) return;
    state.shoes--;
    state.shoesT = SHOES_TIME;
    popup(mort.x, mort.y - 150, 'MOON SHOES!', '#9ff3ff', 12, 1.5);
    popup(mort.x, mort.y - 132, '(definitely not hockey skates)', '#cfd8ff', 7, 1.8);
    sfx.shoes();
    for (let i = 0; i < 14; i++) spawn({ x: mort.x + rand(-16, 16), y: GROUND - 2, vx: rand(-120, 120), vy: rand(-140, -30), life: 0.6, color: '#dff6ff', size: rand(1.5, 3), g: 300, type: 'dot' });
  }

  function catchGlobe(g) {
    g.dead = true;
    mort.carry.push(g.hue);
    mort.squash = 0.6;
    state.stats.caught++;
    addScore(5);
    popup(g.x, mort.y - 130, '+$5 CAUGHT', '#ffe066', 9, 0.9);
    if (mort.carry.length >= MAX_CARRY) popup(mort.x, mort.y - 150, 'HANDS FULL - JUMP!', '#ffb0b0', 8, 1.4);
    sfx.caught();
    for (let i = 0; i < 8; i++) {
      const a = rand(0, TAU);
      spawn({ x: g.x, y: g.y, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, life: 0.35, color: `hsl(${g.hue},100%,85%)`, size: 2, type: 'spark', drag: 4 });
    }
  }

  function depositGlobes() {
    const n = mort.carry.length;
    state.boxCount += n;
    state.stats.delivered += n;
    addScore(10 * n);
    popup(BOX_X, GROUND - 70, `+$${10 * n} DELIVERED`, '#7dffea', 9, 1.3);
    sfx.deposit(n);
    for (const hue of mort.carry) {
      for (let i = 0; i < 10; i++) spawn({ x: BOX_X + rand(-14, 14), y: GROUND - 40, vx: rand(-60, 60), vy: rand(-160, -60), life: 0.6, color: `hsl(${hue},100%,80%)`, size: 2, g: 300, type: 'spark' });
    }
    mort.carry = [];
  }

  function stunBuford(g) {
    const b = buford;
    b.stun = 2.8;
    b.windup = 0;
    b.spin = 0;
    state.stats.stuns++;
    addScore(25);
    popup(b.x, b.y - 80, '+$25 STUNNED!', '#ff7ab8', 12, 1.4);
    sfx.stun();
    state.shake = 6;
    state.hitstop = 0.08;
    const cy = b.y - 12;
    let nx = g.x - b.x, ny = g.y - cy;
    const d = Math.hypot(nx, ny) || 1;
    nx /= d; ny /= d;
    g.vx = nx * 200;
    g.vy = Math.max(70, ny * 220);
    for (let i = 0; i < 16; i++) {
      const a = rand(0, TAU);
      spawn({ x: g.x, y: g.y, vx: Math.cos(a) * rand(80, 220), vy: Math.sin(a) * rand(80, 220), life: rand(0.4, 0.8), color: i % 2 ? '#ffe066' : '#ffffff', size: rand(3, 6), type: 'star', vr: rand(-8, 8), drag: 2 });
    }
  }

  function smashGlobe(g, atY = GROUND - 6) {
    g.dead = true;
    state.bumpCombo = 0;
    if (state.lives > 0) state.lives--;
    state.shake = 9;
    sfx.smash();
    popup(g.x, GROUND - 30, 'CRASH!', '#ff6b6b', 12, 1);
    for (let i = 0; i < 22; i++) {
      spawn({ x: g.x, y: atY, vx: rand(-200, 200), vy: rand(-320, -60), life: rand(0.8, 1.5), color: `hsla(${g.hue},90%,${rand(65, 90)}%,0.9)`, size: rand(3, 7), type: 'shard', g: 600, rot: rand(0, TAU), vr: rand(-12, 12) });
    }
    for (let i = 0; i < 10; i++) {
      spawn({ x: g.x + rand(-8, 8), y: atY, vx: rand(-80, 80), vy: rand(-180, -40), life: rand(0.6, 1.1), color: '#ffffff', size: rand(1.5, 3), g: 300, type: 'dot' });
    }
    if (state.mode === 'play' && !buford.leaving && buford.stun <= 0) {
      buford.grin = 1.2;
      popup(buford.x, buford.y - 84, 'HAW HAW!', '#ffd0a0', 10, 1.1);
      sfx.laugh();
    }
    if (state.lives <= 0 && state.overT <= 0) state.overT = GAME_OVER_DELAY;
  }

  function updateGlobes(dt) {
    const b = buford;
    const hy = mort.y - HAT_TOP;
    for (const g of state.globes) {
      if (g.state === 'beam') {
        g.bt += dt;
        if (g.bt < 0) continue;
        const t = clamp(g.bt / 1.1, 0, 1);
        const e = t * t * (3 - 2 * t);
        const cx = (g.sx + TX) / 2, cy = Math.min(g.sy, GROUND - 170) - 90;
        const tx = TX, ty = GROUND - 70;
        g.x = (1 - e) * (1 - e) * g.sx + 2 * (1 - e) * e * cx + e * e * tx;
        g.y = (1 - e) * (1 - e) * g.sy + 2 * (1 - e) * e * cy + e * e * ty;
        g.rot += dt * 8;
        g.scale = 1 - e * 0.7;
        if (Math.random() < 0.6) spawn({ x: g.x, y: g.y, vx: rand(-20, 20), vy: rand(-20, 20), life: 0.5, color: '#9ff3ff', size: 2.5, type: 'dot' });
        if (t >= 1) {
          g.dead = true;
          state.stats.saved++;
          addScore(10);
          popup(TX, GROUND - 150 - (state.stats.saved % 3) * 14, '+$10 SAVED', '#7dffea', 9, 1);
          sfx.saved(state.stats.saved);
          for (let i = 0; i < 12; i++) {
            const a = rand(0, TAU);
            spawn({ x: tx, y: ty, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120, life: 0.5, color: '#bffaff', size: 2, type: 'spark', drag: 3 });
          }
        }
        continue;
      }

      const prevBottom = g.y + g.r;
      g.vy += GLOBE_GRAVITY * dt;
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      g.rot += g.vx * dt * 0.02;
      g.age += dt;

      if (g.x < PLAY_L + g.r) { g.x = PLAY_L + g.r; g.vx = Math.abs(g.vx) * 0.9; sfx.wall(); }
      if (g.x > PLAY_R - g.r) { g.x = PLAY_R - g.r; g.vx = -Math.abs(g.vx) * 0.9; sfx.wall(); spawnBarrierSparks(g.y); }

      // On the ground with a free hand, Mort catches anything that touches him above the knees
      if (mort.onGround && mort.carry.length < MAX_CARRY && touchesMortAboveKnees(g)) {
        catchGlobe(g);
        continue;
      }

      // Mort's hat
      const bottom = g.y + g.r;
      const relVy = g.vy - mort.vy;
      const sweep = Math.max(0, bottom - prevBottom) + Math.max(0, -mort.vy * dt) + 16;
      if (relVy > 0 && bottom >= hy && bottom - hy <= sweep && Math.abs(g.x - mort.x) < HAT_HALF + g.r * 0.9) {
        if (!mort.onGround) { bumpGlobe(g); continue; }
        if (mort.carry.length < MAX_CARRY) { catchGlobe(g); continue; }
        // hands full: the globe slips right past him
        if (!g.slipped) {
          g.slipped = true;
          popup(mort.x, mort.y - 150, 'HANDS FULL!', '#ff9a9a', 10, 1.2);
        }
      }

      // Buford
      if (g.bumped && b.stun <= 0 && state.mode === 'play' && !b.leaving) {
        if (Math.hypot(g.x - b.x, g.y - (b.y - 12)) < g.r + 32) stunBuford(g);
      }

      if (g.y + g.r >= GROUND) smashGlobe(g);
    }
    state.globes = state.globes.filter((g) => !g.dead);
  }

  // Mort's catchable outline (relative to his feet): body/arms/head from the knees up, plus the hat.
  const MORT_CATCH_BOXES = [
    { l: -18, r: 18, t: -84, b: -14 },
    { l: -HAT_HALF, r: HAT_HALF, t: -HAT_TOP - 4, b: -80 },
  ];

  function touchesMortAboveKnees(g) {
    for (const box of MORT_CATCH_BOXES) {
      const nx = clamp(g.x, mort.x + box.l, mort.x + box.r);
      const ny = clamp(g.y, mort.y + box.t, mort.y + box.b);
      if (Math.hypot(g.x - nx, g.y - ny) < g.r) return true;
    }
    return false;
  }

  function spawnBarrierSparks(y) {
    for (let i = 0; i < 6; i++) spawn({ x: PLAY_R, y, vx: rand(-90, -20), vy: rand(-60, 60), life: 0.35, color: '#8ff6ff', size: 2, type: 'spark', drag: 4 });
  }

  // ---------------------------------------------------------------------------
  // Characters
  // ---------------------------------------------------------------------------
  function autopilot() {
    // Predict where each globe will meet the hat, then chase the soonest one we can still reach.
    const hy = mort.y - HAT_TOP;
    const landings = [];
    for (const g of state.globes) {
      if (g.state !== 'fly') continue;
      const dy = hy - (g.y + g.r);
      const disc = g.vy * g.vy + 2 * GLOBE_GRAVITY * dy;
      if (disc < 0) continue;
      const t = (-g.vy + Math.sqrt(disc)) / GLOBE_GRAVITY;
      if (t <= 0) continue;
      const lo = PLAY_L + g.r, hi = PLAY_R - g.r, span = hi - lo;
      let u = (g.x + g.vx * t - lo) % (2 * span);
      if (u < 0) u += 2 * span;
      landings.push({ t, x: lo + (u > span ? 2 * span - u : u) });
    }
    landings.sort((a, b) => a.t - b.t);
    const reachable = landings.find((l) => Math.abs(l.x - mort.x) / mortSpeed() < l.t - 0.05);
    const next = reachable || landings[0];
    const carry = mort.carry.length;
    if (!reachable && landings.length && mort.carry.length < MAX_CARRY) activateShoes();
    const boxTrip = (Math.abs(BOX_X - mort.x) / mortSpeed()) * 2 + 0.6;
    if (carry > 0 && (!next || next.t > boxTrip || (carry >= MAX_CARRY && next.t > 1.3))) return { x: BOX_X, jump: false };
    if (!next) return { x: buford.x, jump: false };
    const aim = Math.sign(buford.x - next.x) * 9;
    const jump = carry >= MAX_CARRY && next.t < 0.24 && Math.abs(next.x - mort.x) < 30;
    return { x: next.x - aim, jump };
  }

  function updateMort(dt) {
    let dir = 0;
    const SPEED = mortSpeed();
    if (state.demo) {
      const ap = autopilot();
      if (ap.jump) input.jumpBuf = 0.1;
      const tx = ap.x;
      mort.vx += (clamp((tx - mort.x) * 8, -SPEED, SPEED) - mort.vx) * Math.min(1, dt * 14);
    } else {
      if (input.left) dir -= 1;
      if (input.right) dir += 1;
      if (dir !== 0) {
        input.pointer = false;
        mort.vx += (dir * SPEED - mort.vx) * Math.min(1, dt * 12);
      } else if (input.pointer) {
        const desired = clamp((input.px - mort.x) * 8, -SPEED, SPEED);
        mort.vx += (desired - mort.vx) * Math.min(1, dt * 14);
      } else {
        mort.vx *= 1 - Math.min(1, dt * 10);
      }
    }
    mort.x += mort.vx * dt;
    if (mort.x < PLAY_L + 22) { mort.x = PLAY_L + 22; mort.vx = 0; }
    if (mort.x > BOX_X + 10) { mort.x = BOX_X + 10; mort.vx = 0; }
    if (mort.carry.length > 0 && Math.abs(mort.x - BOX_X) < 26) depositGlobes();

    if (input.jumpBuf > 0) input.jumpBuf -= dt;
    if (input.jumpBuf > 0 && mort.onGround) {
      input.jumpBuf = 0;
      mort.vy = -JUMP_V;
      mort.onGround = false;
      sfx.jump();
      for (let i = 0; i < 8; i++) spawn({ x: mort.x + rand(-14, 14), y: GROUND, vx: rand(-60, 60), vy: rand(-80, -20), life: 0.5, color: '#ffffff', size: rand(1.5, 3), g: 200, type: 'dot' });
    }
    mort.vy += MORT_GRAVITY * dt;
    mort.y += mort.vy * dt;
    if (mort.y >= GROUND) {
      if (!mort.onGround && mort.vy > 200) {
        for (let i = 0; i < 6; i++) spawn({ x: mort.x + rand(-14, 14), y: GROUND, vx: rand(-70, 70), vy: rand(-60, -10), life: 0.4, color: '#ffffff', size: 2, g: 200, type: 'dot' });
      }
      mort.y = GROUND; mort.vy = 0; mort.onGround = true;
    }
    if (Math.abs(mort.vx) > 25) mort.facing = Math.sign(mort.vx);
    mort.walkT += Math.abs(mort.vx) * dt * (state.shoesT > 0 ? 0.02 : 0.06); // long skating strides
    if (state.shoesT > 0) {
      const was = state.shoesT;
      state.shoesT = Math.max(0, state.shoesT - dt);
      if (mort.onGround && Math.abs(mort.vx) > 300 && Math.random() < 0.8) {
        spawn({ x: mort.x - Math.sign(mort.vx) * 12, y: GROUND - 2, vx: -mort.vx * rand(0.1, 0.25), vy: rand(-120, -40), life: rand(0.3, 0.5), color: '#e8f8ff', size: rand(1.5, 2.5), g: 400, type: 'dot' });
      }
      if (was > 0 && state.shoesT === 0) popup(mort.x, mort.y - 140, 'SHOES OFF', '#cfd8ff', 8, 1);
    }
    mort.squash = Math.max(0, mort.squash - dt * 6);
    mort.armUp = Math.max(0, mort.armUp - dt);
  }

  function updateBuford(dt) {
    const b = buford;
    b.flap += dt * (b.stun > 0 ? 3 : 12);
    b.grin = Math.max(0, b.grin - dt);

    if (b.leaving) {
      if (state.modeT > 0.9) {
        b.y -= dt * 260 * Math.min(1, (state.modeT - 0.9) * 2);
        b.x += Math.sin(state.t * 8) * 40 * dt;
      }
      jetFlame(b, 1.4);
      return;
    }

    if (b.stun > 0) {
      b.stun -= dt;
      b.spin += dt * 9;
      b.y += (b.baseY + 46 - b.y) * Math.min(1, dt * 3);
      if (Math.random() < dt * 14) spawn({ x: b.x + rand(-20, 20), y: b.y + 24, vx: rand(-20, 20), vy: rand(10, 40), life: 0.9, color: 'rgba(160,160,180,0.5)', size: rand(5, 9), type: 'smoke' });
      return;
    }

    const targetY = state.mode === 'intro' ? b.baseY : b.baseY + Math.sin(state.t * 2.2) * 9;
    b.y += (targetY - b.y) * Math.min(1, dt * (state.mode === 'intro' ? 2.2 : 4));

    b.retarget -= dt;
    if (Math.abs(b.targetX - b.x) < 10 || b.retarget <= 0) {
      b.targetX = rand(80, PLAY_R - 80);
      b.retarget = rand(1.5, 3.5);
    }
    const sp = 75 + state.level * 12;
    b.vx += (Math.sign(b.targetX - b.x) * sp - b.vx) * Math.min(1, dt * 2.5);
    b.x = clamp(b.x + b.vx * dt, 60, PLAY_R - 60);

    jetFlame(b, 1);

    if (state.mode !== 'play' || state.overT > 0) return;
    if (b.windup > 0) {
      b.windup -= dt;
      if (b.windup <= 0) throwGlobe();
    } else {
      b.throwT -= dt;
      if (b.throwT <= 0 && flyingCount() < maxActive()) b.windup = 0.45;
    }
  }

  function jetFlame(b, power) {
    if (b.stun > 0) return;
    for (const s of [-1, 1]) {
      if (Math.random() < 0.7) {
        spawn({ x: b.x + s * 24, y: b.y + 26, vx: rand(-15, 15), vy: rand(120, 200) * power, life: rand(0.15, 0.3), color: Math.random() < 0.5 ? '#ffb347' : '#ffe680', size: rand(2, 4), type: 'dot' });
      }
    }
  }

  function updateMilo(dt) {
    milo.t += dt;
    const hitting = state.mode === 'play' || state.mode === 'intro';
    const phase = Math.sin(milo.t * 9);
    if (hitting && phase > 0.95 && milo.t - milo.lastHit > 0.4) {
      milo.lastHit = milo.t;
      for (let i = 0; i < 7; i++) spawn({ x: milo.x + 20, y: GROUND - 46, vx: rand(10, 120), vy: rand(-150, 10), life: rand(0.2, 0.45), color: i % 2 ? '#fff3a0' : '#ffb347', size: 1.8, g: 500, type: 'spark' });
    }
  }

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------
  function update(dt) {
    state.t += dt;
    state.modeT += dt;
    state.shake = Math.max(0, state.shake - dt * 30);

    for (const f of flakes) {
      f.y += f.s * dt;
      f.x += Math.sin(state.t * 0.8 + f.ph) * 12 * dt;
      if (f.y > H + 4) { f.y = -4; f.x = rand(0, W); }
    }

    let gdt = dt;
    if (state.hitstop > 0) { state.hitstop -= dt; gdt = 0; }

    switch (state.mode) {
      case 'title':
        buford.flap += dt * 12;
        mort.walkT += dt * 2;
        if (state.modeT > 42) startGame(true); // attract mode
        break;
      case 'intro':
        updateMort(gdt);
        updateBuford(gdt);
        updateMilo(gdt);
        if (state.modeT > 2.4) setMode('play');
        break;
      case 'play':
        updateMort(gdt);
        updateBuford(gdt);
        updateGlobes(gdt);
        updateMilo(gdt);
        if (state.overT > 0) {
          state.overT -= dt;
          if (state.overT <= 0) {
            if (state.demo) { setMode('title'); state.demo = false; break; }
            setMode('over');
            if (state.newHigh) saveHigh(state.high);
            sfx.gameOver();
          }
        } else {
          state.progress += gdt / state.repairTime;
          if (state.progress >= 1) beginTeleport();
        }
        break;
      case 'teleport':
        updateMort(gdt);
        updateBuford(gdt);
        updateGlobes(gdt);
        updateMilo(gdt);
        if (state.globes.length === 0 && state.modeT > 2.6) {
          state.bonus = state.level * 50;
          addScore(state.bonus);
          if (state.newHigh) saveHigh(state.high);
          setMode('clear');
          if (!state.demo) sfx.oCanada();
        }
        break;
      case 'clear':
        updateMort(gdt);
        if (state.demo && state.modeT > 3) { state.level++; startLevel(); }
        break;
      case 'over':
        break;
    }

    for (const p of state.particles) {
      p.vy += p.g * dt;
      if (p.drag) { p.vx *= 1 - Math.min(1, p.drag * dt); p.vy *= 1 - Math.min(1, p.drag * dt); }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      p.life -= dt;
      if (p.type === 'shard' && p.y > GROUND + 4 && p.vy > 0) { p.y = GROUND + 4; p.vy *= -0.3; p.vx *= 0.6; p.vr *= 0.5; }
    }
    state.particles = state.particles.filter((p) => p.life > 0);
    for (const p of state.popups) { p.life -= dt; p.y -= 34 * dt; }
    state.popups = state.popups.filter((p) => p.life > 0);
  }

  function beginTeleport() {
    state.progress = 1;
    setMode('teleport');
    sfx.teleport();
    for (const hue of mort.carry) {
      state.globes.push({ x: mort.x, y: mort.y - 50, r: 15, vx: 0, vy: 0, hue, rot: 0, bumped: false, state: 'fly', age: 0 });
    }
    mort.carry = [];
    let i = 0;
    for (const g of state.globes) {
      g.state = 'beam';
      g.bt = -i * 0.14;
      g.sx = g.x;
      g.sy = Math.max(g.y, 20);
      i++;
    }
    buford.leaving = true;
    buford.windup = 0;
    buford.stun = 0;
    popup(buford.x, buford.y - 84, 'CURSES!', '#ffd0a0', 12, 1.6);
    popup(TX, GROUND - 210, 'TELEPORT!', '#7dffea', 12, 1.6);
  }

  // ---------------------------------------------------------------------------
  // Rendering: characters and props
  // ---------------------------------------------------------------------------
  function drawMort(c, m) {
    const air = GROUND - m.y;
    c.fillStyle = `rgba(40,40,100,${0.28 * Math.max(0.3, 1 - air / 200)})`;
    ell(c, m.x, GROUND + 3, 24 * Math.max(0.5, 1 - air / 250), 5);
    c.fill();

    c.save();
    c.translate(m.x, m.y);
    const sq = m.squash;
    c.scale(m.facing * (1 + sq * 0.12), 1 - sq * 0.1);
    const moving = Math.min(1, Math.abs(m.vx) / 150);
    const walk = m.onGround ? Math.sin(m.walkT) * moving : 0.5;

    const skates = state.shoesT > 0;
    if (skates && Math.abs(m.vx) > 300) { // speed lines
      c.strokeStyle = 'rgba(200,240,255,0.5)';
      c.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const ly = -30 - i * 22, len = 20 + ((state.t * 300 + i * 17) % 18);
        c.beginPath(); c.moveTo(-22, ly); c.lineTo(-22 - len, ly); c.stroke();
      }
    }

    // legs
    for (const s of [-1, 1]) {
      c.save();
      c.translate(s * 6, -26);
      c.rotate(m.onGround ? walk * 0.55 * s : s * 0.25);
      c.fillStyle = '#1b2244';
      roundRect(c, -5, 0, 10, 21, 3); c.fill();
      c.fillStyle = '#f4c430';
      c.fillRect(-1, 1, 2, 18);
      if (skates) drawSkate(c);
      else {
        c.fillStyle = '#3a2414';
        roundRect(c, -6, 17, 15, 8, 3); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.25)';
        c.fillRect(-4, 18, 9, 2);
      }
      c.restore();
    }

    const armAngle = m.armUp > 0 || !m.onGround ? -2.6 : -walk * 0.6;
    const drawArm = (x, a, dark) => {
      c.save();
      c.translate(x, -56);
      c.rotate(a);
      c.fillStyle = dark ? '#9c1018' : '#d81f28';
      roundRect(c, -4.5, 0, 9, 19, 4); c.fill();
      c.fillStyle = '#5a3418';
      c.beginPath(); c.arc(0, 21, 4.5, 0, TAU); c.fill();
      c.restore();
    };
    drawArm(-12, m.armUp > 0 || !m.onGround ? 2.6 : walk * 0.6, true);

    // red serge tunic
    const g = c.createLinearGradient(-16, -62, 16, -24);
    g.addColorStop(0, '#ef2b33');
    g.addColorStop(1, '#a3111a');
    c.fillStyle = g;
    roundRect(c, -15, -62, 30, 38, 8); c.fill();
    c.fillStyle = '#1b2244';
    roundRect(c, -8, -63, 16, 6, 3); c.fill(); // collar
    c.strokeStyle = '#6b3d1c';
    c.lineWidth = 3;
    c.beginPath(); c.moveTo(-11, -60); c.lineTo(12, -33); c.stroke(); // Sam Browne strap
    c.fillStyle = '#6b3d1c';
    c.fillRect(-15, -33, 30, 5);
    c.fillStyle = '#ffd36b';
    c.fillRect(-3, -33, 6, 5);
    for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(-2, -54 + i * 8, 1.6, 0, TAU); c.fill(); }

    // head
    c.fillStyle = '#f5c79c';
    c.beginPath(); c.arc(1, -72, 12, 0, TAU); c.fill();
    c.fillStyle = '#e8a87c';
    c.beginPath(); c.arc(-9, -71, 3.5, 0, TAU); c.fill(); // ear
    c.fillStyle = '#1b1430';
    c.beginPath(); c.ellipse(6, -74, 1.8, 2.4, 0, 0, TAU); c.fill();
    c.fillStyle = '#ffffff';
    c.fillRect(6, -75.5, 1, 1);
    c.fillStyle = '#ff9a8a';
    c.beginPath(); c.arc(8, -69, 2.5, 0, TAU); c.fill(); // rosy cheek
    c.fillStyle = '#6b3d1c';
    c.beginPath(); // mustache
    c.moveTo(4, -67); c.quadraticCurveTo(9, -70, 14, -66); c.quadraticCurveTo(9, -66, 4, -65); c.fill();
    c.strokeStyle = '#7a2a2a';
    c.lineWidth = 1.3;
    c.beginPath(); c.arc(9, -64, 3, 0.2, 1.4); c.stroke();

    // campaign hat (with the famous "lemon squeezer" pinch)
    const hg = c.createLinearGradient(0, -100, 0, -80);
    hg.addColorStop(0, '#c08446');
    hg.addColorStop(1, '#8a5a2b');
    c.fillStyle = hg;
    c.beginPath();
    c.moveTo(-14, -83);
    c.lineTo(-11, -97);
    c.quadraticCurveTo(-6, -102, 0, -96.5);
    c.quadraticCurveTo(6, -102, 11, -97);
    c.lineTo(14, -83);
    c.closePath();
    c.fill();
    c.fillStyle = '#4a2a14';
    c.fillRect(-14, -87, 28, 4);
    c.fillStyle = '#9a6633';
    ell(c, 0, -82, HAT_HALF, 5); c.fill();
    c.fillStyle = 'rgba(255,230,180,0.35)';
    ell(c, -6, -83.5, 18, 1.8); c.fill();

    m.carry.forEach((hue, i) => drawGlobeShape(c, 13 - i * 9, -44 - i * 13, 11, hue, i * 1.7));
    drawArm(10, m.carry.length && m.onGround && m.armUp <= 0 ? -1.35 : armAngle, false);
    c.restore();
  }

  // Moon shoes. Any resemblance to hockey skates is purely coincidental.
  function drawSkate(c) {
    c.fillStyle = '#16161e';
    c.beginPath();
    c.moveTo(-6, 12); c.lineTo(4, 12); c.lineTo(5, 18);
    c.quadraticCurveTo(12, 19, 12, 24); c.lineTo(-7, 24); c.lineTo(-7, 14);
    c.closePath(); c.fill();
    c.fillStyle = '#e3242b';
    c.fillRect(-7, 21, 19, 2);
    c.strokeStyle = '#ffffff';
    c.lineWidth = 0.8;
    for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-2, 14 + i * 2.5); c.lineTo(4, 14 + i * 2.5); c.stroke(); }
    c.fillStyle = '#cfd4e6';
    c.fillRect(-4, 24, 2, 2.5);
    c.fillRect(8, 24, 2, 2.5);
    const bg = c.createLinearGradient(0, 26, 0, 29);
    bg.addColorStop(0, '#ffffff');
    bg.addColorStop(1, '#8a92b0');
    c.fillStyle = bg;
    c.beginPath();
    c.moveTo(-7, 26.5); c.lineTo(11, 26.5); c.quadraticCurveTo(14, 26.5, 13, 28.5); c.lineTo(-6, 28.5);
    c.closePath(); c.fill();
  }

  function drawShoeButton(c) {
    const { x, y, w, h } = SHOE_BTN;
    const active = state.shoesT > 0;
    const usable = !active && state.shoes > 0;
    c.save();
    roundRect(c, x, y, w, h, 8);
    c.fillStyle = active ? 'rgba(40,90,140,0.85)' : 'rgba(14,12,44,0.75)';
    c.fill();
    c.lineWidth = 2;
    c.strokeStyle = usable ? `rgba(160,240,255,${0.6 + Math.sin(state.t * 4) * 0.25})` : 'rgba(160,190,255,0.35)';
    c.stroke();
    c.translate(x + 20, y - 5);
    c.scale(1.1, 1.1);
    drawSkate(c);
    c.restore();
    text(c, `x${state.shoes}`, x + 44, y + 13, 10, state.shoes > 0 ? '#ffffff' : '#7a7f9a', 'left');
    text(c, 'S', x + w - 10, y + 13, 7, '#9ff3ff', 'right', null);
    if (active) {
      const k = state.shoesT / SHOES_TIME;
      roundRect(c, x + 44, y + 22, (w - 52) * k, 5, 2.5);
      c.fillStyle = state.shoesT < 2 && Math.floor(state.t * 8) % 2 ? '#ff7a7a' : '#7dffea';
      c.fill();
    } else {
      text(c, 'MOON SHOES', x + 44, y + 25, 6, '#cfd8ff', 'left', null);
    }
  }

  function drawBuford(c, b) {
    c.save();
    c.translate(b.x, b.y);
    if (b.stun > 0) c.rotate(Math.sin(b.spin) * 0.35);
    else c.rotate(clamp(b.vx / 600, -0.15, 0.15));

    // jetpack tanks
    for (const s of [-1, 1]) {
      const tg = c.createLinearGradient(s * 30, 0, s * 18, 0);
      tg.addColorStop(0, '#5e6680');
      tg.addColorStop(1, '#c5cbe0');
      c.fillStyle = tg;
      roundRect(c, s * 24 - 7, -18, 14, 40, 6); c.fill();
      c.fillStyle = '#3a3f55';
      c.fillRect(s * 24 - 5, 20, 10, 6);
      c.fillStyle = '#b22234'; // contraband stripes
      c.fillRect(s * 24 - 7, -8, 14, 3);
      c.fillStyle = '#3c3b6e';
      c.fillRect(s * 24 - 7, -3, 14, 3);
      if (b.stun <= 0) {
        const fl = 14 + Math.random() * 10 + (b.leaving ? 14 : 0);
        const fg = c.createLinearGradient(0, 26, 0, 26 + fl);
        fg.addColorStop(0, 'rgba(255,255,220,0.95)');
        fg.addColorStop(0.4, 'rgba(255,180,70,0.85)');
        fg.addColorStop(1, 'rgba(255,90,40,0)');
        c.fillStyle = fg;
        c.beginPath(); c.moveTo(s * 24 - 5, 26); c.lineTo(s * 24 + 5, 26); c.lineTo(s * 24, 26 + fl); c.closePath(); c.fill();
      }
    }

    // feet
    c.fillStyle = '#ff9a1f';
    ell(c, -10, 30, 9, 4, 0.2); c.fill();
    ell(c, 10, 30, 9, 4, -0.2); c.fill();

    // body
    const bg = c.createRadialGradient(-8, -10, 4, 0, 0, 36);
    bg.addColorStop(0, '#3a3f5c');
    bg.addColorStop(1, '#10121f');
    c.fillStyle = bg;
    ell(c, 0, 2, 25, 30); c.fill();
    c.fillStyle = '#f4f6ff';
    ell(c, 0, 8, 16, 21); c.fill();
    c.strokeStyle = 'rgba(120,120,150,0.6)'; // costume zipper
    c.lineWidth = 1;
    c.setLineDash([2, 2]);
    c.beginPath(); c.moveTo(0, -12); c.lineTo(0, 26); c.stroke();
    c.setLineDash([]);

    // flippers
    const flap = Math.sin(b.flap) * 0.35;
    c.fillStyle = '#1a1d30';
    c.save(); c.translate(-23, -6); c.rotate(0.5 + flap); ell(c, 0, 12, 6, 15); c.fill(); c.restore();
    c.save();
    c.translate(23, -6);
    if (b.windup > 0) {
      c.rotate(-2.6);
      ell(c, 0, 12, 6, 15); c.fill();
      c.restore();
      drawGlobeShape(c, 34, -50, 13, 200, state.t * 3, 1);
    } else {
      c.rotate(-0.5 - flap); ell(c, 0, 12, 6, 15); c.fill(); c.restore();
    }

    // head
    c.fillStyle = '#161927';
    c.beginPath(); c.arc(0, -32, 20, 0, TAU); c.fill();
    // face hole showing a very un-penguin-like face
    c.fillStyle = '#f2b98f';
    ell(c, 0, -29, 13, 12); c.fill();
    c.fillStyle = 'rgba(90,60,50,0.35)'; // five o'clock shadow
    ell(c, 0, -23, 11, 6); c.fill();
    if (b.stun > 0) {
      c.strokeStyle = '#2a1a1a';
      c.lineWidth = 1.6;
      for (const ex of [-5, 5]) {
        c.beginPath(); c.moveTo(ex - 2.5, -34); c.lineTo(ex + 2.5, -29); c.moveTo(ex + 2.5, -34); c.lineTo(ex - 2.5, -29); c.stroke();
      }
      c.fillStyle = '#5a1a1a';
      ell(c, 0, -22, 3, 2.5); c.fill();
    } else {
      c.fillStyle = '#fff';
      ell(c, -5, -31, 3, 3); c.fill();
      ell(c, 5, -31, 3, 3); c.fill();
      c.fillStyle = '#1b1430';
      const look = clamp((mort.x - b.x) / 300, -1, 1) * 1.2;
      c.beginPath(); c.arc(-5 + look, -30.5, 1.5, 0, TAU); c.arc(5 + look, -30.5, 1.5, 0, TAU); c.fill();
      c.strokeStyle = '#3a2016';
      c.lineWidth = 2;
      c.beginPath(); c.moveTo(-9, -37); c.lineTo(-2, -34.5); c.moveTo(9, -37); c.lineTo(2, -34.5); c.stroke(); // scheming brows
      c.fillStyle = '#5a1a1a';
      c.beginPath();
      if (b.grin > 0) { c.arc(0, -24, 5.5, 0, Math.PI); } else { c.arc(0, -25, 4.5, 0.15, Math.PI - 0.15); }
      c.fill();
      c.fillStyle = '#fff';
      c.fillRect(-3, -24, 6, 1.6);
    }
    // beak of the costume hood
    c.fillStyle = '#ff9a1f';
    c.beginPath(); c.moveTo(-8, -45); c.quadraticCurveTo(0, -36, 8, -45); c.quadraticCurveTo(0, -50, -8, -45); c.fill();
    c.fillStyle = '#fff';
    c.beginPath(); c.arc(-9, -45, 3.5, 0, TAU); c.arc(9, -45, 3.5, 0, TAU); c.fill();
    c.fillStyle = '#111';
    c.beginPath(); c.arc(-9, -45, 1.6, 0, TAU); c.arc(9, -45, 1.6, 0, TAU); c.fill();
    c.restore();

    if (b.stun > 0) {
      for (let i = 0; i < 3; i++) {
        const a = b.spin * 0.7 + (i * TAU) / 3;
        star(c, b.x + Math.cos(a) * 26, b.y - 62 + Math.sin(a) * 6, 6, '#ffe066', b.spin);
      }
    }
  }

  function drawMilo(c, t) {
    const x = milo.x, y = GROUND;
    const working = state.mode === 'play' || state.mode === 'intro';
    const swing = working ? Math.sin(t * 9) : 0;
    c.save();
    c.translate(x, y);
    c.fillStyle = 'rgba(40,40,100,0.25)';
    ell(c, 0, 3, 16, 4); c.fill();
    c.fillStyle = '#2d3550';
    c.fillRect(-8, -18, 7, 16);
    c.fillRect(2, -18, 7, 16);
    c.fillStyle = '#2a1a10';
    roundRect(c, -9, -4, 9, 5, 2); c.fill();
    roundRect(c, 1, -4, 10, 5, 2); c.fill();
    const g = c.createLinearGradient(0, -44, 0, -16);
    g.addColorStop(0, '#ff9b3d');
    g.addColorStop(1, '#d4651a');
    c.fillStyle = g;
    roundRect(c, -11, -42, 22, 26, 6); c.fill();
    c.fillStyle = '#cfd8ff';
    c.fillRect(-11, -30, 22, 3); // reflective stripe
    c.fillStyle = '#f2c094';
    c.beginPath(); c.arc(1, -50, 10, 0, TAU); c.fill();
    c.fillStyle = '#2b2b40';
    c.fillRect(-8, -53, 18, 3);
    c.fillStyle = '#8ff6ff';
    ell(c, 6, -52, 4, 3.4); c.fill();
    c.fillStyle = '#4a2a14';
    c.beginPath(); c.arc(4, -45, 2, 0, Math.PI); c.fill();
    c.fillStyle = '#ffd23f'; // hard hat
    c.beginPath(); c.arc(1, -56, 10.5, Math.PI, TAU); c.fill();
    c.fillRect(-11, -57, 24, 3);
    c.fillStyle = '#e3242b';
    mapleLeaf(c, 1, -61, 3.2, '#e3242b');
    // arm + wrench
    c.save();
    c.translate(7, -38);
    c.rotate(-0.9 + swing * 0.6);
    c.fillStyle = '#e57828';
    roundRect(c, -3.5, 0, 7, 15, 3); c.fill();
    c.fillStyle = '#9aa3c0';
    c.fillRect(-1.5, 13, 3, 14);
    c.beginPath(); c.arc(0, 28, 4.5, 0, TAU); c.fill();
    c.fillStyle = '#e57828';
    c.fillRect(-1.5, 28, 3, 5);
    c.restore();
    c.restore();
  }

  function drawBox(c, t) {
    const x = BOX_X, y = GROUND;
    c.fillStyle = 'rgba(40,40,100,0.25)';
    ell(c, x, y + 3, 26, 5); c.fill();
    // globes peeking out of the top
    const shown = Math.min(state.boxCount || 0, 4);
    for (let i = 0; i < shown; i++) drawGlobeShape(c, x - 12 + i * 8, y - 40 + (i % 2) * 3, 9, GLOBE_HUES[i % GLOBE_HUES.length], i);
    const g = c.createLinearGradient(x - 22, 0, x + 22, 0);
    g.addColorStop(0, '#8a5a2b');
    g.addColorStop(0.5, '#b07a40');
    g.addColorStop(1, '#7a4a22');
    c.fillStyle = g;
    roundRect(c, x - 22, y - 38, 44, 38, 4); c.fill();
    c.strokeStyle = '#4a2a14';
    c.lineWidth = 2;
    c.strokeRect(x - 20, y - 36, 40, 34);
    c.beginPath(); c.moveTo(x - 20, y - 19); c.lineTo(x + 20, y - 19); c.stroke();
    c.fillStyle = '#f4f8ff';
    roundRect(c, x - 24, y - 42, 48, 6, 3); c.fill(); // snow on the rim
    mapleLeaf(c, x, y - 18, 9, '#e3242b');
    // bobbing arrow when Mort has globes to drop off
    if (mort.carry.length > 0 && inGame()) {
      const by = y - 66 + Math.sin(t * 6) * 5;
      c.fillStyle = Math.floor(t * 4) % 2 ? '#7dffb0' : '#ffffff';
      c.beginPath(); c.moveTo(x - 9, by); c.lineTo(x + 9, by); c.lineTo(x, by + 11); c.closePath(); c.fill();
      text(c, 'DROP', x, by - 9, 7, '#7dffb0');
    }
  }

  function drawBarrier(c, t) {
    const g = c.createLinearGradient(PLAY_R - 8, 0, PLAY_R + 8, 0);
    g.addColorStop(0, 'rgba(120,240,255,0)');
    g.addColorStop(0.5, 'rgba(140,245,255,0.38)');
    g.addColorStop(1, 'rgba(120,240,255,0)');
    c.fillStyle = g;
    c.fillRect(PLAY_R - 8, 40, 16, GROUND - 40);
    c.fillStyle = 'rgba(200,255,255,0.7)';
    for (let i = 0; i < 8; i++) {
      const yy = 40 + ((t * 70 + i * 55) % (GROUND - 40));
      c.fillRect(PLAY_R - 1, yy, 2, 12);
    }
    c.fillStyle = '#6d7396';
    roundRect(c, PLAY_R - 7, GROUND - 14, 14, 16, 3); c.fill();
    c.fillStyle = '#8ff6ff';
    c.fillRect(PLAY_R - 3, GROUND - 10, 6, 3);
  }

  function drawTeleporter(c, t) {
    const x = TX, y = GROUND;
    const p = state.progress;
    const ready = state.mode === 'teleport';

    if (ready) {
      const bg = c.createLinearGradient(x - 40, 0, x + 40, 0);
      bg.addColorStop(0, 'rgba(120,250,255,0)');
      bg.addColorStop(0.5, `rgba(180,255,255,${0.45 + Math.sin(t * 20) * 0.1})`);
      bg.addColorStop(1, 'rgba(120,250,255,0)');
      c.fillStyle = bg;
      c.fillRect(x - 40, 0, 80, y - 6);
    }

    c.fillStyle = '#3d4263';
    ell(c, x, y - 2, 62, 11); c.fill();
    c.fillStyle = '#7b82ad';
    ell(c, x, y - 6, 56, 9); c.fill();
    const glowA = 0.15 + p * 0.55 + (ready ? 0.3 : 0);
    c.fillStyle = `rgba(130,245,255,${glowA})`;
    ell(c, x, y - 7, 44, 6.5); c.fill();

    for (const s of [-1, 1]) {
      const px = x + s * 45;
      const pg = c.createLinearGradient(px - 6, 0, px + 6, 0);
      pg.addColorStop(0, '#5e6680');
      pg.addColorStop(0.5, '#d4d9ee');
      pg.addColorStop(1, '#5e6680');
      c.fillStyle = pg;
      roundRect(c, px - 6, y - 140, 12, 134, 4); c.fill();
      for (let i = 0; i < 5; i++) {
        const lit = p > (i + 1) / 6 || ready;
        c.fillStyle = lit ? '#8ff6ff' : '#2a2f48';
        c.fillRect(px - 2, y - 30 - i * 20, 4, 8);
      }
      const hue = lerp(0, 160, p);
      const og = c.createRadialGradient(px, y - 146, 1, px, y - 146, 16);
      og.addColorStop(0, `hsla(${hue},100%,85%,1)`);
      og.addColorStop(0.4, `hsla(${hue},100%,60%,0.7)`);
      og.addColorStop(1, `hsla(${hue},100%,50%,0)`);
      c.fillStyle = og;
      c.beginPath(); c.arc(px, y - 146, 16, 0, TAU); c.fill();
    }

    // crackling arcs between pylons
    if (p > 0.15 || ready) {
      const n = ready ? 4 : 1 + Math.floor(p * 3);
      c.strokeStyle = `rgba(170,250,255,${ready ? 0.9 : 0.25 + p * 0.5})`;
      c.lineWidth = 1.5;
      for (let k = 0; k < n; k++) {
        if (!ready && Math.random() > 0.5) continue;
        const yy = y - 40 - Math.random() * 90;
        c.beginPath();
        c.moveTo(x - 39, yy);
        for (let i = 1; i < 8; i++) c.lineTo(x - 39 + (78 * i) / 8, yy + rand(-8, 8));
        c.lineTo(x + 39, yy + rand(-4, 4));
        c.stroke();
      }
    }
    if (ready) {
      for (let i = 0; i < 4; i++) {
        const ry = y - 10 - ((t * 120 + i * 40) % 160);
        c.strokeStyle = `rgba(200,255,255,${0.6 * (1 - (y - ry) / 180)})`;
        c.lineWidth = 2;
        ell(c, x, ry, 36, 6); c.stroke();
      }
    }

    // repair progress panel (hidden behind the story on the title screen)
    if (state.mode === 'title') return;
    const bx = 806, by = 222, bw = 134;
    roundRect(c, bx, by, bw, 40, 8);
    c.fillStyle = 'rgba(14,12,44,0.82)';
    c.fill();
    c.strokeStyle = 'rgba(160,190,255,0.5)';
    c.lineWidth = 2;
    c.stroke();
    text(c, ready ? 'READY!' : "MILO'S REPAIRS", bx + bw / 2, by + 12, 7, ready ? '#7dffea' : '#cfd8ff', 'center', null);
    roundRect(c, bx + 8, by + 22, bw - 16, 10, 4);
    c.fillStyle = '#20244a';
    c.fill();
    if (p > 0) {
      roundRect(c, bx + 8, by + 22, Math.max(8, (bw - 16) * p), 10, 4);
      const pg = c.createLinearGradient(bx, 0, bx + bw, 0);
      pg.addColorStop(0, '#ff5a6a');
      pg.addColorStop(0.5, '#ffd36b');
      pg.addColorStop(1, '#7dffb0');
      c.fillStyle = pg;
      c.fill();
    }
  }

  function drawGlobeShape(c, x, y, r, hue, rot, scaleK = 1) {
    c.save();
    c.translate(x, y);
    c.scale(scaleK, scaleK);
    const glow = c.createRadialGradient(0, 0, r * 0.6, 0, 0, r * 1.9);
    glow.addColorStop(0, `hsla(${hue},100%,70%,0.35)`);
    glow.addColorStop(1, `hsla(${hue},100%,70%,0)`);
    c.fillStyle = glow;
    c.beginPath(); c.arc(0, 0, r * 1.9, 0, TAU); c.fill();

    const body = c.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
    body.addColorStop(0, `hsla(${hue},90%,94%,0.95)`);
    body.addColorStop(0.55, `hsla(${hue},80%,64%,0.55)`);
    body.addColorStop(1, `hsla(${hue},85%,40%,0.9)`);
    c.fillStyle = body;
    c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();

    c.save();
    c.beginPath(); c.arc(0, 0, r - 1.5, 0, TAU); c.clip();
    c.fillStyle = 'rgba(255,255,255,0.85)';
    ell(c, 0, r * 0.95, r, r * 0.45); c.fill();
    c.rotate(rot);
    mapleLeaf(c, 0, -1, r * 0.42, 'rgba(225,30,45,0.9)');
    c.fillStyle = 'rgba(255,255,255,0.9)';
    for (let i = 0; i < 5; i++) {
      const a = i * 1.3 + 0.4;
      c.fillRect(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6, 1.6, 1.6);
    }
    c.restore();

    c.strokeStyle = `hsla(${hue},100%,92%,0.85)`;
    c.lineWidth = 1.5;
    c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.9)';
    ell(c, -r * 0.38, -r * 0.45, r * 0.3, r * 0.15, -0.6); c.fill();
    c.restore();
  }

  function drawParticles(c) {
    for (const p of state.particles) {
      const a = clamp(p.life / p.max, 0, 1);
      c.globalAlpha = a;
      switch (p.type) {
        case 'shard':
          c.save();
          c.translate(p.x, p.y);
          c.rotate(p.rot);
          c.fillStyle = p.color;
          c.beginPath(); c.moveTo(-p.size, -p.size * 0.5); c.lineTo(p.size, 0); c.lineTo(-p.size * 0.3, p.size * 0.7); c.closePath(); c.fill();
          c.restore();
          break;
        case 'star':
          star(c, p.x, p.y, p.size, p.color, p.rot);
          break;
        case 'spark':
          c.strokeStyle = p.color;
          c.lineWidth = p.size;
          c.lineCap = 'round';
          c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); c.stroke();
          break;
        case 'smoke':
          c.globalAlpha = a * 0.6;
          c.fillStyle = p.color;
          c.beginPath(); c.arc(p.x, p.y, p.size * (1.6 - a * 0.6), 0, TAU); c.fill();
          break;
        default:
          c.fillStyle = p.color;
          c.beginPath(); c.arc(p.x, p.y, p.size * (0.5 + a * 0.5), 0, TAU); c.fill();
      }
    }
    c.globalAlpha = 1;
  }

  function drawPopups(c) {
    for (const p of state.popups) {
      const age = p.max - p.life;
      const k = age < 0.12 ? 0.6 + (age / 0.12) * 0.6 : 1.2 - Math.min(0.2, (age - 0.12) * 1.5);
      c.globalAlpha = clamp(p.life / p.max * 2.5, 0, 1);
      c.save();
      c.translate(clamp(p.x, 60, W - 60), p.y);
      c.scale(k, k);
      text(c, p.text, 0, 0, p.size, p.color);
      c.restore();
    }
    c.globalAlpha = 1;
  }

  function drawHUD(c) {
    text(c, money(state.score), 18, 24, 18, '#ffe066', 'left');
    c.font = `18px ${FONT}`;
    const w = c.measureText(money(state.score)).width;
    text(c, 'CAD', 26 + w, 27, 9, '#ffb0b0', 'left');
    text(c, `(${money(usd(state.score))} USD)`, 18, 46, 8, '#a9b4e8', 'left');
    for (let i = 0; i < state.lives; i++) {
      mapleLeaf(c, 28 + i * 22, 68, 9.5, '#ff2d3b');
    }
    text(c, `LEVEL ${state.level}`, PLAY_R / 2 + 12, 22, 12, '#ffffff');
    text(c, `HI ${money(state.high)}`, W - 16, 22, 10, state.newHigh ? '#7dffb0' : '#cfd8ff', 'right');
    if (state.demo) text(c, 'DEMO - PRESS ANY KEY', PLAY_R / 2 + 12, 46, 9, Math.floor(state.t * 2) % 2 ? '#ffe066' : '#ffffff');
    if (Sound.muted) text(c, 'MUTED (M)', W - 16, 42, 7, '#ff9a9a', 'right');
    drawShoeButton(c);

    // markers for globes that went above the top of the screen
    for (const g of state.globes) {
      if (g.state === 'fly' && g.y < -g.r) {
        c.fillStyle = `hsl(${g.hue},100%,75%)`;
        c.beginPath(); c.moveTo(g.x, 6); c.lineTo(g.x - 7, 18); c.lineTo(g.x + 7, 18); c.closePath(); c.fill();
      }
    }
  }

  function drawTitle(c, t) {
    c.fillStyle = 'rgba(5,4,20,0.35)';
    c.fillRect(0, 0, W, H);

    const bob = Math.sin(t * 2) * 4;
    c.save();
    c.translate(W / 2, 74 + bob);
    for (const [s, x] of [[-1, -300], [1, 300]]) mapleLeaf(c, x, 18, 26, '#ff2d3b', s * 0.2 + Math.sin(t * 1.5) * 0.1);
    const g = c.createLinearGradient(0, -20, 0, 20);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#bcd0ff');
    c.shadowColor = 'rgba(120,180,255,0.8)';
    c.shadowBlur = 18;
    text(c, 'MOON MOUNTIE', 0, 0, 38, g, 'center', '#1a0f3a');
    const g2 = c.createLinearGradient(0, 30, 0, 80);
    g2.addColorStop(0, '#ff6a6a');
    g2.addColorStop(1, '#d8101e');
    text(c, 'MORT', 0, 58, 54, g2, 'center', '#ffffff');
    c.shadowBlur = 0;
    c.restore();

    panel(c, 116, 164, 728, 224);
    let y = 182;
    for (const para of STORY) {
      for (const line of wrapText(c, para, 692, 8)) {
        text(c, line, W / 2, y, 8, '#ffffff', 'center', null);
        y += 13;
      }
      y += 6;
    }

    if (Math.floor(t * 2.2) % 2 === 0) text(c, 'PRESS SPACE OR TAP TO START', W / 2, 408, 14, '#7dffb0');
    text(c, 'ARROWS / A D: MOVE    SPACE / UP: JUMP    S / DOWN: MOON SHOES', W / 2, 432, 8, '#cfd8ff');
    text(c, 'MOUSE OR TOUCH: SLIDE TO MOVE, TAP TO JUMP, TAP SKATE FOR SHOES', W / 2, 447, 8, '#cfd8ff');
    text(c, 'P: PAUSE    M: MUTE', W / 2, 462, 8, '#cfd8ff');
    text(c, `HIGH SCORE  ${money(state.high)} CAD  (${money(usd(state.high))} USD)`, W / 2, 486, 9, '#ffb0b0');
  }

  const STORY = [
    "The year is 2112, and Canada has terraformed the moon into a winter wonderland! As a member of the Royal Canadian Moon Police in New Newfoundland, Mort's job is to protect Moon Canada from crime.",
    'Unfortunately, American criminal Buford T. Bilgewater has managed to sneak past Moon Canadian customs by dressing up as a penguin. Now he intends to ruin the celebration of Moon Canada Day by destroying all of the delicate snow globes that are necessary for the festivities!',
    "In MOON MOUNTIE MORT, you help Mort catch the snow globes thrown by Buford and drop them in the collection box until Moon Mechanic Milo can fix the teleporter and whisk them off to safety! Mort can only carry two globes at a time, so when his hands are full, jump to bump globes back into the sky! Earn $5\u00a0Canadian ($3\u00a0American) for each globe you catch or bump, $10\u00a0Canadian ($6\u00a0American) for each globe you deliver, and $25\u00a0Canadian ($15\u00a0American) if you can stun Buford by hitting him with one of the globes! Can you save Moon Canada Day and beat your high score?",
  ];

  function wrapText(c, str, maxW, size) {
    c.font = `${size}px ${FONT}`;
    const lines = [];
    let line = '';
    for (const word of str.split(' ')) {
      const test = line ? line + ' ' + word : word;
      if (line && c.measureText(test).width > maxW) { lines.push(line); line = word; } else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }

  function drawIntro(c) {
    const t = state.modeT;
    const a = clamp(Math.min(t * 4, (2.4 - t) * 3), 0, 1);
    c.globalAlpha = a;
    panel(c, 220, 190, 520, 116);
    text(c, `LEVEL ${state.level}`, W / 2, 222, 26, '#ffe066');
    text(c, `MILO NEEDS ${Math.round(state.repairTime)} SECONDS`, W / 2, 258, 10, '#ffffff');
    text(c, 'TO FIX THE TELEPORTER. CATCH THOSE GLOBES!', W / 2, 278, 9, '#cfd8ff');
    c.globalAlpha = 1;
  }

  function drawClear(c) {
    const t = state.modeT;
    c.fillStyle = `rgba(5,4,20,${Math.min(0.45, t)})`;
    c.fillRect(0, 0, W, H);
    panel(c, 200, 110, 560, 316);
    text(c, 'GLOBES SAVED!', W / 2, 156, 24, '#7dffea');
    text(c, 'Happy Moon Canada Day, eh!', W / 2, 188, 9, '#ffffff', 'center', null);
    const rows = [
      ['GLOBES CAUGHT', `${state.stats.caught} x $5`],
      ['GLOBES BUMPED', `${state.stats.bumps} x $5`],
      ['GLOBES DELIVERED', `${state.stats.delivered} x $10`],
      ['GLOBES TELEPORTED', `${state.stats.saved} x $10`],
      ['BUFORD STUNS', `${state.stats.stuns} x $25`],
      ['LEVEL BONUS', money(state.bonus)],
    ];
    rows.forEach(([k, v], i) => {
      if (t < 0.4 + i * 0.2) return;
      text(c, k, 250, 218 + i * 22, 10, '#cfd8ff', 'left', null);
      text(c, v, 710, 218 + i * 22, 10, '#ffe066', 'right', null);
    });
    if (t > 1.6) {
      text(c, `TOTAL ${money(state.score)} CAD  (${money(usd(state.score))} USD)`, W / 2, 366, 11, '#ffffff');
    }
    if (t > 1.2 && !state.demo && Math.floor(t * 2.2) % 2 === 0) text(c, `PRESS SPACE FOR LEVEL ${state.level + 1}`, W / 2, 398, 10, '#7dffb0');
    for (let i = 0; i < 2; i++) {
      if (Math.random() < 0.3) {
        spawn({ x: rand(220, 740), y: 110, vx: rand(-30, 30), vy: rand(40, 90), life: 2.5, color: '#ff2d3b', size: rand(3, 5), type: 'star', vr: rand(-3, 3) });
      }
    }
  }

  function drawOver(c) {
    const t = state.modeT;
    c.fillStyle = `rgba(5,4,20,${Math.min(0.55, t)})`;
    c.fillRect(0, 0, W, H);
    panel(c, 190, 120, 580, 280);
    text(c, 'GAME OVER', W / 2, 162, 32, '#ff5a6a');
    text(c, 'Buford ruined Moon Canada Day... this time!', W / 2, 202, 9, '#ffffff', 'center', null);
    text(c, `FINAL SCORE ${money(state.score)} CAD`, W / 2, 246, 14, '#ffe066');
    text(c, `(that's ${money(usd(state.score))} American)`, W / 2, 272, 9, '#a9b4e8', 'center', null);
    text(c, `REACHED LEVEL ${state.level}`, W / 2, 302, 10, '#cfd8ff');
    if (state.newHigh) text(c, 'NEW HIGH SCORE!', W / 2, 332, 13, Math.floor(t * 4) % 2 ? '#7dffb0' : '#ffffff');
    if (t > 1.5 && Math.floor(t * 2.2) % 2 === 0) text(c, 'PRESS SPACE TO CONTINUE', W / 2, 372, 10, '#7dffb0');
  }

  function draw() {
    const c = ctx;
    c.setTransform(scale, 0, 0, scale, 0, 0);
    if (state.shake > 0) c.translate(rand(-state.shake, state.shake) * 0.5, rand(-state.shake, state.shake) * 0.5);

    c.drawImage(skyLayer, 0, 0, W, H);
    drawAurora(c, state.t);
    c.drawImage(landLayer, 0, 0, W, H);

    const t = state.t;
    drawBarrier(c, t);
    drawTeleporter(c, t);
    drawBox(c, t);
    drawMilo(c, milo.t);

    if (state.mode === 'title') {
      buford.x = 872; buford.y = 140 + Math.sin(t * 2.2) * 8;
      buford.stun = 0; buford.windup = 0; buford.leaving = false;
      drawBuford(c, buford);
      Object.assign(mort, { x: 90, y: GROUND, vx: 0, onGround: true, facing: 1 });
      drawMort(c, mort);
    } else {
      drawBuford(c, buford);
      drawMort(c, mort);
    }

    for (const g of state.globes) {
      if (g.state !== 'fly') continue;
      const k = clamp(1 - (GROUND - g.y) / 420, 0, 1);
      c.fillStyle = `hsla(${g.hue},80%,30%,${0.08 + k * 0.3})`;
      ell(c, g.x, GROUND + 3, g.r * (0.5 + k * 0.6), 3.5);
      c.fill();
    }
    for (const g of state.globes) drawGlobeShape(c, g.x, g.y, g.r, g.hue, g.rot, g.scale || 1);
    drawParticles(c);

    c.fillStyle = 'rgba(255,255,255,0.75)';
    for (const f of flakes) { c.beginPath(); c.arc(f.x, f.y, f.r, 0, TAU); c.fill(); }

    drawPopups(c);

    c.setTransform(scale, 0, 0, scale, 0, 0);
    const vg = c.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 1.05);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,10,0.5)');
    c.fillStyle = vg;
    c.fillRect(0, 0, W, H);

    switch (state.mode) {
      case 'title': drawTitle(c, t); break;
      case 'intro': drawHUD(c); drawIntro(c); break;
      case 'play': case 'teleport': drawHUD(c); break;
      case 'clear': drawHUD(c); drawClear(c); break;
      case 'over': drawHUD(c); drawOver(c); break;
    }

    if (state.paused) {
      c.fillStyle = 'rgba(5,4,20,0.55)';
      c.fillRect(0, 0, W, H);
      text(c, 'PAUSED', W / 2, H / 2 - 10, 28, '#ffffff');
      text(c, 'PRESS P TO RESUME', W / 2, H / 2 + 28, 10, '#cfd8ff');
    }
  }

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------
  const inGame = () => ['intro', 'play', 'teleport'].includes(state.mode);

  function primaryAction() {
    Sound.init();
    if (state.paused) { state.paused = false; return; }
    if (state.demo) { state.demo = false; state.globes = []; setMode('title'); return; }
    switch (state.mode) {
      case 'title': startGame(); break;
      case 'clear': if (state.modeT > 1.2) { state.level++; startLevel(); } break;
      case 'over': if (state.modeT > 1.5) setMode('title'); break;
      default: input.jumpBuf = 0.15;
    }
  }

  function togglePause() {
    if (!inGame() || state.demo) return;
    state.paused = !state.paused;
  }

  const KEYS_LEFT = ['ArrowLeft', 'KeyA'];
  const KEYS_RIGHT = ['ArrowRight', 'KeyD'];
  const KEYS_JUMP = ['Space', 'ArrowUp', 'KeyW', 'Enter'];

  window.addEventListener('keydown', (e) => {
    if ([...KEYS_LEFT, ...KEYS_RIGHT, ...KEYS_JUMP, 'ArrowDown'].includes(e.code)) e.preventDefault();
    if (state.mode === 'title') state.modeT = Math.min(state.modeT, 1); // reset attract timer
    if (e.code === 'KeyM') { Sound.init(); Sound.muted = !Sound.muted; return; }
    if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
    if (state.demo) { primaryAction(); return; }
    if (KEYS_LEFT.includes(e.code)) input.left = true;
    if (KEYS_RIGHT.includes(e.code)) input.right = true;
    if (KEYS_JUMP.includes(e.code) && !e.repeat) primaryAction();
    if ((e.code === 'KeyS' || e.code === 'ArrowDown') && !e.repeat && !state.paused) { Sound.init(); activateShoes(); }
  });
  window.addEventListener('keyup', (e) => {
    if (KEYS_LEFT.includes(e.code)) input.left = false;
    if (KEYS_RIGHT.includes(e.code)) input.right = false;
  });

  function toGameX(clientX) {
    const r = canvas.getBoundingClientRect();
    return ((clientX - r.left) / r.width) * W;
  }

  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse' || e.buttons) {
      const x = toGameX(e.clientX);
      if (e.pointerType === 'mouse' && Math.abs(x - input.px) < 1) return;
      input.px = x;
      input.pointer = true;
    }
  });
  function onShoeButton(e) {
    const r = canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W, y = ((e.clientY - r.top) / r.height) * H;
    const b = SHOE_BTN, pad = 8;
    return x >= b.x - pad && x <= b.x + b.w + pad && y >= b.y - pad && y <= b.y + b.h + pad;
  }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (inGame() && !state.demo && !state.paused && onShoeButton(e)) { Sound.init(); activateShoes(); return; }
    input.px = toGameX(e.clientX);
    if (inGame()) input.pointer = true;
    if (state.mode === 'title') state.modeT = Math.min(state.modeT, 1);
    primaryAction();
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  window.addEventListener('blur', () => {
    input.left = input.right = false;
    if (inGame() && !state.demo) state.paused = true;
  });
  window.addEventListener('resize', resize);
  window.addEventListener('beforeunload', () => { if (state.newHigh) saveHigh(state.high); });

  // ---------------------------------------------------------------------------
  // Main loop
  // ---------------------------------------------------------------------------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (!state.paused) update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  resize();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(renderLayers);
  requestAnimationFrame(frame);

  // exposed for automated smoke tests
  window.__mmm = { state, mort, buford, startGame, update, draw };
})();
