import { isValidPlanarQuad, type MockupPoint, type MockupQuad } from "@/domain/mockup/mockup";

export type Matrix3 = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

const EPSILON = 1e-8;

export function homographyFromUnitSquare(quad: MockupQuad): Matrix3 {
  if (!isValidPlanarQuad(quad)) {
    throw new Error("Mockup surface must be a non-degenerate convex quad");
  }

  const x0 = quad.topLeft.x;
  const y0 = quad.topLeft.y;
  const x1 = quad.topRight.x;
  const y1 = quad.topRight.y;
  const x2 = quad.bottomRight.x;
  const y2 = quad.bottomRight.y;
  const x3 = quad.bottomLeft.x;
  const y3 = quad.bottomLeft.y;

  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const sx = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const sy = y0 - y1 + y2 - y3;
  const denominator = dx1 * dy2 - dx2 * dy1;

  if (Math.abs(denominator) <= EPSILON) {
    return [x1 - x0, x3 - x0, x0, y1 - y0, y3 - y0, y0, 0, 0, 1];
  }

  const g = (sx * dy2 - dx2 * sy) / denominator;
  const h = (dx1 * sy - sx * dy1) / denominator;
  return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h, 1];
}

export function invertMatrix3(matrix: Matrix3): Matrix3 {
  const [a, b, c, d, e, f, g, h, i] = matrix;
  const A = e * i - f * h;
  const B = f * g - d * i;
  const C = d * h - e * g;
  const D = c * h - b * i;
  const E = a * i - c * g;
  const F = b * g - a * h;
  const G = b * f - c * e;
  const H = c * d - a * f;
  const I = a * e - b * d;
  const determinant = a * A + b * B + c * C;
  if (Math.abs(determinant) <= EPSILON) throw new Error("Mockup homography is singular");
  const inv = 1 / determinant;
  return [A * inv, D * inv, G * inv, B * inv, E * inv, H * inv, C * inv, F * inv, I * inv];
}

export function projectPoint(matrix: Matrix3, point: MockupPoint): MockupPoint {
  const denominator = matrix[6] * point.x + matrix[7] * point.y + matrix[8];
  if (Math.abs(denominator) <= EPSILON) throw new Error("Point projects to infinity");
  return {
    x: (matrix[0] * point.x + matrix[1] * point.y + matrix[2]) / denominator,
    y: (matrix[3] * point.x + matrix[4] * point.y + matrix[5]) / denominator,
  };
}
