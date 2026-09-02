import { useEffect, useRef, type CSSProperties } from 'react';
import {
  BRANDING_FONT_STACKS,
  BRANDING_FONT_WEIGHT_VALUES,
  type BrandingConfig,
  type OverlayPosition,
} from '../../../shared/branding';
import { LocalMediaImage } from '../ui/LocalMediaImage';

interface BrandingCssOverlayProps {
  config: BrandingConfig;
}

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

export function BrandingCssOverlay({ config }: BrandingCssOverlayProps) {
  const movingTextRef = useRef<HTMLDivElement | null>(null);

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
      element.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [config.movingText.enabled]);

  const zoomScale = config.canvas.zoomPercent / 100;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {config.canvas.top.enabled && config.canvas.top.imagePath ? (
        <LocalMediaImage
          filePath={config.canvas.top.imagePath}
          asBackground
          className="absolute left-0 right-0 top-0 h-[12%] opacity-90"
          alt="Top image"
        />
      ) : null}
      {config.canvas.bottom.enabled && config.canvas.bottom.imagePath ? (
        <LocalMediaImage
          filePath={config.canvas.bottom.imagePath}
          asBackground
          className="absolute bottom-0 left-0 right-0 h-[12%] opacity-90"
          alt="Bottom image"
        />
      ) : null}
      {config.canvas.left.enabled && config.canvas.left.imagePath ? (
        <LocalMediaImage
          filePath={config.canvas.left.imagePath}
          asBackground
          className="absolute bottom-0 left-0 top-0 w-[12%] opacity-90"
          alt="Left image"
        />
      ) : null}
      {config.canvas.right.enabled && config.canvas.right.imagePath ? (
        <LocalMediaImage
          filePath={config.canvas.right.imagePath}
          asBackground
          className="absolute bottom-0 right-0 top-0 w-[12%] opacity-90"
          alt="Right image"
        />
      ) : null}

      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ transform: zoomScale !== 1 ? `scale(${zoomScale})` : undefined }}
      >
        {config.watermark.enabled ? (
          <div
            style={{
              ...positionStyle(config.watermark.position, config.watermark.marginPercent),
              opacity: config.watermark.opacityPercent / 100,
              ...(config.watermark.mode === 'image' && config.watermark.imagePath
                ? { maxWidth: `${config.watermark.scalePercent}%` }
                : {}),
            }}
          >
            {config.watermark.mode === 'image' && config.watermark.imagePath ? (
              <LocalMediaImage
                filePath={config.watermark.imagePath}
                alt="Watermark"
                className="h-auto w-full object-contain"
              />
            ) : (
              <div
                className="leading-tight"
                style={{
                  fontFamily: BRANDING_FONT_STACKS[config.watermark.text.fontFamily],
                  fontWeight: BRANDING_FONT_WEIGHT_VALUES[config.watermark.text.fontWeight],
                  fontSize: `${config.watermark.text.fontSizePercent}cqh`,
                  color: config.watermark.text.color,
                  textShadow: config.watermark.text.shadow
                    ? '0 2px 8px rgba(0,0,0,0.65)'
                    : undefined,
                }}
              >
                <div>{config.watermark.text.text}</div>
                {config.watermark.text.secondaryText ? (
                  <div style={{ fontSize: '0.38em', textAlign: 'right' }}>
                    {config.watermark.text.secondaryText}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ) : null}

        {config.movingText.enabled ? (
          <div
            ref={movingTextRef}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-medium text-white"
            style={{
              opacity: config.movingText.opacityPercent / 100,
              fontSize: `${config.movingText.sizePercent}cqh`,
              textShadow: '0 2px 8px rgba(0,0,0,0.55)',
            }}
          >
            {config.movingText.text}
          </div>
        ) : null}
      </div>
    </div>
  );
}
