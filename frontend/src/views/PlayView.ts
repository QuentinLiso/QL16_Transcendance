// src/views/PlayView.ts
import type { View } from "./AppShell";
import { domElem as h, mount } from "../ui/DomElement";
import { Avatar } from "../ui/Avatar";

/**
 * PlayView: settings panel → 2D or 3D match view
 * - Search an opponent from a dummy user list
 * - Points to win (3/5/7/9)
 * - Paddle size with preview
 * - Pick your side (left/right)
 * - Free-move paddles (all directions) toggle
 * - 2D vs 3D mode; same logic, different rendering
 *
 * Babylon is lazy-loaded ONLY if 3D is chosen (install @babylonjs/core to use it).
 */

/* ---------------- Dummy users (same vibe as tournaments) ---------------- */
type Id = number;
type User = { id: Id; alias: string; avatar: string | null };

const stockAvatar = "/user.png";
function stableId(str: string) {
  let s = 0;
  for (let i = 0; i < str.length; i++) s = ((s << 5) - s + str.charCodeAt(i)) | 0;
  return Math.abs(s) + 1000;
}
function makeUser(alias: string): User {
  return { id: stableId(alias), alias, avatar: stockAvatar };
}
const allUsers: User[] = [
  "Ada Lovelace",
  "Alan Turing",
  "Grace Hopper",
  "Hedy Lamarr",
  "Barbara Liskov",
  "Edsger Dijkstra",
  "Donald Knuth",
  "Linus Torvalds",
  "Ken Thompson",
  "Dennis Ritchie",
  "Margaret Hamilton",
  "John Von Neumann",
].map(makeUser);

/* ---------------- Settings types ---------------- */
type Points = 3 | 5 | 7 | 9;
type PaddleSizeKey = "small" | "medium" | "large";
type GameMode = "2d" | "3d";
type Side = "left" | "right";

type Settings = {
  me: User;
  opponent: User | null;
  pointsToWin: Points;
  paddleSize: PaddleSizeKey;
  mySide: Side;
  freeMove: boolean;
  mode: GameMode;
};

/* ---------------- Helpers ---------------- */
const paddleHeights: Record<PaddleSizeKey, number> = { small: 70, medium: 110, large: 150 };
const paddleWidth = 12;
function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

/* =========================================================================
   2D Engine (canvas)
============================================================================ */
class Player2D {
  name: string;
  color: string;
  x: number;
  y: number;
  width = paddleWidth;
  height: number;
  score = 0;

  // movement flags
  up = false;
  down = false;
  left = false;
  right = false;

  constructor(name: string, color: string, x: number, y: number, height: number) {
    this.name = name;
    this.color = color;
    this.x = x;
    this.y = y;
    this.height = height;
  }

  update(dt: number, canvasW: number, canvasH: number, freeMove: boolean, side: Side) {
    const v = 600;
    if (this.up) this.y -= v * dt;
    if (this.down) this.y += v * dt;
    if (freeMove) {
      if (this.left) this.x -= v * dt;
      if (this.right) this.x += v * dt;
      // keep inside own half
      const half = canvasW / 2;
      const margin = 10;
      const leftBound = side === "left" ? margin : half + margin;
      const rightBound = side === "left" ? half - margin - this.width : canvasW - margin - this.width;
      this.x = clamp(this.x, leftBound, rightBound);
    }
    // vertical clamp
    this.y = clamp(this.y, 0, canvasH - this.height);
  }
}

class Ball2D {
  x: number;
  y: number;
  radius = 10;
  vx = 320;
  vy = 220;
  accel = 1.05;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
  reset(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() > 0.5 ? 1 : -1) * 320;
    this.vy = (Math.random() > 0.5 ? 1 : -1) * 220;
  }

  step(dt: number, cw: number, ch: number, pL: Player2D, pR: Player2D): 1 | 2 | null {
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // walls
    if (this.y - this.radius < 0 || this.y + this.radius > ch) this.vy *= -1;

    // collisions
    const hitLeft = this.x - this.radius <= pL.x + pL.width && this.x - this.radius >= pL.x && this.y + this.radius >= pL.y && this.y - this.radius <= pL.y + pL.height;
    const hitRight = this.x + this.radius >= pR.x && this.x + this.radius <= pR.x + pR.width && this.y + this.radius >= pR.y && this.y - this.radius <= pR.y + pR.height;

    if (hitLeft || hitRight) {
      this.vx *= -this.accel;
      this.vy *= this.accel;
    }

    if (this.x < 0) return 2;
    if (this.x > cw) return 1;
    return null;
  }
}

