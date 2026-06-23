import { useEffect, useRef, useState } from 'react';
import { ActionIcon, Button, TextArea } from '@lobehub/ui';
import { Select } from 'antd';
import { createStyles } from 'antd-style';
import {
  ArrowUp,
  FileText,
  Image as ImageIcon,
  Paperclip,
  Presentation,
  RectangleHorizontal,
  RectangleVertical,
  Sparkles,
  Square,
  Table2,
  Telescope,
  Wand2,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import ModelSelect from './ModelSelect';
import ImageModelSelect from './draw/ImageModelSelect';
import { EASING } from '../ui/motion';
import type { Attachment } from '../api/chat';
import type { ImgParams } from '../api/imagegen';

const ACCEPT = 'image/*,.txt,.md,.json,.csv,.log,.py,.ts,.tsx,.js,.yaml,.yml,.toml,.pdf,.docx,.xlsx,.xlsm,.pptx';
const MAX_BYTES = 16 * 1024 * 1024;

const readAsBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(((r.result as string) || '').split(',')[1] ?? '');
    r.onerror = reject;
    r.readAsDataURL(file);
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
    background: ${token.colorGlassBg};
    backdrop-filter: blur(${token.glassBlur});
    -webkit-backdrop-filter: blur(${token.glassBlur});
    border: 1px solid ${token.colorGlassBorder};
    box-shadow: ${token.shadowGlass};
    transition: border-color 0.2s ${EASING.standard}, box-shadow 0.2s ${EASING.standard},
      transform 0.2s ${EASING.standard};
    &:hover {
      transform: translateY(-1px);
    }
    /* The active-input affordance is scoped to the textarea (see .ta), so opening a
       dropdown or clicking a bottom-row control doesn't lift/ring the whole card. */
    &:has(textarea:focus) {
      border-color: ${token.colorPrimaryBorder};
      box-shadow: ${token.shadowGlass}, 0 0 0 3px ${token.colorBrandGlow};
    }
    @media (prefers-reduced-motion: reduce) {
      transition: border-color 0.2s ${EASING.standard}, box-shadow 0.2s ${EASING.standard};
      &:hover {
        transform: none;
      }
    }
  `,
  dragging: css`
    border-color: ${token.colorPrimary};
    box-shadow: ${token.shadowGlass}, inset 0 0 0 1px ${token.colorPrimary},
      0 0 0 3px ${token.colorBrandGlow};
    background: ${token.colorPrimaryBg};
  `,
  chips: css`
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  `,
  chip: css`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    max-width: 220px;
    height: 30px;
    padding: 0 4px 0 6px;
    border-radius: 8px;
    background: ${token.colorFillTertiary};
    border: 1px solid ${token.colorBorderSecondary};
    color: ${token.colorTextSecondary};
    font-size: 12px;
    transition: background 0.15s ${EASING.standard}, border-color 0.15s ${EASING.standard};
    &:hover {
      background: ${token.colorFillSecondary};
      border-color: ${token.colorBorder};
    }
  `,
  chipInert: css`
    opacity: 0.45;
  `,
  thumb: css`
    width: 22px;
    height: 22px;
    flex: none;
    border-radius: 5px;
    object-fit: cover;
  `,
  chipIcon: css`
    flex: none;
    display: inline-flex;
    color: ${token.colorTextTertiary};
    padding-left: 3px;
  `,
  chipName: css`
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  chipX: css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 5px;
    cursor: pointer;
    color: ${token.colorTextTertiary};
    transition: background 0.15s ${EASING.standard}, color 0.15s ${EASING.standard},
      transform 0.12s ${EASING.standard};
    &:hover {
      background: ${token.colorFill};
      color: ${token.colorText};
    }
    &:active {
      transform: scale(0.88);
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
  send: css`
    width: 32px;
    height: 32px;
    border-radius: 8px !important;
    display: inline-flex !important;
    align-items: center;
    justify-content: center;
    padding: 0 !important;
    border: none !important;
    background: ${token.colorBrandGradient} !important;
    box-shadow: 0 1px 2px ${token.colorBrandGlow} !important;
    transition: transform 0.12s ${EASING.standard}, box-shadow 0.18s ${EASING.standard},
      opacity 0.18s ${EASING.standard} !important;
    &:not(:disabled):hover {
      box-shadow: 0 2px 10px ${token.colorBrandGlow} !important;
      transform: translateY(-1px);
    }
    &:not(:disabled):active {
      transform: translateY(0) scale(0.94);
    }
    &:disabled {
      opacity: 0.55;
      box-shadow: none !important;
    }
    @media (prefers-reduced-motion: reduce) {
      &:not(:disabled):hover,
      &:not(:disabled):active {
        transform: none;
      }
    }
  `,
  hint: css`
    margin-top: 8px;
    text-align: center;
    font-size: 11px;
    color: ${token.colorTextQuaternary};
  `,
  skillRow: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 10px;
    padding: 0 4px;
  `,
  skillChip: css`
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 30px;
    padding: 0 11px;
    border-radius: 8px;
    background: ${token.colorFillTertiary};
    color: ${token.colorTextSecondary};
    border: 1px solid transparent;
    font-size: 12.5px;
    cursor: pointer;
    transition: background 0.15s ${EASING.standard}, color 0.15s ${EASING.standard},
      border-color 0.15s ${EASING.standard}, transform 0.12s ${EASING.standard};
    &:hover {
      background: ${token.colorFill};
      color: ${token.colorText};
    }
    &:focus-visible {
      outline: none;
      border-color: ${token.colorPrimaryBorder};
      box-shadow: 0 0 0 2px ${token.colorBrandGlow};
    }
    &:active {
      transform: scale(0.96);
    }
    @media (prefers-reduced-motion: reduce) {
      &:active {
        transform: none;
      }
    }
  `,
  skillChipActive: css`
    background: ${token.colorPrimaryBg};
    color: ${token.colorPrimary};
    border-color: ${token.colorPrimaryBorder};
    &:hover {
      background: ${token.colorPrimaryBgHover};
      color: ${token.colorPrimary};
    }
  `,
  mini: css`
    .ant-select-selector {
      height: 30px !important;
      border-radius: 8px !important;
      background: ${token.colorFillTertiary} !important;
      border-color: transparent !important;
      transition: background 0.15s ${EASING.standard}, border-color 0.15s ${EASING.standard} !important;
    }
    &:hover .ant-select-selector {
      background: ${token.colorFill} !important;
    }
    &.ant-select-focused .ant-select-selector {
      border-color: ${token.colorPrimaryBorder} !important;
      box-shadow: 0 0 0 2px ${token.colorBrandGlow} !important;
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
}));

