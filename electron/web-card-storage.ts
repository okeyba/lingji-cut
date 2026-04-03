import fs from 'node:fs/promises';
import path from 'node:path';
import type { PersistedAIState } from '../src/lib/ai-persistence';
import { normalizeWebCardSrcDoc } from '../src/lib/web-card';
import type { TimelineData } from '../src/types';
import type { WebCardPayload } from '../src/types/ai';

const WEB_CARD_DIR_NAME = 'ai-cards';

interface MaterializeResult<T> {
  data: T;
  changed: boolean;
}

function sanitizeFileSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'card';
}

function buildWebCardFilePath(projectDir: string, identifier: string): string {
  return path.join(projectDir, WEB_CARD_DIR_NAME, `${sanitizeFileSegment(identifier)}.html`);
}

async function materializeWebCardPayload(
  projectDir: string,
  identifier: string,
  webCard?: WebCardPayload,
): Promise<MaterializeResult<WebCardPayload | undefined>> {
  if (!webCard) {
    return { data: undefined, changed: false };
  }

  if (!webCard.srcDoc) {
    return { data: webCard, changed: false };
  }

  const filePath = buildWebCardFilePath(projectDir, identifier);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, normalizeWebCardSrcDoc(webCard.srcDoc), 'utf-8');

  return {
    data: {
      src: filePath,
      runtimeStatus: webCard.runtimeStatus,
      lastGeneratedAt: webCard.lastGeneratedAt,
    },
    changed: true,
  };
}

export async function materializePersistedAIState(
  projectDir: string,
  state: PersistedAIState,
): Promise<MaterializeResult<PersistedAIState>> {
  if (!state.analysisResult) {
    return { data: state, changed: false };
  }

  let changed = false;
  const cards = await Promise.all(
    state.analysisResult.cards.map(async (card) => {
      const result = await materializeWebCardPayload(projectDir, card.id, card.webCard);
      changed = changed || result.changed;
      return result.changed ? { ...card, webCard: result.data } : card;
    }),
  );

  return {
    changed,
    data: changed
      ? {
          ...state,
          analysisResult: {
            ...state.analysisResult,
            cards,
          },
        }
      : state,
  };
}

export async function materializeTimelineWebCards(
  projectDir: string,
  timeline: TimelineData,
): Promise<MaterializeResult<TimelineData>> {
  let changed = false;
  const overlays = await Promise.all(
    timeline.overlays.map(async (overlay) => {
      const webCard = overlay.aiCardData?.webCard;
      if (!webCard) {
        return overlay;
      }

      const identifier = overlay.aiCardData?.sourceCardId ?? overlay.id;
      const result = await materializeWebCardPayload(projectDir, identifier, webCard);
      changed = changed || result.changed;
      if (!result.changed || !overlay.aiCardData) {
        return overlay;
      }

      return {
        ...overlay,
        aiCardData: {
          ...overlay.aiCardData,
          webCard: result.data,
        },
      };
    }),
  );

  return {
    changed,
    data: changed
      ? {
          ...timeline,
          overlays,
        }
      : timeline,
  };
}
