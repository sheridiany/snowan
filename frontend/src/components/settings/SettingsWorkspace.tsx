import { Block, CopyButton, Text } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import { FolderOpen } from 'lucide-react';

const WORKSPACE_DIR = '~/.snowan/workspace';

const useStyles = createStyles(({ token, css }) => ({
  card: css`
    padding: 20px;
    border-radius: ${token.borderRadiusLG}px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  `,
  title: css`
    font-size: 14px;
    font-weight: 600;
    color: ${token.colorText};
  `,
  sub: css`
    font-size: 12px;
    color: ${token.colorTextTertiary};
    line-height: 1.6;
  `,
  path: css`
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: ${token.borderRadius}px;
    background: ${token.colorFillQuaternary};
    border: 1px solid ${token.colorBorderSecondary};
  `,
  icon: css`
    flex: none;
    color: ${token.colorTextTertiary};
    display: inline-flex;
  `,
  mono: css`
    flex: 1;
    min-width: 0;
    font-family: ${token.fontFamilyCode};
    font-size: 13px;
    color: ${token.colorText};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,
}));

export default function SettingsWorkspace() {
  const { styles } = useStyles();

  return (
    <Block variant="outlined" className={styles.card}>
      <Text className={styles.title}>工作目录</Text>
      <Text className={styles.sub}>
        会话产生的文件、技能与本地资料都保存在这个目录下。
      </Text>
      <div className={styles.path}>
        <span className={styles.icon}>
          <FolderOpen size={16} />
        </span>
        <span className={styles.mono}>{WORKSPACE_DIR}</span>
        <CopyButton content={WORKSPACE_DIR} size="small" />
      </div>
    </Block>
  );
}
