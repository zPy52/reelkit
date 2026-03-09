import type { EffectClip } from '../clips';

export interface EffectNode {
  name: string;
  getFilter(time: number, clip: EffectClip): string | null;
}

const effectRegistry = new Map<string, EffectNode>();

effectRegistry.set('fade', {
  name: 'fade',
  getFilter(time, clip) {
    const from = Number(clip.params?.from ?? 0);
    const to = Number(clip.params?.to ?? 1);
    const progress = clip.duration === 0
      ? 1
      : Math.max(0, Math.min(1, (time - clip.start) / clip.duration));
    const opacity = from + (to - from) * progress;
    return `opacity(${opacity})`;
  },
});

effectRegistry.set('blur', {
  name: 'blur',
  getFilter(_, clip) {
    const intensity = Number(clip.params?.intensity ?? 4);
    return `blur(${intensity}px)`;
  },
});

export function getEffectNode(name: string): EffectNode | undefined {
  return effectRegistry.get(name);
}

export function registerEffectNode(node: EffectNode): void {
  effectRegistry.set(node.name, node);
}
