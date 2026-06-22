import { useEffect, useState } from 'react';
import { App, Modal } from 'antd';
import { Button, Markdown } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import { Check, Lightbulb, Loader2, Sparkles, X } from 'lucide-react';

import { useDaily } from '../../hooks/useDaily';
import { suggestDay, summarizeDay } from '../../api/daily';
import { appendCarryover, insertUnderHeading } from './markdownSource';
import AssemblyBand from './AssemblyBand';
import DailyEditor from './DailyEditor';

const useStyles = createStyles(({ token, css }) => ({
  ai: css`
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 8px;
  `,
  chip: css`
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    color: ${token.colorTextTertiary};
    margin-right: auto;
  `,
  spin: css`
    animation: dailyExpandSpin 0.9s linear infinite;
    @keyframes dailyExpandSpin {
      to {
        transform: rotate(360deg);
      }
    }
  `,
  body: css`
    display: flex;
    flex-direction: column;
    height: 64vh;
    min-height: 0;
  `,
  sugg: css`
    border: 1px solid ${token.colorBorderSecondary};
    background: ${token.colorFillQuaternary};
    border-radius: ${token.borderRadius}px;
    padding: 8px 12px 4px;
    margin: 0 0 10px;
  `,
  suggHead: css`
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    font-weight: 500;
    color: ${token.colorTextSecondary};
    margin-bottom: 2px;
  `,
  suggClose: css`
    margin-left: auto;
    cursor: pointer;
    color: ${token.colorTextTertiary};
    &:hover {
      color: ${token.colorText};
    }
  `,
}));

type Props = {
  date: string;
  open: boolean;
  onClose: () => void;
};

// Focused, centered overlay for a single day's note: a wide writing surface plus the
// 早计划 / 晚复盘 AI drafts and the read-only assembly band. Owns its own useDaily(date)
// so the panel doesn't have to thread the day's buffer in — load/save behavior is
// identical to the (now-removed) DailyView.
export default function DailyExpand({ date, open, onClose }: Props) {
  const { styles } = useStyles();
  const { message } = App.useApp();
  const d = useDaily(date);

  const [aiBusy, setAiBusy] = useState<'suggest' | 'summarize' | null>(null);
  const [editSignal, setEditSignal] = useState(0);
  // 给我建议 result — shown read-only in a card, NOT written into the note body.
  const [suggestions, setSuggestions] = useState<string | null>(null);

  // Move an unfinished carryover line into the buffer, then drop the user into the
  // textarea on the staged change.
  const moveToToday = (line: string) => {
    d.edit(appendCarryover(d.body, line));
    setEditSignal((s) => s + 1);
    message.success('已移到今天');
  };

  const runSuggest = async () => {
    setAiBusy('suggest');
    try {
      const { draft } = await suggestDay(date);
      // Advice, not tasks — shown in a card to read, never injected into the note.
      setSuggestions(draft);
    } catch {
      message.error('建议生成失败,请重试');
    } finally {
      setAiBusy(null);
    }
  };

  const runSummarize = async () => {
    setAiBusy('summarize');
    try {
      const { draft } = await summarizeDay(date);
      // Same staged-not-saved contract as runPlan, under the 晚复盘 heading.
      d.edit(insertUnderHeading(d.body, '晚复盘', draft), true);
      setEditSignal((s) => s + 1);
    } catch {
      message.error('总结失败,请重试');
    } finally {
      setAiBusy(null);
    }
  };

  // The file changed on disk under the open buffer — fire once per conflict
  // transition (lifted from DailyView).
  useEffect(() => {
    if (d.saveState !== 'conflict') return;
    Modal.confirm({
      title: '这篇日记在别处被改过',
      content:
        '磁盘上的内容和你正在编辑的不一致。是用磁盘版本覆盖当前编辑,还是用当前编辑覆盖磁盘?',
      okText: '保留我的编辑(覆盖磁盘)',
      cancelText: '加载磁盘版本(放弃编辑)',
      onOk: () => d.overwriteDisk().catch(() => message.error('保存失败')),
      onCancel: () => d.reloadFromDisk().catch(() => message.error('加载失败')),
    });
  }, [d.saveState]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Modal
      title={date}
      open={open}
      // Flush the buffer before the modal unmounts so an in-flight edit isn't lost.
      onCancel={() => {
        d.blur();
        onClose();
      }}
      footer={null}
      width={720}
      destroyOnClose
    >
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
            aiBusy === 'suggest' ? (
              <Loader2 size={14} className={styles.spin} />
            ) : (
              <Lightbulb size={14} />
            )
          }
          disabled={aiBusy !== null}
          onClick={runSuggest}
        >
          给我建议
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

      {suggestions && (
        <div className={styles.sugg}>
          <div className={styles.suggHead}>
            <Lightbulb size={13} />
            今日建议
            <X size={14} className={styles.suggClose} onClick={() => setSuggestions(null)} />
          </div>
          <Markdown>{suggestions}</Markdown>
        </div>
      )}

      <div className={styles.body}>
        <AssemblyBand
          assembly={d.assembly}
          carryover={d.carryover}
          chats={d.chats}
          images={d.images}
          // Deep-linking out of the band leaves the day view: close the modal so the
          // panel's host can navigate.
          onView={() => onClose()}
          onCarryover={moveToToday}
        />
        {!d.loading && (
          <DailyEditor body={d.body} onChange={d.edit} onBlur={d.blur} editSignal={editSignal} />
        )}
      </div>
    </Modal>
  );
}
