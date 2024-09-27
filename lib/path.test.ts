import { jest, describe, it, expect } from "@jest/globals";
import { Path } from "./path";

describe("Lines", () => {
  it("reset", () => {
    const path = new Path();
    path.reset();
    // path.moveTo({ x: 0.1, y: 0.1 })
    expect(path.lines).toEqual([]);
    expect(path.currentPoint).toBeUndefined();
  });
  it("moveTo", () => {
    const path = new Path();
    const p1 = { x: 0.1, y: 0.1 };

    path.reset();
    path.moveTo(p1);

    expect(path.lines).toEqual([]);
    expect(path.currentPoint).toEqual(p1);
  });
  it("moveTo p0 -> draw line to p1", () => {
    const path = new Path();
    const p0 = { x: 0.1, y: 0.1 };
    const p1 = { x: 0.3, y: 0.3 };

    path.reset();
    path.moveTo(p0);
    path.drawLine(p1);

    expect(path.lines).toEqual([
      {
        from: p0,
        to: p1,
      },
    ]);
    expect(path.currentPoint).toEqual(p1);
  });
});
