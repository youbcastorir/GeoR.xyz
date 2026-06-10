import zipfile
import os

# إنشاء مجلد مؤقت للمشروع
project_dir = "GeoR"
os.makedirs(project_dir, exist_ok=True)

# الملفات ومحتوياتها (كما وردت أعلاه)
files = {
    "server.js": '''const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

// Initialize lowdb
const adapter = new JSONFile('db.json');
const db = new Low(adapter, {});
await db.read();
db.data ||= {
  actions: [],        // drawing strokes, text, erasures
  territories: [],
  users: {},
  comments: [],
  follows: [],
  events: [
    { id: '1', name: 'Pixel Wars', active: true, description: 'Fight for territory!', start: Date.now() },
    { id: '2', name: 'World Art Day', active: false, description: 'Collaborative mural', start: Date.now() + 86400000 }
  ],
  globalPoints: {}
};
await db.write();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Helper: get or create user
function getUser(userId, socketId) {
  if (!db.data.users[userId]) {
    db.data.users[userId] = {
      id: userId,
      nickname: `Explorer_${Math.floor(Math.random() * 10000)}`,
      country: 'Unknown',
      points: 0,
      achievements: [],
      createdAt: Date.now(),
      lastSeen: Date.now(),
      socketId
    };
    db.write();
  } else {
    db.data.users[userId].lastSeen = Date.now();
    db.data.users[userId].socketId = socketId;
    db.write();
  }
  return db.data.users[userId];
}

// API endpoints
app.get('/api/leaderboard', (req, res) => {
  const users = Object.values(db.data.users);
  const sorted = users.sort((a,b) => b.points - a.points).slice(0, 20);
  res.json(sorted);
});

app.get('/api/territories', (req, res) => res.json(db.data.territories));
app.get('/api/actions', (req, res) => res.json(db.data.actions.slice(-10000)));
app.get('/api/comments', (req, res) => res.json(db.data.comments));
app.get('/api/events', (req, res) => res.json(db.data.events));

// Socket.IO real-time
io.on('connection', (socket) => {
  let currentUserId = null;

  socket.on('register', async ({ userId, nickname, country }) => {
    currentUserId = userId;
    let user = getUser(userId, socket.id);
    if (nickname) user.nickname = nickname.slice(0, 20);
    if (country) user.country = country;
    await db.write();
    
    socket.emit('init', {
      actions: db.data.actions,
      territories: db.data.territories,
      users: Object.values(db.data.users),
      comments: db.data.comments,
      events: db.data.events
    });
    io.emit('user_joined', { userId: user.id, nickname: user.nickname, country: user.country });
    updateWorldMap();
  });

  socket.on('draw', async (data) => {
    const user = db.data.users[currentUserId];
    if (!user) return;
    const action = {
      ...data,
      userId: currentUserId,
      nickname: user.nickname,
      timestamp: Date.now()
    };
    db.data.actions.push(action);
    user.points += 1;
    await db.write();
    socket.broadcast.emit('draw', action);
    updateLeaderboards();
  });

  socket.on('claim_territory', async ({ x, y, w, h }) => {
    const user = db.data.users[currentUserId];
    if (!user) return;
    const territory = {
      id: uuidv4(),
      x, y, width: w, height: h,
      ownerId: currentUserId,
      ownerName: user.nickname,
      timestamp: Date.now()
    };
    db.data.territories.push(territory);
    user.points += 50;
    await db.write();
    io.emit('territory_claimed', territory);
    updateLeaderboards();
  });

  socket.on('comment', async ({ message }) => {
    const user = db.data.users[currentUserId];
    if (!user || !message.trim()) return;
    const comment = {
      id: uuidv4(),
      userId: currentUserId,
      nickname: user.nickname,
      message: message.slice(0, 280),
      timestamp: Date.now(),
      likes: []
    };
    db.data.comments.unshift(comment);
    user.points += 2;
    await db.write();
    io.emit('new_comment', comment);
  });

  socket.on('like_comment', async ({ commentId }) => {
    const comment = db.data.comments.find(c => c.id === commentId);
    if (comment && !comment.likes.includes(currentUserId)) {
      comment.likes.push(currentUserId);
      const author = db.data.users[comment.userId];
      if (author) author.points += 1;
      await db.write();
      io.emit('comment_liked', { commentId, likes: comment.likes.length, likerId: currentUserId });
      if (author && author.socketId) {
        io.to(author.socketId).emit('notification', { text: `${db.data.users[currentUserId]?.nickname} liked your comment` });
      }
    }
  });

  socket.on('follow', async ({ targetUserId }) => {
    if (currentUserId === targetUserId) return;
    if (!db.data.follows.some(f => f.follower === currentUserId && f.followed === targetUserId)) {
      db.data.follows.push({ follower: currentUserId, followed: targetUserId, timestamp: Date.now() });
      await db.write();
      const followedUser = db.data.users[targetUserId];
      if (followedUser && followedUser.socketId) {
        io.to(followedUser.socketId).emit('notification', { text: `${db.data.users[currentUserId]?.nickname} started following you` });
      }
    }
  });

  socket.on('disconnect', () => {
    if (currentUserId) {
      db.data.users[currentUserId].lastSeen = Date.now();
      db.write();
      io.emit('user_left', currentUserId);
      updateWorldMap();
    }
  });
});

function updateWorldMap() {
  const activeUsers = Object.values(db.data.users).filter(u => Date.now() - u.lastSeen < 60000);
  const countries = {};
  activeUsers.forEach(u => { countries[u.country] = (countries[u.country] || 0) + 1; });
  io.emit('world_map', countries);
}

function updateLeaderboards() {
  const tops = Object.values(db.data.users).sort((a,b) => b.points - a.points).slice(0, 10);
  io.emit('leaderboard_update', tops);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`GeoR running on port ${PORT}`));
''',
    "package.json": '''{
  "name": "geor",
  "version": "1.0.0",
  "description": "Global collaborative canvas – One World. One Canvas.",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "socket.io": "^4.6.1",
    "lowdb": "^6.1.1",
    "uuid": "^9.0.0",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
''',
    "index.html": '''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>GeoR – One World. One Canvas.</title>
  <meta name="description" content="Global collaborative canvas. Draw, erase, claim territories, chat, and leave your mark on the world map.">
  <meta property="og:title" content="GeoR – Global Collaborative Canvas">
  <meta property="og:description" content="Join the battle for visibility. Create art, compete, collaborate.">
  <meta property="og:image" content="https://geor.xyz/og-image.png">
  <meta property="og:url" content="https://geor.xyz">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="stylesheet" href="style.css">
  <link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,600;14..32,700&display=swap" rel="stylesheet">
</head>
<body>
  <div class="app">
    <aside class="sidebar left">
      <div class="logo">
        <h1>GeoR</h1>
        <span>One World. One Canvas.</span>
      </div>
      <div class="tools">
        <button id="tool-brush" class="tool-btn active" data-tool="brush">✏️ Brush</button>
        <button id="tool-eraser" class="tool-btn" data-tool="eraser">🧽 Eraser</button>
        <button id="tool-text" class="tool-btn" data-tool="text">📝 Text</button>
        <button id="tool-territory" class="tool-btn" data-tool="territory">🏰 Claim Territory</button>
        <input type="color" id="color-picker" value="#ff3366">
        <input type="range" id="brush-size" min="1" max="50" value="5">
      </div>
      <div class="zoom-controls">
        <button id="zoom-in">🔍 Zoom +</button>
        <button id="zoom-out">🔍 Zoom -</button>
        <button id="reset-view">⟳ Reset</button>
      </div>
      <div class="user-profile">
        <div class="avatar" id="user-avatar">👤</div>
        <input type="text" id="nickname" maxlength="20" placeholder="Your nickname">
        <select id="country">
          <option value="US">USA</option><option value="GB">UK</option><option value="FR">France</option>
          <option value="DE">Germany</option><option value="JP">Japan</option><option value="BR">Brazil</option>
          <option value="IN">India</option><option value="CN">China</option><option value="Other">Other</option>
        </select>
        <div id="user-points">Points: 0</div>
      </div>
    </aside>

    <main class="canvas-container">
      <canvas id="world-canvas" width="2000" height="2000"></canvas>
      <div id="tooltip" class="tooltip"></div>
    </main>

    <aside class="sidebar right">
      <div class="tabs">
        <button class="tab-btn active" data-tab="chat">💬 Chat</button>
        <button class="tab-btn" data-tab="leaderboard">🏆 Leaderboard</button>
        <button class="tab-btn" data-tab="worldmap">🌍 World Map</button>
        <button class="tab-btn" data-tab="timeline">⏱️ Timeline</button>
        <button class="tab-btn" data-tab="events">🎉 Events</button>
      </div>
      <div id="chat-tab" class="tab-content active">
        <div id="comments-list" class="comments-list"></div>
        <div class="comment-input">
          <input type="text" id="comment-text" placeholder="Leave a global message...">
          <button id="send-comment">➤</button>
        </div>
      </div>
      <div id="leaderboard-tab" class="tab-content">
        <div id="leaderboard-list"></div>
      </div>
      <div id="worldmap-tab" class="tab-content">
        <div id="worldmap-container"></div>
        <div id="active-users-count"></div>
      </div>
      <div id="timeline-tab" class="tab-content">
        <input type="range" id="timeline-slider" min="0" max="100" value="100">
        <button id="replay-btn">▶️ Replay to this moment</button>
        <div id="timeline-info"></div>
      </div>
      <div id="events-tab" class="tab-content">
        <div id="events-list"></div>
      </div>
    </aside>
  </div>
  <footer>
    <p>GeoR.xyz is a global collaborative canvas where humanity can create, compete, communicate, and leave its mark together.</p>
    <p>📧 <a href="mailto:salatrir@gmail.com">salatrir@gmail.com</a></p>
  </footer>
  <script src="/socket.io/socket.io.js"></script>
  <script src="script.js"></script>
</body>
</html>
''',
    "style.css": '''* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Inter', sans-serif;
  background: #0a0a0f;
  color: #eee;
  overflow: hidden;
}

.app {
  display: flex;
  height: calc(100vh - 60px);
}

/* Sidebars */
.sidebar {
  width: 280px;
  background: rgba(18, 18, 28, 0.95);
  backdrop-filter: blur(10px);
  border-right: 1px solid rgba(255,255,255,0.1);
  display: flex;
  flex-direction: column;
  padding: 1rem;
  gap: 1rem;
  overflow-y: auto;
}

.sidebar.right {
  border-right: none;
  border-left: 1px solid rgba(255,255,255,0.1);
}

.logo h1 {
  font-size: 1.8rem;
  background: linear-gradient(135deg, #ff3366, #33ffcc);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.tools {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.tool-btn {
  background: #2a2a3a;
  border: none;
  color: white;
  padding: 0.5rem;
  border-radius: 12px;
  cursor: pointer;
  transition: 0.2s;
  font-size: 0.9rem;
}

.tool-btn.active {
  background: #ff3366;
  box-shadow: 0 0 10px #ff3366;
}

#color-picker, #brush-size {
  width: 100%;
  margin-top: 0.5rem;
}

.canvas-container {
  flex: 1;
  position: relative;
  background: #121218;
  overflow: hidden;
  cursor: crosshair;
}

canvas {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
  box-shadow: 0 0 30px rgba(0,0,0,0.5);
}

.tooltip {
  position: fixed;
  background: black;
  padding: 4px 8px;
  border-radius: 8px;
  font-size: 12px;
  pointer-events: none;
  z-index: 1000;
}

/* Tabs */
.tabs {
  display: flex;
  gap: 0.5rem;
  border-bottom: 1px solid #333;
}

.tab-btn {
  background: none;
  border: none;
  color: #aaa;
  padding: 0.5rem;
  cursor: pointer;
}

.tab-btn.active {
  color: #ff3366;
  border-bottom: 2px solid #ff3366;
}

.tab-content {
  display: none;
  flex-direction: column;
  gap: 1rem;
  height: 100%;
  overflow-y: auto;
}

.tab-content.active {
  display: flex;
}

.comments-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.comment-item {
  background: #1e1e2a;
  padding: 0.8rem;
  border-radius: 12px;
  border-left: 3px solid #ff3366;
}

.comment-header {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  color: #ff3366;
  margin-bottom: 0.3rem;
}

.comment-likes {
  cursor: pointer;
  color: #33ffcc;
}

#leaderboard-list, #worldmap-container, #events-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

footer {
  height: 60px;
  background: #050508;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2rem;
  font-size: 0.8rem;
  border-top: 1px solid #222;
  padding: 0 1rem;
}

footer a {
  color: #33ffcc;
  text-decoration: none;
}

@media (max-width: 800px) {
  .sidebar { width: 240px; }
  .tools .tool-btn { font-size: 0.7rem; }
}
''',
    "script.js": '''const socket = io();
let userId = localStorage.getItem('geor_userId');
if (!userId) { userId = crypto.randomUUID(); localStorage.setItem('geor_userId', userId); }

let nickname = localStorage.getItem('geor_nickname') || '';
let country = localStorage.getItem('geor_country') || 'US';

// Canvas & drawing state
const canvas = document.getElementById('world-canvas');
const ctx = canvas.getContext('2d');
let scale = 1;
let offsetX = 0, offsetY = 0;
let isDrawing = false;
let currentTool = 'brush';
let brushColor = '#ff3366';
let brushSize = 5;
let lastX, lastY;

// UI elements
const toolBtns = document.querySelectorAll('.tool-btn');
const colorPicker = document.getElementById('color-picker');
const brushSizeInput = document.getElementById('brush-size');
const nicknameInput = document.getElementById('nickname');
const countrySelect = document.getElementById('country');
const userPointsSpan = document.getElementById('user-points');

nicknameInput.value = nickname;
countrySelect.value = country;
colorPicker.addEventListener('input', (e) => brushColor = e.target.value);
brushSizeInput.addEventListener('input', (e) => brushSize = parseInt(e.target.value));

// Set active tool
toolBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    toolBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTool = btn.dataset.tool;
  });
});

// Zoom & pan
document.getElementById('zoom-in').onclick = () => { scale *= 1.2; applyTransform(); };
document.getElementById('zoom-out').onclick = () => { scale /= 1.2; applyTransform(); };
document.getElementById('reset-view').onclick = () => { scale = 1; offsetX = 0; offsetY = 0; applyTransform(); };

function applyTransform() {
  canvas.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
}

// Convert screen to canvas coordinates
function screenToCanvas(screenX, screenY) {
  const rect = canvas.getBoundingClientRect();
  const canvasX = (screenX - rect.left - offsetX) / scale;
  const canvasY = (screenY - rect.top - offsetY) / scale;
  return { x: canvasX, y: canvasY };
}

// Drawing logic
function startDraw(e) {
  isDrawing = true;
  const { x, y } = screenToCanvas(e.clientX, e.clientY);
  lastX = x; lastY = y;
  if (currentTool === 'text') {
    const text = prompt('Enter your message:', 'GeoR');
    if (text) {
      socket.emit('draw', { type: 'text', x, y, text, color: brushColor, size: 24 });
    }
    isDrawing = false;
  } else if (currentTool === 'territory') {
    // Simplified: claim 100x100 area
    socket.emit('claim_territory', { x, y, w: 100, h: 100 });
    isDrawing = false;
  }
}

function drawMove(e) {
  if (!isDrawing) return;
  const { x, y } = screenToCanvas(e.clientX, e.clientY);
  if (currentTool === 'brush') {
    socket.emit('draw', { type: 'stroke', points: [{x:lastX, y:lastY}, {x, y}], color: brushColor, size: brushSize });
  } else if (currentTool === 'eraser') {
    socket.emit('draw', { type: 'stroke', points: [{x:lastX, y:lastY}, {x, y}], color: '#121218', size: brushSize });
  }
  lastX = x; lastY = y;
}

function endDraw() { isDrawing = false; }

canvas.addEventListener('mousedown', startDraw);
canvas.addEventListener('mousemove', drawMove);
canvas.addEventListener('mouseup', endDraw);
canvas.addEventListener('mouseleave', endDraw);

// Render all actions
function renderAction(action) {
  if (action.type === 'stroke') {
    ctx.beginPath();
    ctx.moveTo(action.points[0].x, action.points[0].y);
    ctx.lineTo(action.points[1].x, action.points[1].y);
    ctx.strokeStyle = action.color;
    ctx.lineWidth = action.size;
    ctx.stroke();
  } else if (action.type === 'text') {
    ctx.font = `${action.size}px "Inter"`;
    ctx.fillStyle = action.color;
    ctx.fillText(action.text, action.x, action.y);
  }
}

// Real-time socket handlers
socket.on('init', (data) => {
  data.actions.forEach(renderAction);
  data.territories.forEach(t => drawTerritory(t));
  updateLeaderboard(data.users);
  data.comments.forEach(addCommentToDOM);
});

socket.on('draw', (action) => { renderAction(action); });
socket.on('territory_claimed', (t) => { drawTerritory(t); });
socket.on('new_comment', (c) => { addCommentToDOM(c); });
socket.on('comment_liked', ({ commentId, likes }) => {
  const likeSpan = document.querySelector(`.comment-item[data-id="${commentId}"] .comment-likes`);
  if (likeSpan) likeSpan.innerText = `❤️ ${likes}`;
});
socket.on('leaderboard_update', updateLeaderboard);
socket.on('world_map', (countries) => updateWorldMap(countries));
socket.on('notification', (notif) => { alert(`🔔 ${notif.text}`); });

function drawTerritory(t) {
  ctx.save();
  ctx.strokeStyle = '#ffaa33';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.strokeRect(t.x, t.y, t.width, t.height);
  ctx.fillStyle = '#ffaa33cc';
  ctx.font = '12px Inter';
  ctx.fillText(`🏰 ${t.ownerName}`, t.x+5, t.y+15);
  ctx.restore();
}

function updateLeaderboard(users) {
  const container = document.getElementById('leaderboard-list');
  container.innerHTML = users.map(u => `<div>🏅 ${u.nickname} — ${u.points} pts</div>`).join('');
}

function updateWorldMap(countries) {
  const container = document.getElementById('worldmap-container');
  container.innerHTML = Object.entries(countries).map(([c, count]) => `<div>${c}: ${count} active</div>`).join('');
  document.getElementById('active-users-count').innerText = `🌐 Total active: ${Object.values(countries).reduce((a,b)=>a+b,0)}`;
}

function addCommentToDOM(comment) {
  const container = document.getElementById('comments-list');
  const div = document.createElement('div');
  div.className = 'comment-item';
  div.setAttribute('data-id', comment.id);
  div.innerHTML = `
    <div class="comment-header">
      <span>${comment.nickname}</span>
      <span class="comment-likes">❤️ ${comment.likes.length}</span>
    </div>
    <div>${comment.message}</div>
    <div style="font-size:10px; margin-top:5px;">${new Date(comment.timestamp).toLocaleTimeString()}</div>
  `;
  div.querySelector('.comment-likes').onclick = () => socket.emit('like_comment', { commentId: comment.id });
  container.prepend(div);
}
