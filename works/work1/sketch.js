// ========== p5.js (WEBGL) ==========

// ---- 設定 ----
const AUTO_ROTATE = false; // 回さない（必要なら true に）

// 色
let targetColor = [180, 120, 255];
let currentColor = [180, 120, 255];

// アクション（動き系）
/* 'idle' | 'stretch' | 'shatter' | 'fall' | 'waitingReturn' | 'waver' | 'melt' */
let action = 'idle';
let actionStart = 0;
let cooldownUntil = 0;

// フォルム切替（false: 球体 / true: 顔）
let isFace = false;

// 伸び
const STRETCH_DUR = 900;
const STRETCH_PEAK = 2.2;

// 粉砕
let shards = []; // {pos, vel, rot, rotVel, life, maxLife, size}
const GRAVITY_SHARDS = 0.0006;

// 落下（見切れ→待機→復帰）
let posY = 0;
let fallV = 0;
const FALL_ACCEL = 0.0022;
const FALL_VMAX  = 1.8;
const RESPAWN_DELAY = 1200; // 見切れ後の待機
let disappearTime = null;

// 揺らめけ
const WAVER_DUR = 2200;
const WAVER_POS_AMP = 0.22;
const WAVER_SCALE_AMP = 0.06;
let waverSeedX = 0, waverSeedY = 1000, waverSeedZ = 2000;

// 溶けろ
const MELT_DUR = 2500;
const MELT_MIN_SCALEY = 0.06;

// ====== 表情（新規） ======
/* expr: 'none' | 'smile' | 'cry' | 'angry' */
let expr = { type: 'none', start: 0, dur: 0 };

// 涙パーティクル（cry）
let tears = []; // {pos, vel, life, maxLife}
const TEAR_GRAV = 0.0009;

// UI参照
const formBtn   = document.getElementById('formBtn');
const exprNote  = document.getElementById('expr-note');

function setup(){
  createCanvas(windowWidth, windowHeight, WEBGL);
  noStroke();

  // フォルム切替ボタン
  if (formBtn){
    formBtn.addEventListener('click', () => {
      isFace = !isFace;
      formBtn.setAttribute('aria-pressed', String(isFace));
      formBtn.textContent = isFace ? '🧑 フォルム：顔' : '🧑 フォルム：球体';
      // 顔モード時だけ注釈を表示
      if (exprNote) exprNote.style.display = isFace ? 'block' : 'none';
    });
  }
  // 初期表示（球体なので非表示）
  if (exprNote) exprNote.style.display = 'none';
}

function windowResized(){
  resizeCanvas(windowWidth, windowHeight);
}

function draw(){
  background(8, 10, 14);

  // ライト
  ambientLight(60);
  directionalLight(255,255,255,-0.3,-0.4,-1);
  pointLight(255,220,200,  0,-200,200);

  // 自動回転（デフォルトOFF）
  if (AUTO_ROTATE){
    rotateY(millis()/4000);
    rotateX(sin(millis()/5000)*0.15);
  }

  // 色補間
  for (let i=0;i<3;i++) currentColor[i] = lerp(currentColor[i], targetColor[i], 0.08);

  const s = min(width, height) * 0.2; // 基準サイズ
  const effR = s * 0.92;
  const bottomY = height / 2;

  // --- 動き系アクション ---
  if (action === 'stretch'){
    drawStretch(s);
  } else if (action === 'shatter'){
    drawShards();
  } else if (action === 'fall' || action === 'waitingReturn'){
    updateFallAndDraw(s, effR, bottomY);
  } else if (action === 'waver'){
    updateWaverAndDraw(s);
  } else if (action === 'melt'){
    updateMeltAndDraw(s);
  } else {
    drawCoreStyled(s, posY, 0.92, 255);
  }

  // --- 表情寿命・涙更新 ---
  updateExpression(s);
}

// ========== 共通描画（球体 or 顔） ==========
function drawCoreStyled(s, y, scaleY = 0.92, alpha = 255){
  if (isFace) drawFace(s, y, scaleY, alpha, expr);
  else        drawSphere(s, y, scaleY, alpha);
}

function drawSphere(s, y, scaleY, alpha){
  push();
  translate(0, y, 0);
  ambientMaterial(currentColor[0], currentColor[1], currentColor[2], alpha);
  push(); scale(1, scaleY, 1); sphere(s, 64, 48); pop();
  pop();
}

