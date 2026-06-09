/* canvas.js — GeoR Global Canvas Engine */

(function () {
  'use strict';

  // ── State ──────────────────────────────────────────────────────────
  const state = {
    tool: 'draw',
    color: '#00ffcc',
    brushSize: 4,
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    isDrawing: false,
    lastX: 0,
    lastY: 0,
    history: [],
    maxHistory: 30,
    textPending: null,
    avatarColor: '#00ffcc',
    username: null,
    country: null,
    hasDrawn: false,
    firstStroke: true,
  };

  const CANVAS_W = 4000;
  const CANVAS_H = 3000;

  // ── Setup ──────────────────────────────────────────────────────────
  const wrapper = document.getElementById('canvasWrapper');
  const canvas = document.getElementById('globalCanvas');
  const overlay = document.getElementById('overlayCanvas');
  const ctx = canvas.getContext('2d');
  const octx = overlay.getContext('2d');

  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  overlay.width = CANVAS_W;
  overlay.height = CANVAS_H;

  resizeOverlay();
  window.addEventListener('resize', resizeOverlay);

  function resizeOverlay() {
    const rect = wrapper.getBoundingClientRect();
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
    canvas.style.width = CANVAS_W * state.zoom + 'px';
    canvas.style.height = CANVAS_H * state.zoom + 'px';
    applyTransform();
  }

  function applyTransform() {
    const t = `translate(${state.offsetX}px, ${state.offsetY}px) scale(${state.zoom})`;
    canvas.style.transform = t;
    canvas.style.transformOrigin = '0 0';
    document.getElementById('cursorsLayer').style.transform = t;
    document.getElementById('territoriesLayer').style.transform = t;
    updateMinimap();
  }

  // ── Tool API ────────────────────────────────────────────────────────
  window.setTool = function (tool) {
    state.tool = tool;
    document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`.tool-btn[data-tool="${tool}"]`);
    if (btn) btn.classList.add('active');
    wrapper.style.cursor = tool === 'erase' ? 'cell' : tool === 'text' ? 'text' : 'crosshair';
  };

  window.setColor = function (color) {
    state.color = color;
    document.getElementById('colorPreview').style.background = color;
    document.getElementById('colorPicker').value = color;
  };

  window.setBrushSize = function (size) {
    state.brushSize = parseInt(size);
    document.getElementById('sizeDisplay').textContent = size + 'px';
  };

  window.zoomCanvas = function (factor) {
    const oldZoom = state.zoom;
    state.zoom = Math.max(0.2, Math.min(8, state.zoom * factor));
    const rect = wrapper.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    state.offsetX = cx - (cx - state.offsetX) * (state.zoom / oldZoom);
    state.offsetY = cy - (cy - state.offsetY) * (state.zoom / oldZoom);
    document.getElementById('zoomLevel').textContent = Math.round(state.zoom * 100) + '%';
    applyTransform();
  };

  window.resetView = function () {
    state.zoom = 1;
    state.offsetX = 0;
    state.offsetY = 0;
    document.getElementById('zoomLevel').textContent = '100%';
    applyTransform();
  };

  window.flyToZone = function (x, y) {
    const rect = wrapper.getBoundingClientRect();
    state.zoom = 1.5;
    state.offsetX = rect.width / 2 - x * state.zoom;
    state.offsetY = rect.height / 2 - y * state.zoom;
    document.getElementById('zoomLevel').textContent = '150%';
    applyTransform();
    showToast('🗺️ Flew to zone!', 'success');
  };

  window.undoLast = function () {
    if (state.history.length === 0) { showToast('Nothing to undo', 'warn'); return; }
    const snap = state.history.pop();
    ctx.putImageData(snap, 0, 0);
    updateMinimap();
    showToast('↩ Undone', 'success');
  };

  window.clearMyStrokes = function () {
    if (!confirm('Clear your recent strokes?')) return;
    if (state.history.length > 0) {
      ctx.putImageData(state.history[0], 0, 0);
      state.history = [];
      updateMinimap();
      showToast('🗑 Cleared your strokes', 'warn');
    }
  };

  window.takeScreenshot = function () {
    const link = document.createElement('a');
    link.download = 'geor-snapshot.png';
    link.href = canvas.toDataURL();
    link.click();
    showToast('📷 Screenshot saved!', 'success');
  };

  // ── Canvas Coordinates ─────────────────────────────────────────────
  function clientToCanvas(clientX, clientY) {
    const rect = wrapper.getBoundingClientRect();
    const x = (clientX - rect.left - state.offsetX) / state.zoom;
    const y = (clientY - rect.top - state.offsetY) / state.zoom;
    return { x: Math.round(x), y: Math.round(y) };
  }

  // ── Drawing ─────────────────────────────────────────────────────────
  function saveSnapshot() {
    if (state.history.length >= state.maxHistory) state.history.shift();
    state.history.push(ctx.getImageData(0, 0, CANVAS_W, CANVAS_H));
  }

  function startDraw(e) {
    if (!state.username) { openProfileModal(); return; }
    if (state.tool === 'text') { handleTextTool(e); return; }
    if (state.tool === 'eyedrop') { handleEyedrop(e); return; }
    state.isDrawing = true;
    const { x, y } = clientToCanvas(e.clientX || e.touches[0].clientX, e.clientY || e.touches[0].clientY);
    state.lastX = x;
    state.lastY = y;
    saveSnapshot();
    draw(x, y, x, y);
  }

  function moveDraw(e) {
    e.preventDefault();
    const cx = e.clientX || (e.touches && e.touches[0].clientX);
    const cy = e.clientY || (e.touches && e.touches[0].clientY);
    const { x, y } = clientToCanvas(cx, cy);
    document.getElementById('coordX').textContent = x;
    document.getElementById('coordY').textContent = y;

    if (state.isDrawing) {
      draw(state.lastX, state.lastY, x, y);
      state.lastX = x;
      state.lastY = y;
    }
  }

  function endDraw() {
    if (state.isDrawing) {
      state.isDrawing = false;
      updateMinimap();
      if (state.firstStroke) {
        state.firstStroke = false;
        triggerAchievement('✏️', 'First Stroke', 'You left your first mark!');
        window.addPoints && window.addPoints(10);
      }
    }
  }

  function draw(x1, y1, x2, y2) {
    ctx.save();
    ctx.lineWidth = state.brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (state.tool === 'erase') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.lineWidth = state.brushSize * 3;
    } else if (state.tool === 'fill') {
      floodFill(Math.round(x2), Math.round(y2), state.color);
      ctx.restore();
      return;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = state.color;
    }
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  function handleEyedrop(e) {
    const { x, y } = clientToCanvas(e.clientX, e.clientY);
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    const hex = '#' + [pixel[0], pixel[1], pixel[2]].map(v => v.toString(16).padStart(2, '0')).join('');
    setColor(hex);
    setTool('draw');
    showToast(`🎨 Color picked: ${hex}`, 'success');
  }

  // Simple flood fill
  function floodFill(startX, startY, fillColorHex) {
    const imageData = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
    const data = imageData.data;
    const target = getPixel(data, startX, startY);
    const fill = hexToRgba(fillColorHex);
    if (colorsMatch(target, fill)) return;
    const stack = [[startX, startY]];
    const visited = new Set();
    while (stack.length > 0 && stack.length < 200000) {
      const [x, y] = stack.pop();
      if (x < 0 || x >= CANVAS_W || y < 0 || y >= CANVAS_H) continue;
      const key = y * CANVAS_W + x;
      if (visited.has(key)) continue;
      visited.add(key);
      const current = getPixel(data, x, y);
      if (!colorsMatch(current, target)) continue;
      setPixel(data, x, y, fill);
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    ctx.putImageData(imageData, 0, 0);
  }

  function getPixel(data, x, y) {
    const i = (y * CANVAS_W + x) * 4;
    return [data[i], data[i+1], data[i+2], data[i+3]];
  }
  function setPixel(data, x, y, color) {
    const i = (y * CANVAS_W + x) * 4;
    data[i] = color[0]; data[i+1] = color[1]; data[i+2] = color[2]; data[i+3] = color[3];
  }
  function colorsMatch(a, b) { return a[0]===b[0] && a[1]===b[1] && a[2]===b[2]; }
  function hexToRgba(hex) {
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return [r, g, b, 255];
  }

  // ── Text Tool ────────────────────────────────────────────────────────
  function handleTextTool(e) {
    const { x, y } = clientToCanvas(e.clientX, e.clientY);
    state.textPending = { x, y };
    const popup = document.getElementById('textPopup');
    popup.style.display = 'block';
    popup.style.left = Math.min(e.clientX, window.innerWidth - 300) + 'px';
    popup.style.top = (e.clientY - 80) + 'px';
    document.getElementById('textInput').value = '';
    document.getElementById('textInput').focus();
  }

  window.placeText = function () {
    if (!state.textPending) return;
    const text = document.getElementById('textInput').value.trim();
    if (!text) return;
    const font = document.getElementById('fontSelect').value;
    const size = parseInt(document.getElementById('textSize').value);
    saveSnapshot();
    ctx.save();
    ctx.font = `${size}px "${font}"`;
    ctx.fillStyle = state.color;
    ctx.fillText(text, state.textPending.x, state.textPending.y);
    ctx.restore();
    updateMinimap();
    cancelText();
    showToast('✍️ Text placed!', 'success');
    if (!state.hasDrawn) {
      state.hasDrawn = true;
      window.addPoints && window.addPoints(5);
    }
  };

  window.cancelText = function () {
    document.getElementById('textPopup').style.display = 'none';
    state.textPending = null;
  };

  document.getElementById('textInput')?.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') placeText();
    if (e.key === 'Escape') cancelText();
  });

  // ── Event Listeners ──────────────────────────────────────────────────
  wrapper.addEventListener('mousedown', startDraw);
  wrapper.addEventListener('mousemove', moveDraw);
  wrapper.addEventListener('mouseup', endDraw);
  wrapper.addEventListener('mouseleave', endDraw);
  wrapper.addEventListener('touchstart', startDraw, { passive: false });
  wrapper.addEventListener('touchmove', moveDraw, { passive: false });
  wrapper.addEventListener('touchend', endDraw);

  // Pan with middle mouse
  let panning = false, panStartX = 0, panStartY = 0, panOffX = 0, panOffY = 0;
  wrapper.addEventListener('mousedown', function(e) {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      panning = true;
      panStartX = e.clientX; panStartY = e.clientY;
      panOffX = state.offsetX; panOffY = state.offsetY;
      e.preventDefault();
    }
  });
  document.addEventListener('mousemove', function(e) {
    if (!panning) return;
    state.offsetX = panOffX + (e.clientX - panStartX);
    state.offsetY = panOffY + (e.clientY - panStartY);
    applyTransform();
  });
  document.addEventListener('mouseup', function(e) {
    if (e.button === 1 || panning) panning = false;
  });

  // Zoom with wheel
  wrapper.addEventListener('wheel', function(e) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const rect = wrapper.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const oldZoom = state.zoom;
    state.zoom = Math.max(0.2, Math.min(8, state.zoom * factor));
    state.offsetX = cx - (cx - state.offsetX) * (state.zoom / oldZoom);
    state.offsetY = cy - (cy - state.offsetY) * (state.zoom / oldZoom);
    document.getElementById('zoomLevel').textContent = Math.round(state.zoom * 100) + '%';
    applyTransform();
  }, { passive: false });

  // ── Minimap ───────────────────────────────────────────────────────────
  const minimap = document.getElementById('minimapCanvas');
  const mctx = minimap.getContext('2d');
  const MW = 180, MH = 100;

  function updateMinimap() {
    mctx.clearRect(0, 0, MW, MH);
    mctx.drawImage(canvas, 0, 0, MW, MH);

    const rect = wrapper.getBoundingClientRect();
    const vx = -state.offsetX / state.zoom / CANVAS_W * MW;
    const vy = -state.offsetY / state.zoom / CANVAS_H * MH;
    const vw = rect.width / state.zoom / CANVAS_W * MW;
    const vh = rect.height / state.zoom / CANVAS_H * MH;

    const vp = document.getElementById('minimapViewport');
    vp.style.left = Math.max(0, vx) + 'px';
    vp.style.top = (24 + Math.max(0, vy)) + 'px';
    vp.style.width = Math.min(vw, MW) + 'px';
    vp.style.height = Math.min(vh, MH) + 'px';
  }

  // Minimap click to navigate
  minimap.addEventListener('click', function(e) {
    const rect = minimap.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / MW;
    const my = (e.clientY - rect.top) / MH;
    const wRect = wrapper.getBoundingClientRect();
    state.offsetX = -(mx * CANVAS_W * state.zoom - wRect.width / 2);
    state.offsetY = -(my * CANVAS_H * state.zoom - wRect.height / 2);
    applyTransform();
  });

  // ── Initial canvas seeding (paint existing "world") ──────────────────
  function seedInitialCanvas() {
    ctx.fillStyle = '#070710';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Grid lines
    ctx.strokeStyle = 'rgba(0,255,204,0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < CANVAS_W; x += 100) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke();
    }
    for (let y = 0; y < CANVAS_H; y += 100) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke();
    }

    // Seed "prior art" from other users
    const arts = [
      { type: 'text', x: 400, y: 300, text: '🇧🇷 BRASIL', color: '#00aa55', size: 40, font: 'Orbitron' },
      { type: 'text', x: 1800, y: 500, text: 'PIXEL WARS', color: '#ff0040', size: 60, font: 'Orbitron' },
      { type: 'text', x: 1800, y: 580, text: 'ZONE III', color: '#ff6600', size: 30, font: 'Space Mono' },
      { type: 'text', x: 2800, y: 400, text: '日本', color: '#ff3366', size: 50, font: 'serif' },
      { type: 'text', x: 300, y: 1200, text: '🇺🇸 USA MURAL', color: '#3366ff', size: 36, font: 'Orbitron' },
      { type: 'text', x: 3000, y: 900, text: 'MOROCCO 🇲🇦', color: '#cc2200', size: 32, font: 'Rajdhani' },
      { type: 'text', x: 1200, y: 1800, text: '∞ GeoR.xyz ∞', color: '#00ffcc', size: 44, font: 'Orbitron' },
      { type: 'text', x: 2400, y: 2200, text: 'One World.', color: '#8800ff', size: 38, font: 'Orbitron' },
      { type: 'text', x: 2400, y: 2260, text: 'One Canvas.', color: '#00ccff', size: 38, font: 'Orbitron' },
    ];

    arts.forEach(a => {
      ctx.save();
      if (a.type === 'text') {
        ctx.font = `bold ${a.size}px "${a.font}"`;
        ctx.fillStyle = a.color;
        ctx.shadowColor = a.color;
        ctx.shadowBlur = 15;
        ctx.fillText(a.text, a.x, a.y);
      }
      ctx.restore();
    });

    // Random pixel art patches
    seedPixelPatches();
    updateMinimap();
    state.history.push(ctx.getImageData(0, 0, CANVAS_W, CANVAS_H));
  }

  function seedPixelPatches() {
    const patches = [
      { x: 600, y: 600, colors: ['#ff0040','#ff6600','#ffdd00'] },
      { x: 2000, y: 1200, colors: ['#00ffcc','#00aaff','#0055ff'] },
      { x: 3200, y: 1600, colors: ['#8800ff','#ff00aa','#ff0040'] },
      { x: 800, y: 2000, colors: ['#00ff88','#00ffcc','#ffdd00'] },
      { x: 1600, y: 600, colors: ['#ff6600','#ffdd00','#ff0040'] },
    ];

    patches.forEach(p => {
      const size = 8;
      const grid = 20;
      for (let row = 0; row < grid; row++) {
        for (let col = 0; col < grid; col++) {
          if (Math.random() > 0.4) {
            ctx.fillStyle = p.colors[Math.floor(Math.random() * p.colors.length)];
            ctx.globalAlpha = 0.6 + Math.random() * 0.4;
            ctx.fillRect(p.x + col * size, p.y + row * size, size - 1, size - 1);
          }
        }
      }
      ctx.globalAlpha = 1;
    });

    // Graffiti-style strokes
    const graffiti = [
      { x1:100, y1:400, x2:350, y2:450, color:'#ff0040', w:8 },
      { x1:500, y1:200, x2:700, y2:280, color:'#00ffcc', w:6 },
      { x1:1500, y1:1000, x2:1700, y2:1100, color:'#ff6600', w:10 },
      { x1:2500, y1:500, x2:2800, y2:600, color:'#8800ff', w:7 },
      { x1:3500, y1:1200, x2:3700, y2:1400, color:'#00ff88', w:9 },
    ];
    graffiti.forEach(g => {
      ctx.save();
      ctx.strokeStyle = g.color;
      ctx.lineWidth = g.w;
      ctx.lineCap = 'round';
      ctx.shadowColor = g.color;
      ctx.shadowBlur = 12;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(g.x1, g.y1);
      ctx.quadraticCurveTo(
        (g.x1 + g.x2) / 2 + (Math.random()-0.5)*80,
        (g.y1 + g.y2) / 2 + (Math.random()-0.5)*80,
        g.x2, g.y2
      );
      ctx.stroke();
      ctx.restore();
    });
  }

  // Add territory labels
  function addTerritories() {
    const layer = document.getElementById('territoriesLayer');
    const territories = [
      { x: 350, y: 260, label: '🇧🇷 Brasil Corner' },
      { x: 1750, y: 460, label: '⚔️ Battle Zone' },
      { x: 2750, y: 360, label: '🇯🇵 Tokyo Pixel' },
      { x: 250, y: 1160, label: '🇺🇸 USA Mural' },
      { x: 1150, y: 1760, label: '🌍 GeoR Center' },
      { x: 2950, y: 860, label: '🇲🇦 Maroc Art' },
    ];
    territories.forEach(t => {
      const el = document.createElement('div');
      el.className = 'territory-label';
      el.style.left = t.x + 'px';
      el.style.top = t.y + 'px';
      el.textContent = t.label;
      layer.appendChild(el);
    });
  }

  seedInitialCanvas();
  addTerritories();

  // Expose state for other modules
  window.canvasState = state;
  window.canvasCtx = ctx;
  window.canvasEl = canvas;

})();
