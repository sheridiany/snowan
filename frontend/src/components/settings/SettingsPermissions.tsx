import { Block, Button, Tag, Text } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import { Pencil, ShieldCheck } from 'lucide-react';

type Rule = {
  access: 'allow' | 'ask';
  type: string;
  pattern: string;
  comment: string;
};

const DEFAULT_RULES: Rule[] = [
  { access: 'allow', type: 'Bash', pattern: '^ls\\b', comment: 'List directory contents' },
  { access: 'allow', type: 'Bash', pattern: '^grep\\b', comment: 'Search file contents' },
  { access: 'allow', type: 'Bash', pattern: '^cat\\b', comment: 'Read a file' },
  { access: 'allow', type: 'Bash', pattern: '^pwd\\b', comment: 'Print working directory' },
  { access: 'allow', type: 'Bash', pattern: '^git status\\b', comment: 'Inspect repo state' },
  { access: 'ask', type: 'Bash', pattern: '^rm\\b', comment: 'Delete files — confirm first' },
];

const useStyles = createStyles(({ token, css }) => ({
  wrap: css`
    display: flex;
    flex-direction: column;
    gap: 16px;
  `,
  explainer: css`
    padding: 16px 18px;
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorFillQuaternary};
    display: flex;
    gap: 12px;
    align-items: flex-start;
  `,
  explainIcon: css`
    flex: none;
    margin-top: 1px;
    color: ${token.colorPrimary};
    display: inline-flex;
  `,
  explainBody: css`
    display: flex;
    flex-direction: column;
    gap: 4px;
  `,
  explainTitle: css`
    font-size: 13px;
    font-weight: 600;
    color: ${token.colorText};
  `,
  explainText: css`
    font-size: 12px;
    line-height: 1.7;
    color: ${token.colorTextSecondary};
  `,
  link: css`
    color: ${token.colorPrimary};
    cursor: pointer;
    font-weight: 500;
  `,
  section: css`
    padding: 18px;
    border-radius: ${token.borderRadiusLG}px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  `,
  sectionHead: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  `,
  sectionTitle: css`
    font-size: 14px;
    font-weight: 600;
    color: ${token.colorText};
  `,
  table: css`
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadius}px;
    overflow: hidden;
  `,
  headRow: css`
    display: grid;
    grid-template-columns: 96px 84px 1.1fr 1.4fr;
    background: ${token.colorFillQuaternary};
    border-bottom: 1px solid ${token.colorBorderSecondary};
  `,
  bodyRow: css`
    display: grid;
    grid-template-columns: 96px 84px 1.1fr 1.4fr;
    border-bottom: 1px solid ${token.colorBorderSecondary};
    &:last-child {
      border-bottom: none;
    }
    &:hover {
      background: ${token.colorFillQuaternary};
    }
  `,
  th: css`
    padding: 9px 12px;
    font-size: 11px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: ${token.colorTextTertiary};
  `,
  td: css`
    padding: 11px 12px;
    font-size: 13px;
    color: ${token.colorTextSecondary};
    display: flex;
    align-items: center;
    min-width: 0;
  `,
  mono: css`
    font-family: ${token.fontFamilyCode};
    font-size: 12px;
    color: ${token.colorText};
  `,
  comment: css`
    color: ${token.colorTextTertiary};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,
  empty: css`
    padding: 28px;
    border: 1px dashed ${token.colorBorderSecondary};
    border-radius: ${token.borderRadius}px;
    text-align: center;
    font-size: 13px;
    color: ${token.colorTextTertiary};
  `,
}));

export default function SettingsPermissions() {
  const { styles } = useStyles();

  return (
    <div className={styles.wrap}>
      <div className={styles.explainer}>
        <span className={styles.explainIcon}>
          <ShieldCheck size={18} />
        </span>
        <div className={styles.explainBody}>
          <span className={styles.explainTitle}>关于权限</span>
          <span className={styles.explainText}>
            探索模式(explore)下,助手可以自由读取你的文件与代码;执行模式(execute)
            下,任何会修改系统的命令都需要先经过这里的规则匹配。命中“允许”直接放行,命中“询问”
            会在执行前向你确认。 <span className={styles.link}>了解更多</span>
          </span>
        </div>
      </div>

      <Block variant="outlined" className={styles.section}>
        <div className={styles.sectionHead}>
          <Text className={styles.sectionTitle}>默认权限</Text>
          <Button size="small" shape="round" icon={<Pencil size={13} />}>
            编辑
          </Button>
        </div>

        <div className={styles.table}>
          <div className={styles.headRow}>
            <span className={styles.th}>访问</span>
            <span className={styles.th}>类型</span>
            <span className={styles.th}>模式</span>
            <span className={styles.th}>注释</span>
          </div>
          {DEFAULT_RULES.map((r, i) => (
            <div className={styles.bodyRow} key={i}>
              <span className={styles.td}>
                {r.access === 'allow' ? (
                  <Tag color="success">允许</Tag>
                ) : (
                  <Tag color="warning">询问</Tag>
                )}
              </span>
              <span className={styles.td}>
                <Tag>{r.type}</Tag>
              </span>
              <span className={styles.td}>
                <code className={styles.mono}>{r.pattern}</code>
              </span>
              <span className={styles.td}>
                <span className={styles.comment}>{r.comment}</span>
              </span>
            </div>
          ))}
        </div>
      </Block>

      <Block variant="outlined" className={styles.section}>
        <div className={styles.sectionHead}>
          <Text className={styles.sectionTitle}>Workspace 自定义</Text>
          <Button size="small" shape="round" icon={<Pencil size={13} />}>
            编辑
          </Button>
        </div>
        <div className={styles.empty}>
          当前工作区还没有自定义权限规则。添加规则可针对此项目覆盖默认行为。
        </div>
      </Block>
    </div>
  );
}
