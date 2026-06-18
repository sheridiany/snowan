import { useState } from 'react';
import { ActionIcon, Button, TextArea } from '@lobehub/ui';
import { Select } from 'antd';
import { createStyles } from 'antd-style';
import {
  ArrowUp,
  Box,
  Compass,
  Database,
  Paperclip,
  Play,
  Sparkles,
} from 'lucide-react';

export type ComposerMode = 'explore' | 'execute';

type Option = { value: string; label: string };

const MODE_OPTIONS: { value: ComposerMode; label: string; hint: string }[] = [
  { value: 'explore', label: '探索', hint: '只读 · 不改动任何数据' },
  { value: 'execute', label: '执行', hint: '可执行操作 · 可写入' },
];

const DEFAULT_SOURCE_OPTIONS: Option[] = [
  { value: 'all', label: '全部数据源' },
  { value: 'local', label: '本地文件' },
  { value: 'web', label: '网页' },
  { value: 'calendar', label: '日历' },
];

const DEFAULT_MODEL_OPTIONS: Option[] = [
  { value: 'default', label: '默认模型' },
  { value: 'fast', label: '快速' },
  { value: 'reasoning', label: '深度推理' },
];

const useStyles = createStyles(({ token, css }) => ({
  wrap: css`
    width: 100%;
    max-width: 760px;
    margin: 0 auto;
    padding: 12px 16px 22px;
  `,
  card: css`
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px 12px 8px;
    border-radius: 12px;
    background: ${token.colorBgElevated};
    box-shadow: ${token.boxShadowSecondary};
    transition: box-shadow 0.15s ease;
  `,
  topRow: css`
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  `,
  modeGroup: css`
    display: inline-flex;
    padding: 2px;
    gap: 2px;
    border-radius: 8px;
    background: ${token.colorFillQuaternary};
    border: 1px solid ${token.colorBorderSecondary};
  `,
  modeItem: css`
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 26px;
    padding: 0 11px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    color: ${token.colorTextSecondary};
    cursor: pointer;
    user-select: none;
    transition: background 0.15s ease, color 0.15s ease;
    &:hover {
      color: ${token.colorText};
    }
  `,
  modeItemActive: css`
    background: ${token.colorBgElevated};
    color: ${token.colorText};
    box-shadow: 0 1px 3px ${token.colorFillQuaternary};
  `,
  chip: css`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 30px;
    padding: 0 6px 0 10px;
    border-radius: 8px;
    background: ${token.colorFillQuaternary};
    border: 1px solid ${token.colorBorderSecondary};
    color: ${token.colorTextSecondary};
    transition: border-color 0.15s ease;
    &:hover {
      border-color: ${token.colorPrimaryBorder};
    }
  `,
  chipIcon: css`
    display: inline-flex;
    color: ${token.colorTextTertiary};
  `,
  chipSelect: css`
    .ant-select-selector {
      background: transparent !important;
      border: none !important;
      box-shadow: none !important;
      padding-inline: 0 !important;
      height: 28px !important;
    }
    .ant-select-selection-item {
      font-size: 12px;
      font-weight: 500;
      line-height: 28px !important;
      color: ${token.colorTextSecondary};
    }
  `,
  ta: css`
    border: none !important;
    box-shadow: none !important;
    background: transparent !important;
    padding: 2px 2px 0 !important;
    resize: none;
    font-size: 15px;
  `,
  bottomRow: css`
    display: flex;
    align-items: center;
    gap: 8px;
  `,
  leftTools: css`
    display: inline-flex;
    align-items: center;
    gap: 2px;
  `,
  spacer: css`
    flex: 1;
  `,
  send: css`
    width: 32px;
    height: 32px;
    border-radius: 8px !important;
    display: inline-flex !important;
    align-items: center;
    justify-content: center;
    padding: 0 !important;
  `,
  hint: css`
    margin-top: 6px;
    text-align: center;
    font-size: 11px;
    color: ${token.colorTextQuaternary};
  `,
}));

export interface ComposerProps {
  busy: boolean;
  onSend: (text: string) => void;
  mode?: ComposerMode;
  onModeChange?: (mode: ComposerMode) => void;
  sourceOptions?: Option[];
  modelOptions?: Option[];
  defaultSource?: string;
  defaultModel?: string;
}

export default function Composer({
  busy,
  onSend,
  mode: modeProp,
  onModeChange,
  sourceOptions = DEFAULT_SOURCE_OPTIONS,
  modelOptions = DEFAULT_MODEL_OPTIONS,
  defaultSource,
  defaultModel,
}: ComposerProps) {
  const { styles, cx } = useStyles();
  const [value, setValue] = useState('');
  const [modeState, setModeState] = useState<ComposerMode>(modeProp ?? 'explore');
  const [source, setSource] = useState(defaultSource ?? sourceOptions[0]?.value);
  const [model, setModel] = useState(defaultModel ?? modelOptions[0]?.value);

  const mode = modeProp ?? modeState;
  const setMode = (next: ComposerMode) => {
    if (modeProp === undefined) setModeState(next);
    onModeChange?.(next);
  };

  const submit = () => {
    const text = value.trim();
    if (!text || busy) return;
    setValue('');
    onSend(text);
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.topRow}>
          <div className={styles.modeGroup} role="radiogroup" aria-label="模式">
            {MODE_OPTIONS.map((opt) => {
              const active = mode === opt.value;
              const Icon = opt.value === 'explore' ? Compass : Play;
              return (
                <span
                  key={opt.value}
                  role="radio"
                  aria-checked={active}
                  title={opt.hint}
                  className={cx(styles.modeItem, active && styles.modeItemActive)}
                  onClick={() => setMode(opt.value)}
                >
                  <Icon size={14} />
                  {opt.label}
                </span>
              );
            })}
          </div>

          <div className={styles.chip}>
            <span className={styles.chipIcon}>
              <Database size={14} />
            </span>
            <Select
              className={styles.chipSelect}
              value={source}
              onChange={setSource}
              options={sourceOptions}
              variant="borderless"
              popupMatchSelectWidth={false}
              styles={{ popup: { root: { minWidth: 140 } } }}
            />
          </div>
        </div>

        <TextArea
          className={styles.ta}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          autoSize={{ minRows: 1, maxRows: 8 }}
          placeholder="问点什么…"
        />

        <div className={styles.bottomRow}>
          <div className={styles.leftTools}>
            <ActionIcon icon={Paperclip} size="small" title="附件" />
            <ActionIcon icon={Database} size="small" title="数据源" />
            <ActionIcon icon={Box} size="small" title="MCP" />
          </div>

          <span className={styles.spacer} />

          <div className={styles.chip}>
            <span className={styles.chipIcon}>
              <Sparkles size={14} />
            </span>
            <Select
              className={styles.chipSelect}
              value={model}
              onChange={setModel}
              options={modelOptions}
              variant="borderless"
              popupMatchSelectWidth={false}
              placement="topLeft"
              styles={{ popup: { root: { minWidth: 140 } } }}
            />
          </div>

          <Button
            type="primary"
            className={styles.send}
            loading={busy}
            onClick={submit}
            title="发送"
            aria-label="发送"
            icon={busy ? undefined : <ArrowUp size={18} />}
          />
        </div>
      </div>
      <div className={styles.hint}>Enter 发送 · Shift + Enter 换行</div>
    </div>
  );
}
