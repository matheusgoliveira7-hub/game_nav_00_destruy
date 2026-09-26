/* STAR MANIA — shmup fixo estilo Megamania | Canvas 2D + WebAudio | desktop + mobile */
(() => {
"use strict";
const W = 480, H = 640;
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const el = (id) => document.getElementById(id);
const uiScore = el("score"), uiHi = el("hi"), uiLevel = el("level"),
      uiLives = el("lives"), uiEnergy = el("energy-fill"),
      overlay = el("overlay"), ovTitle = el("ov-title"),
      ovMsg = el("ov-msg"), btnStart = el("btn-start");

// ---------- AUDIO (sintetizado, sem assets) ----------
const AudioSys = {
  ctx: null,
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
  },
  laser() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = "square";
    o.frequency.setValueAtTime(1400, t);
    o.frequency.exponentialRampToValueAtTime(180, t + 0.12);
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(g).connect(this.ctx.destination);
    o.start(t); o.stop(t + 0.13);
  },
  boom() { // explosão "crushing"
    if (!this.ctx) return;
    const t = this.ctx.currentTime, dur = 0.32;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.6);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = "lowpass";
    f.frequency.setValueAtTime(3200, t);
    f.frequency.exponentialRampToValueAtTime(120, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.32, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.ctx.destination);
    src.start(t);
    const o = this.ctx.createOscillator(), g2 = this.ctx.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(35, t + dur);
    g2.gain.setValueAtTime(0.18, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g2).connect(this.ctx.destination);
    o.start(t); o.stop(t + dur);
  },
  hurt() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(300, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.4);
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    o.connect(g).connect(this.ctx.destination);
    o.start(t); o.stop(t + 0.42);
  }
};

// ---------- SPRITES PIXEL ART (mapas 16x16, cores vibrantes) ----------
const PX = 2; // escala do pixel
function drawMap(map, pal, x, y, flashWhite) {
  for (let r = 0; r < map.length; r++) {
    const row = map[r];
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      if (ch === "." || ch === " ") continue;
      ctx.fillStyle = flashWhite ? "#ffffff" : (pal[ch] || "#fff");
      ctx.fillRect(Math.round(x + c * PX), Math.round(y + r * PX), PX, PX);
    }
  }
}

const SPR = {
  ship: [
    ".......ww.......",
    ".......ww.......",
    "......wwww......",
    "......wwww......",
    "......wwww......",
    "..c...wwww...c..",
    "..cc..wwww..cc..",
    "..cccwwwwwwccc..",
    ".wwwwwwwwwwwwww.",
    ".wWWWWWWWWWWWWw.",
    "wWWWWWWWWWWWWWWw",
    "wwwwwwwwwwwwwwww",
  ],
  shipPal: { w: "#00E5FF", W: "#FFFFFF", c: "#FF206E" },

  burger: [
    "................",
    ".....bbbbbb.....",
    "...bbbbbbbbbb...",
    "..bBBBBBBBBBBb..",
    "..bbbbbbbbbbbb..",
    "...llllllllll...",
    "..yyyyyyyyyyyy..",
    "..mmmmmmmmmmmm..",
    "..mMMMMMMMMMMm..",
    "...bbbbbbbbbb...",
    "....bbbbbbbb....",
    "................",
  ],
  burgerPal: { b: "#F2A541", B: "#FFE135", l: "#39D353", y: "#FFD60A", m: "#7A3B1E", M: "#A5522A" },

  cookie: [
    "................",
    ".....cccccc.....",
    "...cccccccccc...",
    "..cccccccccccc..",
    "..cckccccckccc..",
    ".cccccccccccccc.",
    ".ccckccccccckc..",
    ".cccccccccccccc.",
    ".cccccccckccccc.",
    "..ccccccckccc...",
    "..ccckccccccc...",
    "...cccccccccc...",
    ".....cccccc.....",
    "................",
  ],
  cookiePal: { c: "#D9A066", k: "#3A1F0D" },

  iron: [
    "................",
    "......hh........",
    ".....h.hh.......",
    "....hh..hhh.....",
    "...hhhhhhhhhhh..",
    "..dddddddddddd..",
    "..dDDDDDDDDDDd..",
    "..dddddddddddd..",
    "..dddddddddddd..",
    "...ssssssssss...",
    "................",
  ],
  ironPal: { h: "#9AA5B1", d: "#4CC9F0", D: "#90E0FF", s: "#FF6B35" },

  bow: [
    "................",
    "..rr......rr....",
    "..rrrr..rrrr....",
    "..rrrrrrrrrr....",
    "...rrrrrrrrrW...",
    "...rrrrrrrrrW...",
    "..rrrrrrrrrr....",
    "..rrrr..rrrr....",
    "..rr......rr....",
    "................",
  ],
  bowPal: { r: "#FF206E", W: "#FFE135" },

  diamond: [
    "................",
    "......ww........",
    ".....wwww.......",
    "....wwwwww......",
    "...wwwwwwww.....",
    "..ccwwwwwwcc....",
    "...ccwwwwcc.....",
    "....ccwwcc......",
    ".....cccc.......",
    "......cc........",
    "................",
  ],
  diamondPal: { w: "#FFFFFF", c: "#00E5FF" },
};
const ENEMY_TYPES = ["burger", "cookie", "iron", "bow", "diamond"];
const ENEMY_NAMES = { burger: "HAMBÚRGUERES", cookie: "BOLACHAS", iron: "FERROS", bow: "GRAVATAS", diamond: "DIAMANTES" };

