import { Button, TextArea } from '@lobehub/ui';
import { Select } from 'antd';
import { createStyles } from 'antd-style';
import { Sparkles } from 'lucide-react';
import ImageModelSelect from './ImageModelSelect';
import type { ImgParams } from '../../hooks/useImagegen';

const SIZES = ['1024x1024', '1024x1536', '1536x1024'];
const COUNTS = [1, 2, 3, 4];

const useStyles = createStyles(({ token, css }) => ({
  wrap: css`
    width: 100%;
    max-width: 760px;
    margin: 0 auto;
    padding: 12px 16px 18px;
  `,
  card: css`
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 12px 10px;
    border-radius: 16px;
    background: ${token.colorBgElevated};
    border: 1px solid ${token.colorBorderSecondary};
    box-shadow: ${token.boxShadowTertiary};
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
    &:focus-within {
      border-color: ${token.colorPrimaryBorder};
    }
  `,
  ta: css`
    border: none !important;
    box-shadow: none !important;
    background: transparent !important;
    padding: 2px 4px 0 !important;
    resize: none;
    font-size: 15px;
  `,
  bottomRow: css`
    display: flex;
    align-items: center;
    gap: 8px;
  `,
  spacer: css`
    flex: 1;
  `,
  mini: css`
    .ant-select-selector {
      height: 30px !important;
      border-radius: 8px !important;
    }
    .ant-select-selection-item {
      line-height: 28px !important;
      font-size: 12px;
    }
  `,
  send: css`
    height: 32px;
    border-radius: 8px !important;
    padding: 0 14px !important;
    display: inline-flex !important;
    align-items: center;
    gap: 6px;
  `,
  hint: css`
    margin-top: 8px;
    text-align: center;
    font-size: 11px;
    color: ${token.colorTextQuaternary};
  `,
}));

type Props = {
  value: string;
  onChange: (v: string) => void;
  params: ImgParams;
  onParamsChange: (p: ImgParams) => void;
  busy: boolean;
  onSubmit: () => void;
};

export default function ImgInputBar({
  value,
  onChange,
  params,
  onParamsChange,
  busy,
  onSubmit,
}: Props) {
  const { styles } = useStyles();

  const submit = () => {
    if (!value.trim() || busy) return;
    onSubmit();
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <TextArea
          className={styles.ta}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          autoSize={{ minRows: 1, maxRows: 8 }}
          placeholder="描述你想要的画面…"
        />
        <div className={styles.bottomRow}>
          <Select
            className={styles.mini}
            size="small"
            value={params.size}
            onChange={(size) => onParamsChange({ ...params, size })}
            options={SIZES.map((s) => ({ value: s, label: s }))}
            popupMatchSelectWidth={false}
          />
          <Select
            className={styles.mini}
            size="small"
            value={params.n}
            onChange={(n) => onParamsChange({ ...params, n })}
            options={COUNTS.map((c) => ({ value: c, label: `${c} 张` }))}
            popupMatchSelectWidth={false}
          />
          <span className={styles.spacer} />
          <ImageModelSelect />
          <Button
            type="primary"
            className={styles.send}
            loading={busy}
            onClick={submit}
            icon={busy ? undefined : <Sparkles size={15} />}
          >
            生成
          </Button>
        </div>
      </div>
      <div className={styles.hint}>Enter 生成 · Shift + Enter 换行</div>
    </div>
  );
}
