/** Просторова сітка для пошуку сусідів у натовпі (цілі, снаряди, контакти). */
export class SpatialHash {
  private cells = new Map<number, number[]>();
  constructor(private readonly cell = 32) {}

  clear(): void {
    this.cells.clear();
  }

  private key(cx: number, cy: number): number {
    return (cx + 32768) * 65536 + (cy + 32768);
  }

  insert(index: number, x: number, y: number): void {
    const k = this.key(Math.floor(x / this.cell), Math.floor(y / this.cell));
    const arr = this.cells.get(k);
    if (arr) arr.push(index);
    else this.cells.set(k, [index]);
  }

  /** Викликає cb для індексів у клітинках, що перетинають коло. Точну перевірку робить викликач. */
  query(x: number, y: number, r: number, cb: (index: number) => void): void {
    const c = this.cell;
    const x0 = Math.floor((x - r) / c);
    const x1 = Math.floor((x + r) / c);
    const y0 = Math.floor((y - r) / c);
    const y1 = Math.floor((y + r) / c);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const arr = this.cells.get(this.key(cx, cy));
        if (arr) for (let i = 0; i < arr.length; i++) cb(arr[i]!);
      }
    }
  }
}
