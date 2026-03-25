let album = [
  { src: '1.jpg', msg: '山道の緑が気持ちいいですね！' },
  { src: '2.jpg', msg: '階段きつかった' },
  { src: '3.jpg', msg: '高尾山薬王院！' },
  { src: '4.jpg', msg: '帰りはロープウェイでスイスイ' },
  { src: '5.jpg', msg: '〆のお蕎麦です' }
];

// ====== DOM ======
const gallery = document.getElementById('gallery');
const mainFlame = document.querySelector('#gallery .main');
const thumbFlame = document.querySelector('#gallery .thumb');

const gameSection = document.getElementById('game');         // 初期はhidden想定（index.html側）
const canvas = document.getElementById('stage');
const overlay = document.getElementById('overlay');
const hpPlayerEl = document.getElementById('hp-player');
const hpEnemyEl = document.getElementById('hp-enemy');
const btnRetry = document.getElementById('btn-retry');

const resultSection = document.getElementById('result');
const resultImg = document.getElementById('result-image');
const resultMsg = document.getElementById('result-msg');
const btnBack = document.getElementById('btn-back');
let isGalleryVisible = false; // mainFlame, mainMsg 表示中は true


// ====== Build gallery (select screen) ======
// 勝利時に挿入するため、ここでは生成のみ
const mainImage = document.createElement('img');
const mainMsg = document.createElement('p');

// サムネイル生成
album.forEach((a, i) => {
  const img = document.createElement('img');
  img.setAttribute('src', a.src);
  img.setAttribute('alt', a.msg);
  img.setAttribute('role', 'option');
  img.setAttribute('tabindex', '0');
  img.dataset.index = String(i);
  if (i === 0) img.setAttribute('aria-selected', 'true');
  thumbFlame.appendChild(img);
});

// サムネクリック／Enter/Spaceで選択（idle時のみ）
thumbFlame.addEventListener('click', onSelect);
thumbFlame.addEventListener('keydown', (e) => {
  if (state !== 'idle') return;
  if (e.key === 'Enter') { // ← Space を外す
     const t = e.target;
     if (t && t.dataset && t.dataset.index) {
       onSelect({ target: t });
       e.preventDefault();
     }
   }
});

function onSelect(event) {
  if (state !== 'idle') return;                      // play中にリセットされない
  if (!event.target || !event.target.src) return;
  const idx = Number(event.target.dataset.index);
  selectIndex(idx);
  startGame(idx);
}

function selectIndex(i) {
  // aria-selectedの表示だけ反映（画像の差し替えは勝利後に行う）
  [...thumbFlame.querySelectorAll('img')].forEach((el, j) => {
    el.setAttribute('aria-selected', j === i ? 'true' : 'false');
  });
}

// ====== Game state ======
let state = 'idle'; // 'idle' | 'playing' | 'win' | 'lose'
let keys = new Set();
let rafId = 0;

let player, enemy, bulletsP, bulletsE, lastShotP, lastShotE, enemySprite;

