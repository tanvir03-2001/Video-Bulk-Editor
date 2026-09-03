import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import {
  BRANDING_FONT_STACKS,
  BRANDING_FONT_WEIGHT_VALUES,
  type OverlayPosition,
  type WatermarkConfig,
} from '../../../shared/branding';

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

function transformOriginFor(position: OverlayPosition): string {
  const [vertical, horizontal] = position.split('-');
  const y = vertical === 'top' ? 'top' : vertical === 'bottom' ? 'bottom' : 'center';
  const x = horizontal === 'left' ? 'left' : horizontal === 'right' ? 'right' : 'center';
  return `${x} ${y}`;
}

interface TextLogoCssLockupProps {
  config: WatermarkConfig;
  className?: string;
  style?: CSSProperties;
}

/**
 * Live CSS preview for text watermarks.
 * Matches export: render primary/secondary at height-% font sizes, then scale the
 * whole lockup so its width equals scalePercent of the frame.
 */
export function TextLogoCssLockup({ config, className = '', style }: TextLogoCssLockupProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const lockupRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const primary = config.text.text.trim() || ' ';
  const secondary = config.text.secondaryText.trim();

  useLayoutEffect(() => {
    const frame = frameRef.current?.parentElement;
    const lockup = lockupRef.current;
    if (!frame || !lockup) {
      return;
    }

    const update = () => {
      const naturalWidth = lockup.offsetWidth;
      if (naturalWidth <= 0 || frame.clientWidth <= 0) {
        return;
      }
      const targetWidth = frame.clientWidth * (config.scalePercent / 100);
      setScale(Math.max(0.05, targetWidth / naturalWidth));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(frame);
    observer.observe(lockup);
    return () => {
      observer.disconnect();
    };
  }, [
    config.scalePercent,
    config.text.fontSizePercent,
    config.text.secondaryFontSizePercent,
    config.text.fontFamily,
    config.text.fontWeight,
    primary,
    secondary,
  ]);

  return (
    <div ref={frameRef} className={className} style={style}>
      <div
        style={{
          ...positionStyle(config.position, config.marginPercent),
          opacity: config.opacityPercent / 100,
        }}
      >
        <div
          ref={lockupRef}
          className="leading-none"
          style={{
            display: 'inline-block',
            width: 'max-content',
            fontFamily: BRANDING_FONT_STACKS[config.text.fontFamily],
            fontWeight: BRANDING_FONT_WEIGHT_VALUES[config.text.fontWeight],
            fontSize: `${config.text.fontSizePercent}cqh`,
            color: config.text.color,
            textShadow: config.text.shadow ? '0 2px 8px rgba(0,0,0,0.65)' : undefined,
            transform: `scale(${scale})`,
            transformOrigin: transformOriginFor(config.position),
            whiteSpace: 'nowrap',
          }}
        >
          <div>{primary}</div>
          {secondary ? (
            <div
              className="mt-[0.06em]"
              style={{
                fontSize: `${config.text.secondaryFontSizePercent}cqh`,
                textAlign: 'right',
                whiteSpace: 'nowrap',
              }}
            >
              {secondary}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
