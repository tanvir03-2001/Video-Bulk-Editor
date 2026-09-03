import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  DEFAULT_BRANDING_SUBTITLES,
  type BrandingConfig,
  type BrandingSide,
  type OverlayPosition,
} from '../../../shared/branding';
import { LocalMediaImage } from '../ui/LocalMediaImage';
import { resolvePreviewLayout, type PreviewSideDims } from './previewLayout';
import { TextLogoCssLockup } from './TextLogoCssLockup';

interface BrandingCssOverlayProps {
  config: BrandingConfig;
  /** Source frame size — improves side-band layout accuracy. */
  sourceWidth?: number;
  sourceHeight?: number;
}

const DEMO_SUBTITLE_WORDS = ['This', 'is', 'a', 'demo'] as const;
const DEMO_ACTIVE_WORD_INDEX = 2;

function positionStyle(position: OverlayPosition, marginPercent: number): CSSProperties {
  const margin = `${marginPercent}cqw`;
  const [vertical, horizontal] = position.split('-');
  const style: CSSProperties = { position: 'absolute' };

  if (horizontal === 'left') {
    style.left = margin;
    style.textAlign = 'left';
  } else if (horizontal === 'right') {
    style.right = margin;
    style.textAlign = 'right';
  } else {
    style.left = '50%';
    style.transform = 'translateX(-50%)';
    style.textAlign = 'center';
  }

  if (vertical === 'top') {
    style.top = margin;
  } else if (vertical === 'bottom') {
    style.bottom = margin;
  } else {
    style.top = '50%';
    style.transform =
      horizontal === 'center' ? 'translate(-50%, -50%)' : `${style.transform ?? ''} translateY(-50%)`;
  }

  return style;
}