// ====== Canvas fit to DPR ======
const ctx = canvas.getContext('2d');
function fitCanvasToDisplay() {
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const cssW = canvas.clientWidth || canvas.width;
  const cssH = canvas.clientHeight || canvas.height;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
fitCanvasToDisplay();
window.addEventListener('resize', fitCanvasToDisplay);

// ====== Input ======
window.addEventListener('keydown', (e) => {
  const isSpace = (e.key === ' ' || e.code === 'Space');

  // ★ ギャラリーが表示中のときは Space 無効
  if (isGalleryVisible && isSpace) {
    e.preventDefault(); // スクロール防止
    return;             // バトル再開・弾発射 どちらも無効
  }

  // 通常入力処理
  keys.add(e.key.toLowerCase());

  // バトル中のみ Spaceスクロール防止
  if (state === 'playing' && isSpace) {
    e.preventDefault();
  }
});



window.addEventListener('keyup', (e) => {
  keys.delete(e.key.toLowerCase());
});

// ====== Buttons ======
btnRetry?.addEventListener('click', () => {
  if (state !== 'playing' && typeof enemy?.idx === 'number') {
    startGame(enemy.idx);
  }
});
btnBack?.addEventListener('click', () => {
  resultSection.classList.add('hidden');
  state = 'idle';
  overlay.classList.add('hidden');
  btnRetry.classList.add('hidden');
  gameSection?.classList.add('hidden');             // 選択画面に戻る
  gallery?.scrollIntoView({ behavior: 'smooth' });
});

// ====== Preload sprites ======
const spriteCache = new Map();
album.forEach(a => {
  const im = new Image();
  im.src = a.src;
  spriteCache.set(a.src, im);
});

function startGame(opponentIndex) {
  state = 'playing';
  isGalleryVisible = false; // ★ バトル中はギャラリー非表示
  mainFlame.classList.add('hidden');

  gameSection?.classList.remove('hidden');
  overlay.textContent = 'バトル開始！';
  overlay.classList.remove('hidden');
  btnRetry.classList.add('hidden');
  resultSection.classList.add('hidden');

  const W = canvas.clientWidth;
  const H = canvas.clientHeight;

  player = { x: W * 0.18, y: H * 0.5, r: 14, speed: 3.2, hp: 100, hpMax: 100 };
  enemy  = { x: W * 0.82, y: H * 0.5, r: 18, speed: 2.6, hp: 120, hpMax: 120, idx: opponentIndex };

  lastShotP = 0;
  lastShotE = 0;
  bulletsP = [];
  bulletsE = [];
  enemySprite = spriteCache.get(album[opponentIndex].src);

  updateHPBars();
  cancelAnimationFrame(rafId);
  loop();
}


function updateHPBars() {
  const p = Math.max(0, Math.min(1, player.hp / player.hpMax)) * 100;
  const e = Math.max(0, Math.min(1, enemy.hp / enemy.hpMax)) * 100;
  hpPlayerEl.style.width = `${p}%`;
  hpEnemyEl.style.width = `${e}%`;
}

// ====== Game Loop ======
function loop(ts = performance.now()) {
  rafId = requestAnimationFrame(loop);
  if (state !== 'playing') return;

  const W = canvas.clientWidth;
  const H = canvas.clientHeight;

  // clear
  ctx.clearRect(0, 0, W, H);

  // ---- Player move (arrow keys) ----
 const vx =
  (keys.has('arrowleft') || keys.has('a') ? -1 : 0) +
  (keys.has('arrowright') || keys.has('d') ? 1 : 0);
const vy =
  (keys.has('arrowup') || keys.has('w') ? -1 : 0) +
  (keys.has('arrowdown') || keys.has('s') ? 1 : 0);
  const len = Math.hypot(vx, vy) || 1;
  player.x += (vx / len) * player.speed;
  player.y += (vy / len) * player.speed;
  player.x = Math.max(player.r, Math.min(W - player.r, player.x));
  player.y = Math.max(player.r, Math.min(H - player.r, player.y));

  // ---- Player shoot (Space) ----
  if (keys.has(' ') || keys.has('space')) {
    if (ts - lastShotP > 140) {
      bulletsP.push(spawnBullet(player.x, player.y, 6));
      lastShotP = ts;
    }
  }

  // ---- Enemy AI: vertical strafe & aimed shots ----
  const dy = player.y - enemy.y;
  enemy.y += Math.sign(dy) * Math.min(Math.abs(dy) * 0.04, enemy.speed);
  enemy.y = Math.max(enemy.r, Math.min(H - enemy.r, enemy.y));

  if (ts - lastShotE > 520) {
    const ang = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    const spd = 3.2;
    bulletsE.push({
      x: enemy.x - enemy.r - 6,
      y: enemy.y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      r: 5,
      color: '#ff6b81'
    });
    lastShotE = ts;
  }

  // ---- Update bullets ----
  updateBullets(bulletsP, W, H);
  updateBullets(bulletsE, W, H);

  // ---- Collisions ----
  hitCheck(bulletsP, enemy, () => {
    enemy.hp -= 8;
    updateHPBars();
  });
  hitCheck(bulletsE, player, () => {
    player.hp -= 10;
    updateHPBars();
  });

  // ---- Draw ----
  drawEnemy(enemy, enemySprite);
  drawPlayer(player);
  drawBullets(bulletsP);
  drawBullets(bulletsE);

  // ---- End check ----
  if (enemy.hp <= 0) return onWin();
  if (player.hp <= 0) return onLose();
}

// ====== Entities & Rendering ======
function spawnBullet(x, y, speed) {
  return { x: x + 10, y, vx: speed, vy: 0, r: 4, color: '#7cdcff' };
}

function updateBullets(arr, W, H) {
  for (let i = arr.length - 1; i >= 0; i--) {
    const b = arr[i];
    b.x += b.vx;
    b.y += b.vy;

    // 画面右端(プレイヤー弾)または左端(敵弾)を超えたら消す
    if (b.x > W + b.r || b.x < -b.r || b.y < -b.r || b.y > H + b.r) {
      arr.splice(i, 1);
    }
  }
}

function hitCheck(bullets, entity, onHit = () => {}) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    const d = Math.hypot(b.x - entity.x, b.y - entity.y);
    if (d < b.r + entity.r) {
      bullets.splice(i, 1);
      onHit();
    }
  }
}

