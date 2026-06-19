import { useEffect, useState } from 'react';
import { App, Input, Modal, Spin } from 'antd';
import { createStyles } from 'antd-style';
import { draftNote, createNote, type DraftEntry } from '../api/knowledge';

const useStyles = createStyles(({ token, css }) => ({
  body: css`
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-top: 8px;
  `,
  loading: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 40px 0;
    color: ${token.colorTextTertiary};
    font-size: 13px;
  `,
  label: css`
    font-size: 12px;
    color: ${token.colorTextTertiary};
  `,
}));

type Props = {
  open: boolean;
  entries: DraftEntry[];
  sessionId: string;
  topic?: string;
  onClose: () => void;
  onSaved?: () => void;
};

// Drafts a structured note from the chat messages (LLM, with backend fallback),
// lets the user edit it, then saves it as a chat-origin note that cites the
// conversation it came from.
export default function NoteDraftModal({ open, entries, sessionId, topic, onClose, onSaved }: Props) {
  const { styles } = useStyles();
  const { message } = App.useApp();
  const [drafting, setDrafting] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDrafting(true);
    setTitle('');
    setBody('');
    draftNote(entries, topic)
      .then((d) => {
        setTitle(d.title);
        setBody(d.body);
      })
      .catch(() => message.error('生成草稿失败,请重试'))
      .finally(() => setDrafting(false));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!body.trim()) {
      message.warning('笔记内容为空');
      return;
    }
    setSaving(true);
    try {
      await createNote({
        body: body.trim(),
        title: title.trim(),
        origin: 'chat',
        source: { chat: sessionId },
      });
      message.success('已存入知识库');
      onSaved?.();
      onClose();
    } catch (e) {
      message.error(`保存失败:${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="存为笔记"
      open={open}
      onCancel={onClose}
      onOk={save}
      okText="存入知识库"
      cancelText="取消"
      okButtonProps={{ disabled: drafting }}
      confirmLoading={saving}
      width={620}
      destroyOnHidden
    >
      {drafting ? (
        <div className={styles.loading}>
          <Spin />
          正在把这段对话提炼成笔记…
        </div>
      ) : (
        <div className={styles.body}>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="笔记标题" />
          <span className={styles.label}>内容（可编辑）</span>
          <Input.TextArea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            autoSize={{ minRows: 12, maxRows: 22 }}
          />
        </div>
      )}
    </Modal>
  );
}
