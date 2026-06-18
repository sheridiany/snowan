import { useMemo, useState } from 'react';
import { App, Button, Input, Modal } from 'antd';
import { createStyles } from 'antd-style';
import { Check, Eye, Trash2, Wand2 } from 'lucide-react';
import {
  addModel,
  deleteModel,
  discoverModels,
  probeVision,
  setActive,
  testModel,
  type Active,
  type ModelInfo,
  type ProviderInfo,
} from '../../api/providers';
import { CapabilityTag } from './CapabilityTags';

type RowAction = 'active' | 'test' | 'probe' | 'delete';

const useStyles = createStyles(({ token, css }) => ({
  toolbar: css`
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  `,
  addRow: css`
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  `,
  list: css`
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 360px;
    overflow-y: auto;
    margin: 0 -4px;
    padding: 0 4px;
  `,
  empty: css`
    padding: 28px 0;
    text-align: center;
    font-size: 13px;
    color: ${token.colorTextTertiary};
  `,
  row: css`
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 12px;
    border-radius: ${token.borderRadius + 2}px;
    background: ${token.colorFillQuaternary};
  `,
  rowActive: css`
    box-shadow: inset 0 0 0 1.5px ${token.colorPrimary};
    background: ${token.colorPrimaryBg};
  `,
  meta: css`
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  `,
  mName: css`
    font-size: 13.5px;
    font-weight: 500;
    color: ${token.colorText};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  mId: css`
    font-size: 11.5px;
    color: ${token.colorTextTertiary};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  actions: css`
    flex: none;
    display: flex;
    align-items: center;
    gap: 4px;
  `,
}));

export function ModelManageModal({
  provider,
  active,
  open,
  onClose,
  onChanged,
}: {
  provider: ProviderInfo;
  active: Active;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { styles, cx } = useStyles();
  const { message } = App.useApp();
  const [query, setQuery] = useState('');
  const [newId, setNewId] = useState('');
  const [adding, setAdding] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [busy, setBusy] = useState<{ modelId: string; action: RowAction } | null>(null);

  const canDiscover = provider.kind === 'openai' || provider.kind === 'custom';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return provider.models;
    return provider.models.filter(
      (m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q),
    );
  }, [provider.models, query]);

  const isActiveModel = (m: ModelInfo) =>
    active.provider === provider.id && active.model === m.id;

  const handleDiscover = async () => {
    setDiscovering(true);
    try {
      const { added, total } = await discoverModels(provider.id);
      message.success(`发现 ${total} 个模型,新增 ${added.length} 个`);
      onChanged();
    } catch (e) {
      message.error(`自动发现失败:${(e as Error).message}`);
    } finally {
      setDiscovering(false);
    }
  };

  const handleAdd = async () => {
    const id = newId.trim();
    if (!id) return;
    setAdding(true);
    try {
      await addModel(provider.id, { id });
      message.success(`已添加 ${id}`);
      setNewId('');
      onChanged();
    } catch (e) {
      message.error(`添加失败:${(e as Error).message}`);
    } finally {
      setAdding(false);
    }
  };

  const run = async (modelId: string, action: RowAction, fn: () => Promise<void>) => {
    setBusy({ modelId, action });
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  const handleSetActive = (m: ModelInfo) =>
    run(m.id, 'active', async () => {
      try {
        await setActive(provider.id, m.id);
        message.success(`已设为默认:${m.name}`);
        onChanged();
      } catch (e) {
        message.error(`设置失败:${(e as Error).message}`);
      }
    });

  const handleTest = (m: ModelInfo) =>
    run(m.id, 'test', async () => {
      try {
        const r = await testModel(provider.id, m.id);
        if (r.ok) message.success(r.message || '连接正常');
        else message.error(r.message || '测试失败');
      } catch (e) {
        message.error(`测试失败:${(e as Error).message}`);
      }
    });

  const handleProbe = (m: ModelInfo) =>
    run(m.id, 'probe', async () => {
      try {
        const r = await probeVision(provider.id, m.id);
        message.info(r.message || '检测完成');
        onChanged();
      } catch (e) {
        message.error(`检测失败:${(e as Error).message}`);
      }
    });

  const handleDelete = (m: ModelInfo) =>
    run(m.id, 'delete', async () => {
      try {
        await deleteModel(provider.id, m.id);
        message.success(`已删除 ${m.name}`);
        onChanged();
      } catch (e) {
        message.error(`删除失败:${(e as Error).message}`);
      }
    });

  return (
    <Modal
      title={`${provider.name} · 模型管理`}
      open={open}
      onCancel={onClose}
      footer={null}
      width={560}
      destroyOnHidden
    >
      <div className={styles.toolbar}>
        <Input
          allowClear
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索模型 id 或名称"
        />
        {canDiscover && (
          <Button icon={<Wand2 size={15} />} loading={discovering} onClick={handleDiscover}>
            自动发现
          </Button>
        )}
      </div>

      <div className={styles.addRow}>
        <Input
          value={newId}
          onChange={(e) => setNewId(e.target.value)}
          onPressEnter={handleAdd}
          placeholder="输入模型 id 手动添加"
        />
        <Button type="primary" loading={adding} disabled={!newId.trim()} onClick={handleAdd}>
          添加
        </Button>
      </div>

      <div className={styles.list}>
        {filtered.length === 0 ? (
          <div className={styles.empty}>
            {provider.models.length === 0 ? '暂无模型,先添加或自动发现' : '没有匹配的模型'}
          </div>
        ) : (
          filtered.map((m) => {
            const isActive = isActiveModel(m);
            return (
              <div key={m.id} className={cx(styles.row, isActive && styles.rowActive)}>
                <div className={styles.meta}>
                  <span className={styles.mName}>{m.name}</span>
                  {m.name !== m.id && <span className={styles.mId}>{m.id}</span>}
                </div>
                <CapabilityTag model={m} />
                <div className={styles.actions}>
                  <Button
                    size="small"
                    type={isActive ? 'text' : 'default'}
                    icon={isActive ? <Check size={14} /> : undefined}
                    disabled={isActive}
                    loading={busy?.modelId === m.id && busy.action === 'active'}
                    onClick={() => handleSetActive(m)}
                  >
                    {isActive ? '默认' : '设为默认'}
                  </Button>
                  <Button
                    size="small"
                    loading={busy?.modelId === m.id && busy.action === 'test'}
                    onClick={() => handleTest(m)}
                  >
                    测试
                  </Button>
                  <Button
                    size="small"
                    icon={<Eye size={14} />}
                    loading={busy?.modelId === m.id && busy.action === 'probe'}
                    onClick={() => handleProbe(m)}
                  >
                    检测视觉
                  </Button>
                  <Button
                    size="small"
                    type="text"
                    danger
                    icon={<Trash2 size={14} />}
                    loading={busy?.modelId === m.id && busy.action === 'delete'}
                    onClick={() => handleDelete(m)}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </Modal>
  );
}
