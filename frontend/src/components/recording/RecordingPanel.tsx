import { useEffect, useRef, useState } from 'react';
import { ActionIcon, Empty } from '@lobehub/ui';
import { App, Popconfirm } from 'antd';
import { createStyles } from 'antd-style';
import { ChevronLeft, Mic, Square, Trash2 } from 'lucide-react';

import { ListRow } from '../shell/ListPane';
import {
  listRecordings,
  getRecording,
  uploadRecording,
  deleteRecording,
  recordingAudioUrl,
  type Recording,
} from '../../api/recording';

function recDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function fmtClock(ms: number): string {
  const total = Math.floor(ms / 1000);
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

const useStyles = createStyles(({ token, css }) => ({
  scroll: css`
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    padding: 6px 8px 12px;
  `,
  recBar: css`
    flex: none;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 4px 10px;
  `,
  recBtn: css`
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 36px;
    padding: 0 14px;
    border: none;
    border-radius: ${token.borderRadius}px;
    background: ${token.colorPrimary};
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.12s ease;
    &:hover {
      background: ${token.colorPrimaryHover};
    }
    &:disabled {
      opacity: 0.6;
      cursor: default;
    }
  `,
  stopBtn: css`
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 36px;
    padding: 0 14px;
    border: 1px solid ${token.colorErrorBorder};
    border-radius: ${token.borderRadius}px;
    background: ${token.colorErrorBg};
    color: ${token.colorError};
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.12s ease;
    &:hover {
      background: ${token.colorErrorBgHover};
    }
  `,
  liveDot: css`
    width: 9px;
    height: 9px;
    flex: none;
    border-radius: 50%;
    background: ${token.colorError};
    animation: recPulse 1.2s ease-in-out infinite;
    @media (prefers-reduced-motion: reduce) {
      animation: none;
    }
    @keyframes recPulse {
      0%,
      100% {
        opacity: 1;
      }
      50% {
        opacity: 0.25;
      }
    }
  `,
  liveTimer: css`
    font-variant-numeric: tabular-nums;
    font-size: 14px;
    font-weight: 600;
    color: ${token.colorText};
  `,
  busy: css`
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: ${token.colorTextSecondary};
  `,
  detail: css`
    flex: 1;
    overflow-y: auto;
    padding: 8px 18px 24px;
  `,
  detailTitle: css`
    font-size: 18px;
    font-weight: 700;
    line-height: 1.4;
    color: ${token.colorText};
    margin: 8px 0 4px;
  `,
  detailMeta: css`
    font-size: 12px;
    color: ${token.colorTextTertiary};
    margin-bottom: 14px;
  `,
  back: css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    flex: none;
    border-radius: ${token.borderRadiusSM}px;
    cursor: pointer;
    color: ${token.colorTextSecondary};
    &:hover {
      background: ${token.colorFillTertiary};
      color: ${token.colorText};
    }
  `,
  crumb: css`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    font-size: 13px;
    font-weight: 600;
    color: ${token.colorText};
  `,
  audio: css`
    width: 100%;
    margin: 4px 0 16px;
  `,
  summary: css`
    font-size: 14px;
    line-height: 1.7;
    color: ${token.colorText};
    white-space: pre-wrap;
    margin-bottom: 16px;
  `,
  sectionLabel: css`
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: ${token.colorTextQuaternary};
    margin: 0 0 6px;
  `,
  transcript: css`
    font-size: 13px;
    line-height: 1.8;
    color: ${token.colorTextSecondary};
    white-space: pre-wrap;
    word-break: break-word;
  `,
  detailHeader: css`
    flex: none;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 0 8px 0 10px;
  `,
  actions: css`
    flex: none;
    display: flex;
    align-items: center;
    gap: 2px;
  `,
}));

export default function RecordingPanel({ refreshKey }: { refreshKey?: number }) {
  const { styles } = useStyles();
  const { message } = App.useApp();
  const [items, setItems] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<Recording | null>(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = () => {
    setLoading(true);
    listRecordings()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(refresh, [refreshKey]);

  useEffect(() => () => {
    if (tickRef.current) clearInterval(tickRef.current);
    recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
  }, []);

  const startRecording = async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      message.error('无法访问麦克风,请在系统设置中授予权限后重试。');
      return;
    }
    chunksRef.current = [];
    const rec = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const ms = Date.now() - startedAtRef.current;
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      finishRecording(blob, ms);
    };
    recorderRef.current = rec;
    startedAtRef.current = Date.now();
    rec.start();
    setElapsed(0);
    setRecording(true);
    tickRef.current = setInterval(() => setElapsed(Date.now() - startedAtRef.current), 250);
  };

  const stopRecording = () => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    setRecording(false);
    recorderRef.current?.stop();
  };

  const finishRecording = (blob: Blob, ms: number) => {
    setTranscribing(true);
    uploadRecording(blob, ms)
      .then((rec) => {
        setItems((prev) => [rec, ...prev]);
        setOpen(rec);
      })
      .catch(() => message.error('转写失败,请重试。'))
      .finally(() => setTranscribing(false));
  };

  const onDelete = (rec: Recording) =>
    deleteRecording(rec.id)
      .then(() => {
        setItems((prev) => prev.filter((r) => r.id !== rec.id));
        setOpen((cur) => (cur?.id === rec.id ? null : cur));
        message.success('已删除');
      })
      .catch((e: Error) => message.error(`删除失败:${e.message || '请重试'}`));

  const openDetail = (rec: Recording) => {
    setOpen(rec);
    // List rows may carry an empty transcript; hydrate the full record.
    if (!rec.transcript) {
      getRecording(rec.id)
        .then((full) => setOpen((cur) => (cur?.id === full.id ? full : cur)))
        .catch(() => {});
    }
  };

  if (open) {
    return (
      <>
        <div className={styles.detailHeader}>
          <span className={styles.crumb}>
            <span className={styles.back} onClick={() => setOpen(null)}>
              <ChevronLeft size={18} />
            </span>
            <span>录音</span>
          </span>
          <div className={styles.actions}>
            <Popconfirm
              title="删除这条录音?"
              description="录音和转写都会删除,不可恢复。"
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
              onConfirm={() => onDelete(open)}
            >
              <ActionIcon icon={Trash2} size="small" title="删除" />
            </Popconfirm>
          </div>
        </div>
        <div className={styles.detail}>
          <div className={styles.detailTitle}>{open.title || '未命名录音'}</div>
          <div className={styles.detailMeta}>
            {recDate(open.created_at)} · {fmtClock(open.duration_ms)}
          </div>
          <audio className={styles.audio} controls src={recordingAudioUrl(open.id)} />
          {open.summary && <div className={styles.summary}>{open.summary}</div>}
          <div className={styles.sectionLabel}>转写全文</div>
          <div className={styles.transcript}>{open.transcript || '（暂无转写内容）'}</div>
        </div>
      </>
    );
  }

  return (
    <div className={styles.scroll}>
      <div className={styles.recBar}>
        {recording ? (
          <>
            <button className={styles.stopBtn} onClick={stopRecording}>
              <Square size={15} fill="currentColor" />
              停止
            </button>
            <span className={styles.liveDot} />
            <span className={styles.liveTimer}>{fmtClock(elapsed)}</span>
          </>
        ) : transcribing ? (
          <span className={styles.busy}>
            <span className={styles.liveDot} />
            转写中…
          </span>
        ) : (
          <button className={styles.recBtn} onClick={startRecording}>
            <Mic size={16} />
            录音
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <Empty
          icon={Mic}
          title={loading ? '加载中…' : '还没有录音'}
          description="点上面的「录音」开始,转写好的内容会出现在这里。"
          paddingBlock={36}
        />
      ) : (
        items.map((r) => (
          <ListRow
            key={r.id}
            icon={Mic}
            label={r.title || '未命名录音'}
            sub={r.summary || fmtClock(r.duration_ms)}
            right={recDate(r.created_at)}
            onClick={() => openDetail(r)}
            onDelete={() => onDelete(r)}
          />
        ))
      )}
    </div>
  );
}
