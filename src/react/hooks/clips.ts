import { useEffect, useState } from 'react';
import type { Timeline } from '../../timeline';
import type { UseClipsResult } from './types';

export class SubmodulePreviewHooksClips {
  public use(timeline: Timeline): UseClipsResult {
    const [clips, setClips] = useState<UseClipsResult>(timeline.getClips());

    useEffect(() => {
      setClips(timeline.getClips());
    }, [timeline]);

    useEffect(() => {
      const refresh = () => {
        setClips(timeline.getClips());
      };

      const unsubscribeAdded = timeline.on('clip-added', refresh);
      const unsubscribeRemoved = timeline.on('clip-removed', refresh);
      const unsubscribeChanged = timeline.on('clip-changed', refresh);

      return () => {
        unsubscribeAdded();
        unsubscribeRemoved();
        unsubscribeChanged();
      };
    }, [timeline]);

    return clips;
  }
}