// ---- 顔（頭・目・鼻・口・耳） + 表情反映（前面に出す＆怒り眉を“ひそめる”）----
function drawFace(s, y, scaleY, alpha, exprObj){
  push();
  translate(0, y, 0);

  // ====== 表情パラメータ ======
  const eAmt = getExprAmount(exprObj);
  const isSmile = exprObj.type === 'smile';
  const isCry   = exprObj.type === 'cry';
  const isAngry = exprObj.type === 'angry';

  // 眉パラメータ（怒り＝ひそめる：内側を下げ、中央へ寄せる）
  let browTiltInner = 0;        // 内側を上下に傾ける（+で左下げ／右上げ）
  let browRaise = 0;            // 眉全体の上下
  let browInward = 0;           // 眉を内側へ寄せる距離
  let browShorten = 0;          // 眉の長さを少し短くして中央を強調

  if (isSmile){ browRaise = -s*0.02 * eAmt; }
  if (isCry){   browTiltInner =  0.35 * eAmt; }
  if (isAngry){
    browTiltInner = -0.65 * eAmt;    // 傾きを強める（ひそめ）
    browRaise     =  s*0.02 * eAmt;  // 眉の内側が下がって見えるよう全体をわずかに下げ気味
    browInward    =  s*0.06 * eAmt;  // 中央へ寄せる
    browShorten   =  s*0.05 * eAmt;  // 眉を少し短く
  }

  // 目の細さ
  let eyeSquintY = 1.0;
  if (isSmile) eyeSquintY = 1.0 - 0.25*eAmt;
  if (isAngry) eyeSquintY = 1.0 - 0.20*eAmt;
  if (isCry)   eyeSquintY = 1.0 - 0.10*eAmt;

  // 口
  let mouthY =  s*0.22;
  let mouthRadius = s*0.18;
  let mouthTube   = s*0.02;
  if (isSmile) { mouthY -= s*0.05*eAmt; mouthRadius = s*(0.18 + 0.03*eAmt); }
  if (isAngry) { mouthY += s*0.02*eAmt; mouthRadius = s*(0.16 - 0.02*eAmt); }
  if (isCry)   { mouthY += s*0.05*eAmt; mouthRadius = s*(0.15 - 0.02*eAmt); }

  // ===== 頭部 =====
  const HEAD_SCALE_Z = 0.90;
  const HEAD_RAD_Z   = 0.90 * s * HEAD_SCALE_Z; // ≒ 0.81s
  const FRONT_OFFSET = s * 0.02;

  push();
  ambientMaterial(currentColor[0], currentColor[1], currentColor[2], alpha);
  scale(0.95, scaleY, HEAD_SCALE_Z);
  ellipsoid(s*0.95, s*1.05, s*0.90, 32, 24);
  pop();

  // ===== 耳 =====
  const earY = -s*0.02;
  const earX =  s*0.62;
  const earZ = -s*0.12;
  drawEar(+earX, earY, earZ, alpha, +1);
  drawEar(-earX, earY, earZ, alpha, -1);

  // ===== 目 =====
  const eyeY = -s*0.15;
  const eyeX =  s*0.28;
  const eyeZ =  HEAD_RAD_Z + FRONT_OFFSET; // 前面より手前
  // 白目
  push(); translate(-eyeX, eyeY, eyeZ);
  ambientMaterial(250, 250, 250, alpha);
  scale(1, eyeSquintY, 1);
  sphere(s*0.12, 18, 14);
  pop();
  push(); translate( eyeX, eyeY, eyeZ);
  ambientMaterial(250, 250, 250, alpha);
  scale(1, eyeSquintY, 1);
  sphere(s*0.12, 18, 14);
  pop();
  // 黒目
  const pupilZ = eyeZ + s*0.02;
  push(); translate(-eyeX, eyeY, pupilZ);
  ambientMaterial(20, 20, 24, alpha);
  sphere(s*0.055, 14, 10);
  pop();
  push(); translate( eyeX, eyeY, pupilZ);
  ambientMaterial(20, 20, 24, alpha);
  sphere(s*0.055, 14, 10);
  pop();

  // ===== 眉（内側を下げ傾け、中央に寄せ、長さも少し短縮） =====
  const browBaseY = -s*0.30 + browRaise;
  const browZ = HEAD_RAD_Z + FRONT_OFFSET + s*0.01;
  const browFullL = s*0.28 - browShorten; // 長さ短縮
  const browT = s*0.025, browD = s*0.02;
  const dark = isAngry ? 25 : 40; // 怒り時は少し濃く

  // 左眉（観客から見て左 = -X）— 内側側（中央側）をより下げて“ひそめる”
  push();
  translate(-eyeX + browInward, browBaseY, browZ);
  rotateZ(+browTiltInner);
  ambientMaterial(dark, 30, 30, alpha);
  box(browFullL, browT, browD);
  pop();

  // 右眉
  push();
  translate(+eyeX - browInward, browBaseY, browZ);
  rotateZ(-browTiltInner);
  ambientMaterial(dark, 30, 30, alpha);
  box(browFullL, browT, browD);
  pop();

  // ===== 鼻 =====
  const noseZ = HEAD_RAD_Z + FRONT_OFFSET + s*0.01;
  push();
  translate(0, 0, noseZ);
  ambientMaterial(200, 180, 180, alpha);
  ellipsoid(s*0.07, s*0.10, s*0.06, 16, 12);
  pop();

  // ===== 口 =====
  const mouthZ = HEAD_RAD_Z + FRONT_OFFSET + s*0.005;
  push();
  translate(0, mouthY, mouthZ);
  rotateX(HALF_PI);
  ambientMaterial(220, 80, 100, alpha);
  torus(mouthRadius, mouthTube, 24, 8);
  pop();

  // ===== 涙 =====
  if (isCry){
    drawTearsAtZ(s, eyeX, eyeY, mouthZ + s*0.02);
  }

  pop();
}

