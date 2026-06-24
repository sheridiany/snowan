import { useEffect, useRef, useState } from 'react';
import { ActionIcon } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import { Maximize2, Moon } from 'lucide-react';

import { ConflictError, getDaily, saveDaily } from '../../api/daily';
import { TYPE } from '../../theme/themes';

// The compact daily-note jotter shown under the selected-day events inside the
// 日程 right-panel source. Quick capture only: drafting (晚复盘) and serious
// writing happen in the expand modal, so every header button just calls onExpand.

const AUTOSAVE_MS = 800;

const useStyles = createStyles(({ token, css }) => ({
  section: css`
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    border-top: 1px solid ${token.colorBorderSecondary};
    margin: 10px 0 0;
    padding-top: 10px;
  `,
  head: css`
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0 2px 6px;
  `,
  label: css`
    font-size: ${TYPE.small}px;
    color: ${token.colorTextTertiary};
    margin-right: auto;
  `,
  miniBtn: css`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 24px;
    padding: 0 8px;
    border-radius: ${token.borderRadiusSM}px;
    font-size: ${TYPE.small}px;
    color: ${token.colorTextSecondary};
    cursor: pointer;
    transition: background 0.12s ease, color 0.12s ease;
    &:hover {
      background: ${token.colorFillTertiary};
      color: ${token.colorText};
    }
  `,
  ta: css`
    flex: 1;
    width: 100%;
    box-sizing: border-box;
    min-height: 60px;
    padding: 6px 8px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadius}px;
    outline: none;
    resize: none;
    background: ${token.colorFillQuaternary};
    color: ${token.colorText};
    font-size: ${TYPE.dense}px;
    line-height: 1.6;
    transition: border-color 0.12s ease, background 0.12s ease;
    &:focus {
      border-color: ${token.colorPrimary};
      background: ${token.colorBgContainer};
    }
  `,
  hint: css`
    height: 16px;
    margin: 4px 2px 0;
    font-size: ${TYPE.micro}px;
    color: ${token.colorTextQuaternary};
  `,
}));

type Props = {
  date: string;
  onExpand: (date: string) => void;
};

export default function PanelDailyNote({ date, onExpand }: Props) {
  const { styles } = useStyles();
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  // The updated_at the buffer is based on; passed to saveDaily for 409 detection.
  const baseRef = useRef<string | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pending = useRef(false);

  useEffect(() => {
    let alive = true;
    getDaily(date).then((n) => {
      if (!alive) return;
      setBody(n.body);
      baseRef.current = n.updated_at;
    });
    return () => {
      alive = false;
      clearTimeout(timer.current);
    };
  }, [date]);

  const flush = async (next: string) => {
    pending.current = false;
    setSaving(true);
    try {
      const saved = await saveDaily(date, next, baseRef.current);
      baseRef.current = saved.updated_at;
    } catch (e) {
      // v1 conflict resolution: disk wins, reload and drop the local edit.
      if (e instanceof ConflictError) {
        const fresh = await getDaily(date);
        setBody(fresh.body);
        baseRef.current = fresh.updated_at;
      } else {
        throw e;
      }
    } finally {
      setSaving(false);
    }
  };

  const onChange = (next: string) => {
    setBody(next);
    pending.current = true;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(next), AUTOSAVE_MS);
  };

  // Flush a still-debounced edit before opening the modal, so it loads the latest
  // body from disk instead of dropping the last keystrokes.
  const handleExpand = async () => {
    if (pending.current) {
      clearTimeout(timer.current);
      await flush(body);
    }
    onExpand(date);
  };

  return (
    <div className={styles.section}>
      <div className={styles.head}>
        <span className={styles.label}>日记</span>
        <span className={styles.miniBtn} onClick={handleExpand}>
          <Moon size={13} /> 晚复盘
        </span>
        <ActionIcon icon={Maximize2} size="small" title="展开" onClick={handleExpand} />
      </div>
      <textarea
        className={styles.ta}
        value={body}
        placeholder="随手记今天…"
        onChange={(e) => onChange(e.target.value)}
      />
      <div className={styles.hint}>{saving ? '保存中…' : '已自动保存'}</div>
    </div>
  );
}
