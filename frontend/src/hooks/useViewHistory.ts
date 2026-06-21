import { useState } from 'react';
import type { View } from '../components/shell/ListPane';

// Section navigation with back/forward history, plus the two layout flags
// (list pane collapsed, right panel open). Pure, no async.
export function useViewHistory() {
  const [hist, setHist] = useState<View[]>(['daily']);
  const [hi, setHi] = useState(0);
  const view = hist[hi];

  const go = (v: View) => {
    if (v === hist[hi]) return;
    setHist((h) => [...h.slice(0, hi + 1), v]);
    setHi((i) => i + 1);
  };
  const back = () => setHi((i) => Math.max(0, i - 1));
  const forward = () => setHi((i) => Math.min(hist.length - 1, i + 1));
  const canBack = hi > 0;
  const canForward = hi < hist.length - 1;

  const [listCollapsed, setListCollapsed] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);

  return {
    view,
    go,
    back,
    forward,
    canBack,
    canForward,
    listCollapsed,
    toggleNav: () => setListCollapsed((c) => !c),
    rightOpen,
    toggleRight: () => setRightOpen((o) => !o),
    openRight: () => setRightOpen(true),
  };
}
