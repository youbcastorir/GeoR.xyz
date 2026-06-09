/* simulation.js — GeoR Real-Time Simulation Engine
   Simulates other users drawing, cursors moving, and canvas activity
   (Replace this with WebSocket server in production)
*/

(function () {
  'use strict';

  const CANVAS_W = 4000;
  const CANVAS_H = 3000;

  // Simulated remote users
  const remoteUsers = [
    { id: 'u1', name: 'PixelKing_BR', flag: '🇧🇷', color: '#00aa55', x: 450, y: 320, vx: 2, vy: 1 },
    { id: 'u2', name: 'NeonTokyo', flag: '🇯🇵', color: '#ff3366', x: 2850, y: 430, vx: -1, vy: 2 },
    { id: 'u3', name: 'WallStreetArt', flag: '🇺🇸', color: '#3366ff', x: 350, y: 1250, vx: 3, vy: -1 },
    { id: 'u4', name: 'SaharaInk', flag: '🇲🇦', color: '#cc2200', x: 3050, y: 920, vx: -2, vy: 1 },
    { id: 'u5', name: 'BerlinBrush', flag: '🇩🇪', color: '#ffffff', x: 1900, y: 1250, vx: 1, vy: 2 },
    { id: 'u6', name: 'SeoulPixel', flag: '🇰🇷', color: '#ff00aa', x: 1650, y: 550, vx: 2, vy: -1 },
    { id: 'u7', name: 'MumbaiMural', flag: '🇮🇳', color: '#ffdd00', x: 2450, y: 2250, vx: -1, vy: -2 },
  ];

  const cursorsLayer = document.getElementById('cursorsLayer');
  const cursorEls = {};

  // Create cursor elements
  remoteUsers.forEach(u => {
    const el = document.createElement('div');
    el.className = 'remote-cursor';
    el.id = 'cursor-' + u.id;
    el.innerHTML = `
      <div class="cursor-dot" style="background:${u.color};box-shadow:0 0 8px ${u.color}"></div>
      <div class="cursor-label" style="background:rgba(0,0,0,0.8);border-left:2px solid ${u.color}">${u.flag} ${u.name}</div>
    `;
    el.style.left = u.x + 'px';
    el.style.top = u.y + 'px';
    cursorsLayer.appendChild(el);
    cursorEls[u.id] = el;
  });

  // Zone targets for user movement simulation
  const zones = [
    { x: 400, y: 300, r: 200 },
    { x: 1800, y: 500, r: 250 },
    { x: 2800, y: 400, r: 200 },
    { x: 350, y: 1200, r: 200 },
    { x: 3000, y: 900, r: 180 },
    { x: 1200, y: 1800, r: 300 },
    { x: 2400, y: 2200, r: 200 },
  ];

  const userTargets = {};
  remoteUsers.forEach(u => {
    userTargets[u.id] = randomZone();
  });

  function randomZone() {
    const z = zones[Math.floor(Math.random() * zones.length)];
    return {
      x: z.x + (Math.random() - 0.5) * z.r * 2,
      y: z.y + (Math.random() - 0.5) * z.r * 2,
    };
  }

  // Move cursors toward their targets, switch targets occasionally
  function tickCursors() {
    if (!window.canvasState) return;
    remoteUsers.forEach(u => {
      const target = userTargets[u.id];
      const dx = target.x - u.x;
      const dy = target.y - u.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 20) {
        userTargets[u.id] = randomZone();
      }

      const speed = 1.5 + Math.random() * 1;
      u.x += (dx / dist) * speed + (Math.random() - 0.5) * 2;
      u.y += (dy / dist) * speed + (Math.random() - 0.5) * 2;

      // Clamp
      u.x = Math.max(0, Math.min(CANVAS_W, u.x));
      u.y = Math.max(0, Math.min(CANVAS_H, u.y));

      const el = cursorEls[u.id];
      if (el) {
        el.style.left = u.x + 'px';
        el.style.top = u.y + 'px';
      }
    });
  }

  // Draw strokes for simulated users
  function simulateDraw() {
    const ctx = window.canvasCtx;
    if (!ctx) return;

    const u = remoteUsers[Math.floor(Math.random() * remoteUsers.length)];
    const target = userTargets[u.id];

    // Random stroke from current pos toward target
    ctx.save();
    ctx.strokeStyle = u.color;
    ctx.lineWidth = Math.random() * 8 + 2;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.5 + Math.random() * 0.4;
    ctx.shadowColor = u.color;
    ctx.shadowBlur = 6;

    const len = Math.random() * 60 + 20;
    const angle = Math.atan2(target.y - u.y, target.x - u.x) + (Math.random() - 0.5) * 0.8;

    ctx.beginPath();
    ctx.moveTo(u.x, u.y);
    ctx.lineTo(
      u.x + Math.cos(angle) * len,
      u.y + Math.sin(angle) * len
    );
    ctx.stroke();
    ctx.restore();

    // Occasionally drop text
    if (Math.random() < 0.03) {
      const texts = ['GeoR!', '🔥', '✨', 'HERE', 'ART', '⚔️', '∞', '01010'];
      ctx.save();
      ctx.font = `bold ${Math.floor(Math.random()*20+10)}px "Orbitron"`;
      ctx.fillStyle = u.color;
      ctx.globalAlpha = 0.7;
      ctx.fillText(
        texts[Math.floor(Math.random() * texts.length)],
        u.x + (Math.random()-0.5)*40,
        u.y + (Math.random()-0.5)*40
      );
      ctx.restore();
    }
  }

  // Random occasional target switch
  setInterval(() => {
    const u = remoteUsers[Math.floor(Math.random() * remoteUsers.length)];
    userTargets[u.id] = randomZone();
  }, 4000);

  // Main simulation tick
  let lastDraw = 0;
  function tick(ts) {
    tickCursors();
    if (ts - lastDraw > 400) {
      lastDraw = ts;
      simulateDraw();
      if (window.canvasCtx) {
        // Update minimap periodically
        const minimap = document.getElementById('minimapCanvas');
        if (minimap && window.canvasEl) {
          const mctx = minimap.getContext('2d');
          mctx.drawImage(window.canvasEl, 0, 0, 180, 100);
        }
      }
    }
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);

  // ── Occasional "battle" event notifications ───────────────────────
  const battleEvents = [
    () => showToast('⚔️ PixelKing_BR erased a rival zone!', 'warn'),
    () => showToast('🔥 Battle Zone temperature rising!', 'warn'),
    () => showToast('🌟 NeonTokyo completed a pixel mural!', 'success'),
    () => showToast('🇲🇦 Maroc Art territory expanding!', 'success'),
    () => showToast('💥 Pixel Wars: 847 players fighting for the center!', 'warn'),
    () => showToast('🎨 New collaboration forming in Tokyo zone!', 'success'),
    () => showToast('⚡ 5000 pixels drawn in the last 10 seconds!', 'success'),
    () => showToast('🏆 WallStreetArt just hit 100k points!', 'success'),
  ];

  let evIdx = 0;
  setInterval(() => {
    // Don't show notifications while profile modal is open
    const modal = document.getElementById('profileModal');
    if (modal && modal.style.display !== 'none') return;
    battleEvents[evIdx % battleEvents.length]();
    evIdx++;
  }, 8000);

  // ── Floating sparks on canvas (visual flair) ──────────────────────
  const canvasWrapper = document.getElementById('canvasWrapper');

  function createSpark() {
    if (!canvasWrapper) return;
    const spark = document.createElement('div');
    spark.style.cssText = `
      position:absolute;
      width:3px;height:3px;
      border-radius:50%;
      pointer-events:none;
      z-index:50;
      background:${['#00ffcc','#ff0040','#ffdd00','#8800ff','#ff6600'][Math.floor(Math.random()*5)]};
      left:${Math.random()*100}%;
      top:${Math.random()*100}%;
      animation:sparkFade 1.5s ease forwards;
    `;
    canvasWrapper.appendChild(spark);
    setTimeout(() => spark.remove(), 1500);
  }

  // Inject spark keyframe
  const style = document.createElement('style');
  style.textContent = `
    @keyframes sparkFade {
      0% { opacity:1; transform:scale(1) translate(0,0); }
      100% { opacity:0; transform:scale(0) translate(${Math.random()*40-20}px,${Math.random()*-40}px); }
    }
  `;
  document.head.appendChild(style);

  setInterval(createSpark, 300);

})();
