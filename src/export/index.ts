import { SubmoduleExportServiceDownload } from './download';
import { SubmoduleExportServiceOptions } from './options';
import { SubmoduleExportServiceResolution } from './resolution';

export class ExportService {
  public static readonly download = new SubmoduleExportServiceDownload();
  public static readonly options = new SubmoduleExportServiceOptions();
  public static readonly resolution = new SubmoduleExportServiceResolution();
}

export { AudioEncoderBridge } from './audio-encoder-bridge';
export { ExportPipeline } from './export-pipeline';
export { FrameProducer } from './frame-producer';
export { ExportMuxer } from './muxer';
export { VideoEncoderBridge } from './video-encoder-bridge';
export type {
  ExportAudioCodec,
  ExportFormat,
  ExportHardwareAcceleration,
  ExportOptions,
  ExportPipelineResult,
  ExportQuality,
  ExportResolution,
  ExportResult,
  ExportTimelineLike,
  ExportVideoCodec,
  ResolvedExportOptions,
  ResolvedExportResolution,
} from './types';
