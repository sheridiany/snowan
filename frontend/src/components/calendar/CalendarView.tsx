import { useEffect, useMemo, useState } from 'react';
import { Empty } from '@lobehub/ui';
import { App, Button, Segmented, Tooltip } from 'antd';
import { createStyles } from 'antd-style';
import { CalendarDays, ChevronLeft, ChevronRight, MapPin } from 'lucide-react';

import { ListPane, ListRow, type NavProps } from '../shell/ListPane';
import DetailPane from '../../ui/DetailPane';
import {
  cleanCalendarField,
  formatTimeRange,
  getCalendar,
  type CalendarEvent,
  type CalendarSource,
} from '../../api/calendar';

type Mode = 'month' | 'week';

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

// A handful of fixed-date 节日 / 节气 labels. Dependency-free and deliberately
// tiny — just enough warmth in the grid without a lunar-calendar library.
const SOLAR_LABELS: Record<string, string> = {
  '01-01': '元旦',
  '02-14': '情人节',
  '03-08': '妇女节',
  '04-05': '清明',
  '05-01': '劳动节',
  '06-01': '儿童节',
  '06-21': '夏至',
  '09-10': '教师节',
  '10-01': '国庆',
  '12-22': '冬至',
  '12-25': '圣诞',
};

// Stable per-source pill color, picked from a warm-leaning palette so events
// stay distinguishable without clashing with the terracotta house brand.
const PILL_COLORS = ['#C2703D', '#9C6F8B', '#5E7C8B', '#6E8B5B', '#C2922F', '#B5503C'];

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const sameDay = (a: Date, b: Date) => dayKey(a) === dayKey(b);

// Monday-based start of the week containing `d`.
function startOfWeek(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const offset = (out.getDay() + 6) % 7; // 0 = Monday
  out.setDate(out.getDate() - offset);
  return out;
}

