import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  Badge,
  Button,
  EmptyState,
  Field,
  IconButton,
  Input,
  MediaPlaceholder,
  ModalShell,
  ProgressBar,
  SurfaceCard,
  Textarea,
} from '../src/ui/primitives';
import { FileDropCard, SelectionCard } from '../src/ui/patterns';

describe('ui primitives', () => {
  it('renders a loading button with disabled busy state', () => {
    const html = renderToStaticMarkup(
      <Button variant="primary" size="lg" loading>
        保存
      </Button>,
    );

    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('disabled=""');
    expect(html).toContain('data-variant="primary"');
    expect(html).toContain('data-size="lg"');
  });

  it('renders an icon button with an accessible label', () => {
    const html = renderToStaticMarkup(
      <IconButton aria-label="打开设置" variant="ghost" size="sm">
        <span>icon</span>
      </IconButton>,
    );

    expect(html).toContain('aria-label="打开设置"');
    expect(html).toContain('data-variant="ghost"');
    expect(html).toContain('data-size="sm"');
    expect(html).toContain('icon');
  });

  it('renders field controls with labels and hints', () => {
    const html = renderToStaticMarkup(
      <Field label="标题" hint="最多 20 个字">
        <Input value="播客标题" readOnly />
      </Field>,
    );

    expect(html).toContain('标题');
    expect(html).toContain('最多 20 个字');
    expect(html).toContain('value="播客标题"');
  });

  it('renders a textarea field and empty state action area', () => {
    const html = renderToStaticMarkup(
      <EmptyState
        eyebrow="EMPTY"
        title="还没有内容"
        description="先导入字幕再继续"
        actions={
          <Field label="备注">
            <Textarea value="待处理" readOnly rows={2} />
          </Field>
        }
      />,
    );

    expect(html).toContain('还没有内容');
    expect(html).toContain('先导入字幕再继续');
    expect(html).toContain('textarea');
    expect(html).toContain('待处理');
  });

  it('renders badges, progress bar and modal shell metadata', () => {
    const html = renderToStaticMarkup(
      <ModalShell
        visible
        eyebrow="EXPORT"
        title="导出设置"
        footer={
          <>
            <Badge variant="info">1080p</Badge>
            <ProgressBar value={42} tone="brand" />
          </>
        }
      >
        <Badge variant="warning" shape="rounded">
          极速低码率
        </Badge>
      </ModalShell>,
    );

    expect(html).toContain('导出设置');
    expect(html).toContain('EXPORT');
    expect(html).toContain('1080p');
    expect(html).toContain('极速低码率');
    expect(html).toContain('aria-valuenow="42"');
    expect(html).toContain('role="dialog"');
  });

  it('renders surface cards, selection cards and file drop cards', () => {
    const html = renderToStaticMarkup(
      <SurfaceCard variant="brand" padding="lg">
        <SelectionCard
          title="1080p"
          description="更清晰但导出更慢"
          meta="1920 x 1080"
          selected
          tone="brand"
        />
        <FileDropCard
          eyebrow="AUDIO"
          heading="拖入 MP3"
          placeholder="把文件拖到这里"
          value="demo.mp3"
          accentColor="#7bd5ff"
          action={<span>选择文件</span>}
        />
      </SurfaceCard>,
    );

    expect(html).toContain('data-variant="brand"');
    expect(html).toContain('1080p');
    expect(html).toContain('data-selected="true"');
    expect(html).toContain('拖入 MP3');
    expect(html).toContain('demo.mp3');
  });

  it('renders media placeholders for non-visual assets', () => {
    const html = renderToStaticMarkup(
      <>
        <MediaPlaceholder variant="audio" label="AUDIO" />
        <MediaPlaceholder variant="srt" label="SRT" />
        <MediaPlaceholder variant="generic" label="PDF" />
      </>,
    );

    expect(html).toContain('AUDIO');
    expect(html).toContain('SRT');
    expect(html).toContain('PDF');
  });
});
