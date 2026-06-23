import { useEffect, useRef, useState } from 'react';
import { createStyles } from 'antd-style';
import {
  BookOpen,
  Brain,
  CalendarDays,
  ChevronRight,
  Image as ImageIcon,
  MessagesSquare,
  Plus,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { formatTimeRange, cleanCalendarField } from '../../api/calendar';
import type { Assembly, CarryoverItem } from '../../api/daily';
import type { ChatCapture, ImageCapture } from './localCaptures';
import { imageFileUrl } from '../../api/imagegen';
import type { View } from '../shell/ListPane';

const useStyles = createStyles(({ token, css }) => ({
  band: css`
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 4px 0 8px;
    border-bottom: 1px solid ${token.colorFillQuaternary};
    margin-bottom: 8px;
  `,
  section: css`
    display: flex;
    flex-direction: column;
  `,
  head: css`
    display: flex;
    align-items: center;
    gap: 6px;
    height: 30px;
    padding: 0 6px;
    border-radius: ${token.borderRadius}px;
    cursor: pointer;
    color: ${token.colorTextSecondary};
    font-size: 12px;
    font-weight: 600;
    user-select: none;
    transition: background 0.12s ease;
    &:hover {
      background: ${token.colorFillTertiary};
    }
  `,
  chev: css`
    flex: none;
    transition: transform 0.12s ease;
    color: ${token.colorTextTertiary};
  `,
  chevOpen: css`
    transform: rotate(90deg);
  `,
  count: css`
    margin-left: auto;
    font-size: 11px;
    font-weight: 500;
    color: ${token.colorTextQuaternary};
  `,
  link: css`
    margin-left: 6px;
    font-size: 11px;
    font-weight: 500;
    color: ${token.colorTextTertiary};
    cursor: pointer;
    &:hover {
      color: ${token.colorPrimary};
    }
  `,
  rows: css`
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding: 2px 0 6px 24px;
  `,
  row: css`
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 26px;
    padding: 3px 8px;
    border-radius: ${token.borderRadius}px;
    font-size: 12px;
    color: ${token.colorText};
    cursor: pointer;
    transition: background 0.12s ease;
    &:hover {
      background: ${token.colorFillTertiary};
    }
  `,
  rowText: css`
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  rowMeta: css`
    flex: none;
    font-size: 11px;
    color: ${token.colorTextTertiary};
  `,
  carryRow: css`
    & .carry-action {
      opacity: 0;
    }
    &:hover .carry-action {
      opacity: 1;
    }
  `,
  carryAction: css`
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 11px;
    font-weight: 500;
    color: ${token.colorTextTertiary};
    cursor: pointer;
    transition: opacity 0.12s ease, color 0.12s ease;
    &:hover {
      color: ${token.colorPrimary};
    }
  `,
  thumb: css`
    width: 22px;
    height: 22px;
    flex: none;
    border-radius: 4px;
    object-fit: cover;
  `,
}));

function Section({
  icon: Icon,
  label,
  count,
  defaultOpen,
  linkLabel,
  onLink,
  children,
}: {
  icon: LucideIcon;
  label: string;
  count: number;
  defaultOpen?: boolean;
  linkLabel?: string;
  onLink?: () => void;
  children: React.ReactNode;
}) {
  const { styles, cx } = useStyles();
  const [open, setOpen] = useState(defaultOpen ?? count > 0);
  // Counts arrive after the async assembly load; auto-open a section the first time
  // it gains content (unless the user has already toggled it themselves).
  const touched = useRef(false);
  useEffect(() => {
    if (!touched.current && defaultOpen === undefined && count > 0) setOpen(true);
  }, [count, defaultOpen]);
  return (
    <div className={styles.section}>
      <div
        className={styles.head}
        onClick={() => {
          touched.current = true;
          setOpen((o) => !o);
        }}
      >
        <ChevronRight size={14} className={cx(styles.chev, open && styles.chevOpen)} />
        <Icon size={14} />
        {label}
        <span className={styles.count}>{count > 0 ? count : ''}</span>
        {linkLabel && onLink && (
          <span
            className={styles.link}
            onClick={(e) => {
              e.stopPropagation();
              onLink();
            }}
          >
            {linkLabel}
          </span>
        )}
      </div>
      {open && children}
    </div>
  );
}

type Props = {
  assembly: Assembly | null;
  carryover: CarryoverItem[];
  chats: ChatCapture[];
  images: ImageCapture[];
  onView: (v: View) => void;
  onCarryover: (line: string) => void;
};

// Thin, read-only, collapsible context band. Each section is near-zero height when
// empty; every row deep-links out to the real artifact (direction §3). Nothing here
// is ever written into the .md.
export default function AssemblyBand({
  assembly,
  carryover,
  chats,
  images,
  onView,
  onCarryover,
}: Props) {
  const { styles, cx } = useStyles();
  const events = assembly?.events ?? [];
  const memory = assembly?.memory ?? [];
  const captureCount = chats.length + images.length;

  // Writing-first: a section only appears when it has content, and the whole band
  // disappears on a quiet day — an empty day is a clean writing surface, not a wall
  // of "今天没有…" placeholders.
  if (!events.length && !captureCount && !carryover.length && !memory.length) return null;

  return (
    <div className={styles.band}>
      {events.length > 0 && (
        // Calendar lives in the RightPanel now (not a top-level view) — read-only rows.
        <Section icon={CalendarDays} label="今日日程" count={events.length}>
          <div className={styles.rows}>
            {events.map((ev) => (
              <div key={ev.id} className={styles.row}>
                <span className={styles.rowMeta}>{formatTimeRange(ev.startsAt, ev.endsAt)}</span>
                <span className={styles.rowText}>{cleanCalendarField(ev.title) || '无标题事件'}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {captureCount > 0 && (
        <Section icon={BookOpen} label="今日捕获" count={captureCount}>
          <div className={styles.rows}>
            {chats.map((c) => (
              <div key={c.id} className={styles.row} onClick={() => onView('conversations')}>
                <MessagesSquare size={13} />
                <span className={styles.rowText}>{c.title}</span>
              </div>
            ))}
            {images.map((im) => (
              <div key={im.sessionId} className={styles.row} onClick={() => onView('draw')}>
                {im.previewId ? (
                  <img className={styles.thumb} src={imageFileUrl(im.previewId)} alt={im.title} />
                ) : (
                  <ImageIcon size={13} />
                )}
                <span className={styles.rowText}>{im.title}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {carryover.length > 0 && (
        <Section icon={Plus} label="昨日未完成" count={carryover.length}>
          <div className={styles.rows}>
            {carryover.map((c, i) => (
              <div key={`${c.fromDate}-${i}`} className={cx(styles.row, styles.carryRow)}>
                <span className={styles.rowText}>{c.line.replace(/^\s*[-*]\s+\[ \]\s*/, '')}</span>
                <span className={styles.rowMeta}>{c.fromDate.slice(5)}</span>
                <span
                  className={cx(styles.carryAction, 'carry-action')}
                  onClick={() => onCarryover(c.line)}
                >
                  <Plus size={12} /> 移到今天
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {memory.length > 0 && (
        <Section icon={Brain} label="相关记忆" count={memory.length} defaultOpen={false}>
          <div className={styles.rows}>
            {memory.map((m) => (
              <div key={m.id} className={styles.row}>
                <Brain size={13} />
                <span className={styles.rowText}>{m.title || m.snippet}</span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