function drawEar(earX, earY, earZ, alpha, side=+1){
  const s = min(width, height) * 0.2;
  push();
  translate(earX, earY, earZ);
  rotateZ(0.12*side);
  rotateY(0.18*side);
  ambientMaterial(currentColor[0]*0.95, currentColor[1]*0.95, currentColor[2]*0.95, alpha);
  ellipsoid(s*0.22, s*0.30, s*0.10, 24, 18);
  translate(-side*s*0.02, 0, s*0.04);
  ambientMaterial(120,100,110, alpha);
  ellipsoid(s*0.10, s*0.17, s*0.06, 16, 12);
  pop();
}

// ========== 伸びろ ==========
function drawStretch(s){
  const t = millis() - actionStart;
  let u = constrain(t / STRETCH_DUR, 0, 1);
  u = u*u*(3 - 2*u);
  const sx = lerp(1, STRETCH_PEAK, u);
  const syz = lerp(1, 0.88, u);

  push();
  translate(0, posY, 0);
  scale(sx, syz, syz);
  if (isFace) drawFace(s, 0, 0.92, 255, expr);
  else        drawSphere(s, 0, 0.92, 255);
  pop();

  if (t >= STRETCH_DUR) action = 'idle';
}

// ========== 壊れろ ==========
function drawShards(){
  for (let i = shards.length-1; i >= 0; i--){
    const p = shards[i];
    p.life += 16;
    const k = p.life / p.maxLife;

    p.vel.y += GRAVITY_SHARDS;
    p.vel.mult(0.992);
    p.rot.add(p.rotVel);
    p.pos.add(p.vel);

    push();
    translate(p.pos.x, p.pos.y, p.pos.z);
    rotateX(p.rot.x); rotateY(p.rot.y); rotateZ(p.rot.z);
    const fade = 1 - pow(k, 1.5);
    ambientMaterial(
      currentColor[0]*fade + 40*(1-fade),
      currentColor[1]*fade + 40*(1-fade),
      currentColor[2]*fade + 60*(1-fade)
    );
    box(p.size, p.size, p.size * 0.7);
    pop();

    if (p.life >= p.maxLife) shards.splice(i,1);
  }
  if (shards.length === 0) action = 'idle';
}