// The 6×7 (month) or 1×7 (week) cell window. Month view always pads to whole
// weeks so the grid is rectangular.
function buildDays(anchor: Date, mode: Mode): Date[] {
  if (mode === 'week') {
    const start = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

const useStyles = createStyles(({ token, css }) => ({
  toolbar: css`
    flex: none;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 18px 10px;
  `,
  title: css`
    font-size: 17px;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: ${token.colorText};
    font-variant-numeric: tabular-nums;
    min-width: 132px;
  `,
  nav: css`
    display: inline-flex;
    align-items: center;
    gap: 2px;
  `,
  navBtn: css`
    width: 30px;
    height: 30px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 9px;
    color: ${token.colorTextSecondary};
    cursor: pointer;
    transition: background 0.12s ease, color 0.12s ease;
    &:hover {
      background: ${token.colorFillTertiary};
      color: ${token.colorText};
    }
  `,
  spacer: css`
    flex: 1;
  `,
  weekHead: css`
    flex: none;
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    padding: 0 18px;
  `,
  weekHeadCell: css`
    padding: 6px 4px 8px;
    text-align: center;
    font-size: 12px;
    font-weight: 600;
    color: ${token.colorTextTertiary};
  `,
  weekend: css`
    color: ${token.colorError};
  `,
  gridWrap: css`
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 0 18px 18px;
  `,
  grid: css`
    height: 100%;
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 6px;
  `,
  monthGrid: css`
    grid-auto-rows: minmax(96px, 1fr);
  `,
  weekGrid: css`
    grid-auto-rows: minmax(420px, 1fr);
  `,
  cell: css`
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 6px 7px 8px;
    border-radius: ${token.borderRadius}px;
    border: 1px solid ${token.colorBorderSecondary};
    background: ${token.colorBgContainer};
    overflow: hidden;
  `,
  cellMuted: css`
    background: ${token.colorFillQuaternary};
    border-color: transparent;
  `,
  cellHead: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
  `,
  dateNum: css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 22px;
    height: 22px;
    padding: 0 5px;
    border-radius: 11px;
    font-size: 12.5px;
    font-weight: 600;
    color: ${token.colorTextSecondary};
    font-variant-numeric: tabular-nums;
  `,
  dateOut: css`
    color: ${token.colorTextQuaternary};
  `,
  dateWeekend: css`
    color: ${token.colorError};
  `,
  today: css`
    background: ${token.colorPrimary};
    color: ${token.colorBgContainer};
  `,
  solar: css`
    font-size: 11px;
    color: ${token.colorPrimary};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  pills: css`
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-height: 0;
  `,
  pill: css`
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 2px 6px;
    border-radius: 6px;
    font-size: 11.5px;
    font-weight: 500;
    line-height: 1.35;
    color: ${token.colorText};
    cursor: default;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  dot: css`
    flex: none;
    width: 6px;
    height: 6px;
    border-radius: 50%;
  `,
  more: css`
    padding: 1px 6px;
    font-size: 11px;
    color: ${token.colorTextTertiary};
  `,
  legend: css`
    display: flex;
    flex-direction: column;
    gap: 9px;
    padding: 4px 6px 10px;
  `,
  legendRow: css`
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12.5px;
    color: ${token.colorTextSecondary};
    min-width: 0;
  `,
  legendName: css`
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  legendCount: css`
    flex: none;
    font-size: 11px;
    color: ${token.colorTextQuaternary};
    font-variant-numeric: tabular-nums;
  `,
  empty: css`
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px;
  `,
}));

function MonthTitle({ anchor, mode }: { anchor: Date; mode: Mode }) {
  if (mode === 'week') {
    const days = buildDays(anchor, 'week');
    const a = days[0];
    const b = days[6];
    const span =
      a.getMonth() === b.getMonth()
        ? `${a.getFullYear()} 年 ${a.getMonth() + 1} 月 ${a.getDate()}–${b.getDate()} 日`
        : `${a.getMonth() + 1}.${a.getDate()} – ${b.getMonth() + 1}.${b.getDate()}`;
    return <>{span}</>;
  }
  return <>{`${anchor.getFullYear()} 年 ${anchor.getMonth() + 1} 月`}</>;
}

export default function CalendarView({
  view,
  onView,
  onNewChat,
  listCollapsed,
}: NavProps & { listCollapsed?: boolean }) {
  const { styles, cx } = useStyles();
  const { message } = App.useApp();
  const [mode, setMode] = useState<Mode>('month');
  const [anchor, setAnchor] = useState(() => new Date());
  const [sources, setSources] = useState<CalendarSource[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getCalendar()
      .then((data) => {
        if (!alive) return;
        setSources(data.sources);
        setEvents(data.events);
      })
      .catch(() => alive && message.error('加载日历失败'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [message]);

  const colorOf = useMemo(() => {
    const map = new Map<string, string>();
    sources.forEach((s, i) => map.set(s.id, PILL_COLORS[i % PILL_COLORS.length]));
    return (id: string) => map.get(id) ?? PILL_COLORS[0];
  }, [sources]);

  // Bucket events by local day key once, so each cell is a cheap lookup.
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const d = new Date(ev.startsAt);
      if (Number.isNaN(d.getTime())) continue;
      const key = dayKey(d);
      const list = map.get(key);
      if (list) list.push(ev);
      else map.set(key, [ev]);
    }
    for (const list of map.values()) list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return map;
  }, [events]);

  const eventCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const ev of events) map.set(ev.sourceId, (map.get(ev.sourceId) ?? 0) + 1);
    return map;
  }, [events]);

  const days = useMemo(() => buildDays(anchor, mode), [anchor, mode]);
  const today = new Date();
  const step = (dir: 1 | -1) => {
    setAnchor((prev) => {
      const d = new Date(prev);
      if (mode === 'week') d.setDate(d.getDate() + dir * 7);
      else d.setMonth(d.getMonth() + dir);
      return d;
    });
  };
  const maxPills = mode === 'week' ? 12 : 3;

  return (
    <>
      {!listCollapsed && (
        <ListPane view={view} onView={onView} onNewChat={onNewChat}>
          <ListRow
            icon={CalendarDays}
            label="设置日历"
            sub="连接系统日历 / 导入 ICS"
            onClick={() => onView('settings')}
          />
          {sources.length > 0 && (
            <div className={styles.legend}>
              {sources.map((s) => (
                <div key={s.id} className={styles.legendRow}>
                  <span className={styles.dot} style={{ background: colorOf(s.id) }} />
                  <span className={styles.legendName}>{s.name}</span>
                  <span className={styles.legendCount}>{eventCount.get(s.id) ?? 0}</span>
                </div>
              ))}
            </div>
          )}
        </ListPane>
      )}

      <DetailPane title="日历">
        {!loading && sources.length === 0 ? (
          <div className={styles.empty}>
            <Empty
              icon={CalendarDays}
              title="还没有日历"
              description="在「设置 · 日历」里连接系统日历或导入 ICS,日程会显示在这里。"
            />
          </div>
        ) : (
          <>
            <div className={styles.toolbar}>
              <span className={styles.title}>
                <MonthTitle anchor={anchor} mode={mode} />
              </span>
              <div className={styles.nav}>
                <Tooltip title="上一页">
                  <div className={styles.navBtn} onClick={() => step(-1)}>
                    <ChevronLeft size={18} />
                  </div>
                </Tooltip>
                <Button size="small" type="text" onClick={() => setAnchor(new Date())}>
                  今天
                </Button>
                <Tooltip title="下一页">
                  <div className={styles.navBtn} onClick={() => step(1)}>
                    <ChevronRight size={18} />
                  </div>
                </Tooltip>
              </div>
              <div className={styles.spacer} />
              <Segmented
                size="small"
                value={mode}
                onChange={(v) => setMode(v as Mode)}
                options={[
                  { label: '月', value: 'month' },
                  { label: '周', value: 'week' },
                ]}
              />
            </div>

            <div className={styles.weekHead}>
              {WEEKDAYS.map((w, i) => (
                <div key={w} className={cx(styles.weekHeadCell, i >= 5 && styles.weekend)}>
                  {w}
                </div>
              ))}
            </div>

            <div className={styles.gridWrap}>
              <div className={cx(styles.grid, mode === 'month' ? styles.monthGrid : styles.weekGrid)}>
                {days.map((d) => {
                  const inMonth = mode === 'week' || d.getMonth() === anchor.getMonth();
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                  const isToday = sameDay(d, today);
                  const list = byDay.get(dayKey(d)) ?? [];
                  const solar = SOLAR_LABELS[`${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`];
                  const shown = list.slice(0, maxPills);
                  return (
                    <div key={dayKey(d)} className={cx(styles.cell, !inMonth && styles.cellMuted)}>
                      <div className={styles.cellHead}>
                        <span
                          className={cx(
                            styles.dateNum,
                            isToday && styles.today,
                            !isToday && !inMonth && styles.dateOut,
                            !isToday && inMonth && isWeekend && styles.dateWeekend,
                          )}
                        >
                          {d.getDate()}
                        </span>
                        {solar && inMonth && <span className={styles.solar}>{solar}</span>}
                      </div>
                      <div className={styles.pills}>
                        {shown.map((ev) => (
                          <Tooltip
                            key={ev.id}
                            title={
                              <>
                                <div style={{ fontWeight: 600 }}>{ev.title}</div>
                                <div>{formatTimeRange(ev.startsAt, ev.endsAt)}</div>
                                {cleanCalendarField(ev.location) && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <MapPin size={11} />
                                    {cleanCalendarField(ev.location)}
                                  </div>
                                )}
                              </>
                            }
                          >
                            <div
                              className={styles.pill}
                              style={{ background: `${colorOf(ev.sourceId)}22` }}
                            >
                              <span className={styles.dot} style={{ background: colorOf(ev.sourceId) }} />
                              {mode === 'week' && (
                                <span style={{ color: colorOf(ev.sourceId), fontVariantNumeric: 'tabular-nums' }}>
                                  {formatTimeRange(ev.startsAt, ev.endsAt).split(' ')[0]}
                                </span>
                              )}
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.title}</span>
                            </div>
                          </Tooltip>
                        ))}
                        {list.length > shown.length && (
                          <span className={styles.more}>+{list.length - shown.length} 项</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </DetailPane>
    </>
  );
}
