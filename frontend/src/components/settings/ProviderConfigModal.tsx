import { useEffect, useState } from 'react';
import { App, Input, Modal } from 'antd';
import { createStyles } from 'antd-style';
import { configureProvider, type ProviderInfo } from '../../api/providers';

const useStyles = createStyles(({ token, css }) => ({
  field: css`
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 16px;
  `,
  label: css`
    font-size: 13px;
    font-weight: 500;
    color: ${token.colorText};
  `,
  hint: css`
    font-size: 11.5px;
    color: ${token.colorTextTertiary};
  `,
}));

export function ProviderConfigModal({
  provider,
  open,
  onClose,
  onSaved,
}: {
  provider: ProviderInfo | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { styles } = useStyles();
  const { message } = App.useApp();
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && provider) {
      setName(provider.name);
      setBaseUrl(provider.base_url ?? '');
      setApiKey('');
    }
  }, [open, provider]);

  if (!provider) return null;

  const showBaseUrl = provider.kind === 'openai' || provider.kind === 'custom';
  const isCustom = provider.kind === 'custom';

  const save = async () => {
    setSaving(true);
    try {
      const patch: { name?: string; base_url?: string; api_key?: string } = {};
      if (isCustom) patch.name = name.trim();
      if (showBaseUrl) patch.base_url = baseUrl.trim();
      if (apiKey) patch.api_key = apiKey;
      await configureProvider(provider.id, patch);
      message.success('已保存');
      onSaved();
    } catch (e) {
      message.error(`保存失败:${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`配置 ${provider.name}`}
      open={open}
      onCancel={onClose}
      onOk={save}
      okText="保存"
      cancelText="取消"
      confirmLoading={saving}
      width={460}
      destroyOnHidden
    >
      <div style={{ paddingTop: 8 }}>
        {isCustom && (
          <div className={styles.field}>
            <span className={styles.label}>名称</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        )}
        {showBaseUrl && (
          <div className={styles.field}>
            <span className={styles.label}>Base URL</span>
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://…/v1"
            />
          </div>
        )}
        <div className={styles.field}>
          <span className={styles.label}>API Key</span>
          <Input.Password
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={provider.has_api_key ? '已保存 · 留空保持不变' : '粘贴 API Key'}
          />
          <span className={styles.hint}>密钥仅保存在本机 ~/.snowan/config.json(权限 600)</span>
        </div>
      </div>
    </Modal>
  );
}
