import { describe, expect, it } from "vitest";

import {
  homographyFromUnitSquare,
  invertMatrix3,
  isValidPlanarQuad,
  projectPoint,
} from "@/domain/mockup/homography";
import type { MockupQuad } from "@/domain/mockup/mockup";

const rectangle: MockupQuad = {
  topLeft: { x: 0.1, y: 0.2 },
  topRight: { x: 0.9, y: 0.2 },
  bottomRight: { x: 0.9, y: 0.8 },
  bottomLeft: { x: 0.1, y: 0.8 },
};

const perspective: MockupQuad = {
  topLeft: { x: 0.22, y: 0.14 },
  topRight: { x: 0.81, y: 0.22 },
  bottomRight: { x: 0.72, y: 0.83 },
  bottomLeft: { x: 0.13, y: 0.7 },
};

describe("mockup homography", () => {
  it("maps the unit square corners onto a rectangular surface", () => {
    const matrix = homographyFromUnitSquare(rectangle);
    expect(projectPoint(matrix, { x: 0, y: 0 })).toEqual(rectangle.topLeft);
    expect(projectPoint(matrix, { x: 1, y: 0 })).toEqual(rectangle.topRight);
    expect(projectPoint(matrix, { x: 1, y: 1 })).toEqual(rectangle.bottomRight);
    expect(projectPoint(matrix, { x: 0, y: 1 })).toEqual(rectangle.bottomLeft);
  });

  it("round-trips points through a perspective transform and its inverse", () => {
    const matrix = homographyFromUnitSquare(perspective);
    const inverse = invertMatrix3(matrix);
    for (const source of [
      { x: 0, y: 0 },
      { x: 0.25, y: 0.65 },
      { x: 0.5, y: 0.5 },
      { x: 1, y: 1 },
    ]) {
      const projected = projectPoint(matrix, source);
      const restored = projectPoint(inverse, projected);
      expect(restored.x).toBeCloseTo(source.x, 8);
      expect(restored.y).toBeCloseTo(source.y, 8);
    }
  });

  it("rejects crossed and degenerate surfaces", () => {
    expect(isValidPlanarQuad(perspective)).toBe(true);
    expect(
      isValidPlanarQuad({
        topLeft: { x: 0.1, y: 0.1 },
        topRight: { x: 0.9, y: 0.9 },
        bottomRight: { x: 0.1, y: 0.9 },
        bottomLeft: { x: 0.9, y: 0.1 },
      }),
    ).toBe(false);
    expect(
      isValidPlanarQuad({
        topLeft: { x: 0.1, y: 0.1 },
        topRight: { x: 0.5, y: 0.1 },
        bottomRight: { x: 0.9, y: 0.1 },
        bottomLeft: { x: 0.2, y: 0.1 },
      }),
    ).toBe(false);
  });
});
