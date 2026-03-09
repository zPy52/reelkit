import { useEffect, useRef, useState } from 'react';
import type { ExportOptions } from '../../export';
import type { Timeline } from '../../timeline';
import type { UseExportResult } from './types';

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function mergeAbortSignal(
  signal: AbortSignal,
  secondary: AbortSignal | undefined,
): AbortSignal {
  if (!secondary) {
    return signal;
  }

  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any([signal, secondary]);
  }

  const controller = new AbortController();
  const abort = () => controller.abort();

  if (signal.aborted || secondary.aborted) {
    controller.abort();
    return controller.signal;
  }

  signal.addEventListener('abort', abort, { once: true });
  secondary.addEventListener('abort', abort, { once: true });
  return controller.signal;
}

export class SubmodulePreviewHooksExport {
  public use(timeline: Timeline): UseExportResult {
    const controllerRef = useRef<AbortController | null>(null);
    const [progress, setProgress] = useState<number | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
      return () => {
        controllerRef.current?.abort();
        controllerRef.current = null;
      };
    }, []);

    useEffect(() => {
      controllerRef.current?.abort();
      controllerRef.current = null;
      setProgress(null);
      setIsExporting(false);
      setError(null);
    }, [timeline]);

    return {
      exportVideo: async (options?: ExportOptions) => {
        controllerRef.current?.abort();

        const controller = new AbortController();
        controllerRef.current = controller;
        setError(null);
        setIsExporting(true);
        setProgress(0);

        try {
          return await timeline.export({
            ...options,
            signal: mergeAbortSignal(controller.signal, options?.signal),
            onProgress: (nextProgress) => {
              options?.onProgress?.(nextProgress);
              setProgress(nextProgress);
            },
          });
        } catch (errorValue) {
          const normalized = normalizeError(errorValue);
          setError(normalized);
          throw normalized;
        } finally {
          if (controllerRef.current === controller) {
            controllerRef.current = null;
          }

          setIsExporting(false);
          setProgress(null);
        }
      },
      cancel: () => {
        controllerRef.current?.abort();
      },
      progress,
      isExporting,
      error,
    };
  }
}
