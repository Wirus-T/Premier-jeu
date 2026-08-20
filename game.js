"use strict";

const canvas = document.querySelector("#gameCanvas");
const context = canvas.getContext("2d");
const scoreElement = document.querySelector("#score");
const bestScoreElement = document.querySelector("#bestScore");
const gameOverPanel = document.querySelector("#gameOverPanel");
const finalScoreElement = document.querySelector("#finalScore");
const finalBestScoreElement = document.querySelector("#finalBestScore");
const startButton = document.querySelector("#startButton");

const GAME_WIDTH = 480;
const GAME_HEIGHT = 720;
const PLAYER_SPEED = 330;
const OBSTACLE_SPEED = 460;
const OBSTACLE_INTERVAL = 900;
const BEST_SCORE_KEY = "star-dodge-best-score";
const AudioContextClass = window.AudioContext || window.webkitAudioContext;

const player = {
  width: 52,
  height: 52,
  x: 0,
  y: GAME_HEIGHT - 82,
};

let obstacles = [];
let score = 0;
let bestScore = loadBestScore();
let gameState = "idle";
let lastFrameTime = 0;
let timeSinceLastObstacle = 0;
let animationFrameId = null;
let isPaused = false;
let activeTouchPointerId = null;
let audioContext = null;

const pressedKeys = new Set();

bestScoreElement.textContent = bestScore;
resetPlayer();
drawScene();

startButton.addEventListener("click", startGame);
window.addEventListener("keydown", handleKeyDown);
window.addEventListener("keyup", handleKeyUp);
window.addEventListener("blur", () => pressedKeys.clear());
document.addEventListener("visibilitychange", handleVisibilityChange);
canvas.addEventListener("pointerdown", handleTouchStart);
canvas.addEventListener("pointermove", handleTouchMove);
canvas.addEventListener("pointerup", handleTouchEnd);
canvas.addEventListener("pointercancel", handleTouchEnd);

function startGame() {
  prepareAudio();
  playWarriorSound();
  obstacles = [];
  score = 0;
  timeSinceLastObstacle = 0;
  lastFrameTime = performance.now();
  gameState = "playing";
  isPaused = document.hidden;
  activeTouchPointerId = null;
  scoreElement.textContent = score;
  gameOverPanel.hidden = true;
  startButton.hidden = true;
  pressedKeys.clear();
  resetPlayer();

  cancelAnimationFrame(animationFrameId);
  if (!isPaused) animationFrameId = requestAnimationFrame(gameLoop);
}

function gameLoop(currentTime) {
  if (gameState !== "playing" || isPaused) return;

  const deltaTime = Math.min((currentTime - lastFrameTime) / 1000, 0.05);
  lastFrameTime = currentTime;

  updatePlayer(deltaTime);
  updateObstacles(deltaTime);
  drawScene();

  if (gameState === "playing" && !isPaused) {
    animationFrameId = requestAnimationFrame(gameLoop);
  }
}

function updatePlayer(deltaTime) {
  const movesLeft = pressedKeys.has("ArrowLeft") || pressedKeys.has("KeyA") || pressedKeys.has("KeyQ");
  const movesRight = pressedKeys.has("ArrowRight") || pressedKeys.has("KeyD");

  if (movesLeft) player.x -= PLAYER_SPEED * deltaTime;
  if (movesRight) player.x += PLAYER_SPEED * deltaTime;

  player.x = clamp(player.x, 0, GAME_WIDTH - player.width);
}

function updateObstacles(deltaTime) {
  timeSinceLastObstacle += deltaTime * 1000;

  while (timeSinceLastObstacle >= OBSTACLE_INTERVAL) {
    createObstacle();
    timeSinceLastObstacle -= OBSTACLE_INTERVAL;
  }

  for (const obstacle of obstacles) {
    obstacle.y += OBSTACLE_SPEED * deltaTime;

    if (!obstacle.counted && obstacle.y > player.y + player.height) {
      obstacle.counted = true;
      score += 1;
      scoreElement.textContent = score;
    }

    if (rectanglesOverlap(player, obstacle)) {
      endGame();
      return;
    }
  }

  obstacles = obstacles.filter((obstacle) => obstacle.y < GAME_HEIGHT + obstacle.height);
}

function createObstacle() {
  const width = 48 + Math.random() * 42;
  const height = 30 + Math.random() * 26;

  obstacles.push({
    x: Math.random() * (GAME_WIDTH - width),
    y: -height,
    width,
    height,
    counted: false,
  });
}