// ---------- ESTADO ----------
const G = {
  state: "title", // title | playing | dying | clear | over
  time: 0, score: 0, lives: 3, level: 1,
  hi: parseInt(localStorage.getItem("starmania_hi") || "0", 10) || 0,
  energy: 100, energyMax: 100,
  shake: 0, flash: 0, stateT: 0, enemyDir: 1,
};

const player = { x: W / 2, y: H - 88, w: 32, h: 24, speed: 330, cd: 0, inv: 0, alive: true };

// pools
const pBullets = [];   // {x,y,vy,active}
const eBullets = [];
const parts = [];      // partículas explosão
const enemies = [];    // {bx,y,hp,phase,alive,flash,type,w,h}

for (let i = 0; i < 24; i++) pBullets.push({ x: 0, y: 0, vy: -680, active: false });
for (let i = 0; i < 8; i++) eBullets.push({ x: 0, y: 0, vy: 240, active: false });
for (let i = 0; i < 120; i++) parts.push({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, c: "#fff", active: false });

// ---------- INPUT (teclado + touch unificado em ações) ----------
const keys = {};
let touchLeft = false, touchRight = false, touchFire = false;
let dragging = false, dragX = 0, usingTouch = false;

addEventListener("keydown", (e) => {
  if (["ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
  keys[e.code] = true;
  AudioSys.ensure();
  if (e.code === "Enter" && G.state !== "playing") startGame();
  if (e.code === "KeyP" && G.state === "playing") togglePause();
});
addEventListener("keyup", (e) => { keys[e.code] = false; });

function markTouch() {
  if (!usingTouch) { usingTouch = true; document.body.classList.add("touch"); }
}
canvas.addEventListener("pointerdown", (e) => {
  markTouch(); AudioSys.ensure();
  dragging = true;
  dragX = (e.clientX - canvas.getBoundingClientRect().left) / canvas.getBoundingClientRect().width * W;
  if (G.state !== "playing") startGame();
});
addEventListener("pointermove", (e) => {
  if (!dragging) return;
  const r = canvas.getBoundingClientRect();
  dragX = (e.clientX - r.left) / r.width * W;
});
addEventListener("pointerup", () => { dragging = false; });
addEventListener("pointercancel", () => { dragging = false; });

function bindHold(id, set) {
  const b = el(id);
  const on = (e) => { e.preventDefault(); markTouch(); AudioSys.ensure(); set(true); };
  const off = (e) => { e.preventDefault(); set(false); };
  b.addEventListener("pointerdown", on);
  b.addEventListener("pointerup", off);
  b.addEventListener("pointerleave", off);
  b.addEventListener("pointercancel", off);
}
bindHold("t-left", (v) => (touchLeft = v));
bindHold("t-right", (v) => (touchRight = v));
bindHold("t-fire", (v) => (touchFire = v));
if ("ontouchstart" in window) markTouch();

btnStart.addEventListener("click", () => { AudioSys.ensure(); startGame(); });
overlay.addEventListener("pointerdown", (e) => {
  if (e.target === btnStart) return;
  AudioSys.ensure();
});

let paused = false;
function togglePause() { paused = !paused; }
document.addEventListener("visibilitychange", () => { if (document.hidden) paused = true; });

// ---------- FASES / ONDAS ----------
function levelConfig(lv) {
  const idx = (lv - 1) % ENEMY_TYPES.length;
  const cycle = Math.floor((lv - 1) / ENEMY_TYPES.length); // cada 5 fases +difícil
  return {
    type: ENEMY_TYPES[idx],
    count: Math.min(6 + Math.floor(lv * 0.8), 10),
    descend: 14 + lv * 4 + cycle * 10,          // px/s descida
    zigAmp: 46 + Math.min(lv * 5, 60),           // amplitude zigue-zague
    zigFreq: 1.1 + lv * 0.14,                    // velocidade lateral
    eBulletSpeed: 210 + lv * 18,
    eFireEvery: Math.max(1.25 - lv * 0.09, 0.45),// um tiro inimigo por vez
    drain: 3.4 + lv * 0.45,                      // energia/s
  };
}
let cfg = levelConfig(1);
let eFireT = 0;

function spawnWave() {
  cfg = levelConfig(G.level);
  enemies.length = 0;
  const n = cfg.count, gap = W / (n + 1);
  for (let i = 0; i < n; i++) {
    enemies.push({
      bx: gap * (i + 1), y: 84 + (i % 2) * 40,
      phase: i * 0.9, alive: true, flash: 0,
      w: 32, h: 26, x: gap * (i + 1) - 16,
    });
  }
  eBullets.forEach((b) => (b.active = false));
  eFireT = 1.0;
}

// ---------- FLUXO ----------
function startGame() {
  G.score = 0; G.lives = 3; G.level = 1;
  G.energy = G.energyMax; G.state = "playing"; G.stateT = 0;
  player.x = W / 2; player.alive = true; player.inv = 2; player.cd = 0;
  pBullets.forEach((b) => (b.active = false));
  parts.forEach((p) => (p.active = false));
  spawnWave();
  updateHUD();
  overlay.classList.add("hidden");
  paused = false;
}
function nextLevel() {
  G.level++;
  G.energy = G.energyMax; // renova ao mudar de fase
  player.inv = 1.5;
  spawnWave();
  G.state = "playing"; G.stateT = 0;
  updateHUD();
}
function loseLife(reason) {
  G.lives--;
  AudioSys.hurt();
  explode(player.x, player.y, ["#00E5FF", "#ffffff", "#FF206E"], 26);
  updateHUD();
  if (G.lives <= 0) {
    G.state = "over"; G.stateT = 0;
    saveHi();
    showOverlay("GAME OVER", `Score ${fmt(G.score)} · Fase ${G.level}<br>Pressione INICIAR para jogar de novo`);
  } else {
    G.state = "dying"; G.stateT = 0;
    G.energy = G.energyMax; // renova após perder vida (evita morte em cadeia)
    player.inv = 2.5;
  }
}
function saveHi() {
  if (G.score > G.hi) { G.hi = G.score; localStorage.setItem("starmania_hi", String(G.hi)); }
}
function showOverlay(title, msg) {
  ovTitle.textContent = title;
  ovMsg.innerHTML = msg;
  overlay.classList.remove("hidden");
}
function fmt(n) { return String(Math.floor(n)).padStart(6, "0"); }
function updateHUD() {
  uiScore.textContent = fmt(G.score);
  uiHi.textContent = fmt(Math.max(G.hi, G.score));
  uiLevel.textContent = G.level;
  uiLives.textContent = "♥".repeat(Math.max(G.lives, 0)) || "—";
}

// ---------- TIRO / PARTÍCULAS ----------
function firePlayer() {
  if (player.cd > 0) return;
  const b = pBullets.find((b) => !b.active);
  if (!b) return;
  b.active = true;
  b.x = player.x - 2; b.y = player.y - 14;
  b.vy = -720; // projétil rápido
  player.cd = 0.17;
  AudioSys.laser();
}
function enemyFire() {
  if (eBullets.some((b) => b.active)) return; // um de cada vez
  const alive = enemies.filter((e) => e.alive);
  if (!alive.length) return;
  const s = alive[(Math.random() * alive.length) | 0];
  const b = eBullets.find((b) => !b.active);
  if (!b) return;
  b.active = true;
  b.x = s.x + s.w / 2 - 3; b.y = s.y + s.h;
  b.vy = cfg.eBulletSpeed;
}
function explode(x, y, colors, n) {
  let c = 0;
  for (const p of parts) {
    if (p.active) continue;
    p.active = true;
    p.x = x; p.y = y;
    const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 220;
    p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp - 60;
    p.max = p.life = 0.35 + Math.random() * 0.35;
    p.c = colors[(Math.random() * colors.length) | 0];
    if (++c >= n) break;
  }
  G.shake = Math.min(G.shake + 5, 9);
  AudioSys.boom();
}

// colisão AABB precisa (hitbox 70%)
function hit(ax, ay, aw, ah, bx, by, bw, bh, shrink = 0.3) {
  const amx = aw * shrink / 2, amy = ah * shrink / 2;
  const bmx = bw * shrink / 2, bmy = bh * shrink / 2;
  return ax + amx < bx + bw - bmx && ax + aw - amx > bx + bmx &&
         ay + amy < by + bh - bmy && ay + ah - amy > by + bmy;
}

// ---------- UPDATE ----------
let last = performance.now(), acc = 0;
const STEP = 1 / 60;

function update(dt) {
  G.time += dt;

  if (G.state === "playing" && !paused) {
    G.stateT += dt;
    // energia drena sempre
    G.energy -= cfg.drain * dt;
    if (G.energy <= 0) { G.energy = 0; loseLife("energia"); return; }

    // movimento jogador
    let mv = 0;
    if (keys.ArrowLeft || keys.KeyA || touchLeft) mv -= 1;
    if (keys.ArrowRight || keys.KeyD || touchRight) mv += 1;
    player.x += mv * player.speed * dt;

    if (dragging && usingTouch) { // arrastar = segue o dedo (fluido)
      const dx = dragX - player.x;
      player.x += dx * Math.min(1, dt * 14);
    }
    player.x = Math.max(20, Math.min(W - 20, player.x));
    player.cd -= dt; player.inv -= dt;

    const wantFire = keys.Space || keys.KeyZ || keys.KeyJ || touchFire || (usingTouch && dragging);
    if (wantFire) firePlayer();

    // inimigos: zigue-zague + descida lenta em fileiras
    for (const e of enemies) {
      if (!e.alive) continue;
      e.flash -= dt;
      e.x = e.bx + Math.sin(G.time * cfg.zigFreq + e.phase) * cfg.zigAmp - e.w / 2;
      e.x = Math.max(4, Math.min(W - e.w - 4, e.x));
      e.y += cfg.descend * dt;
      if (e.y > H - 220) e.y = H - 220; // estaciona antes da nave (estilo Megamania)
    }
    // tiro inimigo: poucos, um por vez
    eFireT -= dt;
    if (eFireT <= 0) { enemyFire(); eFireT = cfg.eFireEvery; }

    // balas player
    for (const b of pBullets) {
      if (!b.active) continue;
      b.y += b.vy * dt;
      if (b.y < -20) { b.active = false; continue; }
      for (const e of enemies) {
        if (!e.alive) continue;
        if (hit(b.x, b.y, 4, 12, e.x, e.y, e.w, e.h)) {
          b.active = false; e.alive = false; e.flash = 0;
          G.score += 100 * G.level;
          explode(e.x + e.w / 2, e.y + e.h / 2, ["#FFE135", "#FF9F1C", "#FFFFFF"], 14);
          updateHUD();
          break;
        }
      }
    }
    // balas inimigas
    for (const b of eBullets) {
      if (!b.active) continue;
      b.y += b.vy * dt;
      if (b.y > H + 20) { b.active = false; continue; }
      if (player.inv <= 0 && hit(b.x, b.y, 6, 12, player.x - 16, player.y - 12, 32, 24)) {
        b.active = false;
        loseLife("tiro");
        return;
      }
    }
    // contato direto destrói a nave
    if (player.inv <= 0 && G.state === "playing") {
      for (const e of enemies) {
        if (!e.alive) continue;
        if (hit(player.x - 16, player.y - 12, 32, 24, e.x, e.y, e.w, e.h, 0.25)) {
          e.alive = false;
          loseLife("contato");
          return;
        }
      }
    }
    // onda completa destruída → recupera energia + próxima fase
    if (enemies.every((e) => !e.alive) && G.state === "playing") {
      G.score += 500 * G.level;
      G.energy = Math.min(G.energyMax, G.energy + 45);
      saveHi(); updateHUD();
      G.state = "clear"; G.stateT = 0;
    }
  } else if (G.state === "dying") {
    G.stateT += dt;
    if (G.stateT > 1.2) { G.state = "playing"; G.stateT = 0; }
  } else if (G.state === "clear") {
    G.stateT += dt;
    if (G.stateT > 1.6) nextLevel();
  } else if (G.state === "over" || G.state === "title") {
    G.stateT += dt;
  }

  // partículas sempre
  for (const p of parts) {
    if (!p.active) continue;
    p.life -= dt;
    if (p.life <= 0) { p.active = false; continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt;
  }
  G.shake = Math.max(0, G.shake - dt * 22);
  uiEnergy.style.width = (G.energy / G.energyMax * 100).toFixed(1) + "%";
  uiEnergy.classList.toggle("low", G.energy < 25);
}

// ---------- RENDER ----------
function render() {
  ctx.save();
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  if (G.shake > 0) ctx.translate((Math.random() - 0.5) * G.shake, (Math.random() - 0.5) * G.shake);

  // linha do topo (score fica no DOM; aqui moldura arcade)
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, W, 4);
  ctx.fillStyle = "#00E5FF";
  ctx.fillRect(0, 0, W * (G.energy / G.energyMax), 2);

  // inimigos
  const spr = SPR[cfg.type] || SPR.burger;
  const pal = SPR[cfg.type + "Pal"] || SPR.burgerPal;
  for (const e of enemies) {
    if (!e.alive) continue;
    drawMap(spr, pal, e.x, e.y, e.flash > 0);
  }
  // nome da onda
  ctx.fillStyle = "#fff";
  ctx.font = "bold 13px 'Courier New',monospace";
  ctx.textAlign = "center";
  if (G.state === "clear") {
    ctx.fillStyle = "#00FF41";
    ctx.font = "bold 26px 'Courier New',monospace";
    ctx.fillText("FASE " + G.level + " COMPLETA!", W / 2, H / 2 - 10);
    ctx.fillStyle = "#FFE135";
    ctx.font = "bold 14px 'Courier New',monospace";
    ctx.fillText("ENERGIA RECARREGADA", W / 2, H / 2 + 18);
  }
  if (G.state === "playing" && enemies.some((e) => e.alive)) {
    ctx.fillStyle = "#333";
    ctx.font = "bold 12px 'Courier New',monospace";
    ctx.fillText(ENEMY_NAMES[cfg.type] + " · FASE " + G.level, W / 2, 26);
  }

  // balas player (rápidas, vibrantes)
  for (const b of pBullets) {
    if (!b.active) continue;
    ctx.fillStyle = "#00FF41";
    ctx.fillRect(b.x, b.y, 4, 12);
    ctx.fillStyle = "#fff";
    ctx.fillRect(b.x + 1, b.y + 2, 2, 8);
  }
  // balas inimigas
  for (const b of eBullets) {
    if (!b.active) continue;
    ctx.fillStyle = "#FF206E";
    ctx.fillRect(b.x, b.y, 6, 12);
    ctx.fillStyle = "#fff";
    ctx.fillRect(b.x + 2, b.y + 2, 2, 4);
  }
  // partículas
  for (const p of parts) {
    if (!p.active) continue;
    ctx.globalAlpha = Math.max(p.life / p.max, 0);
    ctx.fillStyle = p.c;
    ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    ctx.globalAlpha = 1;
  }
  // player (pisca quando invencível; some no momento da morte)
  const showShip = G.state === "playing" || G.state === "clear" || G.state === "title";
  if (showShip) {
    const blink = player.inv > 0 && Math.floor(G.time * 12) % 2 === 0;
    if (!blink) drawMap(SPR.ship, SPR.shipPal, player.x - 16, player.y - 12, false);
  }
  if (paused && G.state === "playing") {
    ctx.fillStyle = "rgba(0,0,0,.6)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#FFE135";
    ctx.font = "bold 28px 'Courier New',monospace";
    ctx.fillText("PAUSADO (P)", W / 2, H / 2);
  }
  ctx.restore();
}

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.1) dt = 0.1;
  acc += dt;
  let n = 0;
  while (acc >= STEP && n < 4) { update(STEP); acc -= STEP; n++; }
  render();
}

// init
cfg = levelConfig(1);
spawnWave();
G.state = "title";
G.energy = G.energyMax;
updateHUD();
uiHi.textContent = fmt(G.hi);
showOverlay("STAR MANIA", "◀ ▶ / A D move · ESPAÇO atira<br>Toque e arraste no mobile");
requestAnimationFrame((t) => { last = t; requestAnimationFrame(frame); });
})();
