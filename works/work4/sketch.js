// 水面シミュレーション with P5.js
// OpenProcessing または P5.js Editor で動作します

let cols, rows;
let resolution = 5;
let current = [];
let previous = [];
let damping = 0.99;
let fish = [];
let isRaining = false;

function setup() {
  createCanvas(windowWidth, windowHeight);
  
  cols = floor(width / resolution);
  rows = floor(height / resolution);
  
  // 配列の初期化
  for (let i = 0; i < cols; i++) {
    current[i] = [];
    previous[i] = [];
    for (let j = 0; j < rows; j++) {
      current[i][j] = 0;
      previous[i][j] = 0;
    }
  }
  
  // 魚を作成
  for (let i = 0; i < 8; i++) {
    fish.push(new Fish(random(width), random(height)));
  }
  
  // 初期の波紋
  setTimeout(() => {
    createRipple(width / 2, height / 2, 400);
  }, 500);
}

function draw() {
  // 背景のグラデーション
  for (let i = 0; i < height; i++) {
    let inter = map(i, 0, height, 0, 1);
    let c = lerpColor(color(0, 26, 51), color(0, 102, 153), inter);
    stroke(c);
    line(0, i, width, i);
  }
  
  // 水面の更新
  updateWater();
  
  // 水面の描画
  drawWater();
  
  // 魚の更新と描画
  for (let f of fish) {
    f.update();
    f.display();
  }
  
  // UI表示
  drawUI();
}

function updateWater() {
  for (let i = 1; i < cols - 1; i++) {
    for (let j = 1; j < rows - 1; j++) {
      current[i][j] = (
        previous[i - 1][j] +
        previous[i + 1][j] +
        previous[i][j - 1] +
        previous[i][j + 1]
      ) / 2 - current[i][j];
      
      current[i][j] *= damping;
    }
  }
  
  // 配列を入れ替え
  let temp = previous;
  previous = current;
  current = temp;
}

function drawWater() {
  noStroke();
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      let value = previous[i][j];
      
      let brightness = 128 + value;
      let r = constrain(brightness * 0.3, 0, 255);
      let g = constrain(brightness * 0.6, 0, 255);
      let b = constrain(brightness * 1.2, 0, 255);
      
      fill(r, g, b);
      rect(i * resolution, j * resolution, resolution, resolution);
      
      if (abs(value) > 5) {
        let alpha = min(1, abs(value) / 100) * 0.3 * 255;
        fill(255, 255, 255, alpha);
        rect(i * resolution, j * resolution, resolution, resolution);
      }
    }
  }
}

function drawUI() {
  // 情報パネル
  fill(0, 0, 0, 128);
  noStroke();
  rect(20, 20, 280, 120, 10);
  
  fill(255);
  textSize(18);
  textAlign(LEFT, TOP);
  text('💧 水面シミュレーション', 35, 35);
  
  textSize(12);
  text('🖱️ クリックして波を作ろう！', 35, 60);
  text('🐟 魚の近くをクリックすると逃げます', 35, 80);
  text('R: 雨モード切替  C: リセット', 35, 100);
  
  // コントロールボタン表示
  fill(0, 0, 0, 128);
  rect(width / 2 - 150, height - 60, 300, 40, 20);
  
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(14);
  if (isRaining) {
    text('🌤️ 雨モード ON (Rで停止)', width / 2, height - 40);
  } else {
    text('☔ Rキー: 雨を降らせる  Cキー: リセット', width / 2, height - 40);
  }
}

function createRipple(x, y, strength) {
  let col = floor(x / resolution);
  let row = floor(y / resolution);
  
  if (col >= 0 && col < cols && row >= 0 && row < rows) {
    previous[col][row] = strength;
  }
}

function mousePressed() {
  createRipple(mouseX, mouseY, 300);
  
  // 魚を逃がす
  for (let f of fish) {
    f.flee(mouseX, mouseY);
  }
}

