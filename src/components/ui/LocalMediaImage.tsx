import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import { cx } from './cx';

interface LocalMediaImageProps {
  filePath: string | null | undefined;
  alt?: string;
  className?: string;
  style?: CSSProperties;
  asBackground?: boolean;
}

export function LocalMediaImage({
  filePath,
  alt = '',
  className,
  style,
  asBackground = false,
}: LocalMediaImageProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!filePath) {
      setUrl(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const mediaUrl = await window.api.getLocalMediaUrl(filePath);
        if (!cancelled) {
          setUrl(mediaUrl);
        }
      } catch {
        if (!cancelled) {
          setUrl(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [filePath]);

  if (!url) {
    return null;
  }

  if (asBackground) {
    return (
      <div
        className={cx('bg-cover bg-center', className)}
        style={{ ...style, backgroundImage: `url("${url}")` }}
        role="img"
        aria-label={alt}
      />
    );
  }

  return <img src={url} alt={alt} className={className} style={style} />;
}
