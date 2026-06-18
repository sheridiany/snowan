import { useState } from 'react';
import { App, Input, Modal } from 'antd';
import { createStyles } from 'antd-style';
import { createCustom } from '../../api/providers';

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

export function CustomProviderModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { styles } = useStyles();
  const { message } = App.useApp();
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName('');
    setBaseUrl('');
    setApiKey('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const save = async () => {
    if (!name.trim() || !baseUrl.trim()) {
      message.warning('请填写名称和 Base URL');
      return;
    }
    setSaving(true);
    try {
      await createCustom({
        name: name.trim(),
        base_url: baseUrl.trim(),
        ...(apiKey ? { api_key: apiKey } : {}),
      });
      message.success('已添加自定义端点');
      reset();
      onCreated();
    } catch (e) {
      message.error(`添加失败:${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="添加自定义端点"
      open={open}
      onCancel={handleClose}
      onOk={save}
      okText="添加"
      cancelText="取消"
      confirmLoading={saving}
      width={460}
      destroyOnHidden
    >
      <div style={{ paddingTop: 8 }}>
        <div className={styles.field}>
          <span className={styles.label}>名称</span>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如 我的本地模型"
          />
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Base URL</span>
          <Input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://…/v1"
          />
          <span className={styles.hint}>OpenAI 兼容端点地址</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>API Key</span>
          <Input.Password
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="粘贴 API Key（可选）"
          />
        </div>
      </div>
    </Modal>
  );
}
