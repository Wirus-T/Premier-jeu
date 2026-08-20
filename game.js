"use strict";

const canvas = document.querySelector("#gameCanvas");
const context = canvas.getContext("2d");
const scoreElement = document.querySelector("#score");
const bestScoreElement = document.querySelector("#bestScore");
const startButton = document.querySelector("#startButton");

const GAME_WIDTH = 480;
const GAME_HEIGHT = 720;
const PLAYER_SPEED = 330;
const OBSTACLE_SPEED = 230;
const OBSTACLE_INTERVAL = 900;
const BEST_SCORE_KEY = "star-dodge-best-score";

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
  obstacles = [];
  score = 0;
  timeSinceLastObstacle = 0;
  lastFrameTime = performance.now();
  gameState = "playing";
  isPaused = document.hidden;
  activeTouchPointerId = null;
  scoreElement.textContent = score;
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

  if (score > bestScore) {
    bestScore = score;
    bestScoreElement.textContent = bestScore;
    saveBestScore(bestScore);
  }

  drawScene();
  startButton.textContent = "Restart";
  startButton.hidden = false;
  startButton.focus({ preventScroll: true });
}

function drawScene() {
  const gradient = context.createLinearGradient(0, 0, 0, GAME_HEIGHT);
  gradient.addColorStop(0, "#18234b");
  gradient.addColorStop(1, "#090d21");
  context.fillStyle = gradient;
  context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  drawStars();

  for (const obstacle of obstacles) {
    context.fillStyle = "#ff5b6e";
    context.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
    context.fillStyle = "#ff91a0";
    context.fillRect(obstacle.x + 7, obstacle.y + 6, obstacle.width - 14, 6);
  }

  context.fillStyle = "#5de4ff";
  context.fillRect(player.x, player.y, player.width, player.height);
  context.fillStyle = "#092438";
  context.fillRect(player.x + 10, player.y + 13, 8, 8);
  context.fillRect(player.x + 34, player.y + 13, 8, 8);
  context.fillRect(player.x + 14, player.y + 35, 24, 5);

  if (gameState === "gameOver") {
    context.fillStyle = "rgb(4 6 18 / 55%)";
    context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }
}

function drawStars() {
  context.fillStyle = "rgb(255 255 255 / 45%)";
  for (let i = 0; i < 30; i += 1) {
    const x = (i * 83 + 29) % GAME_WIDTH;
    const y = (i * 137 + 47) % GAME_HEIGHT;
    context.fillRect(x, y, 2, 2);
  }
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
