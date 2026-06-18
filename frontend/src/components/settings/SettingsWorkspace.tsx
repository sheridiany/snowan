import { CopyButton } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import { FolderOpen } from 'lucide-react';
import { Row, Section } from './_kit';

const WORKSPACE_NAME = 'Snowan';
const WORKSPACE_DIR = '~/.snowan/workspace';

const useStyles = createStyles(({ token, css }) => ({
  wrap: css`
    display: flex;
    flex-direction: column;
    gap: 28px;
  `,
  name: css`
    font-size: 13.5px;
    font-weight: 600;
    color: ${token.colorText};
  `,
  path: css`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 6px 5px 11px;
    border-radius: ${token.borderRadius}px;
    background: ${token.colorFillQuaternary};
    border: 1px solid ${token.colorBorderSecondary};
  `,
  pathIcon: css`
    flex: none;
    color: ${token.colorTextTertiary};
    display: inline-flex;
  `,
  mono: css`
    font-family: ${token.fontFamilyCode};
    font-size: 12.5px;
    color: ${token.colorText};
  `,
  swatch: css`
    width: 32px;
    height: 32px;
    border-radius: 9px;
    background: ${token.colorPrimary};
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-weight: 700;
    font-size: 15px;
    box-shadow: 0 2px 8px ${token.colorPrimaryBorder};
  `,
}));

export default function SettingsWorkspace() {
  const { styles } = useStyles();

  return (
    <div className={styles.wrap}>
      <Section title="工作区" subtitle="会话产生的文件、技能与本地资料都保存在这个工作区下">
        <Row
          label="名称"
          subtitle="显示在侧边栏与窗口标题中"
          control={<span className={styles.name}>{WORKSPACE_NAME}</span>}
        />
        <Row
          label="工作目录"
          subtitle="所有持久化内容的根目录"
          control={
            <div className={styles.path}>
              <span className={styles.pathIcon}>
                <FolderOpen size={15} />
              </span>
              <span className={styles.mono}>{WORKSPACE_DIR}</span>
              <CopyButton content={WORKSPACE_DIR} size="small" />
            </div>
          }
        />
        <Row
          label="图标"
          subtitle="工作区的标识色块"
          control={<span className={styles.swatch}>S</span>}
        />
      </Section>
    </div>
  );
}
