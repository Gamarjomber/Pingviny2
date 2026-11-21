/**
 * Стек множників за джерелами. Рівень відряду, реліквії, здібності лідера, ривок —
 * кожне джерело ставить свій множник, підсумок = добуток. Нічого не вшивається в клас.
 */
export class ModifierStack<K extends string> {
  private bySource = new Map<string, Map<K, number>>();

  set(source: string, key: K, mult: number): void {
    let m = this.bySource.get(source);
    if (!m) {
      m = new Map();
      this.bySource.set(source, m);
    }
    m.set(key, mult);
  }

  clear(source: string): void {
    this.bySource.delete(source);
  }

  get(key: K): number {
    let v = 1;
    for (const m of this.bySource.values()) v *= m.get(key) ?? 1;
    return v;
  }
}
