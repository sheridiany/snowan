import { useEffect, useState } from 'react';
import { Button, Text } from '@lobehub/ui';
import { App, Tag } from 'antd';
import { createStyles } from 'antd-style';
import { FolderOpen } from 'lucide-react';
import { Row, Section } from './_kit';
import { getAbout, openDataDir, type About } from '../../api/system';

const useStyles = createStyles(({ token, css }) => ({
  wrap: css`
    display: flex;
    flex-direction: column;
    gap: 28px;
  `,
  header: css`
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 0 2px;
  `,
  icon: css`
    width: 40px;
    height: 40px;
    border-radius: 10px;
  `,
  headText: css`
    display: flex;
    flex-direction: column;
    gap: 2px;
  `,
  appName: css`
    font-size: 17px;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: ${token.colorText};
  `,
  appVer: css`
    font-size: 12.5px;
    color: ${token.colorTextTertiary};
  `,
  mono: css`
    font-family: ${token.fontFamilyCode};
    font-size: 12px;
    color: ${token.colorTextTertiary};
    word-break: break-all;
  `,
}));

export default function SettingsAbout() {
  const { styles } = useStyles();
  const { message } = App.useApp();
  const [about, setAbout] = useState<About | null>(null);

  useEffect(() => {
    getAbout()
      .then(setAbout)
      .catch(() => message.error('无法获取应用信息'));
  }, [message]);

  if (!about) {
    return (
      <div className={styles.wrap}>
        <Text className={styles.appVer}>正在加载…</Text>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <img className={styles.icon} src="/snowan-icon.png" alt="Snowan" />
        <div className={styles.headText}>
          <Text className={styles.appName}>Snowan</Text>
          <Text className={styles.appVer}>{about.version}</Text>
        </div>
      </div>

      <Section title="信息">
        <Row label="版本" control={<Text>{about.version}</Text>} />
        <Row
          label="当前模型"
          control={<Text>{about.model ? `${about.provider} · ${about.model}` : '未配置'}</Text>}
        />
        <Row label="后端" control={<Tag color="green">已连接</Tag>} />
        <Row
          label="数据目录"
          subtitle={<span className={styles.mono}>{about.data_dir}</span>}
          control={
            <Button icon={FolderOpen} onClick={() => openDataDir()}>
              在访达打开
            </Button>
          }
        />
      </Section>
    </div>
  );
}
