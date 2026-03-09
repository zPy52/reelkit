import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
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
  const [aspectRatio, setAspectRatio] = useState(() => `${timeline.width} / ${timeline.height}`);

  useEffect(() => {
    setAspectRatio(`${timeline.width} / ${timeline.height}`);
    return timeline.on('resolution-changed', (width, height) => {
      setAspectRatio(`${width} / ${height}`);
    });
  }, [timeline]);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        position: 'relative',
        overflow: 'hidden',
        width: '100%',
        aspectRatio,
        ...style,
      }}
    />
  );
}
