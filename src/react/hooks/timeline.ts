import { useRef } from 'react';
import { Timeline } from '../../timeline';
import type { UseTimelineOptions } from './types';

export class SubmodulePreviewHooksTimeline {
  public use(options: UseTimelineOptions): Timeline {
    const reference = useRef<Timeline | null>(null);
    if (reference.current === null) {
      reference.current = new Timeline(options);
    }

    return reference.current;
  }
}
