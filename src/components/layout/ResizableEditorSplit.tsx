import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useResizablePanelWidth } from '../../hooks/useResizablePanelWidth';
import { cx } from '../ui/cx';

interface ResizableEditorSplitProps {
  settings: ReactNode;
  preview: ReactNode;
  settingsClassName?: string;
  previewClassName?: string;
}

function ResizeHandle({
  disabled,
  isDragging,
  onMouseDown,
}: {
  disabled: boolean;
  isDragging: boolean;
  onMouseDown: () => void;
}) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize settings panel"
      className={cx(
        'relative hidden w-1.5 shrink-0 select-none lg:block',
        disabled ? 'pointer-events-none' : 'cursor-col-resize',
        isDragging ? 'bg-accent/40' : 'bg-surface-border hover:bg-accent/25',
      )}
      onMouseDown={(event) => {
        if (disabled) {
          return;
        }
        event.preventDefault();
        onMouseDown();
      }}
    >
      <div className="absolute inset-y-0 -left-1 -right-1" />
    </div>
  );
}

export function ResizableEditorSplit({
  settings,
  preview,
  settingsClassName,
  previewClassName,
}: ResizableEditorSplitProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [isLargeLayout, setIsLargeLayout] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const updateLayout = () => {
      const nextWidth = container.getBoundingClientRect().width;
      setContainerWidth(nextWidth);
      setIsLargeLayout(window.matchMedia('(min-width: 1024px)').matches);
    };

    updateLayout();
    const observer = new ResizeObserver(updateLayout);
    observer.observe(container);
    window.addEventListener('resize', updateLayout);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateLayout);
    };
  }, []);

  const { settingsWidth, isDragging, startDrag } = useResizablePanelWidth(containerWidth);

  const handleStartDrag = () => {
    const containerLeft = containerRef.current?.getBoundingClientRect().left;
    if (containerLeft === undefined) {
      return;
    }
    startDrag(containerLeft);
  };

  return (
    <div
      ref={containerRef}
      className={cx(
        'flex min-h-0 flex-1 flex-col lg:flex-row',
        isDragging && 'select-none',
      )}
    >
      <div
        className={cx(
          'min-h-0 overflow-y-auto border-b border-surface-border p-3 lg:border-b-0 lg:border-r lg:p-4',
          settingsClassName,
        )}
        style={isLargeLayout ? { width: settingsWidth, flexShrink: 0 } : undefined}
      >
        {settings}
      </div>

      <ResizeHandle
        disabled={!isLargeLayout}
        isDragging={isDragging}
        onMouseDown={handleStartDrag}
      />

      <div
        className={cx(
          'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface/40 p-3 lg:p-4',
          previewClassName,
        )}
      >
        {preview}
      </div>
    </div>
  );
}
