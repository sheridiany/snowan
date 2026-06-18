import { createStyles } from 'antd-style';
import { ChevronDown, Plus, HelpCircle } from 'lucide-react';

const useStyles = createStyles(({ token, css }) => ({
  bar: css`
    height: 44px;
    flex: none;
    display: flex;
    align-items: center;
    /* Reserve 78px on the left for macOS traffic lights (close/minimize/zoom). */
    padding: 0 12px 0 78px;
    background: ${token.colorBgContainer};
    border-bottom: 1px solid ${token.colorBorderSecondary};
    /* This attribute makes the entire bar draggable in Tauri native mode. */
    /* Child elements with data-tauri-drag-region="false" opt out. */
    user-select: none;
  `,
  workspaceBtn: css`
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 4px 8px;
    border-radius: ${token.borderRadiusSM}px;
    cursor: pointer;
    transition: background 0.15s ease;
    color: ${token.colorText};
    &:hover {
      background: ${token.colorFillTertiary};
    }
  `,
  workspaceName: css`
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.01em;
    line-height: 1;
  `,
  chevron: css`
    color: ${token.colorTextTertiary};
    flex: none;
  `,
  spacer: css`
    flex: 1;
  `,
  actions: css`
    display: flex;
    align-items: center;
    gap: 4px;
  `,
  iconBtn: css`
    width: 30px;
    height: 30px;
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
}));

export default function TitleBar() {
  const { styles } = useStyles();

  return (
    <div
      className={styles.bar}
      // This attribute enables native Tauri window dragging on the entire bar.
      data-tauri-drag-region
    >
      {/* Workspace switcher — no drag so click works */}
      <div
        className={styles.workspaceBtn}
        data-tauri-drag-region="false"
        role="button"
        tabIndex={0}
        aria-label="Switch workspace"
      >
        <span className={styles.workspaceName}>My Workspace</span>
        <ChevronDown className={styles.chevron} size={14} />
      </div>

      <div className={styles.spacer} data-tauri-drag-region />

      {/* Action buttons — opt out of drag region so clicks fire */}
      <div
        className={styles.actions}
        data-tauri-drag-region="false"
      >
        <div
          className={styles.iconBtn}
          role="button"
          tabIndex={0}
          aria-label="New item"
          title="New"
        >
          <Plus size={16} />
        </div>
        <div
          className={styles.iconBtn}
          role="button"
          tabIndex={0}
          aria-label="Help"
          title="Help"
        >
          <HelpCircle size={16} />
        </div>
      </div>
    </div>
  );
}
