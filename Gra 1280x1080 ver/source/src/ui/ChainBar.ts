import { UNIT_CLASSES } from '../data/unitClasses';
import type { Squad } from '../sim/squad/Squad';
import type { UnitState } from '../sim/squad/types';

const css = (c: number): string => '#' + c.toString(16).padStart(6, '0');

/**
 * HP-ланцюжок: фігурки бійців у порядку хвоста, кожна залита кольором класу зверху вниз
 * за своїм HP. Відчеплені групи йдуть окремо, з таймером. Перемальовується лише при зміні.
 */
export class ChainBar {
  private lastSig = '';

  constructor(private readonly el: HTMLElement, private readonly squad: Squad) {}

  update(): void {
    const { squad } = this;
    const l = squad.leader;
    const sig =
      `L${Math.round(l.hp)}|` +
      squad.fallen.map((u) => `${u.id}:${Math.ceil(u.downTimeLeft)}`).join(',') +
      '|' +
      squad.chain.map((u) => `${u.id}:${Math.round(u.hp)}`).join(',') +
      '|' +
      squad.groups.map((g) => `${g.id}:${Math.ceil(g.timeLeft)}:${g.units.map((u) => Math.round(u.hp)).join('.')}`).join(',');
    if (sig === this.lastSig) return;
    this.lastSig = sig;

    const lp = Math.round((l.hp / l.maxHp) * 100);
    let html = `<div class="cell leader" style="background:linear-gradient(to bottom, #d9b14a ${lp}%, #1a1422 ${lp}%)" title="Лідер ${Math.round(l.hp)}/${l.maxHp}"></div>`;
    for (const u of squad.chain) html += this.cell(u, false);
    for (const g of squad.groups) {
      html += `<div class="gap"></div>`;
      for (const u of g.units) html += this.cell(u, true);
      html += `<div class="timer">${Math.ceil(g.timeLeft)}с</div>`;
    }
    if (squad.fallen.length) html += `<div class="gap"></div>`;
    for (const u of squad.fallen) {
      html += `<div class="cell down" title="${UNIT_CLASSES[u.classId]?.name ?? u.classId}"><i>${Math.ceil(u.downTimeLeft)}</i></div>`;
    }
    this.el.innerHTML = html;
  }

  private cell(u: UnitState, detached: boolean): string {
    const color = css(UNIT_CLASSES[u.classId]?.color ?? 0xffffff);
    const pct = Math.round((u.hp / u.maxHp) * 100);
    // «залито зверху вниз»: кольорова частина починається згори, порожня — знизу
    const bg = `linear-gradient(to bottom, ${color} ${pct}%, #1a1422 ${pct}%)`;
    return `<div class="cell${detached ? ' detached' : ''}" style="background:${bg}" title="${UNIT_CLASSES[u.classId]?.name ?? u.classId} ${Math.round(u.hp)}/${u.maxHp}"></div>`;
  }
}
