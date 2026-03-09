import type { CSSProperties } from 'react';
import type { PreviewOptions } from '../renderer/canvas-renderer';
import type { Timeline } from '../timeline';
import { PreviewHooks } from './hooks';

export interface PreviewProps {
  timeline: Timeline;
  style?: CSSProperties;
  className?: string;
  previewOptions?: PreviewOptions;
}

export function Preview({ timeline, style, className, previewOptions }: PreviewProps) {
  const { ref } = PreviewHooks.preview.use(timeline, previewOptions);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        position: 'relative',
        overflow: 'hidden',
        width: '100%',
        aspectRatio: `${timeline.width} / ${timeline.height}`,
        ...style,
      }}
    />
  );
}
