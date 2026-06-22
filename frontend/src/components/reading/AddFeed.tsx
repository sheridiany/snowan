import { useRef, useState } from 'react';
import { App, Button, Input, Modal, Segmented } from 'antd';
import { createStyles } from 'antd-style';
import { Plus, Sparkles, Upload } from 'lucide-react';

// Add control: paste a feed URL (subscribe) / an article URL (read-it-later) /
// import an OPML feed list, plus a one-click curated starter set.
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
  hint: css`
    margin-top: 8px;
    font-size: 12px;
    color: ${token.colorTextTertiary};
  `,
  reco: css`
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px solid ${token.colorBorderSecondary};
    text-align: center;
  `,
}));

type Mode = 'feed' | 'article' | 'opml';

export default function AddFeed({
  onSubscribe,
  onSaveArticle,
  onImportOpml,
  onAddRecommended,
}: {
  onSubscribe: (url: string) => Promise<unknown>;
  onSaveArticle: (url: string) => Promise<unknown>;
  onImportOpml: (opml: string) => Promise<{ added: number; total: number }>;
  onAddRecommended: () => Promise<{ added: number; total: number }>;
}) {
  const { styles } = useStyles();
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('feed');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const close = () => {
    setOpen(false);
    setUrl('');
  };

  const submitUrl = () => {
    const u = url.trim();
    if (!u || busy) return;
    setBusy(true);
    (mode === 'feed' ? onSubscribe(u) : onSaveArticle(u))
      .then(() => {
        message.success(mode === 'feed' ? '已订阅' : '已保存');
        close();
      })
      .catch(() => message.error(mode === 'feed' ? '订阅失败,请检查链接' : '保存失败,请检查链接'))
      .finally(() => setBusy(false));
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file || busy) return;
    setBusy(true);
    file
      .text()
      .then((text) => onImportOpml(text))
      .then((r) => {
        message.success(`已导入 ${r.added} 个订阅源,正在抓取文章…`);
        close();
      })
      .catch(() => message.error('导入失败,请检查 OPML 文件'))
      .finally(() => setBusy(false));
  };

  const addRecommended = () => {
    if (busy) return;
    setBusy(true);
    onAddRecommended()
      .then((r) => {
        message.success(`已添加 ${r.added} 个精选订阅,正在抓取文章…`);
        close();
      })
      .catch(() => message.error('添加失败,请重试'))
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
        title="添加订阅"
        okText="添加"
        cancelText="取消"
        confirmLoading={busy}
        okButtonProps={{ style: { display: mode === 'opml' ? 'none' : undefined } }}
        onOk={submitUrl}
        onCancel={close}
        destroyOnHidden
      >
        <Segmented
          block
          value={mode}
          onChange={(v) => setMode(v as Mode)}
          options={[
            { label: '订阅源 (RSS)', value: 'feed' },
            { label: '网页文章', value: 'article' },
            { label: '导入 OPML', value: 'opml' },
          ]}
        />
        {mode === 'opml' ? (
          <div className={styles.field}>
            <Button icon={<Upload size={15} />} block onClick={() => fileRef.current?.click()} loading={busy}>
              选择 .opml 文件导入
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".opml,.xml,text/xml,application/xml"
              hidden
              onChange={onFile}
            />
            <div className={styles.hint}>
              支持任意 RSS 阅读器导出的 OPML(如 BestBlogs 那份几百源的列表)。
            </div>
          </div>
        ) : (
          <Input
            className={styles.field}
            autoFocus
            value={url}
            placeholder={mode === 'feed' ? '粘贴 RSS / Atom 或站点链接' : '粘贴文章链接,稍后读'}
            onChange={(e) => setUrl(e.target.value)}
            onPressEnter={submitUrl}
          />
        )}
        <div className={styles.reco}>
          <Button type="text" icon={<Sparkles size={15} />} onClick={addRecommended} loading={busy}>
            一键添加 28 个精选订阅
          </Button>
        </div>
      </Modal>
    </>
  );
}
