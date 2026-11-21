import { DEFAULT_SQUAD_CONFIG, SQUAD_TUNABLES, type SquadConfig } from '../data/squadConfig';
import { ENEMY_TUNABLES, resetEnemyConfig, saveEnemyConfig } from '../data/enemyTunables';
import { DEFAULT_PRESET_ID, findPreset, SQUAD_PRESETS } from '../data/squadPresets';

const STORAGE_KEY = 'gra.squadConfig.v1';
const PRESET_KEY = 'gra.squadPreset.v1';

/** Завантажує збережені налаштування поверх дефолтів (тільки відомі ключі). */
export function loadSquadConfig(): SquadConfig {
  const cfg: SquadConfig = { ...DEFAULT_SQUAD_CONFIG };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) Object.assign(cfg, findPreset(DEFAULT_PRESET_ID)?.values); // перший запуск: пресет «Юркий»
    if (raw) {
      const saved = JSON.parse(raw) as Partial<Record<keyof SquadConfig, unknown>>;
      for (const k of Object.keys(cfg) as (keyof SquadConfig)[]) {
        if (typeof saved[k] === 'number') cfg[k] = saved[k] as number;
      }
    }
  } catch {
    /* storage недоступний — працюємо з дефолтами */
  }
  return cfg;
}

export const chainLabel = (pursuit: boolean): string =>
  pursuit ? 'хвіст: кожен за попереднім (C)' : 'хвіст: по сліду лідера (C)';

export const warriorLabel = (on: boolean): string => `клас Воїн: ${on ? 'вкл' : 'викл'} (V)`;

export interface PanelActions {
  addUnit(): void;
  removeUnit(): void;
  restart(): void;
  toggleDebug(): boolean;
  damageRandom(): void;
  spawnEnemies(n: number): void;
  toggleSpawner(): boolean;
  toggleGod(): boolean;
  killAll(): void;
  /** Повертає true, якщо тепер кожен іде за попереднім (pursuit). */
  toggleChainMode(): boolean;
  /** Повертає true, якщо клас Воїн тепер увімкнено. */
  toggleWarrior(): boolean;
}

/** Панель параметрів, що будується зі схеми SQUAD_TUNABLES і крутить конфіг наживо. */
export class TuningPanel {
  private readonly stats: HTMLElement;
  private readonly enemyInputs = new Map<string, { range: HTMLInputElement; val: HTMLElement }>();
  private presetSelect!: HTMLSelectElement;
  private presetNote!: HTMLElement;
  private readonly inputs = new Map<keyof SquadConfig, { range: HTMLInputElement; val: HTMLElement }>();