function spawnShards(){
  shards.length = 0;
  const s = min(width, height) * 0.2;
  const N = 120;
  const speedBase = 0.06;
  for (let i=0; i<N; i++){
    const theta = random(TWO_PI);
    const phi = acos(random(-1,1));
    const dir = createVector(
      sin(phi) * cos(theta),
      sin(phi) * sin(theta),
      cos(phi)
    );
    const pos = p5.Vector.mult(dir, s*0.6);
    pos.add(p5.Vector.random3D().mult(5));
    const vel = p5.Vector.mult(dir, speedBase * random(0.6, 1.6));
    vel.add(p5.Vector.random3D().mult(0.02));
    const rot = createVector(random(TWO_PI), random(TWO_PI), random(TWO_PI));
    const rotVel = createVector(random(-0.08,0.08), random(-0.08,0.08), random(-0.08,0.08));
    shards.push({pos, vel, rot, rotVel, life: 0, maxLife: random(700, 1400), size: random(8, 18)});
  }
}

// ========== 落ちろ（見切れ→待機→復帰） ==========
function updateFallAndDraw(s, effR, bottomY){
  if (action === 'fall'){
    fallV = min(FALL_VMAX * s, fallV + FALL_ACCEL * s);
    posY += fallV;
    if (posY - effR > bottomY){
      action = 'waitingReturn';
      disappearTime = millis();
    }
  } else if (action === 'waitingReturn'){
    if (millis() - disappearTime >= RESPAWN_DELAY){
      posY = 0; fallV = 0; action = 'idle';
    }
  }
  if (action !== 'waitingReturn'){
    drawCoreStyled(s, posY, 0.92, 255);
  }
}

// ========== 揺らめけ ==========
function updateWaverAndDraw(s){
  const t = millis() - actionStart;
  let u = constrain(t / WAVER_DUR, 0, 1);
  const strength = 1.0 - u;
  const time = millis() * 0.0012;

  const amp = WAVER_POS_AMP * s * strength;
  const offX = (noise(waverSeedX + time) - 0.5) * 2 * amp;
  const offY = (noise(waverSeedY + time*0.9) - 0.5) * 2 * amp;
  const offZ = (noise(waverSeedZ + time*1.1) - 0.5) * 2 * amp;

  const scalePulse = 1 + (noise(waverSeedX + time*1.3) - 0.5) * 2 * WAVER_SCALE_AMP * strength;

  push();
  translate(offX, posY + offY, offZ);
  scale(1, 0.92 * scalePulse, 1);
  ambientMaterial(currentColor[0], currentColor[1], currentColor[2]);
  if (isFace) drawFace(s, 0, 1, 255, expr); else sphere(s, 64, 48);
  pop();

  if (t >= WAVER_DUR) action = 'idle';
}

// ========== 溶けろ ==========
function updateMeltAndDraw(s){
  const t = millis() - actionStart;
  let u = constrain(t / MELT_DUR, 0, 1);
  const scaleY = lerp(0.92, MELT_MIN_SCALEY, u);
  const down = lerp(0, s * 0.35, u);
  const alpha = lerp(255, 0, u);
  drawCoreStyled(s, posY + down, scaleY, alpha);
  if (t >= MELT_DUR){ posY = 0; action = 'idle'; }
}

// ========== 表情：更新＆補助 ==========
function getExprAmount(e){
  if (e.type === 'none') return 0;
  const t = millis() - e.start;
  const u = constrain(t / e.dur, 0, 1);
  // 前半立ち上がり、後半フェード
  const inOut = u < 0.6 ? (u/0.6) : (1 - (u-0.6)/0.4);
  return constrain(inOut, 0, 1);
}

function updateExpression(s){
  // 涙
  for (let i = tears.length-1; i >= 0; i--){
    const d = tears[i];
    d.life += 16;
    d.vel.y += TEAR_GRAV * s;
    d.vel.mult(0.995);
    d.pos.add(d.vel);
    if (d.life >= d.maxLife) tears.splice(i,1);
  }
  // 表情寿命
  if (expr.type !== 'none' && millis() - expr.start >= expr.dur){
    expr.type = 'none';
  }
}

function drawTearsAtZ(s, eyeX, eyeY, baseZ){
  for (const d of tears){
    push();
    translate(d.pos.x, d.pos.y, d.pos.z);
    ambientMaterial(90, 150, 255, map(d.life, 0, d.maxLife, 220, 0));
    sphere(s*0.03, 10, 8);
    pop();
  }
}

