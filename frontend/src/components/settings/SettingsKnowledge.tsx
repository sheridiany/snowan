import { useEffect, useRef, useState } from 'react';
import { Button, Text } from '@lobehub/ui';
import { App, Input, Tag } from 'antd';
import { createStyles } from 'antd-style';
import { Check, Download, FolderPlus, RotateCw, Trash2 } from 'lucide-react';
import { Row, Section } from './_kit';
import {
  getEmbeddingStatus,
  downloadEmbedding,
  listFolders,
  addFolder,
  removeFolder,
  reindexFolders,
  type EmbeddingStatus,
  type FoldersState,
} from '../../api/knowledge';

const useStyles = createStyles(({ token, css }) => ({
  wrap: css`
    display: flex;
    flex-direction: column;
    gap: 28px;
  `,
  ready: css`
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: ${token.colorSuccess};
    font-size: 13px;
    font-weight: 600;
  `,
  note: css`
    font-size: 12.5px;
    line-height: 1.6;
    color: ${token.colorTextTertiary};
    padding: 0 2px;
  `,
  folderName: css`
    font-family: ${token.fontFamilyCode};
    font-size: 12px;
    color: ${token.colorTextTertiary};
    word-break: break-all;
  `,
  addRow: css`
    display: flex;
    gap: 8px;
    margin-top: 10px;
  `,
  sectionHeadRow: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  `,
  empty: css`
    font-size: 12.5px;
    color: ${token.colorTextQuaternary};
    padding: 8px 2px;
  `,
}));

export default function SettingsKnowledge() {
  const { styles } = useStyles();
  const { message } = App.useApp();
  const [st, setSt] = useState<EmbeddingStatus | null>(null);
  const [folders, setFolders] = useState<FoldersState | null>(null);
  const [path, setPath] = useState('');
  const [adding, setAdding] = useState(false);
  const embTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const fldTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const loadEmb = () => getEmbeddingStatus().then(setSt).catch(() => {});
  const loadFolders = () => listFolders().then(setFolders).catch(() => {});

  useEffect(() => {
    loadEmb();
    loadFolders();
    return () => {
      clearInterval(embTimer.current);
      clearInterval(fldTimer.current);
    };
  }, []);

  // Poll while the model downloads.
  useEffect(() => {
    clearInterval(embTimer.current);
    if (st?.downloading) embTimer.current = setInterval(loadEmb, 2000);
    return () => clearInterval(embTimer.current);
  }, [st?.downloading]);

  // Poll while folders are indexing (file counts settle when it finishes).
  useEffect(() => {
    clearInterval(fldTimer.current);
    if (folders?.indexing) fldTimer.current = setInterval(loadFolders, 2000);
    return () => clearInterval(fldTimer.current);
  }, [folders?.indexing]);

  const startDownload = async () => {
    try {
      await downloadEmbedding();
      setSt((s) => (s ? { ...s, downloading: true } : s));
      message.info('开始下载本地模型,完成后语义检索会自动启用');
    } catch {
      message.error('下载启动失败,请重试');
    }
  };

  const add = async () => {
    const p = path.trim();
    if (!p) return;
    setAdding(true);
    try {
      setFolders(await addFolder(p));
      setPath('');
      message.success('已添加,正在索引该文件夹…');
    } catch (e) {
      message.error((e as Error).message === '400' ? '路径不存在或不是文件夹' : '添加失败');
    } finally {
      setAdding(false);
    }
  };

  const remove = async (id: string) => {
    try {
      setFolders(await removeFolder(id));
    } catch {
      message.error('移除失败');
    }
  };

  const reindex = async () => {
    try {
      setFolders(await reindexFolders());
      message.info('正在重新索引…');
    } catch {
      message.error('操作失败');
    }
  };

  const embControl = !st ? null : st.ready ? (
    <span className={styles.ready}>
      <Check size={15} />
      已就绪
    </span>
  ) : st.downloading ? (
    <Button loading size="small">
      下载中…
    </Button>
  ) : (
    <Button type="primary" size="small" icon={<Download size={14} />} onClick={startDownload}>
      下载模型
    </Button>
  );

  return (
    <div className={styles.wrap}>
      <Section
        title="本地语义检索"
        subtitle="用于「语义搜索」的嵌入模型,完全在你的设备上离线运行——笔记内容不会离开本机。"
      >
        <Row
          label={st?.model ?? '嵌入模型'}
          subtitle={`约 ${st?.size_mb ?? 95}MB · 一次性下载,存于 ~/.snowan/models`}
          control={embControl}
        />
      </Section>

      <Text className={styles.note}>
        没下载也能用:知识库会以关键词检索工作。下载这个本地模型后,会额外启用语义检索(换种说法也能搜到),
        并自动为已存的笔记和文件补建索引。
      </Text>
      {st && !st.ready && (
        <Tag color="warning" style={{ alignSelf: 'flex-start' }}>
          语义检索未启用 · 关键词检索可用
        </Tag>
      )}

      <Section bare>
        <div className={styles.sectionHeadRow}>
          <div>
            <Text style={{ fontSize: 15, fontWeight: 700 }}>本地文件夹</Text>
            <div className={styles.note}>
              选定文件夹里的文件(md / txt / pdf / docx / xlsx / pptx / 代码等)会进入知识库,可被搜索和引用。
            </div>
          </div>
          <Button
            size="small"
            icon={<RotateCw size={14} />}
            loading={folders?.indexing}
            onClick={reindex}
          >
            {folders?.indexing ? '索引中…' : '重新索引'}
          </Button>
        </div>

        <div style={{ marginTop: 12 }}>
          {!folders || folders.folders.length === 0 ? (
            <div className={styles.empty}>还没有添加文件夹。</div>
          ) : (
            folders.folders.map((f) => (
              <Row
                key={f.id}
                label={f.path.split('/').filter(Boolean).pop() || f.path}
                subtitle={
                  <span className={styles.folderName}>
                    {f.path} · {f.file_count} 个文件
                  </span>
                }
                control={
                  <Button
                    size="small"
                    type="text"
                    danger
                    icon={<Trash2 size={14} />}
                    onClick={() => remove(f.id)}
                  />
                }
              />
            ))
          )}
        </div>

        <div className={styles.addRow}>
          <Input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            onPressEnter={add}
            placeholder="粘贴文件夹绝对路径,如 /Users/你/Documents/notes"
          />
          <Button type="primary" icon={<FolderPlus size={15} />} loading={adding} onClick={add}>
            添加
          </Button>
        </div>
      </Section>
    </div>
  );
}
