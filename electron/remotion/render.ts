import { selectComposition, renderMedia } from '@remotion/renderer';
import type { SrtEntry, TimelineData } from '../../src/types';

export interface RemotionRenderParams {
  serveUrl: string;
  outputPath: string;
  timeline: TimelineData;
  srtEntries: SrtEntry[];
  compiledCards: Record<string, string>;
  quality: 'standard' | 'high';
  concurrency: number;
  onProgress?: (ratio: number) => void;
}

const COMPOSITION_ID = 'lingji-composition';

export async function renderRemotionVideo(params: RemotionRenderParams): Promise<void> {
  const inputProps = {
    timeline: params.timeline,
    srtEntries: params.srtEntries,
    compiledCards: params.compiledCards,
  };

  const composition = await selectComposition({
    serveUrl: params.serveUrl,
    id: COMPOSITION_ID,
    inputProps,
  });

  await renderMedia({
    composition,
    serveUrl: params.serveUrl,
    codec: 'h264',
    outputLocation: params.outputPath,
    inputProps,
    concurrency: Math.max(1, params.concurrency),
    crf: params.quality === 'high' ? 18 : 23,
    chromiumOptions: { ignoreCertificateErrors: false },
    onProgress: ({ progress }) => params.onProgress?.(progress),
  });
}