function drawPlayer(p) {
  // blue circle
  ctx.save();
  ctx.shadowColor = 'rgba(124,220,255,.7)';
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
  ctx.fillStyle = '#2eaaff';
  ctx.fill();
  ctx.restore();

  // small eye
  ctx.beginPath();
  ctx.arc(p.x + 5, p.y - 3, 2, 0, Math.PI * 2);
  ctx.fillStyle = '#003a66';
  ctx.fill();
}

function drawEnemy(e, sprite) {
  const size = e.r * 2.2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  if (sprite && sprite.complete) {
    ctx.drawImage(sprite, e.x - size/2, e.y - size/2, size, size);
  } else {
    ctx.fillStyle = '#ff4f6d';
    ctx.fillRect(e.x - size/2, e.y - size/2, size, size);
  }
  ctx.restore();

  ctx.beginPath();
  ctx.arc(e.x, e.y, e.r + 2, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,.85)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawBullets(arr) {
  for (const b of arr) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = b.color;
    ctx.fill();
  }
}

// ====== End States ======
function onWin() {
  state = 'win';
  cancelAnimationFrame(rafId);

  // バトルUIを隠す
  overlay.classList.add('hidden');
  btnRetry.classList.add('hidden');
  gameSection?.classList.add('hidden');

  // ギャラリーに勝利した画像とメッセージを表示
  const idx = enemy.idx;
  mainImage.setAttribute('src', album[idx].src);
  mainImage.setAttribute('alt', album[idx].msg);
  mainMsg.textContent = album[idx].msg;

  if (!mainFlame.contains(mainImage)) mainFlame.appendChild(mainImage);
  if (!mainFlame.contains(mainMsg))   mainFlame.appendChild(mainMsg);

  mainFlame.classList.remove('hidden');

  // ★ ギャラリー表示中フラグON
  isGalleryVisible = true;

  gallery?.scrollIntoView({ behavior: 'smooth' });
  bulletsP = [];
  bulletsE = [];
  state = 'idle';
}


function onLose() {
  state = 'lose';
  overlay.textContent = 'GAME OVER';
  btnRetry.classList.remove('hidden');

  // 結果カード（敗北メッセージ）
  resultImg.src = '';
  resultImg.alt = '';
  resultMsg.textContent = '残念…負けてしまいました。';
  resultSection.classList.remove('hidden');
  resultSection.scrollIntoView({ behavior: 'smooth' });
}

// ====== Init ======
state = 'idle';
overlay.classList.add('hidden');
btnRetry.classList.add('hidden');
resultSection.classList.add('hidden');