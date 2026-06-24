import { createStyles, cx } from 'antd-style';
import { ChevronLeft, ChevronRight, Minus, Square, X } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { PanelLeftRounded, PanelRightRounded } from './craftIcons';
import { EASING } from '../../ui/motion';
import { TYPE } from '../../theme/themes';

// macOS shows native traffic lights (Overlay titleBarStyle) on the left, so we inset
// the bar to clear them. On Windows/Linux the window is frameless (set in lib.rs), so
// we draw our own min/max/close controls on the right instead.
const IS_MAC =
  typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform || navigator.userAgent);

const useStyles = createStyles(({ token, css }) => ({
  bar: css`
    height: 44px;
    flex: none;
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 0 10px;
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
  // Windows/Linux caption buttons: full-height, flush to the right edge.
  winControls: css`
    align-self: stretch;
    display: flex;
    margin-left: 4px;
    margin-right: -10px;
  `,
  winBtn: css`
    width: 46px;
    align-self: stretch;
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${token.colorTextSecondary};
    cursor: pointer;
    transition: background 0.12s ${EASING.standard}, color 0.12s ${EASING.standard};
    &:hover {
      background: ${token.colorFillSecondary};
      color: ${token.colorText};
    }
  `,
  winClose: css`
    &:hover {
      background: #e81123;
      color: #fff;
    }
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

  const WinBtn = ({
    icon,
    label,
    onClick,
    close,
  }: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    close?: boolean;
  }) => (
    <div
      className={cx(styles.winBtn, close && styles.winClose)}
      data-tauri-drag-region="false"
      role="button"
      tabIndex={0}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {icon}
    </div>
  );

  return (
    <div
      className={styles.bar}
      data-tauri-drag-region
      // Clear the native traffic lights on macOS; flush-left on Windows/Linux.
      style={{ paddingLeft: IS_MAC ? 78 : 10, paddingRight: IS_MAC ? 10 : 0 }}
    >
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

      {!IS_MAC && (
        <div className={styles.winControls}>
          <WinBtn
            icon={<Minus size={16} strokeWidth={1.5} />}
            label="最小化"
            onClick={() => getCurrentWindow().minimize()}
          />
          <WinBtn
            icon={<Square size={13} strokeWidth={1.6} />}
            label="最大化"
            onClick={() => getCurrentWindow().toggleMaximize()}
          />
          <WinBtn
            icon={<X size={17} strokeWidth={1.6} />}
            label="关闭"
            onClick={() => getCurrentWindow().close()}
            close
          />
        </div>
      )}
    </div>
  );
}
