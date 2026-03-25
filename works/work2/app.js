const openBtn   = document.getElementById('open');
const playground= document.getElementById('playground');
const form      = document.getElementById('form');
const textarea  = document.getElementById('textarea');
const dropzone  = document.getElementById('dropzone');
const progressBar = document.getElementById('progress-bar');

let dragging = false;
let dragOffset = { x: 0, y: 0 };
const MAX_SECONDS = 10;
let remaining = MAX_SECONDS;
let timerId = null;

/* 表示切替 */
function openPlayground() {
  openBtn.style.display = 'none';
  playground.style.display = 'block';
  playground.setAttribute('aria-hidden', 'false');
  initPosition();
  textarea.focus();
  startProgressBar();
}
function closePlayground() {
  stopProgressBar();
  playground.style.display = 'none';
  playground.setAttribute('aria-hidden', 'true');
  openBtn.style.display = 'inline-block';
}

/* ★ プログレスバー（10秒） */
function startProgressBar() {
  remaining = MAX_SECONDS;
  updateProgressBar();
  stopProgressBar(); // 再起動防止

  timerId = setInterval(() => {
    remaining--;
    updateProgressBar();

    if (remaining <= 0) {
      stopProgressBar();
      alert('制限時間終了');
      fadeOutFormThenReset();
    }
  }, 1000);
}

function stopProgressBar() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
}

function updateProgressBar() {
  const percent = (remaining / MAX_SECONDS) * 100;
  progressBar.style.width = `${percent}%`;

  // 色の変化（青→オレンジ→赤）
  if (remaining > MAX_SECONDS * 0.6) {
    progressBar.style.background = "linear-gradient(90deg, #3b82f6, #60a5fa)";
  } else if (remaining > MAX_SECONDS * 0.3) {
    progressBar.style.background = "linear-gradient(90deg, #f59e0b, #fbbf24)";
  } else {
    progressBar.style.background = "linear-gradient(90deg, #ef4444, #f87171)";
  }
}

/* 初期位置 */
function initPosition() {
  form.style.left = '64px';
  form.style.top  = '50%';
  form.style.transform = 'translateY(-50%)';
  form.style.opacity = '1';
  dropzone.classList.remove('accepting', 'success');
  textarea.value = '';
  progressBar.style.width = '100%';
  progressBar.style.background = "linear-gradient(90deg, #3b82f6, #60a5fa)";
}

/* ドロップ判定 */
function isOverDropzone() {
  const f = form.getBoundingClientRect();
  const d = dropzone.getBoundingClientRect();
  const cx = f.left + f.width / 2;
  const cy = f.top  + f.height / 2;
  return (cx >= d.left && cx <= d.right && cy >= d.top && cy <= d.bottom);
}

/* ドラッグ */
function onPointerDown(e) {
  dragging = true;
  form.setPointerCapture(e.pointerId);
  const r  = form.getBoundingClientRect();
  const pg = playground.getBoundingClientRect();
  form.style.transform = 'none';
  form.style.left = (r.left - pg.left) + 'px';
  form.style.top  = (r.top  - pg.top)  + 'px';
  dragOffset.x = e.clientX - r.left;
  dragOffset.y = e.clientY - r.top;
}

function onPointerMove(e) {
  if (!dragging) return;
  const pg = playground.getBoundingClientRect();
  const r  = form.getBoundingClientRect();
  const w = r.width, h = r.height;
  const newLeftRaw = e.clientX - pg.left - dragOffset.x;
  const newTopRaw  = e.clientY - pg.top  - dragOffset.y;
  const maxLeft = pg.width  - w - 8;
  const maxTop  = pg.height - h - 8;
  const clampedLeft = Math.max(8, Math.min(maxLeft, newLeftRaw));
  const clampedTop  = Math.max(8, Math.min(maxTop,  newTopRaw));
  form.style.left = clampedLeft + 'px';
  form.style.top  = clampedTop  + 'px';
  dropzone.classList.toggle('accepting', isOverDropzone());
}

function onPointerUp(e) {
  if (!dragging) return;
  dragging = false;
  form.releasePointerCapture(e.pointerId);

  if (isOverDropzone()) {
    dropzone.classList.remove('accepting');
    dropzone.classList.add('success');
    stopProgressBar();
    alert('送信されました');
    fadeOutFormThenReset();
  } else {
    dropzone.classList.remove('accepting');
  }
}

/* フェードアウトして初期画面に戻す */
function fadeOutFormThenReset() {
  form.style.transition = 'opacity 0.3s ease';
  form.style.opacity = '0';
  setTimeout(() => {
    form.style.transition = 'none';
    form.style.opacity = '1';
    initPosition();
    closePlayground();
  }, 300);
}

/* イベント */
openBtn.addEventListener('click', openPlayground);
form.addEventListener('submit', (e) => e.preventDefault());
form.addEventListener('pointerdown', onPointerDown);
window.addEventListener('pointermove', onPointerMove);
window.addEventListener('pointerup', onPointerUp);

/* 初期状態 */
closePlayground();