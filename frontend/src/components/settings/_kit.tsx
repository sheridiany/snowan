import { Block, Text } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import type { ReactNode } from 'react';

const useStyles = createStyles(({ token, css }) => ({
  section: css`
    display: flex;
    flex-direction: column;
    gap: 12px;
  `,
  sectionHead: css`
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 0 2px;
  `,
  sectionTitle: css`
    font-size: 15px;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: ${token.colorText};
  `,
  sectionSub: css`
    font-size: 12.5px;
    line-height: 1.5;
    color: ${token.colorTextTertiary};
  `,
  card: css`
    padding: 4px 18px;
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorBgContainer};
  `,
  row: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    min-height: 56px;
    padding: 12px 0;
    border-bottom: 1px solid ${token.colorBorderSecondary};
    &:last-child {
      border-bottom: none;
    }
  `,
  rowText: css`
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  `,
  rowLabel: css`
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13.5px;
    font-weight: 500;
    color: ${token.colorText};
  `,
  rowSub: css`
    font-size: 12px;
    line-height: 1.5;
    color: ${token.colorTextTertiary};
  `,
  rowControl: css`
    flex: none;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
  `,
}));

export function Section({
  title,
  subtitle,
  children,
  bare,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  /** render children without the rounded card wrapper */
  bare?: boolean;
}) {
  const { styles } = useStyles();
  return (
    <div className={styles.section}>
      {(title || subtitle) && (
        <div className={styles.sectionHead}>
          {title && <Text className={styles.sectionTitle}>{title}</Text>}
          {subtitle && <Text className={styles.sectionSub}>{subtitle}</Text>}
        </div>
      )}
      {bare ? (
        children
      ) : (
        <Block variant="outlined" className={styles.card}>
          {children}
        </Block>
      )}
    </div>
  );
}

export function Row({
  label,
  subtitle,
  icon,
  control,
}: {
  label: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  control: ReactNode;
}) {
  const { styles } = useStyles();
  return (
    <div className={styles.row}>
      <div className={styles.rowText}>
        <span className={styles.rowLabel}>
          {icon}
          {label}
        </span>
        {subtitle && <span className={styles.rowSub}>{subtitle}</span>}
      </div>
      <div className={styles.rowControl}>{control}</div>
    </div>
  );
}