  constructor(
    private readonly root: HTMLElement,
    private readonly cfg: SquadConfig,
    actions: PanelActions,
  ) {
    root.innerHTML = `
      <div class="panel-head"><b>Параметри змійки</b><button data-act="hide" title="Tab">×</button></div>
      <div class="stats"></div>
      <div class="presets"><span>Пресет</span><select data-act="preset"></select></div>
      <div class="preset-note"></div>
      <div class="btns">
        <button data-act="add">+ кіт</button><button data-act="rm">− кіт</button>
        <button data-act="dbg">дебаг (Q)</button><button data-act="hurt">урон (K)</button>
        <button data-act="restart">рестарт (R)</button><button data-act="reset">скинути</button>
        <button data-act="enemies">вороги +20 (E)</button><button data-act="spawner">спавн: вкл</button>
        <button data-act="god">безсмертя: викл</button><button data-act="killall">прибрати ворогів</button>
        <button data-act="chain" style="grid-column:1/3">хвіст: по сліду лідера (C)</button>
        <button data-act="warrior" style="grid-column:1/3">${warriorLabel(true)}</button>
      </div>
      <div class="fields"></div>`;
    this.stats = root.querySelector('.stats')!;
    const fields = root.querySelector('.fields')!;
    this.presetSelect = root.querySelector('select[data-act=preset]')!;
    this.presetNote = root.querySelector('.preset-note')!;
    for (const pr of SQUAD_PRESETS) {
      const o = document.createElement('option');
      o.value = pr.id;
      o.textContent = `${pr.name}${pr.recommended ? ' ⭐' : ''}`;
      this.presetSelect.appendChild(o);
    }
    const custom = document.createElement('option');
    custom.value = 'custom';
    custom.textContent = 'свої значення';
    this.presetSelect.appendChild(custom);
    this.presetSelect.addEventListener('change', () => {
      this.presetSelect.blur();
      this.applyPreset(this.presetSelect.value);
    });
    this.syncPresetSelect();

    let group = '';
    for (const t of SQUAD_TUNABLES) {
      if (t.group !== group) {
        group = t.group;
        const h = document.createElement('div');
        h.className = 'group';
        h.textContent = group;
        fields.appendChild(h);
      }
      const row = document.createElement('label');
      row.className = 'row';
      row.innerHTML = `<span>${t.label}</span><input type="range" min="${t.min}" max="${t.max}" step="${t.step}"><em></em>`;
      const range = row.querySelector('input')!;
      const val = row.querySelector('em')!;
      range.value = String(cfg[t.key]);
      val.textContent = String(cfg[t.key]);
      range.addEventListener('input', () => {
        cfg[t.key] = Number(range.value);
        val.textContent = range.value;
        this.syncPresetSelect(true);
        this.save();
      });
      fields.appendChild(row);
      this.inputs.set(t.key, { range, val });
    }

    // --- налаштування ворогів: ті самі повзунки, але пишуть у дані ворогів
    for (const t of ENEMY_TUNABLES) {
      if (t.group !== group) {
        group = t.group;
        const h = document.createElement('div');
        h.className = 'group';
        h.textContent = group;
        fields.appendChild(h);
      }
      const row = document.createElement('label');
      row.className = 'row';
      row.innerHTML = `<span title="${t.label}">${t.label}</span><input type="range" min="${t.min}" max="${t.max}" step="${t.step}"><em></em>`;
      const range = row.querySelector('input')!;
      const val = row.querySelector('em')!;
      range.value = String(t.get());
      val.textContent = String(t.get());
      range.addEventListener('input', () => {
        t.set(Number(range.value));
        val.textContent = range.value;
        saveEnemyConfig();
      });
      fields.appendChild(row);
      this.enemyInputs.set(t.key, { range, val });
    }

    root.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).dataset.act;
      if (!act || act === 'preset') return; // select не чіпаємо: blur() закривав випадаючий список
      if (act === 'hide') this.toggle();
      if (act === 'add') actions.addUnit();
      if (act === 'rm') actions.removeUnit();
      if (act === 'dbg') actions.toggleDebug();
      if (act === 'hurt') actions.damageRandom();
      if (act === 'restart') actions.restart();
      if (act === 'reset') this.reset();
      if (act === 'enemies') actions.spawnEnemies(20);
      if (act === 'killall') actions.killAll();
      if (act === 'chain') (e.target as HTMLElement).textContent = chainLabel(actions.toggleChainMode());
      if (act === 'spawner') (e.target as HTMLElement).textContent = `спавн: ${actions.toggleSpawner() ? 'вкл' : 'викл'}`;
      if (act === 'warrior') (e.target as HTMLElement).textContent = warriorLabel(actions.toggleWarrior());
      if (act === 'god') (e.target as HTMLElement).textContent = `безсмертя: ${actions.toggleGod() ? 'вкл' : 'викл'}`;
      (e.target as HTMLElement).blur(); // щоб пробіл не «натискав» кнопку
    });
  }

  setChainButton(pursuit: boolean): void {
    const b = this.root.querySelector<HTMLElement>('[data-act=chain]');
    if (b) b.textContent = chainLabel(pursuit);
  }

  setWarriorButton(on: boolean): void {
    const b = this.root.querySelector<HTMLElement>('[data-act=warrior]');
    if (b) b.textContent = warriorLabel(on);
  }

  toggle(): void {
    this.root.classList.toggle('hidden');
  }

  setStats(text: string): void {
    if (this.stats.textContent !== text) this.stats.textContent = text;
  }

  /** Застосовує пресет: перезаписує лише ті поля, що в ньому є (утримання, бій, Воїн не чіпає). */
  private applyPreset(id: string): void {
    const pr = findPreset(id);
    if (!pr) return;
    Object.assign(this.cfg, pr.values);
    this.refreshSliders();
    this.syncPresetSelect();
    this.save();
  }

  /** Показує, який пресет зараз активний: збігаються всі його поля. Інакше — «свої значення». */
  private syncPresetSelect(edited = false): void {
    let active = 'custom';
    for (const pr of SQUAD_PRESETS) {
      const same = (Object.keys(pr.values) as (keyof SquadConfig)[]).every((k) => this.cfg[k] === pr.values[k]);
      if (same) {
        active = pr.id;
        break;
      }
    }
    this.presetSelect.value = active;
    const pr = findPreset(active);
    this.presetNote.textContent = pr ? pr.note : edited || active === 'custom' ? 'Ручні зміни відносно пресета.' : '';
    try {
      localStorage.setItem(PRESET_KEY, active);
    } catch {
      /* ignore */
    }
  }

  private refreshSliders(): void {
    for (const [k, { range, val }] of this.inputs) {
      range.value = String(this.cfg[k]);
      val.textContent = String(this.cfg[k]);
    }
  }

  private reset(): void {
    resetEnemyConfig();
    for (const t of ENEMY_TUNABLES) {
      const i = this.enemyInputs.get(t.key)!;
      i.range.value = String(t.get());
      i.val.textContent = String(t.get());
    }
    Object.assign(this.cfg, DEFAULT_SQUAD_CONFIG);
    this.refreshSliders();
    this.syncPresetSelect();
    this.save();
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.cfg));
    } catch {
      /* ignore */
    }
  }
}
