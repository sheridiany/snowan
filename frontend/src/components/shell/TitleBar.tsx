import { createStyles, cx } from 'antd-style';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PanelLeftRounded, PanelRightRounded } from './craftIcons';
import { EASING } from '../../ui/motion';
import { TYPE } from '../../theme/themes';

const useStyles = createStyles(({ token, css }) => ({
  bar: css`
    height: 44px;
    flex: none;
    display: flex;
    align-items: center;
    gap: 2px;
    /* Reserve 78px on the left for macOS traffic lights (close/minimize/zoom). */
    padding: 0 10px 0 78px;
    /* Transparent so the app-shell aurora (colorSceneBg) reads through the chrome. */
    background: transparent;
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
    font-size: ${TYPE.dense}px;
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
    border: 1px solid transparent;
    transition: background 0.15s ${EASING.standard}, color 0.15s ${EASING.standard},
      border-color 0.15s ${EASING.standard}, transform 0.15s ${EASING.standard};
    &:hover {
      background: ${token.colorFillSecondary};
      border-color: ${token.colorBorderSecondary};
      color: ${token.colorText};
    }
    &:active {
      transform: scale(0.94);
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
      <Btn icon={<PanelLeftRounded size={18} />} label="折叠侧栏" onClick={onToggleNav} />
      <Btn
        icon={<ChevronLeft size={18} strokeWidth={1.5} />}
        label="后退"
        onClick={onBack}
        disabled={!canBack}
      />
      <Btn
        icon={<ChevronRight size={18} strokeWidth={1.5} />}
        label="前进"
        onClick={onForward}
        disabled={!canForward}
      />

      <div className={styles.spacer} data-tauri-drag-region>
        {title ? <span className={styles.title}>{title}</span> : null}
      </div>

      <Btn
        icon={<PanelRightRounded size={18} />}
        label="折叠右栏"
        onClick={onToggleRight}
        active={rightOpen}
      />
    </div>
  );
}
