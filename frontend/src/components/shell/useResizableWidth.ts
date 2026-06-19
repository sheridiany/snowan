import { useCallback, useEffect, useRef, useState } from 'react';

// A persisted, drag-to-resize width for a side column. `side` is which edge the
// handle lives on: a right-edge handle grows the column as you drag right, a
// left-edge handle grows it as you drag left.
export function useResizableWidth(opts: {
  key: string;
  initial: number;
  min: number;
  max: number;
  side: 'left' | 'right';
}) {
  const { key, initial, min, max, side } = opts;
  const clamp = (n: number) => Math.max(min, Math.min(max, Math.round(n)));

  const [width, setWidth] = useState(() => {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    const n = stored ? Number(stored) : initial;
    return Number.isFinite(n) ? clamp(n) : initial;
  });

  const widthRef = useRef(width);
  widthRef.current = width;

  useEffect(() => {
    localStorage.setItem(key, String(width));
  }, [key, width]);

  const onResizeStart = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = widthRef.current;
      const move = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        setWidth(clamp(side === 'right' ? startW + dx : startW - dx));
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [min, max, side], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return { width, onResizeStart };
}
