import { useRef, useState } from 'react';
import { ActionIcon, Button, TextArea } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import { ArrowUp, Paperclip, Square, X } from 'lucide-react';
import ModelSelect from './ModelSelect';
import type { Attachment } from '../api/chat';

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
    background: ${token.colorBgElevated};
    border: 1px solid ${token.colorBorderSecondary};
    box-shadow: ${token.boxShadowTertiary};
    transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
    &:hover {
      transform: translateY(-1px);
      box-shadow: ${token.boxShadowSecondary};
    }
    &:focus-within {
      border-color: ${token.colorPrimaryBorder};
    }
    @media (prefers-reduced-motion: reduce) {
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
      &:hover {
        transform: none;
      }
    }
  `,
  dragging: css`
    border-color: ${token.colorPrimary};
    box-shadow: inset 0 0 0 1px ${token.colorPrimary};
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
    border-radius: 9px;
    background: ${token.colorFillTertiary};
    color: ${token.colorTextSecondary};
    font-size: 12px;
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
    &:hover {
      background: ${token.colorFill};
      color: ${token.colorText};
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
  `,
  hint: css`
    margin-top: 8px;
    text-align: center;
    font-size: 11px;
    color: ${token.colorTextQuaternary};
  `,
}));

const isGenericImageName = (f: File) =>
  (f.type || '').startsWith('image/') && (!f.name || /^(image|blob)/i.test(f.name));

export interface ComposerProps {
  busy: boolean;
  onSend: (text: string, attachments: Attachment[]) => void;
  onStop?: () => void;
  onSteer?: (text: string) => void;
}

export default function Composer({ busy, onSend, onStop, onSteer }: ComposerProps) {
  const { styles, cx } = useStyles();
  const [value, setValue] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

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
    if (!text && attachments.length === 0) return;
    const atts = attachments;
    setValue('');
    setAttachments([]);
    onSend(text, atts);
  };

  return (
    <div className={styles.wrap}>
      <div
        className={cx(styles.card, dragging && styles.dragging)}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        {attachments.length > 0 && (
          <div className={styles.chips}>
            {attachments.map((a, i) => (
              <span key={i} className={styles.chip} title={a.name}>
                {a.mime.startsWith('image/') ? (
                  <img className={styles.thumb} src={`data:${a.mime};base64,${a.data}`} alt={a.name} />
                ) : (
                  <span className={styles.chipIcon}>
                    <Paperclip size={12} />
                  </span>
                )}
                <span className={styles.chipName}>{a.name}</span>
                <span
                  className={styles.chipX}
                  onClick={() => setAttachments((prev) => prev.filter((_, k) => k !== i))}
                >
                  <X size={12} />
                </span>
              </span>
            ))}
          </div>
        )}

        <TextArea
          className={styles.ta}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onPaste={onPaste}
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          autoSize={{ minRows: 1, maxRows: 8 }}
          placeholder="问点什么…(可粘贴或拖拽图片、文档)"
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
          <span className={styles.spacer} />
          <ModelSelect />
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
              loading={busy}
              onClick={submit}
              title="发送"
              aria-label="发送"
              icon={busy ? undefined : <ArrowUp size={18} />}
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
