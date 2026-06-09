/* ui.js — GeoR UI Module */

(function () {
  'use strict';

  // ── Profile / Session ─────────────────────────────────────────────
  let userPoints = 0;
  let sessionLoaded = false;

  window.openProfileModal = function () {
    const modal = document.getElementById('profileModal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.style.display = 'flex';
    }
  };

  window.closeProfileModal = function () {
    const modal = document.getElementById('profileModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.style.display = 'none';
    }
  };

  window.startSession = function () {
    const nick = document.getElementById('inputNick').value.trim();
    const country = document.getElementById('inputCountry').value;
    if (!nick) { showToast('Please enter a nickname', 'error'); return; }
    if (!country) { showToast('Please select your country', 'error'); return; }

    window.canvasState.username = nick;
    window.canvasState.country = country;

    closeProfileModal();
    showToast(`🎉 Welcome, ${nick}! Start drawing!`, 'success');
    sessionLoaded = true;

    setTimeout(() => {
      triggerAchievement('🌍', 'Welcome to the World', `${nick} has joined the canvas!`);
    }, 800);

    // Store in sessionStorage
    try {
      sessionStorage.setItem('geor_nick', nick);
      sessionStorage.setItem('geor_country', country);
    } catch(e) {}

    updateHeaderUser(nick, country);
  };

  function updateHeaderUser(nick, country) {
    const btn = document.querySelector('.btn-join');
    if (btn) {
      btn.textContent = `👤 ${nick}`;
      btn.onclick = showUserProfile;
    }
  }

  function showUserProfile() {
    showToast(`👤 ${window.canvasState.username} · ${userPoints} pts`, 'success');
  }

  // Auto-restore session
  window.addEventListener('DOMContentLoaded', function () {
    try {
      const nick = sessionStorage.getItem('geor_nick');
      const country = sessionStorage.getItem('geor_country');
      if (nick && country) {
        window.canvasState.username = nick;
        window.canvasState.country = country;
        updateHeaderUser(nick, country);
        sessionLoaded = true;
      }
    } catch(e) {}
  });

  window.selectAvatarColor = function (el) {
    document.querySelectorAll('.av-color').forEach(e => e.classList.remove('selected'));
    el.classList.add('selected');
    window.canvasState.avatarColor = el.dataset.color;
  };

  // ── Points ─────────────────────────────────────────────────────────
  window.addPoints = function (pts) {
    userPoints += pts;
    const milestones = [10, 50, 100, 500, 1000, 5000];
    if (milestones.includes(userPoints)) {
      triggerAchievement('⭐', 'Points Milestone', `You reached ${userPoints} points!`);
    }
  };

  // ── Toasts ──────────────────────────────────────────────────────────
  window.showToast = function (message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3200);
  };

  // ── Achievements ───────────────────────────────────────────────────
  window.triggerAchievement = function (icon, title, desc) {
    const popup = document.getElementById('achievementPopup');
    const achIcon = document.getElementById('achIcon');
    const achTitle = document.getElementById('achTitle');
    const achDesc = document.getElementById('achDesc');
    if (!popup) return;
    achIcon.textContent = icon;
    achTitle.textContent = title;
    achDesc.textContent = desc;
    popup.classList.add('show');
    setTimeout(() => popup.classList.remove('show'), 3500);
  };

  // ── Mobile Nav ─────────────────────────────────────────────────────
  window.toggleMobileNav = function () {
    const nav = document.getElementById('mobile-nav');
    if (nav) nav.classList.toggle('open');
  };

  // ── Activity Feed ──────────────────────────────────────────────────
  const feedMessages = [
    ['PixelKing_BR', '🇧🇷', 'drew in Brasil Corner'],
    ['NeonTokyo', '🇯🇵', 'added pixel art'],
    ['WallStreetArt', '🇺🇸', 'claimed a territory'],
    ['SaharaInk', '🇲🇦', 'wrote in Arabic'],
    ['BerlinBrush', '🇩🇪', 'erased a rival\'s tag'],
    ['CairoCanvas', '🇪🇬', 'started a collaboration'],
    ['SeoulPixel', '🇰🇷', 'placed K-art'],
    ['LagosLines', '🇳🇬', 'dropped fire art'],
    ['MumbaiMural', '🇮🇳', 'expanded territory'],
    ['ParisGraffiti', '🇫🇷', 'tagged the Eiffel section'],
    ['Anonymous', '🌍', 'is drawing right now...'],
    ['PixelWars', '⚔️', 'battle zone is hot!'],
  ];

  let feedIndex = 0;
  function addFeedItem() {
    const feed = document.getElementById('activityFeed');
    if (!feed) return;
    const msg = feedMessages[feedIndex % feedMessages.length];
    feedIndex++;
    const item = document.createElement('div');
    item.className = 'feed-item';
    item.innerHTML = `${msg[1]} <span>${msg[0]}</span> ${msg[2]}`;
    feed.insertBefore(item, feed.firstChild);
    if (feed.children.length > 12) feed.removeChild(feed.lastChild);
  }

  setInterval(addFeedItem, 2500);
  addFeedItem();

  // ── Live Count Simulation ──────────────────────────────────────────
  function animateLiveCount() {
    const el = document.getElementById('live-count');
    const statEl = document.getElementById('stat-online');
    if (!el) return;
    let base = 4291;
    setInterval(() => {
      const delta = Math.floor((Math.random() - 0.45) * 15);
      base = Math.max(3800, Math.min(5500, base + delta));
      const formatted = base.toLocaleString();
      el.textContent = formatted;
      if (statEl) statEl.textContent = formatted;
    }, 3000);
  }
  animateLiveCount();

  // ── Pixel count animation ──────────────────────────────────────────
  function animatePixels() {
    const el = document.getElementById('stat-pixels');
    if (!el) return;
    let n = 12400000;
    setInterval(() => {
      n += Math.floor(Math.random() * 500 + 200);
      el.textContent = (n / 1000000).toFixed(1) + 'M';
    }, 800);
  }
  animatePixels();

  // ── Keyboard Shortcuts ─────────────────────────────────────────────
  document.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    switch(e.key.toLowerCase()) {
      case 'p': case 'b': window.setTool('draw'); break;
      case 'e': window.setTool('erase'); break;
      case 't': window.setTool('text'); break;
      case 'f': window.setTool('fill'); break;
      case 'i': window.setTool('eyedrop'); break;
      case 'z': if (e.ctrlKey || e.metaKey) { window.undoLast(); e.preventDefault(); } break;
      case '+': case '=': window.zoomCanvas(1.2); break;
      case '-': window.zoomCanvas(0.8); break;
      case 'h': window.resetView(); break;
      case 'escape': window.cancelText(); break;
    }
  });

  // ── Canvas context menu ────────────────────────────────────────────
  document.getElementById('canvasWrapper')?.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    showToast('💡 Tip: Alt+drag to pan • Scroll to zoom • R-click blocked', 'warn');
  });

  // ── Zone label on hover ────────────────────────────────────────────
  const zones = [
    { x: 200, y: 200, w: 500, h: 400, name: '🇧🇷 Brasil Corner' },
    { x: 1600, y: 380, w: 600, h: 280, name: '⚔️ Battle Zone' },
    { x: 2600, y: 300, w: 400, h: 300, name: '🇯🇵 Tokyo Pixel Art' },
    { x: 100, y: 1100, w: 500, h: 300, name: '🇺🇸 USA Mural Zone' },
    { x: 1000, y: 1700, w: 600, h: 200, name: '🌍 GeoR Global Center' },
    { x: 2800, y: 800, w: 400, h: 200, name: '🇲🇦 Maroc Art' },
  ];

  const wrapper = document.getElementById('canvasWrapper');
  const zoneLabel = document.getElementById('zoneLabel');

  wrapper?.addEventListener('mousemove', function(e) {
    if (!window.canvasState) return;
    const rect = wrapper.getBoundingClientRect();
    const cx = (e.clientX - rect.left - window.canvasState.offsetX) / window.canvasState.zoom;
    const cy = (e.clientY - rect.top - window.canvasState.offsetY) / window.canvasState.zoom;

    let found = 'Global Canvas';
    zones.forEach(z => {
      if (cx >= z.x && cx <= z.x + z.w && cy >= z.y && cy <= z.y + z.h) {
        found = z.name;
      }
    });
    if (zoneLabel) zoneLabel.textContent = found;
  });

  // ── Onboarding: show modal on first visit ──────────────────────────
  window.addEventListener('load', function() {
    // If already have a session from sessionStorage, skip modal
    const nick = sessionStorage.getItem('geor_nick');
    if (nick) return;

    const visited = sessionStorage.getItem('geor_visited');
    if (!visited) {
      sessionStorage.setItem('geor_visited', '1');
      setTimeout(() => openProfileModal(), 800);
    }
  });

})();
