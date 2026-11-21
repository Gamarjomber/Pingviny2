/**
 * Слід («рейки» для хвоста): ламана з точок, куди ходило ПЕРО стабілізатора (не сама голова).
 * Нова точка пишеться, коли перо зрушило на RESAMPLE_STEP пікселів: крок за відстанню, не за кадрами.
 * Коти стоять на рейках за довжиною дуги від голови й повертаються по дотичній.
 */
export class Trail {
  private xs: number[] = [];
  private ys: number[] = [];

  /** Початковий прямий слід позаду голови, щоб стартовий хвіст лежав рівно. */
  seedStraight(x: number, y: number, heading: number, length: number, step: number): void {
    this.xs.length = 0;
    this.ys.length = 0;
    const dx = Math.cos(heading);
    const dy = Math.sin(heading);
    for (let d = Math.ceil(length / step) * step; d > 0; d -= step) {
      this.xs.push(x - dx * d);
      this.ys.push(y - dy * d);
    }
    this.xs.push(x);
    this.ys.push(y);
  }

  /** Останній елемент завжди збігається з поточним положенням пера. */
  setPen(x: number, y: number, step: number): void {
    const n = this.xs.length;
    if (n >= 2 && Math.hypot(x - this.xs[n - 2]!, y - this.ys[n - 2]!) < step) {
      this.xs[n - 1] = x;
      this.ys[n - 1] = y;
    } else {
      this.xs.push(x);
      this.ys.push(y);
    }
  }

  /** Для налагодження: точки сліду (від старих до нових). */
  points(): { xs: readonly number[]; ys: readonly number[] } {
    return { xs: this.xs, ys: this.ys };
  }

  /**
   * Розставляє count котів: i-й на відстані (i+1)*spacing ВЗДОВЖ шляху від голови
   * (за довжиною дуги). Шлях: голова → перо → точки сліду назад. Тому верьовка між головою
   * і пером теж входить у довжину, і перший кіт завжди звʼязаний із головою.
   * heading — напрямок руху в точці кота (дотична до шляху).
   */
  place(
    headX: number,
    headY: number,
    count: number,
    spacing: number,
    outX: number[],
    outY: number[],
    outHeading: number[],
  ): void {
    outX.length = count;
    outY.length = count;
    outHeading.length = count;
    if (this.xs.length === 0) {
      for (let i = 0; i < count; i++) {
        outX[i] = headX;
        outY[i] = headY;
        outHeading[i] = 0;
      }
      return;
    }
    let k = this.xs.length - 1;
    let cx = headX;
    let cy = headY;
    let nx = this.xs[k]!;
    let ny = this.ys[k]!;
    for (let i = 0; i < count; i++) {
      let need = spacing;
      for (;;) {
        const dx = nx - cx;
        const dy = ny - cy;
        const len = Math.hypot(dx, dy);
        if (len >= need && len > 1e-9) {
          cx += (dx / len) * need;
          cy += (dy / len) * need;
          outX[i] = cx;
          outY[i] = cy;
          outHeading[i] = Math.atan2(-dy, -dx); // вперед, у бік голови
          break;
        }
        need -= len;
        cx = nx;
        cy = ny;
        k--;
        if (k < 0) {
          this.extendBack(200);
          k += 200;
        }
        nx = this.xs[k]!;
        ny = this.ys[k]!;
      }
    }
  }

  /** Видаляє слід, старший за keepLength (довжина дуги від пера). */
  trimTo(keepLength: number): void {
    let acc = 0;
    for (let i = this.xs.length - 1; i > 0; i--) {
      acc += Math.hypot(this.xs[i]! - this.xs[i - 1]!, this.ys[i]! - this.ys[i - 1]!);
      if (acc >= keepLength) {
        if (i - 1 > 0) {
          this.xs.splice(0, i - 1);
          this.ys.splice(0, i - 1);
        }
        return;
      }
    }
  }

  /** Якщо слід закінчився (дуже довгий хвіст) — продовжуємо його прямо назад. */
  private extendBack(n: number): void {
    let dx = this.xs[0]! - (this.xs[1] ?? this.xs[0]! + 1);
    let dy = this.ys[0]! - (this.ys[1] ?? this.ys[0]!);
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const addX: number[] = [];
    const addY: number[] = [];
    for (let j = n; j >= 1; j--) {
      addX.push(this.xs[0]! + dx * j * 2);
      addY.push(this.ys[0]! + dy * j * 2);
    }
    this.xs.unshift(...addX);
    this.ys.unshift(...addY);
  }
}
