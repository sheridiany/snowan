import { createStyles, cx } from 'antd-style';
import {
  PanelLeft,
  PanelRight,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';

const useStyles = createStyles(({ token, css }) => ({
  bar: css`
    height: 44px;
    flex: none;
    display: flex;
    align-items: center;
    gap: 2px;
    /* Reserve 78px on the left for macOS traffic lights (close/minimize/zoom). */
    padding: 0 10px 0 78px;
    background: ${token.colorBgContainer};
    border-bottom: 1px solid ${token.colorBorderSecondary};
    user-select: none;
  `,
  spacer: css`
    flex: 1;
    align-self: stretch;
    display: flex;
    align-items: center;
    justify-content: center;
  `,
  title: css`
    font-size: 13px;
    font-weight: 600;
    color: ${token.colorTextSecondary};
    pointer-events: none;
  `,
  iconBtn: css`
    width: 28px;
    height: 28px;
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: ${token.borderRadiusSM}px;
    cursor: pointer;
    color: ${token.colorTextSecondary};
    transition: background 0.15s ease, color 0.15s ease;
    &:hover {
      background: ${token.colorFillTertiary};
      color: ${token.colorText};
    }
  `,
  disabled: css`
    color: ${token.colorTextQuaternary};
    cursor: default;
    pointer-events: none;
  `,
}));

type Props = {
  navCollapsed: boolean;
  rightOpen: boolean;
  canBack: boolean;
  canForward: boolean;
  title?: string;
  onToggleNav: () => void;
  onToggleRight: () => void;
  onBack: () => void;
  onForward: () => void;
};

export default function TitleBar({
  rightOpen,
  canBack,
  canForward,
  title,
  onToggleNav,
  onToggleRight,
  onBack,
  onForward,
}: Props) {
  const { styles } = useStyles();

  const Btn = ({
    icon,
    label,
    onClick,
    disabled,
    active,
  }: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    disabled?: boolean;
    active?: boolean;
  }) => (
    <div
      className={cx(styles.iconBtn, disabled && styles.disabled)}
      data-tauri-drag-region="false"
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={disabled ? undefined : onClick}
    >
      {icon}
    </div>
  );

  return (
    <div className={styles.bar} data-tauri-drag-region>
      <Btn icon={<PanelLeft size={17} />} label="折叠侧栏" onClick={onToggleNav} />
      <Btn
        icon={<ArrowLeft size={17} />}
        label="后退"
        onClick={onBack}
        disabled={!canBack}
      />
      <Btn
        icon={<ArrowRight size={17} />}
        label="前进"
        onClick={onForward}
        disabled={!canForward}
      />

      <div className={styles.spacer} data-tauri-drag-region>
        {title ? <span className={styles.title}>{title}</span> : null}
      </div>

      <Btn
        icon={<PanelRight size={17} />}
        label="折叠右栏"
        onClick={onToggleRight}
        active={rightOpen}
      />
    </div>
  );
}