function spawnTears(){
  tears.length = 0;
  const s = min(width, height) * 0.2;
  const HEAD_SCALE_Z = 0.90;
  const HEAD_RAD_Z   = 0.90 * s * HEAD_SCALE_Z;
  const FRONT_OFFSET = s * 0.02;
  const eyeY = -s*0.15;
  const eyeX =  s*0.28;
  const eyeZ =  HEAD_RAD_Z + FRONT_OFFSET + s*0.02; // 前面で発生
  for (const sign of [-1, +1]){
    for (let i=0;i<3;i++){
      const pos = createVector(sign*eyeX + random(-s*0.02, s*0.02),
                               eyeY + random(-s*0.01, s*0.01),
                               eyeZ);
      const vel = createVector(random(-s*0.0015, s*0.0015),
                               random(s*0.002, s*0.004),
                               random(-s*0.0006, s*0.0006));
      tears.push({pos, vel, life: 0, maxLife: random(800, 1300)});
    }
  }
}

// ========== 表情トリガー ==========
function triggerSmile(){ expr = { type: 'smile', start: millis(), dur: 2000 }; }
function triggerCry(){   expr = { type: 'cry',   start: millis(), dur: 2400 }; spawnTears(); }
function triggerAngry(){ expr = { type: 'angry', start: millis(), dur: 2200 }; }

// ========== 動きトリガー ==========
function triggerStretch(){
  if (millis() < cooldownUntil) return;
  if (action === 'fall' || action === 'waitingReturn') return;
  action = 'stretch'; actionStart = millis();
  cooldownUntil = millis() + 600;
}
function triggerShatter(){
  if (millis() < cooldownUntil) return;
  action = 'shatter'; actionStart = millis();
  posY = 0; fallV = 0;
  shards.length = 0; spawnShards();
  cooldownUntil = millis() + 1200;
}
function triggerFall(){
  if (millis() < cooldownUntil) return;
  action = 'fall';
  fallV = 0.25 * min(width, height) * 0.002;
  cooldownUntil = millis() + 400;
}
function triggerWaver(){
  if (millis() < cooldownUntil) return;
  if (action === 'waitingReturn') return;
  action = 'waver'; actionStart = millis();
  waverSeedX = random(10000); waverSeedY = random(10000); waverSeedZ = random(10000);
  cooldownUntil = millis() + 400;
}
function triggerMelt(){
  if (millis() < cooldownUntil) return;
  if (action === 'waitingReturn') return;
  action = 'melt'; actionStart = millis();
  cooldownUntil = millis() + 800;
}

// ========== 音声認識（Web Speech API） ==========

// 標準 or webkit
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recog = null;

// UI
const pttBtn   = document.getElementById('ptt');
const statusEl = document.getElementById('status');
const heardEl  = document.querySelector('#heard em');

// --- マイク権限プリフライト（最初のON時に一度だけ） ---
let micReady = false;
let micReadyPromise = null;
function ensureMicAccess(){
  if (micReady) return Promise.resolve();
  if (micReadyPromise) return micReadyPromise;

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
    return Promise.reject(new Error('この環境ではマイク取得がサポートされていません'));
  }
  micReadyPromise = navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      stream.getTracks().forEach(t => t.stop()); // 権限だけ確定させて即停止
      micReady = true;
    });
  return micReadyPromise;
}

// --- 状態管理（ON/OFFトグル用） ---
let isListening = false; // ボタンのON/OFF状態
let recogActive = false; // recognitionがstart〜endの間 true

// 色辞書（既存のまま）
const colorDict = [
  {keys:['赤','あか','レッド'], rgb:[255,60,60]},
  {keys:['青','あお','ブルー'], rgb:[70,120,255]},
  {keys:['緑','みどり','グリーン'], rgb:[70,220,120]},
  {keys:['黄','きいろ','イエロー'], rgb:[255,210,60]},
  {keys:['白','しろ','ホワイト'], rgb:[240,240,240]},
  {keys:['黒','くろ','ブラック'], rgb:[20,20,24]},
  {keys:['ピンク'], rgb:[255,120,200]},
  {keys:['紫','むらさき','パープル'], rgb:[170,100,255]},
  {keys:['オレンジ'], rgb:[255,150,60]},
];
function findColorIn(text){
  if (!text) return null;
  for (const c of colorDict) for (const k of c.keys)
    if (text.includes(k)) return c.rgb;
  return null;
}
function setTargetColor(rgb){ targetColor = rgb.slice(); }