const isGenericImageName = (f: File) =>
  (f.type || '').startsWith('image/') && (!f.name || /^(image|blob)/i.test(f.name));

// The 4 power skills launched from below the input. The id is the built-in skill name
// the backend activates for the turn (server/skills_builtin/<id>/SKILL.md).
const SKILLS = [
  { id: 'deep-research', label: '深度研究', icon: Telescope },
  { id: 'make-slides', label: '生成幻灯片', icon: Presentation },
  { id: 'write-document', label: '文档编辑', icon: FileText },
  { id: 'analyze-data', label: '表格分析', icon: Table2 },
  { id: 'image', label: '图像生成', icon: ImageIcon },
] as const;

const SKILL_PLACEHOLDER: Record<string, string> = {
  'deep-research': '深度研究:输入你想研究的主题…',
  'make-slides': '生成幻灯片:描述主题,或粘贴要点…',
  'write-document': '文档编辑:说说要写一篇什么文档…',
  'analyze-data': '表格分析:贴上数据,或描述你的表格…',
  image: '描述你想要的画面…',
};

// Ported from draw/ImgInputBar: image generation is now a composer mode.
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

export interface ComposerProps {
  busy: boolean;
  imgBusy?: boolean;
  onSend: (text: string, attachments: Attachment[], skill?: string) => void;
  onStop?: () => void;
  onSteer?: (text: string) => void;
  onGenerateImage: (prompt: string, params: ImgParams, refs: string[]) => void;
  onModeChange?: (skill: string | null) => void;
}

