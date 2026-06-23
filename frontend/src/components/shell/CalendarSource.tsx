import { useState } from 'react';
import { Button, Empty } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

import PanelDailyNote from '../daily/PanelDailyNote';
import PersonaNudge from '../persona/PersonaNudge';
import type { CalendarEvent } from '../../api/calendar';

function evTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  if (d.getHours() === 0 && d.getMinutes() === 0) return '全天';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function isAllDay(iso: string): boolean {
  const d = new Date(iso);
  return d.getHours() === 0 && d.getMinutes() === 0;
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayLabel(d: Date): string {
  const wd = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  const same = (a: Date, b: Date) => ymd(a) === ymd(b);
  const today = new Date();
  const prefix = same(d, today)
    ? '今天 · '
    : same(d, new Date(today.getTime() + 86400000))
      ? '明天 · '
      : '';
  return `${prefix}${d.getMonth() + 1}月${d.getDate()}日 周${wd}`;
}

const useStyles = createStyles(({ token, css }) => ({
  folderEmpty: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  `,
  calNav: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 2px 4px 8px;
  `,
  calMonth: css`
    display: inline-flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
    font-weight: 600;
    color: ${token.colorText};
  `,
  calArrow: css`
    display: inline-flex;
    cursor: pointer;
    color: ${token.colorTextSecondary};
    &:hover {
      color: ${token.colorText};
    }
  `,
  calToday: css`
    font-size: 12px;
    color: ${token.colorPrimary};
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusSM}px;
    padding: 2px 9px;
    cursor: pointer;
    &:hover {
      background: ${token.colorFillTertiary};
    }
  `,
  weekRow: css`
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    text-align: center;
    font-size: 11px;
    color: ${token.colorTextTertiary};
    padding: 0 2px 2px;
  `,
  grid: css`
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    text-align: center;
  `,
  cell: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 4px 0 3px;
    font-size: 13px;
    color: ${token.colorText};
    cursor: pointer;
    border-radius: ${token.borderRadiusSM}px;
    &:hover {
      background: ${token.colorFillQuaternary};
    }
  `,
  cellMuted: css`
    color: ${token.colorTextQuaternary};
  `,
  cellNum: css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
  `,
  cellToday: css`
    background: ${token.colorPrimary};
    color: #fff;
    font-weight: 500;
  `,
  cellSel: css`
    box-shadow: inset 0 0 0 1.5px ${token.colorPrimary};
  `,
  dot: css`
    width: 4px;
    height: 4px;
    border-radius: 50%;
  `,
  daySection: css`
    border-top: 1px solid ${token.colorBorderSecondary};
    margin: 10px 0 0;
    padding-top: 10px;
  `,
  dayHead: css`
    font-size: 12px;
    color: ${token.colorTextTertiary};
    margin: 0 2px 6px;
  `,
  evRow: css`
    display: flex;
    gap: 10px;
    align-items: baseline;
    padding: 5px 2px;
  `,
  evTime: css`
    flex: none;
    width: 42px;
    font-size: 12px;
    color: ${token.colorTextTertiary};
  `,
  evTitle: css`
    flex: 1;
    min-width: 0;
    font-size: 13px;
    color: ${token.colorText};
    word-break: break-word;
  `,
  evLoc: css`
    color: ${token.colorTextTertiary};
    font-size: 12px;
  `,
}));

// The 日程 source: a self-contained month-view (nav header, weekday row, 42-cell
// grid, selected-day event list) plus its daily note. Owns its own month/selected
// -day cursor and date helpers; receives the events to render as a prop.
export default function CalendarSource({
  events,
  loading,
  onboarded,
  onOnboarded,
  onOpenSettings,
  onExpand,
}: {
  events: CalendarEvent[];
  loading: boolean;
  onboarded: boolean | null;
  onOnboarded: () => void;
  onOpenSettings?: () => void;
  onExpand: (date: string) => void;
}) {
  const { styles, cx, theme } = useStyles();
  const [cal, setCal] = useState(() => {
    const t = new Date();
    return { y: t.getFullYear(), m: t.getMonth() }; // m: 0-11
  });
  const [selDay, setSelDay] = useState(() => ymd(new Date()));

  // Calendar: events bucketed by local day, a Mon-aligned 6-week grid, selected-day list.
  const byDay = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const d = new Date(e.startsAt);
    if (Number.isNaN(d.getTime())) continue;
    const k = ymd(d);
    (byDay.get(k) ?? byDay.set(k, []).get(k)!).push(e);
  }
  const firstWeekday = (new Date(cal.y, cal.m, 1).getDay() + 6) % 7; // Mon = 0
  const gridStart = new Date(cal.y, cal.m, 1 - firstWeekday);
  const cells = Array.from({ length: 42 }, (_, i) =>
    new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i),
  );
  const todayYmd = ymd(new Date());
  const selEvents = (byDay.get(selDay) ?? []).slice().sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const selDate = new Date(`${selDay}T00:00:00`);
  const shiftMonth = (delta: number) =>
    setCal(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  const goToday = () => {
    const t = new Date();
    setCal({ y: t.getFullYear(), m: t.getMonth() });
    setSelDay(ymd(t));
  };

  return (
    <>
      {onboarded === false && <PersonaNudge onDone={onOnboarded} />}
      {loading && events.length === 0 ? (
        <Empty icon={Calendar} title="加载中…" paddingBlock={36} />
      ) : events.length === 0 ? (
        <div className={styles.folderEmpty}>
          <Empty
            icon={Calendar}
            title="还没有日程"
            description="连接系统日历或导入 ICS,日程会出现在这里。"
            paddingBlock={28}
          />
          <Button size="small" onClick={onOpenSettings}>
            去设置连接
          </Button>
        </div>
      ) : (
        <>
          <div className={styles.calNav}>
            <span className={styles.calMonth}>
              <span className={styles.calArrow} onClick={() => shiftMonth(-1)}>
                <ChevronLeft size={18} />
              </span>
              {cal.y}年{cal.m + 1}月
              <span className={styles.calArrow} onClick={() => shiftMonth(1)}>
                <ChevronRight size={18} />
              </span>
            </span>
            <span className={styles.calToday} onClick={goToday}>
              今天
            </span>
          </div>
          <div className={styles.weekRow}>
            {['一', '二', '三', '四', '五', '六', '日'].map((w, i) => (
              <span key={w} style={i >= 5 ? { color: theme.colorError } : undefined}>
                {w}
              </span>
            ))}
          </div>
          <div className={styles.grid}>
            {cells.map((d) => {
              const k = ymd(d);
              const inMonth = d.getMonth() === cal.m;
              const isToday = k === todayYmd;
              const isSel = k === selDay;
              const evs = byDay.get(k) ?? [];
              const hasTimed = evs.some((e) => !isAllDay(e.startsAt));
              return (
                <div key={k} className={styles.cell} onClick={() => setSelDay(k)}>
                  <span
                    className={cx(
                      styles.cellNum,
                      isToday && styles.cellToday,
                      !isToday && isSel && styles.cellSel,
                      !inMonth && !isToday && styles.cellMuted,
                    )}
                  >
                    {d.getDate()}
                  </span>
                  <span
                    className={styles.dot}
                    style={{
                      background: evs.length
                        ? hasTimed
                          ? theme.colorPrimary
                          : theme.colorTextQuaternary
                        : 'transparent',
                    }}
                  />
                </div>
              );
            })}
          </div>
          <div className={styles.daySection}>
            <div className={styles.dayHead}>{dayLabel(selDate)}</div>
            {selEvents.length === 0 ? (
              <div style={{ fontSize: 12.5, color: theme.colorTextTertiary, padding: '2px' }}>
                这天没有安排。
              </div>
            ) : (
              selEvents.map((e) => (
                <div key={e.id} className={styles.evRow}>
                  <span className={styles.evTime}>{evTime(e.startsAt)}</span>
                  <span className={styles.evTitle}>
                    {e.title || '未命名日程'}
                    {e.location && <span className={styles.evLoc}> · {e.location}</span>}
                  </span>
                </div>
              ))
            )}
          </div>
          <PanelDailyNote date={selDay} onExpand={onExpand} />
        </>
      )}
    </>
  );
}
