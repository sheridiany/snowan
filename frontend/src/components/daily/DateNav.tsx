import { useState } from 'react';
import { Popover } from 'antd';
import { createStyles } from 'antd-style';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { localDate } from '../../api/daily';

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

function parse(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function shift(date: string, days: number): string {
  const d = parse(date);
  d.setDate(d.getDate() + days);
  return localDate(d);
}
function startOfWeek(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() - ((out.getDay() + 6) % 7)); // Monday-based
  return out;
}

const useStyles = createStyles(({ token, css }) => ({
  nav: css`
    display: flex;
    align-items: center;
    gap: 6px;
  `,
  arrow: css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: ${token.borderRadiusSM}px;
    cursor: pointer;
    color: ${token.colorTextSecondary};
    &:hover {
      background: ${token.colorFillTertiary};
      color: ${token.colorText};
    }
  `,
  title: css`
    min-width: 132px;
    text-align: center;
    font-size: 14px;
    font-weight: 600;
    color: ${token.colorText};
    cursor: pointer;
    padding: 2px 8px;
    border-radius: ${token.borderRadiusSM}px;
    &:hover {
      background: ${token.colorFillTertiary};
    }
  `,
  today: css`
    height: 28px;
    padding: 0 10px;
    border-radius: ${token.borderRadiusSM}px;
    font-size: 12px;
    color: ${token.colorTextSecondary};
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    &:hover {
      background: ${token.colorFillTertiary};
      color: ${token.colorText};
    }
  `,
  cal: css`
    width: 240px;
    padding: 4px;
  `,
  monthBar: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 2px 4px 6px;
    font-size: 13px;
    font-weight: 600;
    color: ${token.colorText};
  `,
  grid: css`
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 1px;
  `,
  wd: css`
    text-align: center;
    font-size: 11px;
    color: ${token.colorTextTertiary};
    padding: 2px 0;
  `,
  cell: css`
    position: relative;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    border-radius: ${token.borderRadiusSM}px;
    cursor: pointer;
    color: ${token.colorText};
    &:hover {
      background: ${token.colorFillTertiary};
    }
  `,
  muted: css`
    color: ${token.colorTextQuaternary};
  `,
  selected: css`
    background: ${token.colorPrimary};
    color: ${token.colorBgContainer};
    &:hover {
      background: ${token.colorPrimary};
    }
  `,
  dot: css`
    position: absolute;
    bottom: 3px;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: ${token.colorPrimary};
  `,
  dotOnSelected: css`
    background: ${token.colorBgContainer};
  `,
}));

type Props = {
  date: string;
  onDate: (date: string) => void;
  markedDates: Set<string>;
};

// Date navigation: prev/next day, a 「今天」 reset, and a mini-month popover with
// dots on dates that have a daily note.
export default function DateNav({ date, onDate, markedDates }: Props) {
  const { styles, cx } = useStyles();
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState(() => parse(date));

  const today = localDate();
  const sel = parse(date);
  const titleText = `${sel.getFullYear()}年${sel.getMonth() + 1}月${sel.getDate()}日`;

  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = startOfWeek(first);
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });

  const calendar = (
    <div className={styles.cal}>
      <div className={styles.monthBar}>
        <span
          className={styles.arrow}
          onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1))}
        >
          <ChevronLeft size={16} />
        </span>
        {anchor.getFullYear()}年{anchor.getMonth() + 1}月
        <span
          className={styles.arrow}
          onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1))}
        >
          <ChevronRight size={16} />
        </span>
      </div>
      <div className={styles.grid}>
        {WEEKDAYS.map((w) => (
          <div key={w} className={styles.wd}>
            {w}
          </div>
        ))}
        {cells.map((d) => {
          const key = localDate(d);
          const inMonth = d.getMonth() === anchor.getMonth();
          const isSel = key === date;
          const marked = markedDates.has(key);
          return (
            <div
              key={key}
              className={cx(styles.cell, !inMonth && styles.muted, isSel && styles.selected)}
              onClick={() => {
                onDate(key);
                setOpen(false);
              }}
            >
              {d.getDate()}
              {marked && <span className={cx(styles.dot, isSel && styles.dotOnSelected)} />}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className={styles.nav}>
      <span className={styles.arrow} onClick={() => onDate(shift(date, -1))} title="前一天">
        <ChevronLeft size={18} />
      </span>
      <Popover
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (v) setAnchor(parse(date));
        }}
        trigger="click"
        content={calendar}
        placement="bottom"
      >
        <span className={styles.title}>{titleText}</span>
      </Popover>
      <span className={styles.arrow} onClick={() => onDate(shift(date, 1))} title="后一天">
        <ChevronRight size={18} />
      </span>
      {date !== today && (
        <span className={styles.today} onClick={() => onDate(today)}>
          今天
        </span>
      )}
    </div>
  );
}
