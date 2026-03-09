import type { BaseClipOptions, ClipKind } from './types';

let clipCounter = 0;

function createFallbackId(prefix: string): string {
  clipCounter += 1;
  return `${prefix}-${clipCounter}`;
}

export function createClipId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return createFallbackId(prefix);
}

export abstract class BaseClip {
  public readonly id: string;
  public start: number;
  public duration: number;
  public in?: number;
  public out?: number;
  public track: number;
  public abstract readonly kind: ClipKind;

  protected constructor(options: BaseClipOptions, prefix: string) {
    this.id = options.id ?? createClipId(prefix);
    this.start = options.start;
    this.duration = options.duration;
    this.in = options.in;
    this.out = options.out;
    this.track = options.track ?? 0;
  }

  public includes(time: number): boolean {
    return this.start <= time && time < this.start + this.duration;
  }

  public getEnd(): number {
    return this.start + this.duration;
  }
}
