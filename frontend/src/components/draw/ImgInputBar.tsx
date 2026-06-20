import { useRef, useState, type ChangeEvent } from 'react';
import { ActionIcon, Button, TextArea } from '@lobehub/ui';
import { Select } from 'antd';
import { createStyles } from 'antd-style';
import {
  ImagePlus,
  RectangleHorizontal,
  RectangleVertical,
  Sparkles,
  Square,
  Wand2,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import ImageModelSelect from './ImageModelSelect';
import type { ImgParams } from '../../hooks/useImagegen';

type Orient = 'auto' | 'square' | 'land' | 'port';
const ORIENT_ICON: Record<Orient, LucideIcon> = {
  auto: Wand2,
  square: Square,
  land: RectangleHorizontal,
  port: RectangleVertical,
};

// gpt-image-2 (the configured custom endpoint) accepts arbitrary size strings, so
// these are presets, not a hard API limit. `auto` lets the model choose.
const SIZE_GROUPS: { label: string; options: { value: string; ratio: string; orient: Orient }[] }[] = [
  { label: '', options: [{ value: 'auto', ratio: '自动', orient: 'auto' }] },
  {
    label: '1K',
    options: [
      { value: '1024x1024', ratio: '1:1', orient: 'square' },
      { value: '1024x576', ratio: '16:9', orient: 'land' },
      { value: '576x1024', ratio: '9:16', orient: 'port' },
    ],
  },
  {
    label: '2K',
    options: [
      { value: '2048x2048', ratio: '1:1', orient: 'square' },
      { value: '2048x1152', ratio: '16:9', orient: 'land' },
      { value: '1152x2048', ratio: '9:16', orient: 'port' },
    ],
  },
  {
    label: '4K',
    options: [
      { value: '3840x2160', ratio: '16:9', orient: 'land' },
      { value: '2160x3840', ratio: '9:16', orient: 'port' },
    ],
  },
];

const SIZE_META: Record<string, { ratio: string; orient: Orient }> = Object.fromEntries(
  SIZE_GROUPS.flatMap((g) => g.options.map((o) => [o.value, { ratio: o.ratio, orient: o.orient }])),
);
const prettySize = (v: string) => (v === 'auto' ? 'Auto' : v.replace('x', '×'));
const SIZE_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  ...SIZE_GROUPS.slice(1).map((g) => ({
    label: g.label,
    options: g.options.map((o) => ({ value: o.value, label: prettySize(o.value) })),
  })),
];

const COUNTS = [1, 2, 3, 4];
const MAX_REFS = 4;

const readDataUrl = (f: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(f);
  });

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
  refs: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 2px 2px 0;
  `,
  refChip: css`
    position: relative;
    width: 48px;
    height: 48px;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid ${token.colorBorderSecondary};
    & img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    & button {
      position: absolute;
      top: 2px;
      right: 2px;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      padding: 0;
      border: none;
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.6);
      color: #fff;
      cursor: pointer;
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
  sizeOpt: css`
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 140px;
    & svg {
      flex: none;
      color: ${token.colorTextSecondary};
    }
  `,
  sizeDims: css`
    font-size: 13px;
  `,
  sizeRatio: css`
    margin-left: auto;
    font-size: 11px;
    color: ${token.colorTextTertiary};
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
  onSubmit: (referenceImages: string[]) => void;
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
  const [refs, setRefs] = useState<{ id: string; url: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const addFiles = async (files: File[]) => {
    const urls = await Promise.all(files.filter((f) => f.type.startsWith('image/')).map(readDataUrl));
    setRefs((prev) => [...prev, ...urls.map((url) => ({ id: crypto.randomUUID(), url }))].slice(0, MAX_REFS));
  };

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    void addFiles(Array.from(e.target.files ?? []));
    if (fileRef.current) fileRef.current.value = '';
  };

  const submit = () => {
    if (!value.trim() || busy) return;
    onSubmit(refs.map((r) => r.url));
    setRefs([]);
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        {refs.length > 0 && (
          <div className={styles.refs}>
            {refs.map((r) => (
              <div key={r.id} className={styles.refChip}>
                <img src={r.url} alt="参考图" />
                <button type="button" onClick={() => setRefs((p) => p.filter((x) => x.id !== r.id))}>
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
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
            options={SIZE_OPTIONS}
            popupMatchSelectWidth={false}
            optionRender={(opt) => {
              const meta = SIZE_META[opt.value as string] ?? { ratio: '', orient: 'auto' as Orient };
              const Icon = ORIENT_ICON[meta.orient];
              return (
                <div className={styles.sizeOpt}>
                  <Icon size={14} />
                  <span className={styles.sizeDims}>{opt.label}</span>
                  {meta.ratio && <span className={styles.sizeRatio}>{meta.ratio}</span>}
                </div>
              );
            }}
          />
          <Select
            className={styles.mini}
            size="small"
            value={params.n}
            onChange={(n) => onParamsChange({ ...params, n })}
            options={COUNTS.map((c) => ({ value: c, label: `${c} 张` }))}
            popupMatchSelectWidth={false}
          />
          <ActionIcon
            icon={ImagePlus}
            size="small"
            title={refs.length ? `参考图 ${refs.length}/${MAX_REFS}` : '添加参考图'}
            disabled={refs.length >= MAX_REFS}
            onClick={() => fileRef.current?.click()}
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={onPick}
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
      <div className={styles.hint}>Enter 生成 · Shift + Enter 换行 · 参考图最多 {MAX_REFS} 张</div>
    </div>
  );
}
