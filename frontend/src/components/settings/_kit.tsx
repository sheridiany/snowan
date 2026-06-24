import { useEffect, useState } from 'react';
import { Text } from '@lobehub/ui';
import { App, Button, Input } from 'antd';
import { createStyles } from 'antd-style';
import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import DisplayHeading from '../../ui/DisplayHeading';
import { TYPE } from '../../theme/themes';

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
  sectionSub: css`
    font-size: ${TYPE.small}px;
    line-height: 1.5;
    color: ${token.colorTextTertiary};
  `,
  card: css`
    display: flex;
    flex-direction: column;
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorBgContainer};
    /* Lit-surface shadow stands in for a hard border (matches app-wide cards). */
    box-shadow: ${token.boxShadowTertiary};
    overflow: hidden;
    /* hairline divider between rows, macOS / Linear grouped-settings style */
    & > * + * {
      border-top: 1px solid ${token.colorBorderSecondary};
    }
  `,
  row: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    min-height: 56px;
    padding: 13px 16px;
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
    font-size: ${TYPE.dense}px;
    font-weight: 500;
    color: ${token.colorText};
  `,
  rowSub: css`
    font-size: ${TYPE.small}px;
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
  secret: css`
    display: flex;
    align-items: center;
    gap: 8px;
  `,
  savedOk: css`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: ${TYPE.small}px;
    font-weight: 500;
    color: ${token.colorSuccess};
  `,
  unset: css`
    font-size: ${TYPE.small}px;
    color: ${token.colorTextQuaternary};
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
          {title && <DisplayHeading level={4}>{title}</DisplayHeading>}
          {subtitle && <Text className={styles.sectionSub}>{subtitle}</Text>}
        </div>
      )}
      {bare ? children : <div className={styles.card}>{children}</div>}
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

// A key/secret input with explicit, legible save state: typing reveals a 保存
// button; once saved it shows 已保存 ✓ (and stays that way on reload if a value
// is present), so the user always knows whether it persisted. onSave does the
// actual write; this handles the dirty/saved state + a toast.
export function SecretField({
  value,
  onSave,
  placeholder = '粘贴 API Key',
  width = 260,
}: {
  value: string;
  onSave: (v: string) => Promise<void>;
  placeholder?: string;
  width?: number;
}) {
  const { styles } = useStyles();
  const { message } = App.useApp();
  const [v, setV] = useState(value);
  const [saved, setSaved] = useState(value);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setV(value);
    setSaved(value);
  }, [value]);

  const dirty = v.trim() !== saved;
  const doSave = async () => {
    const next = v.trim();
    setSaving(true);
    try {
      await onSave(next);
      setSaved(next);
      setV(next);
      message.success('已保存');
    } catch {
      message.error('保存失败,请重试');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.secret}>
      <Input.Password
        value={v}
        placeholder={placeholder}
        style={{ width }}
        onChange={(e) => setV(e.target.value)}
        onPressEnter={doSave}
      />
      {dirty ? (
        <Button size="small" type="primary" loading={saving} onClick={doSave}>
          保存
        </Button>
      ) : v ? (
        <span className={styles.savedOk}>
          <Check size={14} />
          已保存
        </span>
      ) : (
        <span className={styles.unset}>未配置</span>
      )}
    </div>
  );
}