function endGame() {
  gameState = "gameOver";
  pressedKeys.clear();
  activeTouchPointerId = null;
  playCollisionSound();

  if (score > bestScore) {
    bestScore = score;
    bestScoreElement.textContent = bestScore;
    saveBestScore(bestScore);
  }

  finalScoreElement.textContent = score;
  finalBestScoreElement.textContent = bestScore;
  gameOverPanel.hidden = false;
  drawScene();
  startButton.textContent = "Restart";
  startButton.hidden = false;
  startButton.focus({ preventScroll: true });
}

function drawScene() {
  drawForestRoad();

  for (const obstacle of obstacles) {
    drawGoblin(obstacle);
  }

  drawHero();

  if (gameState === "gameOver") {
    context.fillStyle = "rgb(4 6 18 / 55%)";
    context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }
}

function drawHero() {
  context.save();
  context.translate(player.x, player.y);
  context.scale(player.width / 52, player.height / 52);

  context.fillStyle = "rgb(0 0 0 / 28%)";
  context.beginPath();
  context.ellipse(26, 43, 19, 6, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#8f2638";
  context.beginPath();
  context.moveTo(15, 25);
  context.lineTo(8, 45);
  context.lineTo(26, 39);
  context.lineTo(44, 45);
  context.lineTo(37, 25);
  context.closePath();
  context.fill();

  context.fillStyle = "#245fba";
  context.beginPath();
  context.moveTo(17, 24);
  context.lineTo(35, 24);
  context.lineTo(39, 42);
  context.lineTo(13, 42);
  context.closePath();
  context.fill();

  context.fillStyle = "#d7b56d";
  context.fillRect(15, 31, 22, 4);
  context.fillStyle = "#fff0b5";
  context.fillRect(24, 31, 4, 4);

  context.fillStyle = "#f2c89b";
  context.beginPath();
  context.arc(26, 18, 12, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#5a351f";
  context.beginPath();
  context.arc(26, 15, 12, Math.PI, Math.PI * 2);
  context.lineTo(38, 20);
  context.lineTo(33, 17);
  context.lineTo(29, 20);
  context.lineTo(24, 16);
  context.lineTo(19, 20);
  context.lineTo(14, 18);
  context.closePath();
  context.fill();

  context.fillStyle = "#192033";
  context.fillRect(20, 19, 3, 3);
  context.fillRect(29, 19, 3, 3);

  context.strokeStyle = "#f2c89b";
  context.lineWidth = 6;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(36, 27);
  context.lineTo(42, 32);
  context.stroke();

  context.strokeStyle = "#dceaff";
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(42, 31);
  context.lineTo(48, 10);
  context.stroke();
  context.strokeStyle = "#7386a5";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(39, 28);
  context.lineTo(47, 31);
  context.stroke();

  context.restore();
}

function drawGoblin(obstacle) {
  context.save();
  context.translate(obstacle.x, obstacle.y);
  context.scale(obstacle.width / 60, obstacle.height / 50);

  context.fillStyle = "rgb(0 0 0 / 25%)";
  context.beginPath();
  context.ellipse(31, 44, 22, 5, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#3d6330";
  context.fillRect(20, 27, 25, 16);

  context.fillStyle = "#6daa45";
  context.beginPath();
  context.moveTo(17, 14);
  context.lineTo(2, 9);
  context.lineTo(15, 24);
  context.moveTo(43, 14);
  context.lineTo(58, 9);
  context.lineTo(45, 24);
  context.fill();
  context.beginPath();
  context.ellipse(30, 19, 18, 15, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#f4d65e";
  context.beginPath();
  context.arc(24, 17, 3, 0, Math.PI * 2);
  context.arc(36, 17, 3, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#1a2518";
  context.fillRect(23, 16, 2, 3);
  context.fillRect(35, 16, 2, 3);

  context.strokeStyle = "#315027";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(24, 26);
  context.lineTo(30, 29);
  context.lineTo(36, 26);
  context.stroke();

  context.fillStyle = "#755231";
  context.fillRect(28, 30, 18, 4);

  context.fillStyle = "#7c8c9d";
  context.strokeStyle = "#d0dae2";
  context.lineWidth = 2;
  context.beginPath();
  context.arc(14, 34, 10, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.strokeStyle = "#596675";
  context.beginPath();
  context.moveTo(14, 25);
  context.lineTo(14, 43);
  context.moveTo(5, 34);
  context.lineTo(23, 34);
  context.stroke();

  context.restore();
}

function prepareAudio() {
  if (!AudioContextClass) return;
  if (!audioContext) audioContext = new AudioContextClass();
  if (audioContext.state === "suspended") audioContext.resume();
}

function playCollisionSound() {
  if (!audioContext || audioContext.state !== "running") return;

  const startTime = audioContext.currentTime;
  const duration = 0.45;
  const oscillator = audioContext.createOscillator();
  const oscillatorGain = audioContext.createGain();
  const noise = audioContext.createBufferSource();
  const noiseFilter = audioContext.createBiquadFilter();
  const noiseGain = audioContext.createGain();
  const noiseBuffer = audioContext.createBuffer(
    1,
    Math.ceil(audioContext.sampleRate * duration),
    audioContext.sampleRate,
  );
  const noiseData = noiseBuffer.getChannelData(0);

  for (let index = 0; index < noiseData.length; index += 1) {
    noiseData[index] = Math.random() * 2 - 1;
  }

  oscillator.type = "sawtooth";
  oscillator.frequency.setValueAtTime(145, startTime);
  oscillator.frequency.exponentialRampToValueAtTime(52, startTime + duration);
  oscillatorGain.gain.setValueAtTime(0.0001, startTime);
  oscillatorGain.gain.exponentialRampToValueAtTime(0.22, startTime + 0.025);
  oscillatorGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  noise.buffer = noiseBuffer;
  noiseFilter.type = "lowpass";
  noiseFilter.frequency.setValueAtTime(230, startTime);
  noiseFilter.Q.setValueAtTime(3, startTime);
  noiseGain.gain.setValueAtTime(0.12, startTime);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  oscillator.connect(oscillatorGain).connect(audioContext.destination);
  noise.connect(noiseFilter).connect(noiseGain).connect(audioContext.destination);
  oscillator.start(startTime);
  noise.start(startTime);
  oscillator.stop(startTime + duration);
  noise.stop(startTime + duration);
}

function playWarriorSound() {
  if (!audioContext || audioContext.state !== "running") return;

  const startTime = audioContext.currentTime;
  const duration = 0.6;
  const voice = audioContext.createOscillator();
  const voiceGain = audioContext.createGain();
  const voiceFilter = audioContext.createBiquadFilter();
  const vibrato = audioContext.createOscillator();
  const vibratoGain = audioContext.createGain();

  voice.type = "sawtooth";
  voice.frequency.setValueAtTime(105, startTime);
  voice.frequency.exponentialRampToValueAtTime(155, startTime + 0.18);
  voice.frequency.exponentialRampToValueAtTime(82, startTime + duration);
  voiceFilter.type = "bandpass";
  voiceFilter.frequency.setValueAtTime(480, startTime);
  voiceFilter.Q.setValueAtTime(2.5, startTime);
  voiceGain.gain.setValueAtTime(0.0001, startTime);
  voiceGain.gain.exponentialRampToValueAtTime(0.2, startTime + 0.04);
  voiceGain.gain.setValueAtTime(0.2, startTime + 0.35);
  voiceGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  vibrato.frequency.setValueAtTime(9, startTime);
  vibratoGain.gain.setValueAtTime(7, startTime);
  vibrato.connect(vibratoGain).connect(voice.frequency);
  voice.connect(voiceFilter).connect(voiceGain).connect(audioContext.destination);

  vibrato.start(startTime);
  voice.start(startTime);
  vibrato.stop(startTime + duration);
  voice.stop(startTime + duration);
}

function drawForestRoad() {
  context.fillStyle = "#244d2b";
  context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  context.fillStyle = "#173b24";
  for (let index = 0; index < 95; index += 1) {
    const x = (index * 73 + 19) % GAME_WIDTH;
    const y = (index * 109 + 31) % GAME_HEIGHT;
    context.fillRect(x, y, 5, 5);
  }

  context.fillStyle = "#5a4934";
  context.beginPath();
  context.moveTo(143, 0);
  context.lineTo(337, 0);
  context.lineTo(337, 120);
  context.lineTo(319, 120);
  context.lineTo(319, 240);
  context.lineTo(350, 240);
  context.lineTo(350, 360);
  context.lineTo(327, 360);
  context.lineTo(327, 480);
  context.lineTo(345, 480);
  context.lineTo(345, 600);
  context.lineTo(363, 600);
  context.lineTo(363, 720);
  context.lineTo(111, 720);
  context.lineTo(111, 600);
  context.lineTo(127, 600);
  context.lineTo(127, 480);
  context.lineTo(145, 480);
  context.lineTo(145, 360);
  context.lineTo(126, 360);
  context.lineTo(126, 240);
  context.lineTo(157, 240);
  context.lineTo(157, 120);
  context.lineTo(143, 120);
  context.closePath();
  context.fill();

  context.fillStyle = "#937247";
  context.beginPath();
  context.moveTo(157, 0);
  context.lineTo(323, 0);
  context.lineTo(323, 120);
  context.lineTo(305, 120);
  context.lineTo(305, 240);
  context.lineTo(336, 240);
  context.lineTo(336, 360);
  context.lineTo(313, 360);
  context.lineTo(313, 480);
  context.lineTo(331, 480);
  context.lineTo(331, 600);
  context.lineTo(349, 600);
  context.lineTo(349, 720);
  context.lineTo(125, 720);
  context.lineTo(125, 600);
  context.lineTo(141, 600);
  context.lineTo(141, 480);
  context.lineTo(159, 480);
  context.lineTo(159, 360);
  context.lineTo(140, 360);
  context.lineTo(140, 240);
  context.lineTo(171, 240);
  context.lineTo(171, 120);
  context.lineTo(157, 120);
  context.closePath();
  context.fill();

  context.fillStyle = "#b08a58";
  for (let index = 0; index < 42; index += 1) {
    const y = (index * 83 + 17) % GAME_HEIGHT;
    const roadCenter = y < 240 ? 240 : y < 480 ? 238 : 237;
    const x = roadCenter - 72 + ((index * 47) % 145);
    context.fillRect(x, y, 7, 4);
  }

  const trees = [
    [28, 38, 34], [91, 105, 28], [423, 62, 35], [382, 152, 29],
    [45, 214, 36], [94, 310, 30], [420, 285, 36], [380, 393, 28],
    [39, 443, 32], [83, 547, 36], [420, 510, 34], [389, 625, 32],
    [35, 669, 36], [444, 700, 28],
  ];

  for (const [x, y, size] of trees) drawTreeTop(x, y, size);
}

function drawTreeTop(x, y, size) {
  const unit = Math.max(4, Math.round(size / 7));
  context.fillStyle = "rgb(7 24 15 / 35%)";
  context.fillRect(x - size / 2 + unit, y - size / 2 + unit, size, size);
  context.fillStyle = "#0d2e1d";
  context.fillRect(x - size / 2, y - size / 2, size, size);
  context.fillStyle = "#1c6332";
  context.fillRect(x - size / 2 + unit, y - size / 2 + unit, size - unit * 2, size - unit * 2);
  context.fillStyle = "#3d8844";
  context.fillRect(x - size / 2 + unit, y - size / 2 + unit, unit * 2, unit * 2);
  context.fillStyle = "#73502f";
  context.fillRect(x - unit / 2, y - unit / 2, unit, unit);
}

function handleKeyDown(event) {
  const controlKeys = ["ArrowLeft", "ArrowRight", "KeyA", "KeyQ", "KeyD"];
  if (!controlKeys.includes(event.code)) return;

  if (gameState === "playing") event.preventDefault();
  pressedKeys.add(event.code);
}

function handleKeyUp(event) {
  pressedKeys.delete(event.code);
}

function handleTouchStart(event) {
  if (
    event.pointerType !== "touch" ||
    gameState !== "playing" ||
    isPaused ||
    activeTouchPointerId !== null
  ) return;

  activeTouchPointerId = event.pointerId;
  canvas.setPointerCapture(event.pointerId);
  movePlayerToTouch(event);
}

function handleTouchMove(event) {
  if (event.pointerId !== activeTouchPointerId || gameState !== "playing" || isPaused) return;
  movePlayerToTouch(event);
}

function handleTouchEnd(event) {
  if (event.pointerId === activeTouchPointerId) activeTouchPointerId = null;
}

function handleVisibilityChange() {
  if (document.hidden) {
    if (gameState === "playing") {
      isPaused = true;
      cancelAnimationFrame(animationFrameId);
      pressedKeys.clear();
      activeTouchPointerId = null;
    }
    return;
  }

  if (gameState === "playing" && isPaused) {
    isPaused = false;
    lastFrameTime = performance.now();
    animationFrameId = requestAnimationFrame(gameLoop);
  }
}

function movePlayerToTouch(event) {
  const canvasBounds = canvas.getBoundingClientRect();
  const logicalX = (event.clientX - canvasBounds.left) * (GAME_WIDTH / canvasBounds.width);
  player.x = clamp(logicalX - player.width / 2, 0, GAME_WIDTH - player.width);
}

function rectanglesOverlap(first, second) {
  return (
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y
  );
}

function resetPlayer() {
  player.x = (GAME_WIDTH - player.width) / 2;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function loadBestScore() {
  try {
    const savedScore = Number.parseInt(localStorage.getItem(BEST_SCORE_KEY), 10);
    return Number.isFinite(savedScore) && savedScore >= 0 ? savedScore : 0;
  } catch {
    return 0;
  }
}

function saveBestScore(value) {
  try {
    localStorage.setItem(BEST_SCORE_KEY, String(value));
  } catch {
    // Le jeu reste utilisable si le stockage local est indisponible.
  }
}