export default function Composer({
  busy,
  imgBusy = false,
  onSend,
  onStop,
  onSteer,
  onGenerateImage,
  onModeChange,
}: ComposerProps) {
  const { styles, cx } = useStyles();
  const [value, setValue] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [skill, setSkill] = useState<string | null>(null);
  const [imageParams, setImageParams] = useState<ImgParams>({ size: 'auto', n: 1 });
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  useEffect(() => {
    onModeChange?.(skill);
  }, [skill, onModeChange]);

  const imageMode = skill === 'image';
  // In image mode the send button also blocks on the image-gen request.
  const sendBusy = imageMode ? busy || imgBusy : busy;

  const addFiles = async (files: FileList | File[] | null) => {
    if (!files) return;
    const picked: Attachment[] = [];
    for (const f of Array.from(files)) {
      if (f.size > MAX_BYTES) continue;
      const ext = (f.type.split('/')[1] || 'png').replace('+xml', '');
      const name = isGenericImageName(f)
        ? `粘贴图片-${Date.now().toString().slice(-5)}.${ext}`
        : f.name;
      picked.push({ name, mime: f.type || 'application/octet-stream', data: await readAsBase64(f) });
    }
    if (picked.length) setAttachments((prev) => [...prev, ...picked]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const files = e.clipboardData?.files;
    if (files && files.length) {
      e.preventDefault();
      addFiles(files);
    }
  };

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current += 1;
    if (e.dataTransfer.types.includes('Files')) setDragging(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setDragging(false);
    }
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const submit = () => {
    const text = value.trim();
    if (busy) {
      // Mid-run: send a steer (a follow-up instruction) instead of a new turn.
      if (text && onSteer) {
        setValue('');
        onSteer(text);
      }
      return;
    }
    if (imageMode) {
      if (!text || imgBusy) return;
      const refs = attachments
        .filter((a) => a.mime.startsWith('image/'))
        .map((a) => `data:${a.mime};base64,${a.data}`);
      setValue('');
      setAttachments([]);
      onGenerateImage(text, imageParams, refs);
      return;
    }
    if (!text && attachments.length === 0) return;
    const atts = attachments;
    setValue('');
    setAttachments([]);
    onSend(text, atts, skill ?? undefined);
  };

  return (
    <div className={styles.wrap}>
      {!busy && (
        <div className={styles.skillRow}>
          {SKILLS.map((s) => {
            const Ico = s.icon;
            const active = skill === s.id;
            return (
              <button
                key={s.id}
                type="button"
                className={cx(styles.skillChip, active && styles.skillChipActive)}
                onClick={() => setSkill((cur) => (cur === s.id ? null : s.id))}
              >
                <Ico size={14} />
                {s.label}
              </button>
            );
          })}
        </div>
      )}
      <div
        className={cx(styles.card, dragging && styles.dragging)}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        {attachments.length > 0 && (
          <div className={styles.chips}>
            {attachments.map((a, i) => {
              const isImage = a.mime.startsWith('image/');
              // In image mode only image attachments are used as refs; others are inert.
              const inert = imageMode && !isImage;
              return (
              <span
                key={i}
                className={cx(styles.chip, inert && styles.chipInert)}
                title={inert ? `${a.name}(图像生成不支持此附件)` : a.name}
              >
                {isImage ? (
                  <img className={styles.thumb} src={`data:${a.mime};base64,${a.data}`} alt={a.name} />
                ) : (
                  <span className={styles.chipIcon}>
                    <Paperclip size={12} />
                  </span>
                )}
                <span className={styles.chipName}>{imageMode && isImage ? '参考图' : a.name}</span>
                <span
                  className={styles.chipX}
                  onClick={() => setAttachments((prev) => prev.filter((_, k) => k !== i))}
                >
                  <X size={12} />
                </span>
              </span>
              );
            })}
          </div>
        )}

        <TextArea
          className={styles.ta}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onPaste={onPaste}
          onPressEnter={(e) => {
            // While an IME candidate is composing (e.g. pinyin), Enter confirms the
            // candidate — never treat it as send, or CJK input sends half-typed text.
            if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) return;
            if (!e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          autoSize={{ minRows: 1, maxRows: 8 }}
          placeholder={skill ? SKILL_PLACEHOLDER[skill] : '问点什么…(可粘贴或拖拽图片、文档)'}
        />

        <div className={styles.bottomRow}>
          <ActionIcon
            icon={Paperclip}
            size="small"
            title="附件"
            onClick={() => fileRef.current?.click()}
          />
          <input
            ref={fileRef}
            type="file"
            multiple
            accept={ACCEPT}
            hidden
            onChange={(e) => addFiles(e.target.files)}
          />
          {imageMode && (
            <>
              <Select
                className={styles.mini}
                size="small"
                value={imageParams.size}
                onChange={(size) => setImageParams((p) => ({ ...p, size }))}
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
                value={imageParams.n}
                onChange={(n) => setImageParams((p) => ({ ...p, n }))}
                options={COUNTS.map((c) => ({ value: c, label: `${c} 张` }))}
                popupMatchSelectWidth={false}
              />
            </>
          )}
          <span className={styles.spacer} />
          {imageMode ? <ImageModelSelect /> : <ModelSelect />}
          {busy && onStop ? (
            <Button
              type="primary"
              className={styles.send}
              onClick={onStop}
              title="停止"
              aria-label="停止"
              icon={<Square size={13} fill="currentColor" />}
            />
          ) : (
            <Button
              type="primary"
              className={styles.send}
              loading={sendBusy}
              disabled={imageMode && imgBusy}
              onClick={submit}
              title={imageMode ? '生成' : '发送'}
              aria-label={imageMode ? '生成' : '发送'}
              icon={
                sendBusy
                  ? undefined
                  : imageMode
                    ? <Sparkles size={15} />
                    : <ArrowUp size={18} />
              }
            />
          )}
        </div>
      </div>
      <div className={styles.hint}>
        {busy
          ? 'Enter 插话(追加指令,不打断当前回答)· 方块按钮结束本回合'
          : 'Enter 发送 · Shift + Enter 换行 · 支持图片 / 文档'}
      </div>
    </div>
  );
}
