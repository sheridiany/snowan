import { useEffect, useRef, useState } from 'react';
import { Button, Text } from '@lobehub/ui';
import { App, Dropdown, Input, Tag } from 'antd';
import { createStyles } from 'antd-style';
import {
  Check,
  Download,
  Folder,
  FolderPlus,
  Lock,
  MoreHorizontal,
  RotateCw,
} from 'lucide-react';
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
import { isTauri, pickFolder } from '../../lib/tauri';

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
  `,
  privacy: css`
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    font-weight: 500;
    color: ${token.colorSuccess};
  `,
  head: css`
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 0 2px;
  `,
  title: css`
    font-size: 15px;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: ${token.colorText};
  `,
  toolbar: css`
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 14px 0 4px;
  `,
  grid: css`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  `,
  card: css`
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 12px 12px 12px 13px;
    border-radius: ${token.borderRadiusLG}px;
    border: 1px solid ${token.colorBorderSecondary};
    background: ${token.colorBgContainer};
    transition: border-color 0.15s ease, background 0.15s ease;
    &:hover {
      border-color: ${token.colorBorder};
      background: ${token.colorFillQuaternary};
    }
  `,
  cardIcon: css`
    flex: none;
    width: 34px;
    height: 34px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 9px;
    background: ${token.colorPrimaryBg};
    color: ${token.colorPrimary};
  `,
  cardBody: css`
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  `,
  cardName: css`
    font-size: 13.5px;
    font-weight: 600;
    color: ${token.colorText};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  cardPath: css`
    font-size: 11.5px;
    color: ${token.colorTextTertiary};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  cardMenu: css`
    flex: none;
    width: 26px;
    height: 26px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: ${token.borderRadiusSM}px;
    color: ${token.colorTextTertiary};
    cursor: pointer;
    &:hover {
      background: ${token.colorFillSecondary};
      color: ${token.colorText};
    }
  `,
  empty: css`
    font-size: 12.5px;
    color: ${token.colorTextQuaternary};
    padding: 10px 2px;
  `,
  pathRow: css`
    display: flex;
    gap: 8px;
    margin-top: 10px;
  `,
}));

export default function SettingsKnowledge() {
  const { styles } = useStyles();
  const { message } = App.useApp();
  const [st, setSt] = useState<EmbeddingStatus | null>(null);
  const [folders, setFolders] = useState<FoldersState | null>(null);
  const [path, setPath] = useState('');
  const [showPath, setShowPath] = useState(false);
  const [adding, setAdding] = useState(false);
  const embTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const fldTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const embFails = useRef(0);
  const fldFails = useRef(0);

  // Stop a status poll after repeated failures instead of swallowing errors and
  // spinning forever if the backend stops responding.
  const loadEmb = () =>
    getEmbeddingStatus()
      .then((s) => {
        embFails.current = 0;
        setSt(s);
      })
      .catch(() => {
        if ((embFails.current += 1) >= 5) {
          clearInterval(embTimer.current);
          embTimer.current = undefined;
          message.error('获取模型状态失败,已停止刷新');
        }
      });
  const loadFolders = () =>
    listFolders()
      .then((f) => {
        fldFails.current = 0;
        setFolders(f);
      })
      .catch(() => {
        if ((fldFails.current += 1) >= 5) {
          clearInterval(fldTimer.current);
          fldTimer.current = undefined;
          message.error('获取索引状态失败,已停止刷新');
        }
      });

  useEffect(() => {
    loadEmb();
    loadFolders();
    return () => {
      clearInterval(embTimer.current);
      clearInterval(fldTimer.current);
    };
  }, []);

  useEffect(() => {
    clearInterval(embTimer.current);
    if (st?.downloading) embTimer.current = setInterval(loadEmb, 2000);
    return () => clearInterval(embTimer.current);
  }, [st?.downloading]);

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

  const doAdd = async (p: string) => {
    setAdding(true);
    try {
      setFolders(await addFolder(p));
      setPath('');
      setShowPath(false);
      message.success('已添加,正在索引该文件夹…');
    } catch (e) {
      message.error((e as Error).message === '400' ? '路径不存在或不是文件夹' : '添加失败');
    } finally {
      setAdding(false);
    }
  };

  // Desktop → native folder chooser; dev browser → reveal a path input.
  const onAddClick = async () => {
    if (isTauri()) {
      const p = await pickFolder();
      if (p) doAdd(p);
    } else {
      setShowPath((v) => !v);
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

      <Text className={styles.note} style={{ padding: '0 2px' }}>
        没下载也能用:知识库会以关键词检索工作。下载这个本地模型后,会额外启用语义检索(换种说法也能搜到),
        并自动为已存的笔记和文件补建索引。
      </Text>
      {st && !st.ready && (
        <Tag color="warning" style={{ alignSelf: 'flex-start' }}>
          语义检索未启用 · 关键词检索可用
        </Tag>
      )}

      <Section bare>
        <div className={styles.head}>
          <Text className={styles.title}>本地文件夹</Text>
          <Text className={styles.note}>
            搜索文件并从多个文档中提取洞察。支持 PDF、Word、PowerPoint、Excel、Markdown、文本与代码等格式。
          </Text>
          <span className={styles.privacy}>
            <Lock size={13} />
            所有数据本地存储
          </span>
        </div>

        <div className={styles.toolbar}>
          <Button type="primary" icon={<FolderPlus size={15} />} loading={adding} onClick={onAddClick}>
            添加文件夹
          </Button>
          {folders && folders.folders.length > 0 && (
            <Button
              size="small"
              type="text"
              icon={<RotateCw size={14} />}
              loading={folders.indexing}
              onClick={reindex}
            >
              {folders.indexing ? '索引中…' : '重新索引'}
            </Button>
          )}
        </div>

        {showPath && (
          <div className={styles.pathRow}>
            <Input
              value={path}
              autoFocus
              onChange={(e) => setPath(e.target.value)}
              onPressEnter={() => path.trim() && doAdd(path.trim())}
              placeholder="粘贴文件夹绝对路径,如 /Users/你/Documents/notes"
            />
            <Button type="primary" loading={adding} onClick={() => path.trim() && doAdd(path.trim())}>
              添加
            </Button>
          </div>
        )}

        {!folders || folders.folders.length === 0 ? (
          <div className={styles.empty}>还没有添加文件夹。</div>
        ) : (
          <div className={styles.grid}>
            {folders.folders.map((f) => (
              <div key={f.id} className={styles.card}>
                <span className={styles.cardIcon}>
                  <Folder size={18} />
                </span>
                <div className={styles.cardBody}>
                  <span className={styles.cardName}>
                    {f.path.split('/').filter(Boolean).pop() || f.path}
                  </span>
                  <span className={styles.cardPath}>
                    {f.path} · {f.file_count} 个文件
                  </span>
                </div>
                <Dropdown
                  trigger={['click']}
                  menu={{
                    items: [{ key: 'remove', label: '移除', danger: true }],
                    onClick: ({ key }) => key === 'remove' && remove(f.id),
                  }}
                >
                  <span className={styles.cardMenu} role="button" tabIndex={0} aria-label="更多操作">
                    <MoreHorizontal size={16} />
                  </span>
                </Dropdown>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
