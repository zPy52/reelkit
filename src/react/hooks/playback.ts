import { useEffect, useState } from 'react';
import type { Timeline } from '../../timeline';
import type { UsePlaybackResult } from './types';

export class SubmodulePreviewHooksPlayback {
  public use(timeline: Timeline): UsePlaybackResult {
    const [currentTime, setCurrentTime] = useState(timeline.currentTime);
    const [isPlaying, setIsPlaying] = useState(timeline.playing);

    useEffect(() => {
      setCurrentTime(timeline.currentTime);
      setIsPlaying(timeline.playing);
    }, [timeline]);

    useEffect(() => {
      return timeline.on('timeupdate', (time) => {
        setCurrentTime(time);
      });
    }, [timeline]);

    useEffect(() => {
      const unsubscribePlay = timeline.on('play', () => {
        setIsPlaying(true);
      });
      const unsubscribePause = timeline.on('pause', () => {
        setIsPlaying(false);
      });
      const unsubscribeEnded = timeline.on('ended', () => {
        setIsPlaying(false);
      });

      return () => {
        unsubscribePlay();
        unsubscribePause();
        unsubscribeEnded();
      };
    }, [timeline]);

    return {
      currentTime,
      isPlaying,
      play: (startTime?: number) => timeline.play(startTime),
      pause: () => timeline.pause(),
      seek: (time: number) => timeline.seek(time),
    };
  }
}
