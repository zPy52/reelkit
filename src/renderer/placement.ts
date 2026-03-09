import type { Anchor, Placement } from '../clips';

export interface ResolvedPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
}

export function parseDim(value: number | `${number}%`, dimensionPx: number): number {
  if (typeof value === 'number') {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed.endsWith('%')) {
    return Number.parseFloat(trimmed);
  }

  return (Number.parseFloat(trimmed.slice(0, -1)) / 100) * dimensionPx;
}

export function anchorOffset(anchor: Anchor, width: number, height: number): [number, number] {
  switch (anchor) {
    case 'top-left':
      return [0, 0];
    case 'top-center':
      return [width / 2, 0];
    case 'top-right':
      return [width, 0];
    case 'center-left':
      return [0, height / 2];
    case 'center':
      return [width / 2, height / 2];
    case 'center-right':
      return [width, height / 2];
    case 'bottom-left':
      return [0, height];
    case 'bottom-center':
      return [width / 2, height];
    case 'bottom-right':
      return [width, height];
  }
}

export function resolvePlacement(
  placement: Placement,
  canvasWidth: number,
  canvasHeight: number,
  intrinsicWidth: number,
  intrinsicHeight: number,
): ResolvedPlacement {
  const width = parseDim(
    placement.width ?? intrinsicWidth,
    canvasWidth,
  );
  const height = parseDim(
    placement.height ?? intrinsicHeight,
    canvasHeight,
  );
  const x = parseDim(placement.x ?? '50%', canvasWidth);
  const y = parseDim(placement.y ?? '50%', canvasHeight);
  const [offsetX, offsetY] = anchorOffset(placement.anchor ?? 'center', width, height);

  return {
    x: x - offsetX,
    y: y - offsetY,
    width,
    height,
    rotation: placement.rotation ?? 0,
    opacity: placement.opacity ?? 1,
  };
}
