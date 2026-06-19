import { useEffect, useState } from 'react';
import { Button, Markdown, Text } from '@lobehub/ui';
import { App, Dropdown, Input, Modal, Switch } from 'antd';
import { createStyles } from 'antd-style';
import { ChevronRight, MoreHorizontal, Plus, Zap } from 'lucide-react';
import {
  listSkills,
  getSkill,
  createSkill,
  updateSkill,
  setEnabled,
  deleteSkill,
  type Skill,
  type SkillDetail,
} from '../../api/skills';

const useStyles = createStyles(({ token, css }) => ({
  wrap: css`
    display: flex;
    flex-direction: column;
    gap: 16px;
  `,
  head: css`
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  `,
  title: css`
    font-size: 15px;
    font-weight: 700;
    color: ${token.colorText};
  `,
  sub: css`
    font-size: 12.5px;
    line-height: 1.6;
    color: ${token.colorTextTertiary};
    margin-top: 2px;
  `,
  cards: css`
    display: flex;
    flex-direction: column;
    gap: 10px;
  `,
  card: css`
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorFillQuaternary};
    overflow: hidden;
  `,
  cardHead: css`
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 12px 14px;
    cursor: pointer;
  `,
  icon: css`
    flex: none;
    width: 30px;
    height: 30px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    background: ${token.colorPrimaryBg};
    color: ${token.colorPrimary};
  `,
  body: css`
    flex: 1;
    min-width: 0;
  `,
  name: css`
    font-size: 13.5px;
    font-weight: 600;
    color: ${token.colorText};
  `,
  desc: css`
    font-size: 12px;
    color: ${token.colorTextTertiary};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  chevron: css`
    flex: none;
    color: ${token.colorTextQuaternary};
    transition: transform 0.15s ease;
  `,
  chevronOpen: css`
    transform: rotate(90deg);
  `,
  preview: css`
    border-top: 1px solid ${token.colorBorderSecondary};
    padding: 10px 16px 14px;
    font-size: 13px;
  `,
  empty: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 36px 0;
    color: ${token.colorTextTertiary};
    font-size: 13px;
  `,
  field: css`
    display: flex;
    flex-direction: column;
    gap: 5px;
    margin-bottom: 12px;
  `,
  label: css`
    font-size: 12.5px;
    color: ${token.colorTextSecondary};
  `,
}));

function SkillModal({
  open,
  edit,
  onClose,
  onDone,
}: {
  open: boolean;
  edit?: SkillDetail | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { styles } = useStyles();
  const { message } = App.useApp();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(edit?.name ?? '');
      setDescription(edit?.description ?? '');
      setBody(edit?.body ?? '');
    }
  }, [open, edit]);

  const save = async () => {
    if (!name.trim() || !body.trim()) return message.warning('需要名称和内容');
    setSaving(true);
    try {
      if (edit) await updateSkill(edit.name, { description, body });
      else await createSkill(name.trim(), description, body);
      message.success('已保存');
      onDone();
      onClose();
    } catch {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={edit ? '编辑技能' : '添加技能'}
      open={open}
      onCancel={onClose}
      onOk={save}
      okText="保存"
      cancelText="取消"
      confirmLoading={saving}
      width={560}
      destroyOnHidden
    >
      <div style={{ paddingTop: 6 }}>
        <div className={styles.field}>
          <span className={styles.label}>名称(英文标识)</span>
          <Input value={name} disabled={!!edit} onChange={(e) => setName(e.target.value)} placeholder="weekly-report" />
        </div>
        <div className={styles.field}>
          <span className={styles.label}>什么时候用它</span>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="当用户要写周报时" />
        </div>
        <div className={styles.field}>
          <span className={styles.label}>步骤(Markdown)</span>
          <Input.TextArea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            autoSize={{ minRows: 8, maxRows: 18 }}
            placeholder={'# 周报\n\n1. 汇总本周完成的事…\n2. …'}
          />
        </div>
      </div>
    </Modal>
  );
}

export default function SettingsSkills() {
  const { styles, cx } = useStyles();
  const { message, modal } = App.useApp();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [openSet, setOpenSet] = useState<Record<string, SkillDetail | 'loading'>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<SkillDetail | null>(null);

  const load = () => listSkills().then(setSkills).catch(() => {});
  useEffect(() => {
    load();
  }, []);

  const toggle = async (s: Skill) => {
    const enabled = !s.enabled;
    setSkills((prev) => prev.map((x) => (x.name === s.name ? { ...x, enabled } : x)));
    await setEnabled(s.name, enabled).catch(() => {});
  };

  const expand = (name: string) => {
    setOpenSet((prev) => {
      const n = { ...prev };
      if (n[name]) {
        delete n[name];
        return n;
      }
      n[name] = 'loading';
      getSkill(name)
        .then((d) => setOpenSet((p) => ({ ...p, [name]: d })))
        .catch(() => setOpenSet((p) => ({ ...p, [name]: { name, description: '', enabled: true, body: '加载失败' } })));
      return n;
    });
  };

  const startEdit = (name: string) => getSkill(name).then((d) => setEditing(d));

  const remove = (name: string) =>
    modal.confirm({
      title: `移除技能 ${name}?`,
      okText: '移除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        await deleteSkill(name);
        setSkills((prev) => prev.filter((s) => s.name !== name));
        message.success('已移除');
      },
    });

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <div>
          <Text className={styles.title}>技能</Text>
          <div className={styles.sub}>
            教助手「怎么做某类事」的流程。相关时它会自动加载并照着做。启用的技能会注入到它的指令里。
          </div>
        </div>
        <Button type="primary" icon={<Plus size={15} />} onClick={() => setAddOpen(true)}>
          添加技能
        </Button>
      </div>

      {skills.length === 0 ? (
        <div className={styles.empty}>
          <Zap size={28} />
          还没有技能
          <Button size="small" onClick={() => setAddOpen(true)}>
            添加第一个
          </Button>
        </div>
      ) : (
        <div className={styles.cards}>
          {skills.map((s) => {
            const detail = openSet[s.name];
            const open = !!detail;
            return (
              <div key={s.name} className={styles.card}>
                <div className={styles.cardHead} onClick={() => expand(s.name)}>
                  <span className={styles.icon}>
                    <Zap size={16} />
                  </span>
                  <div className={styles.body}>
                    <div className={styles.name}>{s.name}</div>
                    <div className={styles.desc}>{s.description || '（无说明）'}</div>
                  </div>
                  <Switch
                    size="small"
                    checked={s.enabled}
                    onClick={(_, e) => e.stopPropagation()}
                    onChange={() => toggle(s)}
                  />
                  <span onClick={(e) => e.stopPropagation()} style={{ display: 'inline-flex' }}>
                    <Dropdown
                      trigger={['click']}
                      menu={{
                        items: [
                          { key: 'edit', label: '编辑' },
                          { key: 'remove', label: '移除', danger: true },
                        ],
                        onClick: ({ key }) => (key === 'edit' ? startEdit(s.name) : remove(s.name)),
                      }}
                    >
                      <MoreHorizontal size={16} style={{ cursor: 'pointer' }} />
                    </Dropdown>
                  </span>
                  <ChevronRight size={15} className={cx(styles.chevron, open && styles.chevronOpen)} />
                </div>
                {open && (
                  <div className={styles.preview}>
                    {detail === 'loading' ? '加载中…' : <Markdown variant="chat">{detail.body}</Markdown>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <SkillModal open={addOpen} onClose={() => setAddOpen(false)} onDone={load} />
      <SkillModal open={!!editing} edit={editing} onClose={() => setEditing(null)} onDone={load} />
    </div>
  );
}
