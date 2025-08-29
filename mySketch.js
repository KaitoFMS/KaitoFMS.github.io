let img, smallImg;
let agents = [];
const N = 1200;
const ALPHA = 90;
const NOISE_SPEED = 0.003;
let descend = 7.2;
let cnv;


function preload() {
	img = loadImage("kosagi.JPG");
}

function setup() {
	cnv = createCanvas(windowWidth, windowHeight);
	cnv.parent('p5-bg');                             // ← 受け皿にアタッチ
    pixelDensity(Math.min(1, window.devicePixelRatio));
    noStroke();
	smallImg = img.get();
	smallImg.resize(width, height);
	smallImg.loadPixels();

	for (let i = 0; i < N; i++) agents.push(new Agent());
	background(220);
}

function draw() {
	for (let a of agents) {
		a.step();
		a.paint();
	}
	//image(img, 0, 0, width, height); //thumbnail
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
		const radius = map(bright, 0, 255, descend, descend * 5 / 4);

		fill(r, g, b, ALPHA);
		circle(this.x, this.y, radius * 2);
		descend -= 0.0000095;
		if (descend < 1.0) {
			descend = 1.0;
		}
	}
}

function mouseDragged() {
	const ix = constrain(mouseX | 0, 0, width - 1);
	const iy = constrain(mouseY | 0, 0, height - 1);
	const idx = 4 * (iy * width + ix);
	const r = smallImg.pixels[idx + 0];
	const g = smallImg.pixels[idx + 1];
	const b = smallImg.pixels[idx + 2];
	fill(r, g, b, 90);
	circle(mouseX, mouseY, 8);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// 省エネ（別タブで停止）
document.addEventListener('visibilitychange', () => {
  if (document.hidden) noLoop(); else loop();
});