function useSideImageDimensions(
  config: BrandingConfig,
): Partial<Record<BrandingSide, PreviewSideDims>> {
  const [dims, setDims] = useState<Partial<Record<BrandingSide, PreviewSideDims>>>({});
  const signature = (['top', 'bottom', 'left', 'right'] as BrandingSide[])
    .map((side) =>
      config.canvas[side].enabled && config.canvas[side].imagePath
        ? `${side}:${config.canvas[side].imagePath}`
        : `${side}:`,
    )
    .join('|');

  useEffect(() => {
    let cancelled = false;
    const sides = (['top', 'bottom', 'left', 'right'] as BrandingSide[]).filter(
      (side) => config.canvas[side].enabled && config.canvas[side].imagePath,
    );

    void (async () => {
      const next: Partial<Record<BrandingSide, PreviewSideDims>> = {};
      await Promise.all(
        sides.map(async (side) => {
          const path = config.canvas[side].imagePath as string;
          try {
            const url = await window.api.getLocalMediaUrl(path);
            const size = await new Promise<PreviewSideDims | null>((resolve) => {
              const image = new Image();
              image.onload = () => {
                resolve({
                  width: Math.max(1, image.naturalWidth),
                  height: Math.max(1, image.naturalHeight),
                });
              };
              image.onerror = () => {
                resolve(null);
              };
              image.src = url;
            });
            next[side] = size ?? { width: 16, height: 9 };
          } catch {
            next[side] = { width: 16, height: 9 };
          }
        }),
      );
      if (!cancelled) {
        setDims(next);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [signature, config.canvas]);

  return dims;
}

export function BrandingCssOverlay({
  config,
  sourceWidth = 16,
  sourceHeight = 9,
}: BrandingCssOverlayProps) {
  const movingTextRef = useRef<HTMLDivElement | null>(null);
  const sideDims = useSideImageDimensions(config);
  const layout = useMemo(
    () =>
      resolvePreviewLayout(config, Math.max(1, sourceWidth), Math.max(1, sourceHeight), sideDims),
    [config, sourceHeight, sourceWidth, sideDims],
  );

  useEffect(() => {
    if (!config.movingText.enabled) {
      return;
    }

    const element = movingTextRef.current;
    if (!element) {
      return;
    }

    let frameId = 0;
    let phase = 0;
    let lastTs = 0;

    const tick = (timestamp: number) => {
      if (!lastTs) {
        lastTs = timestamp;
      }
      const deltaSec = Math.min(0.05, (timestamp - lastTs) / 1000);
      lastTs = timestamp;
      phase += deltaSec;
      const x = Math.sin(phase) * 18;
      const y = Math.cos(phase * 0.7 + 1.7) * 14;
      element.style.transform = `translate(calc(-50% + ${x}cqw), calc(-50% + ${y}cqh))`;
      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [config.movingText.enabled]);

  const subtitleX = Number.isFinite(config.subtitles.xPercent)
    ? config.subtitles.xPercent
    : DEFAULT_BRANDING_SUBTITLES.xPercent;
  const subtitleY = Number.isFinite(config.subtitles.yPercent)
    ? config.subtitles.yPercent
    : DEFAULT_BRANDING_SUBTITLES.yPercent;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden [container-type:size]">
      {config.canvas.top.enabled && config.canvas.top.imagePath && layout.topPct > 0 ? (
        <LocalMediaImage
          filePath={config.canvas.top.imagePath}
          asBackground
          className="absolute left-0 right-0 top-0"
          style={{ height: `${layout.topPct}%` }}
          alt="Top image"
        />
      ) : null}
      {config.canvas.bottom.enabled && config.canvas.bottom.imagePath && layout.bottomPct > 0 ? (
        <LocalMediaImage
          filePath={config.canvas.bottom.imagePath}
          asBackground
          className="absolute bottom-0 left-0 right-0"
          style={{ height: `${layout.bottomPct}%` }}
          alt="Bottom image"
        />
      ) : null}
      {config.canvas.left.enabled && config.canvas.left.imagePath && layout.leftPct > 0 ? (
        <LocalMediaImage
          filePath={config.canvas.left.imagePath}
          asBackground
          className="absolute"
          style={{
            left: 0,
            top: `${layout.videoTopPct}%`,
            width: `${layout.leftPct}%`,
            height: `${layout.videoHeightPct}%`,
          }}
          alt="Left image"
        />
      ) : null}
      {config.canvas.right.enabled && config.canvas.right.imagePath && layout.rightPct > 0 ? (
        <LocalMediaImage
          filePath={config.canvas.right.imagePath}
          asBackground
          className="absolute"
          style={{
            right: 0,
            top: `${layout.videoTopPct}%`,
            width: `${layout.rightPct}%`,
            height: `${layout.videoHeightPct}%`,
          }}
          alt="Right image"
        />
      ) : null}

      {config.watermark.enabled ? (
        config.watermark.mode === 'image' && config.watermark.imagePath ? (
          <div
            style={{
              ...positionStyle(config.watermark.position, config.watermark.marginPercent),
              opacity: config.watermark.opacityPercent / 100,
              maxWidth: `${config.watermark.scalePercent}%`,
              zIndex: 2,
            }}
          >
            <LocalMediaImage
              filePath={config.watermark.imagePath}
              alt="Watermark"
              className="h-auto w-full object-contain"
            />
          </div>
        ) : config.watermark.mode === 'text' ? (
          <TextLogoCssLockup
            config={config.watermark}
            className="pointer-events-none absolute inset-0 z-[2] overflow-hidden"
          />
        ) : null
      ) : null}

      {config.movingText.enabled ? (
        <div
          ref={movingTextRef}
          className="absolute left-1/2 top-1/2 z-[2] whitespace-nowrap font-medium text-white"
          style={{
            opacity: config.movingText.opacityPercent / 100,
            fontSize: `${config.movingText.sizePercent}cqh`,
            textShadow: '0 2px 8px rgba(0,0,0,0.55)',
          }}
        >
          {config.movingText.text}
        </div>
      ) : null}

      {config.subtitles.enabled ? (
        <div
          className="absolute z-[3] whitespace-nowrap text-center font-black uppercase tracking-wide text-white"
          style={{
            left: `${subtitleX}%`,
            top: `${subtitleY}%`,
            transform: 'translate(-50%, -50%)',
            fontSize: '3.6cqh',
            WebkitTextStroke: '0.08em rgba(0,0,0,0.9)',
            paintOrder: 'stroke fill',
            textShadow: '0 0.08em 0.16em rgba(0,0,0,0.75)',
          }}
          aria-hidden
        >
          {DEMO_SUBTITLE_WORDS.map((word, index) => (
            <span
              key={`${word}-${index}`}
              className={index > 0 ? 'ml-[0.28em]' : undefined}
              style={
                index === DEMO_ACTIVE_WORD_INDEX
                  ? { color: '#00ffff', fontWeight: 900 }
                  : undefined
              }
            >
              {word}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export { resolvePreviewLayout };
