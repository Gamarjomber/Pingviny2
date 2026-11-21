import Phaser from 'phaser';
import { FixedStepper } from '../core/FixedStep';
import { buildDemoArena } from '../data/arena';
import { DEFAULT_CAMERA_CONFIG } from '../data/cameraConfig';
import { loadEnemyConfig } from '../data/enemyTunables';
import { loadSpriteAssets } from '../data/spriteAssets';
import { DEMO_TAIL_ORDER } from '../data/unitClasses';
import { SIM_STEP } from '../game/constants';
import { KeyboardPointerInput } from '../input/KeyboardPointerInput';
import { CameraRig } from '../render/CameraRig';
import { CombatView } from '../render/CombatView';
import { EnemyView } from '../render/EnemyView';
import { attachJuice } from '../render/Juice';
import type { WarriorSystem } from '../sim/leader/WarriorSystem';
import { SquadView } from '../render/SquadView';
import { bakeEnemyTextures } from '../render/SpriteFactory';
import { buildWorldView } from '../render/WorldView';
import { Sim } from '../sim/Sim';
import { ChainBar } from '../ui/ChainBar';
import { loadSquadConfig, TuningPanel } from '../ui/TuningPanel';

const DEMO_TAIL_LENGTH = 12;

/**
 * Демо етапу: змійка + вороги + бій. Сцена лише збирає модулі разом:
 * симуляція (Sim), ввід (input), рендер (render), UI. Справжня сцена етапу
 * використає ті самі модулі.
 */
export class SnakeDemoScene extends Phaser.Scene {
  private sim!: Sim;
  private view!: SquadView;
  private enemyView!: EnemyView;
  private combatView!: CombatView;
  private rig!: CameraRig;
  private input_!: KeyboardPointerInput;
  private chainBar!: ChainBar;
  private panel!: TuningPanel;
  private stepper = new FixedStepper(SIM_STEP);
  private statsTimer = 0;
  private classCursor = 0;
  private readonly cfg = loadSquadConfig();

  constructor() {
    super('SnakeDemo');
  }

  preload(): void {
    loadSpriteAssets(this);
  }

  create(): void {
    this.stepper = new FixedStepper(SIM_STEP);
    this.classCursor = 0;
    const arena = buildDemoArena();
    buildWorldView(this, arena);
    bakeEnemyTextures(this);

    loadEnemyConfig();
    this.sim = new Sim(this.cfg, arena, 2026);
    for (let i = 0; i < DEMO_TAIL_LENGTH; i++) this.addCat();

    this.view = new SquadView(this, this.sim.squad, this.sim.warrior);
    this.enemyView = new EnemyView(this, this.sim);
    this.combatView = new CombatView(this, this.sim);
    this.rig = new CameraRig(this.cameras.main, DEFAULT_CAMERA_CONFIG, this.sim.squad.leader);
    this.cameras.main.setBackgroundColor('#0b0710');
    attachJuice(this, this.sim.bus, this.rig);
    this.input_ = new KeyboardPointerInput(this, () => this.sim.squad.leader);

    const overlay = document.getElementById('gameover')!;
    overlay.classList.remove('show');
    this.sim.bus.on('gameOver', () => overlay.classList.add('show'));

    this.chainBar = new ChainBar(document.getElementById('chainbar')!, this.sim.squad);
    this.panel = new TuningPanel(document.getElementById('panel')!, this.cfg, {
      addUnit: () => this.addCat(),
      removeUnit: () => this.sim.squad.removeLastUnit(),
      restart: () => this.scene.restart(),
      toggleDebug: () => (this.view.debug = !this.view.debug),
      damageRandom: () => this.damageRandom(),
      spawnEnemies: (n) => this.spawnEnemies(n),
      toggleSpawner: () => (this.sim.autoSpawn = !this.sim.autoSpawn),
      toggleGod: () => (this.sim.squad.godMode = !this.sim.squad.godMode),
      killAll: () => this.sim.enemies.clear(),
      toggleChainMode: () => this.toggleChainMode(),
      toggleWarrior: () => this.toggleWarrior(),
    });
    document.getElementById('help')!.textContent =
      'Миша — повертати   A/D, ←/→ — поворот клавішами\nПробіл — ривок   Shift — гальмо   F — активка Воїна   V — Воїн вкл/викл\nQ/F1 — дебаг   C — режим хвоста\nK — урон коту   E — вороги   R — рестарт   Tab — панель\nПідібрати впалого або групу — торкнутись головою';

    const kb = this.input.keyboard!;
    kb.removeAllListeners();
    kb.on('keydown-Q', () => (this.view.debug = !this.view.debug));
    kb.on('keydown-F1', (e: KeyboardEvent) => {
      e.preventDefault();
      this.view.debug = !this.view.debug;
    });
    kb.addCapture('F1');
    kb.on('keydown-K', () => this.damageRandom());
    kb.on('keydown-E', () => this.spawnEnemies(20));
    kb.on('keydown-V', () => this.panel.setWarriorButton(this.toggleWarrior()));
    kb.on('keydown-C', () => this.panel.setChainButton(this.toggleChainMode()));
    kb.on('keydown-R', () => this.scene.restart());
    kb.on('keydown-TAB', (e: KeyboardEvent) => {
      e.preventDefault();
      this.panel.toggle();
    });
    kb.addCapture('SPACE,TAB');
  }

