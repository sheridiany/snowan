import { useEffect, useState } from 'react';
import { App, Modal } from 'antd';
import { Button } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import { Check, Loader2, Sparkles } from 'lucide-react';

import { ListPane, ListRow, type NavProps } from '../shell/ListPane';
import { useDaily } from '../../hooks/useDaily';
import { localDate, planDay, summarizeDay } from '../../api/daily';
import AssemblyBand from '../daily/AssemblyBand';
import DailyEditor from '../daily/DailyEditor';
import DateNav from '../daily/DateNav';
import { appendCarryover, insertUnderHeading } from '../daily/markdownSource';

const useStyles = createStyles(({ token, css }) => ({
  pane: css`
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    background: ${token.colorSurfaceGlow}, ${token.colorBgContainer};
    border-radius: ${token.borderRadiusLG}px;
    box-shadow: ${token.boxShadowTertiary};
    overflow: hidden;
  `,
  header: css`
    flex: none;
    min-height: 52px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 16px;
  `,
  ai: css`
    display: flex;
    align-items: center;
    gap: 8px;
  `,
  chip: css`
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    color: ${token.colorTextTertiary};
    margin-right: 4px;
  `,
  spin: css`
    animation: dailySpin 0.9s linear infinite;
    @keyframes dailySpin {
      to {
        transform: rotate(360deg);
      }
    }
  `,
  bodyArea: css`
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 0 16px 8px;
  `,
  recentTitle: css`
    padding: 6px 10px 2px;
    font-size: 11px;
    font-weight: 600;
    color: ${token.colorTextTertiary};
  `,
}));

export default function DailyView({
  view,
  onView,
  onNewChat,
  listCollapsed,
}: NavProps & { listCollapsed?: boolean }) {
  const { styles, cx } = useStyles();
  const { message } = App.useApp();
  const [date, setDate] = useState(() => localDate());
  const d = useDaily(date);

  const [aiBusy, setAiBusy] = useState<'plan' | 'summarize' | null>(null);
  const [editSignal, setEditSignal] = useState(0);

  const today = localDate();
  // Recent dates with notes, newest first — a quick jump list in the nav column.
  const recent = [...d.dates].sort().reverse().slice(0, 14);

  const moveToToday = (line: string) => {
    d.edit(appendCarryover(d.body, line));
    setEditSignal((s) => s + 1);
    message.success('已移到今天');
  };

  const runPlan = async () => {
    setAiBusy('plan');
    try {
      const { draft } = await planDay(date);
      // The plan fills Highlight + 重点 — stage it under the Highlight heading as an
      // editable block (origin: ai). defer=true so it lands in the buffer WITHOUT
      // arming autosave: the draft persists only once the user edits or blurs (§6
      // 产出草稿供你改/接受,绝不静默改正文).
      d.edit(insertUnderHeading(d.body, 'Highlight', draft), true);
      setEditSignal((s) => s + 1);
    } catch {
      message.error('规划失败,请重试');
    } finally {
      setAiBusy(null);
    }
  };

  const runSummarize = async () => {
    setAiBusy('summarize');
    try {
      const { draft } = await summarizeDay(date);
      // Stage the review draft without arming autosave (defer=true); persists only
      // on the user's subsequent edit/blur — never silently (§6).
      d.edit(insertUnderHeading(d.body, '晚复盘', draft), true);
      setEditSignal((s) => s + 1);
    } catch {
      message.error('总结失败,请重试');
    } finally {
      setAiBusy(null);
    }
  };

  // Conflict prompt: the file changed on disk under the open buffer. Fire once per
  // conflict transition (not on every render while the state stays 'conflict').
  useEffect(() => {
    if (d.saveState !== 'conflict') return;
    Modal.confirm({
      title: '这篇日记在别处被改过',
      content: '磁盘上的内容和你正在编辑的不一致。是用磁盘版本覆盖当前编辑,还是用当前编辑覆盖磁盘?',
      okText: '保留我的编辑(覆盖磁盘)',
      cancelText: '加载磁盘版本(放弃编辑)',
      onOk: () => d.overwriteDisk().catch(() => message.error('保存失败')),
      onCancel: () => d.reloadFromDisk().catch(() => message.error('加载失败')),
    });
  }, [d.saveState]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {!listCollapsed && (
        <ListPane view={view} onView={onView} onNewChat={onNewChat}>
          {recent.length > 0 && <div className={styles.recentTitle}>最近</div>}
          {recent.map((dt) => (
            <ListRow
              key={dt}
              label={dt === today ? '今天' : dt.slice(5).replace('-', '月') + '日'}
              sub={dt}
              active={dt === date}
              onClick={() => setDate(dt)}
            />
          ))}
        </ListPane>
      )}

      <section className={styles.pane}>
        <div className={styles.header}>
          <DateNav date={date} onDate={setDate} markedDates={d.dates} />
          <div className={styles.ai}>
            {d.saveState === 'saving' && (
              <span className={styles.chip}>
                <Loader2 size={13} className={styles.spin} /> 保存中
              </span>
            )}
            {d.saveState === 'saved' && d.savedAt && (
              <span className={styles.chip}>
                <Check size={13} /> 已保存 {d.savedAt}
              </span>
            )}
            <Button
              size="small"
              icon={
                aiBusy === 'plan' ? (
                  <Loader2 size={14} className={styles.spin} />
                ) : (
                  <Sparkles size={14} />
                )
              }
              disabled={aiBusy !== null}
              onClick={runPlan}
            >
              帮我规划今天
            </Button>
            <Button
              size="small"
              icon={
                aiBusy === 'summarize' ? (
                  <Loader2 size={14} className={styles.spin} />
                ) : (
                  <Sparkles size={14} />
                )
              }
              disabled={aiBusy !== null}
              onClick={runSummarize}
            >
              总结今天
            </Button>
          </div>
        </div>

        <div className={cx(styles.bodyArea)}>
          <AssemblyBand
            assembly={d.assembly}
            carryover={d.carryover}
            chats={d.chats}
            images={d.images}
            onView={onView}
            onCarryover={moveToToday}
          />
          {!d.loading && (
            <DailyEditor body={d.body} onChange={d.edit} onBlur={d.blur} editSignal={editSignal} />
          )}
        </div>
      </section>
    </>
  );
}
