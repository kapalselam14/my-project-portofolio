<script lang="ts">
  import { onMount, onDestroy } from "svelte";

  // Game parameters
  const CELL = 16;
  const COLS = 20;
  const ROWS = 20;
  const INIT_SNAKE = [
    { x: 8, y: 10 },
    { x: 7, y: 10 },
    { x: 6, y: 10 }
  ];

  let canvas;
  let snake = [...INIT_SNAKE];
  let direction = "RIGHT";
  let nextDir = "RIGHT";
  let food = { x: 12, y: 10 };
  let score = 0;
  let gameover = false;
  let interval;
  let waitingToStart = true;
  let firstLoad = true;

  // randomly generate food
  function generateRandomFood() {
    let fx, fy;
    do {
      fx = Math.floor(Math.random() * COLS);
      fy = Math.floor(Math.random() * ROWS);
    } while (snake.some((s) => s.x === fx && s.y === fy));
    food = { x: fx, y: fy };
  }

  function draw() {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // background
    ctx.fillStyle = "#222";
    ctx.fillRect(0, 0, COLS * CELL, ROWS * CELL);
    // food
    ctx.fillStyle = "#e35d5b";
    ctx.fillRect(food.x * CELL, food.y * CELL, CELL, CELL);
    // snake
    ctx.fillStyle = "#ffcc00";
    snake.forEach((s, i) => {
      ctx.fillRect(s.x * CELL, s.y * CELL, CELL, CELL);
      // pixel border effect
      ctx.strokeStyle = "#111";
      ctx.lineWidth = 1;
      ctx.strokeRect(s.x * CELL, s.y * CELL, CELL, CELL);
    });
    // score
    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px monospace";
    ctx.fillText("SCORE: " + score, 6, 16);

    if (waitingToStart && firstLoad) {
      ctx.fillStyle = "#000a";
      ctx.fillRect(0, 0, COLS * CELL, ROWS * CELL);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.font = "bold 26px monospace";
      ctx.fillText("Press S to Start", canvas.width / 2, 150);
      ctx.textAlign = "start";
      return;
    }

    if (gameover) {
      ctx.fillStyle = "#000a";
      ctx.fillRect(0, 0, COLS * CELL, ROWS * CELL);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.font = "bold 26px monospace";
      ctx.fillText("GAME OVER", canvas.width / 2, 150);
      ctx.font = "bold 14px monospace";
      ctx.fillText("Press R to Restart", canvas.width / 2, 180);
      ctx.textAlign = "start"; // back to default
    }
  }

  function move() {
    if (gameover) return;
    if (!canvas) return;
    direction = nextDir;
    const head = { ...snake[0] };
    if (direction === "UP") head.y--;
    if (direction === "DOWN") head.y++;
    if (direction === "LEFT") head.x--;
    if (direction === "RIGHT") head.x++;

    // game over conditions (hit wall or itself)
    if (
      head.x < 0 ||
      head.x >= COLS ||
      head.y < 0 ||
      head.y >= ROWS ||
      snake.some((s) => s.x === head.x && s.y === head.y)
    ) {
      gameover = true;
      clearInterval(interval);
      draw();
      return;
    }

    snake.unshift(head); // add new head to the front of the snake
    if (head.x === food.x && head.y === food.y) {
      score += 1;
      generateRandomFood();
    } else {
      snake.pop(); // remove tail if no food eaten
    }
    draw();
  }

  function startGame() {
    if (!canvas) return;
    waitingToStart = false;
    firstLoad = false;
    clearInterval(interval);
    interval = setInterval(move, 130);
    draw();
  }

  function restart() {
    if (!canvas) return;
    snake = [...INIT_SNAKE];
    direction = "RIGHT";
    nextDir = "RIGHT";
    generateRandomFood();
    score = 0;
    gameover = false;
    clearInterval(interval);
    // Only wait for start on first load
    if (firstLoad) {
      waitingToStart = true;
      draw();
    } else {
      waitingToStart = false;
      interval = setInterval(move, 130);
      draw();
    }
  }

  function onKey(e) {
    if (waitingToStart && (e.key === "s" || e.key === "S")) {
      startGame();
      return;
    }
    if (gameover && (e.key === "r" || e.key === "R")) {
      restart();
      return;
    }
    // prevent reverse direction to avoid snake colliding with itself
    if (e.key === "ArrowUp" && direction !== "DOWN") {
      nextDir = "UP";
      e.preventDefault(); // prevent page scroll
    }
    else if (e.key === "ArrowDown" && direction !== "UP") {
      nextDir = "DOWN";
      e.preventDefault(); 
    }
    else if (e.key === "ArrowLeft" && direction !== "RIGHT") {
      nextDir = "LEFT";
      e.preventDefault(); 
    }
    else if (e.key === "ArrowRight" && direction !== "LEFT") {
      nextDir = "RIGHT";
      e.preventDefault();
    }
  }

  onMount(() => {
    window.addEventListener("keydown", onKey);
    setTimeout(() => restart(), 0); // wait for canvas to bind
  });
  onDestroy(() => {
    window.removeEventListener("keydown", onKey);
    clearInterval(interval);
  });
</script>

<!-- Snake Game Canvas, for rendering the game, e.g. food, snake, etc. -->
<canvas
  bind:this={canvas}
  width={COLS * CELL}
  height={ROWS * CELL}
  style="border:2px solid #111; image-rendering: pixelated; background:#222;"
/>

<style>
  canvas {
    margin: auto;
    display: block;
    outline: 1px solid var(--border, #ccc);
  }
</style>