  private toggleWarrior(): boolean {
    const w = this.sim.warrior;
    w.setEnabled(!w.enabled);
    return w.enabled;
  }

  private toggleChainMode(): boolean {
    const squad = this.sim.squad;
    squad.chainMode = squad.chainMode === 'trail' ? 'pursuit' : 'trail';
    return squad.chainMode === 'pursuit';
  }

  private addCat(): void {
    const classId = DEMO_TAIL_ORDER[this.classCursor++ % DEMO_TAIL_ORDER.length]!;
    this.sim.squad.addUnit(classId);
  }

  private spawnEnemies(n: number): void {
    for (let i = 0; i < n; i++) this.sim.spawnRandom();
  }

  private damageRandom(): void {
    const all = this.sim.squad.aliveUnits();
    if (all.length === 0) return;
    this.sim.squad.damageUnit(all[Math.floor(this.sim.rng.next() * all.length)]!, 25);
  }

  update(_time: number, deltaMs: number): void {
    const dt = deltaMs / 1000;
    const squad = this.sim.squad;
    const intent = this.input_.read();
    const wv = this.cameras.main.worldView;
    this.sim.viewRadius = Math.hypot(wv.width, wv.height) / 2;
    this.stepper.advance(dt, (step) => this.sim.update(step, intent));

    const p = this.input.activePointer;
    const pw = this.cameras.main.getWorldPoint(p.x, p.y);
    const count = squad.chain.length + squad.groups.reduce((n, g) => n + g.units.length, 0);
    this.rig.update(dt, squad.leader, pw, count);
    this.view.draw();
    this.enemyView.draw();
    this.combatView.draw();
    this.chainBar.update();

    this.statsTimer -= dt;
    if (this.statsTimer <= 0) {
      this.statsTimer = 0.15;
      const l = squad.leader;
      this.panel.setStats(
        `хвіст: ${squad.chain.length}  груп: ${squad.groups.length}  впалих: ${squad.fallen.length}\n` +
          `вороги: ${this.sim.enemies.list.length}  час: ${this.sim.time.toFixed(0)}с\n` +
          `лідер HP: ${Math.round(l.hp)}/${l.maxHp}  швидк.: ${l.speed.toFixed(0)}\n` +
          `верьовка R: ${squad.lazyRadius().toFixed(1)}  мін. радіус: ${squad.minTurnRadius().toFixed(1)}\n` +
          warriorStats(this.sim.warrior) + '\n' +
          `ривок: ${l.dashTimeLeft > 0 ? 'АКТИВНИЙ' : l.dashCooldownLeft > 0 ? l.dashCooldownLeft.toFixed(1) + 'с' : 'готовий'}\n` +
          `FPS: ${Math.round(this.game.loop.actualFps)}`,
      );
    }
  }
}

const secs = (t: number): string => `${t.toFixed(1)}с`;

function warriorStats(w: WarriorSystem): string {
  if (!w.enabled) return 'Воїн: ВИМКНЕНО';
  const ability = w.abilityTimeLeft > 0 ? `АКТИВНА ${secs(w.abilityTimeLeft)}` : w.abilityCooldownLeft > 0 ? `КД ${secs(w.abilityCooldownLeft)}` : 'готова (F)';
  const ring = w.ringShieldLeft > 0 ? `щит ${secs(w.ringShieldLeft)}` : w.ringCooldownLeft > 0 ? `КД ${w.ringCooldownLeft.toFixed(0)}с` : 'готове';
  return `Воїн: активка ${ability}\n      кільце ${ring}`;
}
