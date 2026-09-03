import type { CSSProperties } from 'react';
import {
  type OverlayPosition,
  type WatermarkConfig,
} from '../../../shared/branding';
import { LocalMediaImage } from '../ui/LocalMediaImage';
import { TextLogoCssLockup } from './TextLogoCssLockup';

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

  if (!isImage) {
    return (
      <TextLogoCssLockup
        config={config}
        className={`pointer-events-none absolute inset-0 z-10 overflow-hidden ${className}`.trim()}
      />
    );
  }

  return (
    <div className={`pointer-events-none absolute inset-0 z-10 overflow-hidden ${className}`.trim()}>
      <div
        style={{
          ...watermarkPositionStyle(config.position, config.marginPercent),
          opacity: config.opacityPercent / 100,
          maxWidth: `${config.scalePercent}%`,
        }}
      >
        {config.imagePath ? (
          <LocalMediaImage
            filePath={config.imagePath}
            alt="Watermark"
            className="h-auto w-full object-contain"
          />
        ) : null}
      </div>
    </div>
  );
}
