import { useEffect, useRef, useState } from 'react';
import { Button, Text } from '@lobehub/ui';
import { App, Tag } from 'antd';
import { createStyles } from 'antd-style';
import { Check, Download } from 'lucide-react';
import { Row, Section } from './_kit';
import { getEmbeddingStatus, downloadEmbedding, type EmbeddingStatus } from '../../api/knowledge';

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
}));

// The local embedding model is a deliberate, user-controlled download. Until it
// lands, the knowledge base still works keyword-only; this panel surfaces the
// status and the one-time download with progress.
export default function SettingsKnowledge() {
  const { styles } = useStyles();
  const { message } = App.useApp();
  const [st, setSt] = useState<EmbeddingStatus | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const load = () => getEmbeddingStatus().then(setSt).catch(() => {});

  useEffect(() => {
    load();
    return () => clearInterval(timer.current);
  }, []);

  // Poll while the download runs, until it reports ready.
  useEffect(() => {
    clearInterval(timer.current);
    if (st?.downloading) {
      timer.current = setInterval(load, 2000);
    } else if (st?.ready) {
      // just finished downloading
      timer.current = undefined;
    }
    return () => clearInterval(timer.current);
  }, [st?.downloading, st?.ready]);

  const start = async () => {
    try {
      await downloadEmbedding();
      setSt((s) => (s ? { ...s, downloading: true } : s));
      message.info('开始下载本地模型,完成后语义检索会自动启用');
    } catch {
      message.error('下载启动失败,请重试');
    }
  };

  const control = !st ? null : st.ready ? (
    <span className={styles.ready}>
      <Check size={15} />
      已就绪
    </span>
  ) : st.downloading ? (
    <Button loading size="small">
      下载中…
    </Button>
  ) : (
    <Button type="primary" size="small" icon={<Download size={14} />} onClick={start}>
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
          control={control}
        />
      </Section>
      <Text className={styles.note}>
        没下载也能用:知识库会以关键词检索工作。下载这个本地模型后,会额外启用语义检索(换种说法也能搜到),
        并自动为已存的笔记补建索引。
      </Text>
      {st && !st.ready && (
        <Tag color="warning" style={{ alignSelf: 'flex-start' }}>
          语义检索未启用 · 关键词检索可用
        </Tag>
      )}
    </div>
  );
}