function mouseDragged() {
  createRipple(mouseX, mouseY, 150);
}

function keyPressed() {
  // R キーで雨モード切替
  if (key === 'r' || key === 'R') {
    isRaining = !isRaining;
  }
  
  // C キーでリセット
  if (key === 'c' || key === 'C') {
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        current[i][j] = 0;
        previous[i][j] = 0;
      }
    }
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  
  cols = floor(width / resolution);
  rows = floor(height / resolution);
  
  // 配列を再初期化
  current = [];
  previous = [];
  for (let i = 0; i < cols; i++) {
    current[i] = [];
    previous[i] = [];
    for (let j = 0; j < rows; j++) {
      current[i][j] = 0;
      previous[i][j] = 0;
    }
  }
}

// 雨を降らせる処理
setInterval(() => {
  if (isRaining) {
    for (let i = 0; i < 3; i++) {
      createRipple(random(width), random(height), 100);
    }
  }
}, 100);

// 魚クラス
class Fish {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = random(-1, 1);
    this.vy = random(-1, 1);
    this.size = random(15, 25);
    this.angle = atan2(this.vy, this.vx);
    this.speed = random(1, 2);
    this.hue = random(30, 70);
    this.tailPhase = random(TWO_PI);
    this.fleeSpeed = 0;
  }
  
  flee(fromX, fromY) {
    let dx = this.x - fromX;
    let dy = this.y - fromY;
    let dist = sqrt(dx * dx + dy * dy);
    
    if (dist < 150) {
      this.fleeSpeed = 8;
      this.vx = (dx / dist) * this.fleeSpeed;
      this.vy = (dy / dist) * this.fleeSpeed;
    }
  }
  
  update() {
    if (this.fleeSpeed > 0) {
      this.fleeSpeed *= 0.95;
      if (this.fleeSpeed < 0.1) {
        this.fleeSpeed = 0;
        this.vx = random(-1, 1);
        this.vy = random(-1, 1);
      }
    } else {
      this.vx += random(-0.2, 0.2);
      this.vy += random(-0.2, 0.2);
      
      let speed = sqrt(this.vx * this.vx + this.vy * this.vy);
      if (speed > this.speed) {
        this.vx = (this.vx / speed) * this.speed;
        this.vy = (this.vy / speed) * this.speed;
      }
    }
    
    this.x += this.vx;
    this.y += this.vy;
    
    // 画面端で反対側に出現
    if (this.x < 0) this.x = width;
    if (this.x > width) this.x = 0;
    if (this.y < 0) this.y = height;
    if (this.y > height) this.y = 0;
    
    this.angle = atan2(this.vy, this.vx);
    this.tailPhase += 0.15;
  }
  
  display() {
    push();
    translate(this.x, this.y);
    rotate(this.angle);
    
    // 影
    fill(0, 0, 0, 50);
    noStroke();
    ellipse(2, 2, this.size * 1.6, this.size * 0.8);
    
    // 魚の体
    colorMode(HSB);
    fill(this.hue, 80, 60);
    colorMode(RGB);
    ellipse(0, 0, this.size * 1.6, this.size * 0.8);
    
    // 尾ひれ
    let tailWave = sin(this.tailPhase) * 5;
    colorMode(HSB);
    fill(this.hue, 80, 60);
    colorMode(RGB);
    triangle(
      -this.size * 0.8, 0,
      -this.size * 1.3, -this.size * 0.4 + tailWave,
      -this.size * 1.3, this.size * 0.4 + tailWave
    );
    
    // 目
    fill(255);
    noStroke();
    circle(this.size * 0.4, -this.size * 0.15, this.size * 0.3);
    
    fill(0);
    circle(this.size * 0.45, -this.size * 0.15, this.size * 0.16);
    
    // ハイライト
    fill(255, 255, 255, 128);
    ellipse(0, -this.size * 0.1, this.size * 0.8, this.size * 0.3);
    
    pop();
  }
}