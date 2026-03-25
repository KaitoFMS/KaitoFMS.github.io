// js/bg-kosagi.js

let img, smallImg;
let agents = [];
const N = 1200;
const ALPHA = 90;
const NOISE_SPEED = 0.003;
let descend = 7.2;

function preload() {
  img = loadImage("img/kosagi.JPG"); // パスはそのままでOK
}

function setup() {
  const holder = document.getElementById("sketch-holder");
  if (!holder) {
    noCanvas();
    return;
  }

  // ★ ここを rect.width / rect.height ではなく windowWidth / windowHeight にする
  const c = createCanvas(windowWidth, windowHeight);
  c.parent("sketch-holder");

  pixelDensity(1);
  initImageAndAgents();
  noStroke();
}

function initImageAndAgents() {
  smallImg = img.get();
  smallImg.resize(width, height);
  smallImg.loadPixels();

  agents = [];
  for (let i = 0; i < N; i++) {
    agents.push(new Agent());
  }

  background(245); // 明るめ
  descend = 7.2;
}

function draw() {
  for (let a of agents) {
    a.step();
    a.paint();
  }
}

class Agent {
  constructor() {
    this.x = random(width);
    this.y = random(height);
    this.tx = random(1000);
    this.ty = random(1000);
  }
  step() {
    this.tx += NOISE_SPEED;
    this.ty += NOISE_SPEED;
    this.x = (this.x + map(noise(this.tx), 0, 1, -2, 2)) % width;
    this.y = (this.y + map(noise(this.ty), 0, 1, -2, 2)) % height;
    if (this.x < 0) this.x += width;
    if (this.y < 0) this.y += height;
  }
  paint() {
    const ix = constrain(floor(this.x), 0, width - 1);
    const iy = constrain(floor(this.y), 0, height - 1);
    const idx = 4 * (iy * width + ix);
    const r = smallImg.pixels[idx + 0];
    const g = smallImg.pixels[idx + 1];
    const b = smallImg.pixels[idx + 2];

    const bright = (r + g + b) / 3;
    const radius = map(bright, 0, 255, descend, (descend * 5) / 4);

    fill(r, g, b, ALPHA);
    circle(this.x, this.y, radius * 2);

    descend -= 0.0000095;
    if (descend < 1.0) descend = 1.0;
  }
}

// ★ ウィンドウサイズに合わせてキャンバスをリサイズ
function windowResized() {
  const holder = document.getElementById("sketch-holder");
  if (!holder) return;

  resizeCanvas(windowWidth, windowHeight);
  initImageAndAgents();
}

function mouseDragged() {
  if (!smallImg) return;
  const ix = constrain(mouseX | 0, 0, width - 1);
  const iy = constrain(mouseY | 0, 0, height - 1);
  const idx = 4 * (iy * width + ix);
  const r = smallImg.pixels[idx + 0];
  const g = smallImg.pixels[idx + 1];
  const b = smallImg.pixels[idx + 2];
  fill(r, g, b, 90);
  circle(mouseX, mouseY, 8);
}

function keyPressed() {
  if (key === " ") saveCanvas("Little Egret", "jpg");
}


