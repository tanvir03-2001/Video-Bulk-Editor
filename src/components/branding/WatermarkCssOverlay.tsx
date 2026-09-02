import type { CSSProperties } from 'react';
import {
  BRANDING_FONT_STACKS,
  BRANDING_FONT_WEIGHT_VALUES,
  type OverlayPosition,
  type WatermarkConfig,
} from '../../../shared/branding';
import { LocalMediaImage } from '../ui/LocalMediaImage';

function watermarkPositionStyle(
  position: OverlayPosition,
  marginPercent: number,
): CSSProperties {
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

interface WatermarkCssOverlayProps {
  config: WatermarkConfig;
  className?: string;
}

export function WatermarkCssOverlay({ config, className = '' }: WatermarkCssOverlayProps) {
  if (!config.enabled) {
    return null;
  }

  const isImage = config.mode === 'image' && Boolean(config.imagePath);

  return (
    <div className={`pointer-events-none absolute inset-0 z-10 overflow-hidden ${className}`.trim()}>
      <div
        style={{
          ...watermarkPositionStyle(config.position, config.marginPercent),
          opacity: config.opacityPercent / 100,
          ...(isImage ? { maxWidth: `${config.scalePercent}%` } : {}),
        }}
      >
        {isImage && config.imagePath ? (
          <LocalMediaImage
            filePath={config.imagePath}
            alt="Watermark"
            className="h-auto w-full object-contain"
          />
        ) : (
          <div
            className="leading-tight"
            style={{
              fontFamily: BRANDING_FONT_STACKS[config.text.fontFamily],
              fontWeight: BRANDING_FONT_WEIGHT_VALUES[config.text.fontWeight],
              fontSize: `${config.text.fontSizePercent}cqh`,
              color: config.text.color,
              textShadow: config.text.shadow ? '0 2px 8px rgba(0,0,0,0.65)' : undefined,
            }}
          >
            <div>{config.text.text}</div>
            {config.text.secondaryText ? (
              <div style={{ fontSize: '0.38em', textAlign: 'right' }}>{config.text.secondaryText}</div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
