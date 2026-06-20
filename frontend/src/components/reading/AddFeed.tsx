import { useState } from 'react';
import { App, Input, Modal, Segmented } from 'antd';
import { createStyles } from 'antd-style';
import { Plus } from 'lucide-react';

// Add control: paste a feed URL (subscribe) or an article URL (read-it-later).
// The user picks the mode; the parent wires each to its endpoint.
const useStyles = createStyles(({ token, css }) => ({
  trigger: css`
    display: flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    padding: 0 10px;
    margin: 2px 0 8px;
    border-radius: ${token.borderRadius}px;
    border: 1px dashed ${token.colorBorder};
    color: ${token.colorTextSecondary};
    font-size: 13px;
    cursor: pointer;
    transition: background 0.12s ease, color 0.12s ease;
    &:hover {
      background: ${token.colorFillTertiary};
      color: ${token.colorText};
    }
  `,
  field: css`
    margin-top: 12px;
  `,
}));

export default function AddFeed({
  onSubscribe,
  onSaveArticle,
}: {
  onSubscribe: (url: string) => Promise<unknown>;
  onSaveArticle: (url: string) => Promise<unknown>;
}) {
  const { styles } = useStyles();
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'feed' | 'article'>('feed');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = () => {
    const u = url.trim();
    if (!u || busy) return;
    setBusy(true);
    const run = mode === 'feed' ? onSubscribe(u) : onSaveArticle(u);
    run
      .then(() => {
        message.success(mode === 'feed' ? '已订阅' : '已保存');
        setOpen(false);
        setUrl('');
      })
      .catch(() => message.error(mode === 'feed' ? '订阅失败,请检查链接' : '保存失败,请检查链接'))
      .finally(() => setBusy(false));
  };

  return (
    <>
      <div className={styles.trigger} onClick={() => setOpen(true)}>
        <Plus size={15} />
        添加订阅 / 网页
      </div>
      <Modal
        open={open}
        title="添加"
        okText="添加"
        cancelText="取消"
        confirmLoading={busy}
        onOk={submit}
        onCancel={() => setOpen(false)}
        destroyOnHidden
      >
        <Segmented
          block
          value={mode}
          onChange={(v) => setMode(v as 'feed' | 'article')}
          options={[
            { label: '订阅源 (RSS)', value: 'feed' },
            { label: '网页文章', value: 'article' },
          ]}
        />
        <Input
          className={styles.field}
          autoFocus
          value={url}
          placeholder={mode === 'feed' ? '粘贴 RSS / Atom 或站点链接' : '粘贴文章链接,稍后读'}
          onChange={(e) => setUrl(e.target.value)}
          onPressEnter={submit}
        />
      </Modal>
    </>
  );
}
