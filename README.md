# GeoR.xyz — One World. One Canvas.

> A global collaborative canvas where humanity can draw, write, create, compete, and leave its mark together in real time.

![GeoR Banner](assets/og-image.png)

**Live Demo:** [https://geor.xyz](https://geor.xyz)  
**Contact:** salatrir@gmail.com  
**License:** MIT

---

## 🌍 What is GeoR?

GeoR is a **Reddit Place × online graffiti × collaborative art × digital world battlefield** — all rolled into one shared canvas. Every visitor from every country can draw, write, erase, claim territory, compete in Pixel Wars, and collaborate with strangers across the globe.

The homepage **is** the product. The canvas itself is the battlefield.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🎨 Global Canvas | Infinite shared drawing space, 4000×3000px base |
| 🖊️ Drawing Tools | Pen, Fill, Text, Eraser, Eyedropper |
| 🌍 World Map | Live participation stats by country |
| ⚔️ Battle Mode | Draw over rivals, claim/defend territory |
| 👑 Leaderboard | Top creators, countries, territories |
| 📜 History | Daily snapshots + canvas evolution timeline |
| ⚡ Events | Pixel Wars, World Art Day, Speed Draw, challenges |
| 🏆 Gamification | Points, badges, achievements, seasonal rankings |
| 💬 Social | Activity feed, live user cursors, zone labels |
| 📱 Responsive | Works on mobile, tablet, desktop |

---

## 🗂️ Project Structure

```
geor/
├── index.html              # Main canvas homepage (the battlefield)
├── css/
│   └── style.css           # Full design system (dark, futuristic)
├── js/
│   ├── canvas.js           # Canvas engine (draw, zoom, pan, undo, fill)
│   ├── ui.js               # UI module (modals, toasts, profile, nav)
│   └── simulation.js       # Real-time simulation (cursors, drawing activity)
├── pages/
│   ├── worldmap.html       # Global participation map
│   ├── leaderboard.html    # Rankings (creators, countries, territories)
│   ├── events.html         # Events calendar + live countdown
│   ├── history.html        # Canvas timeline + daily snapshots
│   └── contact.html        # Contact form + FAQ
├── assets/
│   ├── og-image.png        # Open Graph / Twitter Card image
│   └── icons/              # Favicon, PWA icons
├── sitemap.xml             # SEO sitemap
├── robots.txt              # Crawler rules
└── README.md               # This file
```

---

## 🚀 Installation & Local Development

GeoR is a **100% static site** — no build tools, no Node.js, no dependencies required.

### Option A — Open directly
```bash
# Just open index.html in your browser
open index.html
```

### Option B — Local server (recommended for full functionality)
```bash
# Python
python3 -m http.server 8080

# Or Node.js
npx serve .

# Then visit: http://localhost:8080
```

---

## 🌐 GitHub Pages Deployment

### Step 1 — Initialize repository
```bash
git init
git add .
git commit -m "Launch GeoR"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/geor.git
git push -u origin main
```

### Step 2 — Enable GitHub Pages
1. Go to your repo on GitHub
2. Settings → Pages
3. Source: **Deploy from a branch**
4. Branch: `main` / `/ (root)`
5. Save — your site is live at `https://YOUR_USERNAME.github.io/geor`

### Step 3 — Custom domain (GeoR.xyz)
1. In repo root, create file `CNAME` containing: `geor.xyz`
2. In your domain registrar DNS, add:
   - `A` records pointing to GitHub Pages IPs:
     ```
     185.199.108.153
     185.199.109.153
     185.199.110.153
     185.199.111.153
     ```
   - Or `CNAME` record: `YOUR_USERNAME.github.io`
3. Enable "Enforce HTTPS" in GitHub Pages settings

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                     Browser                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │canvas.js │  │  ui.js   │  │ simulation.js    │  │
│  │ Drawing  │  │ Modals   │  │ Fake real-time   │  │
│  │ Zoom/Pan │  │ Toasts   │  │ Cursor movement  │  │
│  │ Tools    │  │ Profile  │  │ Bot drawing      │  │
│  │ History  │  │ Feed     │  │ Events/notifs    │  │
│  └──────────┘  └──────────┘  └──────────────────┘  │
│         ↕              ↕               ↕            │
│  ┌──────────────────────────────────────────────┐   │
│  │          HTML5 Canvas (4000×3000px)          │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
         ↕ (Production: replace simulation with ↓)
┌─────────────────────────────────────────────────────┐
│              WebSocket Server (Node.js)              │
│  Socket.io → broadcast pixel events to all clients  │
│  Redis → store canvas state                         │
│  PostgreSQL → users, points, territories, history   │
└─────────────────────────────────────────────────────┘
```

---

## ⚡ Real-Time Synchronization Guide

The current build uses **client-side simulation** (simulation.js). To upgrade to real-time multiplayer:

### Server Setup (Node.js + Socket.io)
```javascript
// server.js
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

// In-memory canvas state (use Redis in production)
const canvasState = {}; // key: "x,y", value: { color, user }

io.on('connection', (socket) => {
  // Send current canvas state to new user
  socket.emit('canvas:init', canvasState);

  // Receive pixel event from one client
  socket.on('pixel:draw', ({ x, y, color, size, user }) => {
    canvasState[`${x},${y}`] = { color, user };
    // Broadcast to ALL other clients instantly
    socket.broadcast.emit('pixel:draw', { x, y, color, size, user });
  });

  socket.on('cursor:move', (data) => {
    socket.broadcast.emit('cursor:move', { ...data, id: socket.id });
  });
});

httpServer.listen(3000);
```

### Client Integration
Replace `simulation.js` with:
```javascript
const socket = io('wss://your-server.com');

// Send strokes
socket.emit('pixel:draw', { x, y, color, size, user: username });

// Receive others' strokes
socket.on('pixel:draw', ({ x, y, color, size }) => {
  ctx.fillStyle = color;
  ctx.fillRect(x - size/2, y - size/2, size, size);
});

// Broadcast cursor position
canvas.addEventListener('mousemove', (e) => {
  socket.emit('cursor:move', { x: canvasX, y: canvasY, user: username });
});
```

---

## 🛡️ Moderation Recommendations

1. **Rate limiting** — Max 500 pixels/second per user IP
2. **Content filtering** — Perceptual hashing to detect NSFW pixel patterns
3. **Report system** — Users can flag coordinates; mods review via admin panel
4. **Undo buffer** — Store last 10 minutes of strokes per user for rollback
5. **VPN detection** — Flag suspicious multi-account territory abuse
6. **Canvas snapshots** — Auto-save every hour to S3 for dispute resolution
7. **Banned zones** — Mark certain coordinates as protected (e.g., GeoR logo area)
8. **Community mods** — Top 50 users by reputation get moderation tools

---

## 🎨 Design System

| Token | Value | Use |
|---|---|---|
| `--accent-cyan` | `#00ffcc` | Primary accent, active states |
| `--accent-red` | `#ff0040` | Battle/danger/live indicators |
| `--accent-yellow` | `#ffdd00` | Rankings, achievements |
| `--accent-purple` | `#8800ff` | Seasonal events |
| `--bg-void` | `#050508` | Page background |
| `--font-display` | Orbitron | Headers, logo, numbers |
| `--font-mono` | Space Mono | Stats, coordinates, code |
| `--font-ui` | Rajdhani | Body text, UI elements |

---

## 🔑 Keyboard Shortcuts

| Key | Action |
|---|---|
| `P` / `B` | Pen tool |
| `E` | Eraser |
| `T` | Text tool |
| `F` | Fill bucket |
| `I` | Eyedropper |
| `Ctrl+Z` | Undo |
| `+` / `-` | Zoom in/out |
| `H` | Reset view |
| `Esc` | Cancel text input |
| `Alt+Drag` | Pan canvas |
| `Scroll` | Zoom at cursor |

---

## 📊 SEO & Open Graph

The project includes:
- `sitemap.xml` — All pages with priorities and changefreq
- `robots.txt` — Search engine crawler rules
- Open Graph tags on all pages
- Twitter Card `summary_large_image` on all pages
- `schema.org WebApplication` structured data
- Canonical URLs

---

## 📬 Contact

**Email:** salatrir@gmail.com  
**Project:** GeoR.xyz  
**Slogan:** One World. One Canvas.

---

## 📄 License

MIT License — free to use, modify, and deploy.

---

*GeoR.xyz — Built for the world, by the world.*