// コマンド辞書（既存のまま使う）
const commands = [
  {keys:['伸びろ','のびろ','伸びて','伸びてくれ'], fn: triggerStretch},
  {keys:['壊れろ','こわれろ','壊して','壊せ'],     fn: triggerShatter},
  {keys:['落ちろ','おちろ','落ちて','落ちてくれ'],   fn: triggerFall},
  {keys:['揺れろ','ゆれろ','揺らめいて','ゆらめいて','揺れて','ゆれて'], fn: triggerWaver},
  {keys:['潰れろ','つぶれろ','潰れて','つぶれて','潰れてくれ'], fn: triggerMelt},
  // 表情
  {keys:['笑って','笑え','笑顔','にこっ'],          fn: triggerSmile},
  {keys:['泣いて','泣け','泣いちゃう','涙'],         fn: triggerCry},
  {keys:['悲しんで','かなしんで','悲しめ','かなしめ'],      fn: triggerAngry},
];
function findCommandFn(text){
  if (!text) return null;
  for (const c of commands) for (const k of c.keys)
    if (text.includes(k)) return c.fn;
  return null;
}

// --- 初期化 ---
if (SpeechRecognition){
  recog = new SpeechRecognition();
  recog.lang = 'ja-JP';
  recog.continuous = true;      // 継続認識
  recog.interimResults = true;  // 途中結果も表示

  // ボタンでON/OFF切替（クリック1回でトグル）
  pttBtn?.addEventListener('click', async ()=>{
    if (!isListening){
      // ONへ
      statusEl.textContent = '認識準備中…';
      try {
        await ensureMicAccess();
        if (!recogActive){
          recog.start();
        }
        isListening = true;
        pttBtn.setAttribute('aria-pressed', 'true');
        pttBtn.textContent = '🎤 音声入力: ON';
      } catch (e){
        isListening = false;
        pttBtn.setAttribute('aria-pressed', 'false');
        pttBtn.textContent = '🎤 音声入力: OFF';
        statusEl.textContent = 'マイク権限エラー：' + (e.message || e.name || e);
      }
    } else {
      // OFFへ
      isListening = false;
      try { if (recogActive) recog.stop(); } catch {}
      pttBtn.setAttribute('aria-pressed', 'false');
      pttBtn.textContent = '🎤 音声入力: OFF';
      statusEl.textContent = 'OFF';
    }
  });

  // --- イベントハンドラ ---
  recog.onstart = ()=>{
    recogActive = true;
    statusEl.textContent = '認識中…';
  };

  recog.onend = ()=>{
    recogActive = false;
    // 連続使用中は自動的に再開（Chromeが間欠的にendする対策）
    if (isListening){
      try { recog.start(); } catch {}
    } else {
      statusEl.textContent = 'OFF';
    }
  };

  recog.onresult = (e)=>{
    let finalText = '';
    let interimText = '';
    for (let i = e.resultIndex; i < e.results.length; i++){
      const res = e.results[i];
      const txt = res[0].transcript.trim();
      if (res.isFinal) finalText += txt; else interimText += txt;
    }
    heardEl.textContent = finalText || interimText || '—';

    if (finalText){
      // ① アクション/表情 優先
      const cmd = findCommandFn(finalText);
      if (cmd){ cmd(); return; }
      // ② 色
      const col = findColorIn(finalText);
      if (col) setTargetColor(col);
    }
  };

  recog.onerror = (e)=>{
    recogActive = false;
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed'){
      statusEl.textContent = 'マイクがブロック。🔒→「サイトの設定→マイク」を許可に';
      isListening = false;
      pttBtn.setAttribute('aria-pressed', 'false');
      pttBtn.textContent = '🎤 音声入力: OFF';
    } else if (e.error === 'aborted'){
      statusEl.textContent = '認識が中断されました';
    } else {
      statusEl.textContent = 'エラー: ' + e.error;
    }
  };
} else {
  if (pttBtn) pttBtn.disabled = true;
  statusEl.textContent = 'このブラウザは音声認識非対応（Chrome/Edge推奨）';
}
