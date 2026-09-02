import { useEffect, useState } from 'react';

interface TimelineThumbnailProps {
  thumbPath: string | null;
  className?: string;
}

export function TimelineThumbnail({ thumbPath, className }: TimelineThumbnailProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    if (!thumbPath) {
      setUrl(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const mediaUrl = await window.api.getLocalMediaUrl(thumbPath);
        if (!cancelled) {
          setUrl(mediaUrl);
        }
      } catch {
        if (!cancelled) {
          setUrl(null);
          setFailed(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [thumbPath]);

  if (!url || failed) {
    return null;
  }

  return (
    <img
      src={url}
      alt=""
      className={className}
      onError={() => {
        setFailed(true);
      }}
    />
  );
}
