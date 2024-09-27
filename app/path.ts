type Coord = {
  x: number;
  y: number;
};

export class Path {
  points: Coord[] = [];
  reset(): void {
    this.points = [];
  }
  moveTo(c: Coord): void {
    // TODO
  }
}