class Game2D {
  private ctx: CanvasRenderingContext2D;
  private pLeft: Player2D;
  private pRight: Player2D;
  private ball: Ball2D;
  private paused = true;
  private over = false;
  private winner: Player2D | null = null;
  private last = 0;
  private freeMove: boolean;
  private target: number;
  private keyListener!: (e: KeyboardEvent) => void;
  private keyUpListener!: (e: KeyboardEvent) => void;
  private resizeObs!: ResizeObserver;
  private header: HTMLElement;

  // controls mapping
  private leftKeys = { up: "z", down: "s", left: "q", right: "d" };
  private rightKeys = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" };

  constructor(private wrap: HTMLElement, private canvas: HTMLCanvasElement, header: HTMLElement, me: User, opp: User, mySide: Side, paddleH: number, pointsToWin: number, freeMove: boolean) {
    this.header = header;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D context failed");
    this.ctx = ctx;

    // place paddles by side
    const cw = canvas.width,
      ch = canvas.height;
    const margin = 18;
    const Lx = margin,
      Rx = cw - margin - paddleWidth;
    const midY = (ch - paddleH) / 2;

    const meLeft = mySide === "left";
    const leftName = meLeft ? me.alias : opp.alias;
    const rightName = meLeft ? opp.alias : me.alias;

    this.pLeft = new Player2D(leftName, "#e2f7e1", Lx, midY, paddleH);
    this.pRight = new Player2D(rightName, "#fde2e2", Rx, midY, paddleH);
    this.ball = new Ball2D(cw / 2, ch / 2);

    this.freeMove = freeMove;
    this.target = pointsToWin;

    this.installKeys(meLeft ? "left" : "right");
    this.installResize();
  }

  private installResize() {
    const fit = () => {
      // compute a nice size that fits viewport while keeping ~16:9 ratio
      const maxW = this.wrap.clientWidth;
      const maxH = this.wrap.clientHeight - this.header.clientHeight - 12;
      const ratio = 16 / 9;
      let w = Math.min(maxW, Math.floor(maxH * ratio));
      let h = Math.min(maxH, Math.floor(w / ratio));
      if (w < 640) {
        w = 640;
        h = Math.floor(w / ratio);
      } // minimum comfortable size
      this.canvas.width = w;
      this.canvas.height = h;
    };
    fit();
    this.resizeObs = new ResizeObserver(fit);
    this.resizeObs.observe(this.wrap);
  }

