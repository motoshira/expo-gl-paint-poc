import { jest, describe, it, expect } from "@jest/globals";
import { Path } from "./path";

describe("Lines", () => {
  it("reset", () => {
    const path = new Path();
    path.reset();
    // path.moveTo({ x: 0.1, y: 0.1 });
    expect(path.points).toEqual([]);
  });
});
