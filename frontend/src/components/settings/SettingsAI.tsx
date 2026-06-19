import { useEffect, useMemo, useState } from 'react';
import { App, Modal } from 'antd';
import { createStyles } from 'antd-style';
import { Check, Plus, Settings2, Trash2 } from 'lucide-react';
import {
  deleteProvider,
  listProviders,
  type Active,
  type ProviderInfo,
  type ProvidersState,
} from '../../api/providers';
import { ProviderIcon } from './providerIcon';
import { ModelManageModal } from './ModelManageModal';
import { ProviderConfigModal } from './ProviderConfigModal';
import { CustomProviderModal } from './CustomProviderModal';

const useStyles = createStyles(({ token, css }) => ({
  head: css`
    margin-bottom: 16px;
  `,
  title: css`
    font-size: 16px;
    font-weight: 600;
    color: ${token.colorText};
  `,
  sub: css`
    font-size: 13px;
    color: ${token.colorTextTertiary};
    margin-top: 2px;
  `,
  grid: css`
    display: grid;
    grid-template-columns: 1fr;
    gap: 12px;
  `,
  tile: css`
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px;
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorFillQuaternary};
    cursor: pointer;
    transition: background 0.12s ease, box-shadow 0.12s ease;
    &:hover {
      background: ${token.colorFillTertiary};
    }
  `,
  tileActive: css`
    box-shadow: inset 0 0 0 1.5px ${token.colorPrimary};
    background: ${token.colorPrimaryBg};
    &:hover {
      background: ${token.colorPrimaryBg};
    }
  `,
  icon: css`
    flex: none;
    display: inline-flex;
  `,
  body: css`
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  `,
  nameRow: css`
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  `,
  name: css`
    font-size: 14px;
    font-weight: 600;
    color: ${token.colorText};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  desc: css`
    font-size: 12px;
    color: ${token.colorTextTertiary};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  badge: css`
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 20px;
    padding: 0 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 500;
  `,
  badgeActive: css`
    color: ${token.colorPrimary};
    background: ${token.colorPrimaryBgHover};
  `,
  badgeReady: css`
    color: ${token.colorSuccess};
    background: ${token.colorSuccessBg};
  `,
  badgeIdle: css`
    color: ${token.colorTextTertiary};
    background: ${token.colorFillSecondary};
  `,
  actions: css`
    flex: none;
    display: flex;
    align-items: center;
    gap: 4px;
  `,
  actBtn: css`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 26px;
    padding: 0 9px;
    border-radius: ${token.borderRadius}px;
    border: none;
    background: ${token.colorBgContainer};
    color: ${token.colorTextSecondary};
    font-size: 12px;
    cursor: pointer;
    transition: background 0.12s ease, color 0.12s ease;
    &:hover {
      background: ${token.colorFillSecondary};
      color: ${token.colorText};
    }
  `,
  iconBtn: css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: ${token.borderRadius}px;
    border: none;
    background: ${token.colorBgContainer};
    color: ${token.colorTextTertiary};
    cursor: pointer;
    transition: background 0.12s ease, color 0.12s ease;
    &:hover {
      background: ${token.colorErrorBg};
      color: ${token.colorError};
    }
  `,
  addTile: css`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 14px;
    min-height: 72px;
    border-radius: ${token.borderRadiusLG}px;
    border: 1px dashed ${token.colorBorder};
    color: ${token.colorTextTertiary};
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
    &:hover {
      background: ${token.colorFillQuaternary};
      border-color: ${token.colorPrimary};
      color: ${token.colorPrimary};
    }
  `,
}));

const EMPTY: ProvidersState = {
  active: { provider: null, model: '' },
  active_image: { provider: null, model: '' },
  providers: [],
};

export default function SettingsAI() {
  const { styles, cx } = useStyles();
  const { message } = App.useApp();
  const [state, setState] = useState<ProvidersState>(EMPTY);
  const [manageId, setManageId] = useState<string | null>(null);
  const [configId, setConfigId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const refresh = () => listProviders().then(setState).catch(() => {});
  useEffect(() => {
    refresh();
  }, []);

  // built-ins first, customs after — stable ordering for the grid.
  const ordered = useMemo(
    () => [...state.providers].sort((a, b) => Number(a.is_custom) - Number(b.is_custom)),
    [state.providers],
  );

  const byId = (id: string | null) =>
    id ? state.providers.find((p) => p.id === id) ?? null : null;

  const active: Active = state.active;

  const handleDelete = (p: ProviderInfo) => {
    Modal.confirm({
      title: `删除 ${p.name}?`,
      content: '将移除该端点及其全部模型配置,此操作无法撤销。',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteProvider(p.id);
          message.success(`已删除 ${p.name}`);
          refresh();
        } catch (e) {
          message.error(`删除失败:${(e as Error).message}`);
        }
      },
    });
  };

  const manageProvider = byId(manageId);
  const configProvider = byId(configId);

  return (
    <div>
      <div className={styles.head}>
        <div className={styles.title}>模型提供商</div>
        <div className={styles.sub}>连接你的模型来源 · 当前使用的会用于所有新会话</div>
      </div>

      <div className={styles.grid}>
        {ordered.map((p) => {
          const isActive = active.provider === p.id;
          const ready = p.has_api_key;
          const sub = isActive && active.model ? active.model : `${p.models.length} 个模型`;
          return (
            <div
              key={p.id}
              className={cx(styles.tile, isActive && styles.tileActive)}
              onClick={() => setManageId(p.id)}
            >
              <span className={styles.icon}>
                <ProviderIcon kind={p.kind} size={40} />
              </span>
              <div className={styles.body}>
                <div className={styles.nameRow}>
                  <span className={styles.name}>{p.name}</span>
                  <span
                    className={cx(
                      styles.badge,
                      isActive
                        ? styles.badgeActive
                        : ready
                          ? styles.badgeReady
                          : styles.badgeIdle,
                    )}
                  >
                    {isActive && <Check size={11} />}
                    {isActive ? '使用中' : ready ? '已配置' : '未配置'}
                  </span>
                </div>
                <span className={styles.desc}>{sub}</span>
              </div>
              <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
                <button className={styles.actBtn} onClick={() => setManageId(p.id)}>
                  模型
                </button>
                <button className={styles.actBtn} onClick={() => setConfigId(p.id)}>
                  <Settings2 size={13} />
                  设置
                </button>
                {p.is_custom && (
                  <button
                    className={styles.iconBtn}
                    title="删除端点"
                    onClick={() => handleDelete(p)}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        <div className={styles.addTile} onClick={() => setAddOpen(true)}>
          <Plus size={16} />
          添加自定义端点
        </div>
      </div>

      {manageProvider && (
        <ModelManageModal
          provider={manageProvider}
          active={active}
          open={!!manageId}
          onClose={() => setManageId(null)}
          onChanged={refresh}
        />
      )}

      <ProviderConfigModal
        provider={configProvider}
        open={!!configId}
        onClose={() => setConfigId(null)}
        onSaved={() => {
          setConfigId(null);
          refresh();
        }}
      />

      <CustomProviderModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={() => {
          setAddOpen(false);
          refresh();
        }}
      />
    </div>
  );
}