  private installKeys(meControlSide: "left" | "right") {
    const meMap = meControlSide === "left" ? this.leftKeys : this.rightKeys;
    const oppMap = meControlSide === "left" ? this.rightKeys : this.leftKeys;

    this.keyListener = (e: KeyboardEvent) => {
      if (e.key === " " && !e.repeat) {
        if (this.over) {
          this.resetRound();
          this.over = false;
        }
        this.paused = !this.paused;
      }
      // left paddle
      if (e.key === this.leftKeys.up) this.pLeft.up = true;
      if (e.key === this.leftKeys.down) this.pLeft.down = true;
      if (e.key === this.leftKeys.left) this.pLeft.left = true;
      if (e.key === this.leftKeys.right) this.pLeft.right = true;
      // right paddle
      if (e.key === this.rightKeys.up) this.pRight.up = true;
      if (e.key === this.rightKeys.down) this.pRight.down = true;
      if (e.key === this.rightKeys.left) this.pRight.left = true;
      if (e.key === this.rightKeys.right) this.pRight.right = true;

      // prevent page scroll on space/arrow
      if ([" ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) e.preventDefault();
    };
    this.keyUpListener = (e: KeyboardEvent) => {
      if (e.key === this.leftKeys.up) this.pLeft.up = false;
      if (e.key === this.leftKeys.down) this.pLeft.down = false;
      if (e.key === this.leftKeys.left) this.pLeft.left = false;
      if (e.key === this.leftKeys.right) this.pLeft.right = false;

      if (e.key === this.rightKeys.up) this.pRight.up = false;
      if (e.key === this.rightKeys.down) this.pRight.down = false;
      if (e.key === this.rightKeys.left) this.pRight.left = false;
      if (e.key === this.rightKeys.right) this.pRight.right = false;
    };

    window.addEventListener("keydown", this.keyListener, { passive: false });
    window.addEventListener("keyup", this.keyUpListener, { passive: false });
  }

  dispose() {
    window.removeEventListener("keydown", this.keyListener);
    window.removeEventListener("keyup", this.keyUpListener);
    this.resizeObs?.disconnect();
  }

  resetRound() {
    this.pLeft.score = 0;
    this.pRight.score = 0;
    this.ball.reset(this.canvas.width / 2, this.canvas.height / 2);
  }

  start() {
    this.last = performance.now();
    const tick = (t: number) => {
      const dt = (t - this.last) / 1000;
      this.last = t;
      if (!this.paused) this.update(dt);
      this.draw();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  private update(dt: number) {
    const cw = this.canvas.width,
      ch = this.canvas.height;
    this.pLeft.update(dt, cw, ch, this.freeMove, "left");
    this.pRight.update(dt, cw, ch, this.freeMove, "right");

    const scorer = this.ball.step(dt, cw, ch, this.pLeft, this.pRight);
    if (scorer) {
      (scorer === 1 ? this.pLeft : this.pRight).score++;
      if (this.pLeft.score >= this.target || this.pRight.score >= this.target) {
        this.winner = this.pLeft.score > this.pRight.score ? this.pLeft : this.pRight;
        this.over = true;
      }
      this.ball.reset(cw / 2, ch / 2);
      this.paused = true;
    }
  }

  private drawField(ctx: CanvasRenderingContext2D, w: number, h: number) {
    // greenish gradient background
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#ecfdf5");
    g.addColorStop(1, "#d1fae5");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // field border
    ctx.strokeStyle = "white";
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, w - 4, h - 4);

    // center dashed line
    ctx.save();
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(w / 2, 10);
    ctx.lineTo(w / 2, h - 10);
    ctx.stroke();
    ctx.restore();

    // center circle
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.1, 0, Math.PI * 2);
    ctx.stroke();
  }

  private draw() {
    const ctx = this.ctx,
      w = this.canvas.width,
      h = this.canvas.height;

    this.drawField(ctx, w, h);

    // ball
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
    ctx.fill();

    // paddles
    ctx.fillStyle = this.pLeft.color;
    ctx.fillRect(this.pLeft.x, this.pLeft.y, this.pLeft.width, this.pLeft.height);
    ctx.fillStyle = this.pRight.color;
    ctx.fillRect(this.pRight.x, this.pRight.y, this.pRight.width, this.pRight.height);

    // overlay: paused/winner
    if (this.paused) {
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.font = "28px system-ui, sans-serif";
      ctx.textAlign = "center";
      const msg = this.over ? `Winner: ${this.winner?.name ?? ""}` : "Press Space to resume";
      ctx.fillText(msg, w / 2, h * 0.5 - 18);
    }
  }

  getScores() {
    return { left: this.pLeft.score, right: this.pRight.score };
  }
  isOver() {
    return this.over;
  }
  getWinnerName() {
    return this.winner?.name ?? null;
  }
}

/* =========================================================================
   3D Engine (Babylon) — dual first-person-ish views
   - dynamic import so project builds even if @babylonjs/core isn’t installed
============================================================================ */
class Game3D {
  private leftEngine: any;
  private rightEngine: any;
  private leftScene: any;
  private rightScene: any;
  private leftPaddle: any;
  private rightPaddle: any;
  private ballMeshL: any;
  private ballMeshR: any;
  private last = 0;
  private paused = true;
  private over = false;
  private winner: "left" | "right" | null = null;

  private pLeft = { x: -8, z: 0, w: 0.4, h: 2.5, up: false, down: false, left: false, right: false, score: 0 };
  private pRight = { x: 8, z: 0, w: 0.4, h: 2.5, up: false, down: false, left: false, right: false, score: 0 };
  private ball = { x: 0, z: 0, vx: 11, vz: 7, r: 0.4 };
  private field = { xMin: -10, xMax: 10, zMin: -6, zMax: 6 };
  private target: number;
  private freeMove: boolean;

  private keyDown!: (e: KeyboardEvent) => void;
  private keyUp!: (e: KeyboardEvent) => void;

  constructor(private canvL: HTMLCanvasElement, private canvR: HTMLCanvasElement, private header: HTMLElement, mySide: Side, paddleSize: PaddleSizeKey, pointsToWin: number, freeMove: boolean) {
    this.target = pointsToWin;
    this.freeMove = freeMove;
    // scale paddle height from size
    const sizeScale = paddleSize === "small" ? 0.8 : paddleSize === "large" ? 1.2 : 1;
    this.pLeft.h *= sizeScale;
    this.pRight.h *= sizeScale;

    // swap control mapping if my side is right
    const leftKeys = { up: "w", down: "s", left: "a", right: "d" };
    const rightKeys = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" };
    const meKeys = mySide === "left" ? leftKeys : rightKeys;
    const oppKeys = mySide === "left" ? rightKeys : leftKeys;

    this.keyDown = (e) => {
      if (e.key === " ") {
        this.paused = !this.paused;
        e.preventDefault();
      }
      const map = (k: string, side: "L" | "R", dir: "up" | "down" | "left" | "right") => {
        if (e.key === k) (side === "L" ? this.pLeft : this.pRight)[dir] = true;
      };
      map(leftKeys.up, "L", "up");
      map(leftKeys.down, "L", "down");
      map(leftKeys.left, "L", "left");
      map(leftKeys.right, "L", "right");
      map(rightKeys.up, "R", "up");
      map(rightKeys.down, "R", "down");
      map(rightKeys.left, "R", "left");
      map(rightKeys.right, "R", "right");
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
    };
    this.keyUp = (e) => {
      const up = (k: string, side: "L" | "R", dir: "up" | "down" | "left" | "right") => {
        if (e.key === k) (side === "L" ? this.pLeft : this.pRight)[dir] = false;
      };
      up(leftKeys.up, "L", "up");
      up(leftKeys.down, "L", "down");
      up(leftKeys.left, "L", "left");
      up(leftKeys.right, "L", "right");
      up(rightKeys.up, "R", "up");
      up(rightKeys.down, "R", "down");
      up(rightKeys.left, "R", "left");
      up(rightKeys.right, "R", "right");
    };
    window.addEventListener("keydown", this.keyDown, { passive: false });
    window.addEventListener("keyup", this.keyUp, { passive: false });
  }

  async init() {
    // @ts-ignore dynamic import keeps 2D path compiling even if package missing
    const BAB: any = await import("@babylonjs/core");

    const { Engine, Scene, FreeCamera, Vector3, HemisphericLight, MeshBuilder, Color3, StandardMaterial } = BAB;

    // helper to build a scene for one canvas + camera facing inward
    const buildScene = (canvas: HTMLCanvasElement, camAtLeft: boolean) => {
      const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true }, false);
      const scene = new Scene(engine);

      const cam = new FreeCamera("cam", new Vector3(camAtLeft ? this.field.xMin - 2 : this.field.xMax + 2, 3.5, 0), scene);
      cam.setTarget(new Vector3(0, 0.5, 0));

      new HemisphericLight("l", new Vector3(0, 1, 0), scene);

      // floor
      const ground = MeshBuilder.CreateGround("g", { width: this.field.xMax - this.field.xMin + 2, height: this.field.zMax - this.field.zMin + 2 }, scene);
      const mat = new StandardMaterial("gm", scene);
      mat.diffuseColor = new Color3(0.88, 0.98, 0.93);
      ground.material = mat;

      // paddles & ball
      const pMat = new StandardMaterial("pm", scene);
      pMat.diffuseColor = camAtLeft ? new Color3(0.85, 0.97, 0.85) : new Color3(0.99, 0.88, 0.88);

      const paddle = MeshBuilder.CreateBox("p", { width: this.pLeft.w, height: 0.2, depth: this.pLeft.h }, scene);
      paddle.material = pMat;

      const ball = MeshBuilder.CreateSphere("b", { diameter: this.ball.r * 2 }, scene);
      const bMat = new StandardMaterial("bm", scene);
      bMat.diffuseColor = new Color3(1, 1, 1);
      ball.material = bMat;

      return { engine, scene, paddle, ball };
    };

    const left = buildScene(this.canvL, true);
    const right = buildScene(this.canvR, false);

    this.leftEngine = left.engine;
    this.leftScene = left.scene;
    this.leftPaddle = left.paddle;
    this.ballMeshL = left.ball;
    this.rightEngine = right.engine;
    this.rightScene = right.scene;
    this.rightPaddle = right.paddle;
    this.ballMeshR = right.ball;

    // initial positions
    this.syncMeshes();

    // single RAF that updates logic and renders both scenes
    const tick = (t: number) => {
      const dt = this.last ? (t - this.last) / 1000 : 0;
      this.last = t;

      if (!this.paused && !this.over) this.update(dt);

      this.syncMeshes();
      this.leftScene.render();
      this.rightScene.render();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    // resize handling
    const ro = new ResizeObserver(() => {
      this.leftEngine.resize();
      this.rightEngine.resize();
    });
    ro.observe(this.canvL);
    ro.observe(this.canvR);
  }

  private update(dt: number) {
    const speed = 10;
    // Z is vertical axis on ground plane; X is horizontal
    if (this.pLeft.up) this.pLeft.z -= speed * dt;
    if (this.pLeft.down) this.pLeft.z += speed * dt;
    if (this.freeMove) {
      if (this.pLeft.left) this.pLeft.x -= speed * dt;
      if (this.pLeft.right) this.pLeft.x += speed * dt;
    }
    if (this.pRight.up) this.pRight.z -= speed * dt;
    if (this.pRight.down) this.pRight.z += speed * dt;
    if (this.freeMove) {
      if (this.pRight.left) this.pRight.x -= speed * dt;
      if (this.pRight.right) this.pRight.x += speed * dt;
    }

    // clamp paddles within halves
    const half = (this.field.xMin + this.field.xMax) / 2;
    this.pLeft.x = clamp(this.pLeft.x, this.field.xMin + 0.5, half - 0.6);
    this.pRight.x = clamp(this.pRight.x, half + 0.6, this.field.xMax - 0.5);
    this.pLeft.z = clamp(this.pLeft.z, this.field.zMin + this.pLeft.h / 2, this.field.zMax - this.pLeft.h / 2);
    this.pRight.z = clamp(this.pRight.z, this.field.zMin + this.pRight.h / 2, this.field.zMax - this.pRight.h / 2);

    // ball
    this.ball.x += this.ball.vx * dt;
    this.ball.z += this.ball.vz * dt;

    // walls
    if (this.ball.z < this.field.zMin || this.ball.z > this.field.zMax) this.ball.vz *= -1;

    // collide with paddles (AABB-ish on X/Z)
    const hitPaddle = (px: number, pz: number, pw: number, ph: number) => Math.abs(this.ball.x - px) < pw / 2 + this.ball.r && Math.abs(this.ball.z - pz) < ph / 2 + this.ball.r;

    if (hitPaddle(this.pLeft.x, this.pLeft.z, this.pLeft.w, this.pLeft.h) && this.ball.vx < 0) {
      this.ball.vx *= -1.05;
      this.ball.vz *= 1.05;
    }
    if (hitPaddle(this.pRight.x, this.pRight.z, this.pRight.w, this.pRight.h) && this.ball.vx > 0) {
      this.ball.vx *= -1.05;
      this.ball.vz *= 1.05;
    }

    // score
    if (this.ball.x < this.field.xMin - 0.5) {
      this.pRight.score++;
      this.resetBall();
    }
    if (this.ball.x > this.field.xMax + 0.5) {
      this.pLeft.score++;
      this.resetBall();
    }

    if (this.pLeft.score >= this.target || this.pRight.score >= this.target) {
      this.over = true;
      this.paused = true;
      this.winner = this.pLeft.score > this.pRight.score ? "left" : "right";
    }
  }

  private resetBall() {
    this.ball.x = 0;
    this.ball.z = 0;
    this.ball.vx = (Math.random() > 0.5 ? 1 : -1) * 11;
    this.ball.vz = (Math.random() > 0.5 ? 1 : -1) * 7;
    this.paused = true;
  }

  private syncMeshes() {
    // left camera view: paddle + ball positions
    if (this.leftPaddle) this.leftPaddle.position.set(this.pLeft.x, 0.1, this.pLeft.z);
    if (this.rightPaddle) this.rightPaddle.position.set(this.pRight.x, 0.1, this.pRight.z);
    if (this.ballMeshL) this.ballMeshL.position.set(this.ball.x, 0.25, this.ball.z);
    if (this.ballMeshR) this.ballMeshR.position.set(this.ball.x, 0.25, this.ball.z);
  }

  dispose() {
    window.removeEventListener("keydown", this.keyDown);
    window.removeEventListener("keyup", this.keyUp);
    this.leftEngine?.dispose();
    this.rightEngine?.dispose();
  }

  togglePause() {
    this.paused = !this.paused;
  }
  getScores() {
    return { left: this.pLeft.score, right: this.pRight.score };
  }
  isOver() {
    return this.over;
  }
  getWinnerName(leftAlias: string, rightAlias: string) {
    if (!this.winner) return null;
    return this.winner === "left" ? leftAlias : rightAlias;
  }
}

/* =========================================================================
   Settings Panel (search opponent, knobs, preview)
============================================================================ */
function SettingsPanel(onStart: (s: Settings) => void) {
  const state: Settings = {
    me: {
      id: 1,
      alias: "Quentichou",
      avatar: stockAvatar,
    },
    opponent: null,
    pointsToWin: 3,
    paddleSize: "medium",
    mySide: "left",
    freeMove: false,
    mode: "2d",
  };

  const wrap = h("div", { class: "grid md:grid-cols-2 gap-6 bg-white rounded-2xl border border-emerald-100 shadow" });

  // LEFT: opponent search
  const left = h("div", { class: "flex flex-col gap-3 p-6" });
  left.append(h("div", { class: "text-lg font-semibold text-emerald-900", text: "Choose opponent" }));
  const search = h("input", {
    class: "px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-400",
    attributes: { placeholder: "Search users…", type: "search" },
  }) as HTMLInputElement;
  const results = h("div", { class: "overflow-auto space-y-1" });

  function row(u: User) {
    const picked = state.opponent?.id === u.id;
    const btn = h("button", {
      class: "w-full flex items-center gap-3 px-3 py-2 rounded-xl " + (picked ? "bg-emerald-200/60" : "hover:bg-emerald-100/60"),
      attributes: { type: "button" },
    });
    btn.append(Avatar(u.avatar, 28), h("div", { class: "font-medium text-emerald-900 truncate", text: u.alias }));
    btn.addEventListener("click", () => {
      state.opponent = u;
      renderResults();
      renderSummary();
    });
    return btn;
  }
  function renderResults() {
    results.replaceChildren();
    const q = search.value.trim().toLowerCase();
    const list = q ? allUsers.filter((x) => x.alias.toLowerCase().includes(q)) : allUsers.slice(0, 8);
    list.forEach((u) => results.append(row(u)));
  }
  search.addEventListener("input", renderResults);
  renderResults();

  left.append(search, results);

  // RIGHT: settings
  const right = h("div", { class: "flex flex-col gap-7 p-6 items-center bg-emerald-50" });
  right.append(h("div", { class: "text-lg font-semibold text-slate-800", text: "Match settings" }));

  const rightWrap = h("div", { class: "flex flex-col gap-7 items-center" });
  const rightSeparator = h("i", { class: "fa-solid fa-atom" });

  right.append(rightWrap);
  // Points
  const pointsWrap = h("div", { class: "flex flex-col items-center gap-4" });
  pointsWrap.append(h("div", { class: "text-sm text-slate-600", text: "Points to win" }));
  const points = h("div", { class: "flex flex-wrap gap-2" });
  ([3, 5, 7, 9] as Points[]).forEach((p) => {
    const b = h("button", {
      class: "px-3 py-2 rounded-xl border " + (state.pointsToWin === p ? "bg-emerald-700 text-white border-emerald-600" : "border-slate-200 hover:bg-slate-50"),
      attributes: { type: "button" },
      text: `${p} points`,
    });
    b.addEventListener("click", () => {
      state.pointsToWin = p;
      renderSummary();
      // refresh buttons
      points.querySelectorAll("button").forEach((x) => (x.className = x.className.replace(/bg-emerald-700.*|border-emerald-600/g, "border-slate-200")));
      b.className = "px-3 py-2 rounded-xl border bg-emerald-700 text-white border-emerald-600";
    });
    points.appendChild(b);
  });
  pointsWrap.append(points);
  rightWrap.append(pointsWrap);
  rightWrap.append(rightSeparator);

  // Paddle size + preview
  const sizeWrap = h("div", { class: "flex flex-col items-center gap-4" });
  sizeWrap.append(h("div", { class: "text-sm text-slate-600", text: "Paddle size" }));
  const sizes = h("div", { class: "flex flex-wrap gap-10" });
  (["small", "medium", "large"] as PaddleSizeKey[]).forEach((k) => {
    const box = h("button", {
      class: "px-2 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 flex items-end gap-2",
      attributes: { type: "button", title: k },
    });
    const bar = h("div", { class: "w-3 bg-emerald-700 rounded" });
    (bar as HTMLElement).style.height = `${paddleHeights[k] / 3}px`;
    const label = h("div", { class: "text-xs text-slate-600 capitalize", text: k });
    box.append(bar, label);
    box.addEventListener("click", () => {
      state.paddleSize = k;
      renderSummary();
      sizes.querySelectorAll("button").forEach((x) => x.classList.remove("ring-2", "ring-emerald-300"));
      box.classList.add("ring-2", "ring-emerald-300");
    });
    if (k === state.paddleSize) box.classList.add("ring-2", "ring-emerald-300");
    sizes.append(box);
  });
  sizeWrap.append(sizes);
  rightWrap.append(sizeWrap);

  // Side selector
  const sideWrap = h("div", { class: "w-full flex flex-col items-center gap-3" });
  sideWrap.append(h("div", { class: "text-sm text-slate-600", text: "Side" }));

  const sides = h("div", { class: "w-full flex flex-row items-center justify-around" });
  const leftSidePlayer = h("div", { class: "w-20 flex-none", text: state.me.alias });
  const rightSidePlayer = h("div", { class: "w-20 flex-none", text: "Opponent" });
  const sideBtn = h("button", {
    class: "px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 flex items-center gap-2",
    attributes: { type: "button" },
  });
  const sideIcon = h("i", { class: "fa-solid fa-right-left" });
  sideBtn.append(sideIcon);
  sideBtn.addEventListener("click", () => {
    if (state.mySide === "left") {
      state.mySide = "right";
      leftSidePlayer.textContent = "Opponent";
      rightSidePlayer.textContent = state.me.alias;
    } else {
      state.mySide = "left";
      leftSidePlayer.textContent = state.me.alias;
      rightSidePlayer.textContent = "Opponent";
    }
    renderSummary();
  });
  sides.append(leftSidePlayer, sideBtn, rightSidePlayer);
  sideWrap.append(sides);
  rightWrap.append(sideWrap);

  // Free move toggle
  const freeWrap = h("label", { class: "inline-flex items-center gap-3 cursor-pointer" });
  const freeChk = h("input", { attributes: { type: "checkbox" }, class: "w-4 h-4 accent-emerald-600" }) as HTMLInputElement;
  const freeLbl = h("span", { class: "text-sm text-slate-700", text: "Allow free movement (all directions)" });
  freeChk.checked = state.freeMove;
  freeChk.addEventListener("change", () => {
    state.freeMove = freeChk.checked;
    renderSummary();
  });
  freeWrap.append(freeChk, freeLbl);
  rightWrap.append(freeWrap);

  // Mode
  const modeWrap = h("div", { class: "flex flex-col items-center gap-3" });
  modeWrap.append(h("div", { class: "text-sm text-slate-600", text: "Mode" }));
  const modes = h("div", { class: "flex flex-wrap gap-2" });
  const mode2d = h("button", { class: "px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50", attributes: { type: "button" }, text: "2D" });
  const mode3d = h("button", { class: "px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50", attributes: { type: "button" }, text: "3D" });
  modes.append(mode2d, mode3d);

  const summary = h("div", { class: "text-sm text-slate-600 pt-1" });

  const setMode = (m: GameMode) => {
    state.mode = m;
    mode2d.className = "px-3 py-2 rounded-xl border " + (m === "2d" ? "bg-emerald-700 text-white border-emerald-600" : "border-slate-200 hover:bg-slate-50");
    mode3d.className = "px-3 py-2 rounded-xl border " + (m === "3d" ? "bg-emerald-700 text-white border-emerald-600" : "border-slate-200 hover:bg-slate-50");
    renderSummary();
  };

  setMode("2d");
  mode2d.addEventListener("click", () => setMode("2d"));
  mode3d.addEventListener("click", () => setMode("3d"));
  modeWrap.append(modes);
  rightWrap.append(modeWrap);

  // Summary + Start
  function renderSummary() {
    // summary.textContent = `Opponent: ${state.opponent?.alias ?? "—"} • To ${state.pointsToWin} • ${state.paddleSize} paddle • You on ${state.mySide} • ${
    //   state.freeMove ? "free move" : "classic"
    // } • ${state.mode.toUpperCase()}`;
  }
  renderSummary();
  const startBtn = h("button", {
    class: "mt-1 px-4 py-3 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40",
    attributes: { type: "button", disabled: "true" },
    text: "Start match",
  });
  const canStart = () => {
    const ok = !!state.opponent;
    startBtn.toggleAttribute("disabled", !ok);
  };
  const observeOpponent = new MutationObserver(canStart);
  observeOpponent.observe(results, { childList: true, subtree: true });
  // simpler: also run after every render
  const t = setInterval(canStart, 300);

  startBtn.addEventListener("click", () => {
    clearInterval(t);
    observeOpponent.disconnect();
    onStart({ ...state });
  });

  right.append(summary, startBtn);
  mount(wrap, left, right);
  return { el: wrap };
}

/* =========================================================================
   Header (shared for 2D/3D)
============================================================================ */
function MatchHeader(me: User, opp: User, mySide: Side, getScores: () => { left: number; right: number }) {
  const bar = h("div", { class: "h-16 px-4 border-b border-emerald-100 bg-emerald-50/70 flex items-center justify-between" });

  const leftBox = h("div", { class: "flex items-center gap-3" });
  const rightBox = h("div", { class: "flex items-center gap-3" });

  const meLeft = mySide === "left";
  const L = meLeft ? me : opp;
  const R = meLeft ? opp : me;

  const lScore = h("div", { class: "px-3 py-1 rounded-lg bg-white text-emerald-700 font-semibold min-w-10 text-center", text: "0" });
  const rScore = h("div", { class: "px-3 py-1 rounded-lg bg-white text-emerald-700 font-semibold min-w-10 text-center", text: "0" });

  leftBox.append(Avatar(L.avatar, 32), h("div", { class: "font-semibold text-emerald-900", text: L.alias }), lScore);
  rightBox.append(rScore, h("div", { class: "font-semibold text-emerald-900", text: R.alias }), Avatar(R.avatar, 32));

  bar.append(leftBox, rightBox);

  function update() {
    const s = getScores();
    lScore.textContent = String(s.left);
    rScore.textContent = String(s.right);
  }
  return { el: bar, update };
}

/* =========================================================================
   Match Views
============================================================================ */
function GameView2D(root: HTMLElement, me: User, opp: User, settings: Settings) {
  const wrap = h("div", { class: "h-[calc(100vh-6rem)] w-full grid place-items-center" }); // inside AppShell padding
  const canvas = h("canvas", { class: "rounded-xl shadow border border-emerald-100 bg-white" }) as HTMLCanvasElement;

  const header = MatchHeader(me, opp, settings.mySide, () => game.getScores());
  mount(root, header.el, mount(wrap, canvas));

  const game = new Game2D(wrap, canvas, header.el, me, opp, settings.mySide, paddleHeights[settings.paddleSize], settings.pointsToWin, settings.freeMove);
  game.start();

  // scores ticker
  const raf = () => {
    header.update();
    requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);

  return () => game.dispose();
}

function GameView3D(root: HTMLElement, me: User, opp: User, settings: Settings) {
  const header = MatchHeader(me, opp, settings.mySide, () => game.getScores());

  // vertical screens side-by-side
  const grids = h("div", { class: "grid grid-cols-1 md:grid-cols-2 gap-2 p-2" });
  const cL = h("canvas", { class: "w-full aspect-[9/16] rounded-xl border border-emerald-100 shadow" }) as HTMLCanvasElement;
  const cR = h("canvas", { class: "w-full aspect-[9/16] rounded-xl border border-emerald-100 shadow" }) as HTMLCanvasElement;

  mount(root, header.el, mount(grids, cL, cR));

  const game = new Game3D(cL, cR, header.el, settings.mySide, settings.paddleSize, settings.pointsToWin, settings.freeMove);
  game.init().then(() => {
    // live score refresh
    const pump = () => {
      header.update();
      requestAnimationFrame(pump);
    };
    requestAnimationFrame(pump);
  });

  // Space toggles pause in Game3D already
  return () => game.dispose();
}

/* =========================================================================
   Main exported view
============================================================================ */
export const PlayView: View = (root: HTMLElement) => {
  root.className = "p-6";
  const holder = h("div", { class: "max-w-6xl mx-auto" });
  root.replaceChildren(holder);

  const me: User = { id: 1, alias: "You", avatar: "/user.png" };

  // STEP 1: settings panel
  const settings = SettingsPanel((s) => {
    // clear and move to game mode
    holder.replaceChildren();
    const opp = s.opponent!;
    const unmount = s.mode === "2d" ? GameView2D(holder, me, opp, s) : GameView3D(holder, me, opp, s);

    // optional: add a small back button to return to settings
    const backBar = h("div", { class: "mt-3 flex justify-center" });
    const back = h("button", { class: "px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50", attributes: { type: "button" }, text: "Back to settings" });
    back.addEventListener("click", () => {
      unmount?.();
      holder.replaceChildren(settings.el);
    });
    backBar.append(back);
    holder.append(backBar);
  });

  holder.append(settings.el);
  return () => {};
};
