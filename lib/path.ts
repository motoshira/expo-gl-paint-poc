type Coord = {
  x: number;
  y: number;
};

type Line = {
  from: Coord;
  to: Coord;
};

export class Path {
  currentPoint: Coord | undefined = undefined;
  lines: Line[] = [];
  reset(): void {
    this.points = [];
  }
  checkCurrentDefined(): void {
    if (!this.currentPoint) {
      throw new Error("currentPoint is undefined!");
    }
  }
  moveTo(c: Coord): void {
    // TODO
    this.currentPoint = c;
  }
  drawLine(c: Coord): void {
    this.checkCurrentDefined();
    const current = this.currentPoint;
    this.lines.push({
      from: current,
      to: c,
    });
    this.currentPoint = c;
  }
}
