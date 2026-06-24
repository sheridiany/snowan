import { useEffect, useState } from 'react';
import { Button, Markdown, Text } from '@lobehub/ui';
import { App, Checkbox, Dropdown, Input, Modal, Spin, Switch } from 'antd';
import { createStyles } from 'antd-style';
import { ChevronRight, DownloadCloud, Layers, MoreHorizontal, Plus, Zap } from 'lucide-react';
import {
  listSkills,
  getSkill,
  createSkill,
  updateSkill,
  setEnabled,
  deleteSkill,
  discoverExternalSkills,
  importSkills,
  type Skill,
  type SkillDetail,
  type ExternalSkill,
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
  hint: css`
    font-size: 11.5px;
    line-height: 1.5;
    color: ${token.colorTextTertiary};
  `,
  badge: css`
    display: inline-flex;
    align-items: center;
    height: 17px;
    padding: 0 6px;
    margin-left: 6px;
    border-radius: 5px;
    font-size: 10.5px;
    font-weight: 500;
    letter-spacing: 0.02em;
    color: ${token.colorTextTertiary};
    background: ${token.colorFillSecondary};
    vertical-align: middle;
  `,
  headBtns: css`
    display: flex;
    flex: none;
    gap: 8px;
  `,
  impHead: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  `,
  impList: css`
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 52vh;
    overflow-y: auto;
  `,
  impRow: css`
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 10px 8px;
    border-radius: 8px;
    cursor: pointer;
    &:hover {
      background: ${token.colorFillQuaternary};
    }
  `,
  impRowDone: css`
    opacity: 0.5;
    cursor: default;
    &:hover {
      background: transparent;
    }
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
          <span className={styles.label}>英文名称</span>
          <Input value={name} disabled={!!edit} onChange={(e) => setName(e.target.value)} placeholder="例如 weekly-report" />
          <span className={styles.hint}>
            {edit ? '名称创建后不能修改。' : '用小写英文和连字符,作为这个技能的唯一标识。'}
          </span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>何时触发(描述什么任务该用它)</span>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="例如 当用户要写周报时" />
        </div>
        <div className={styles.field}>
          <span className={styles.label}>步骤(Markdown)</span>
          <Input.TextArea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            autoSize={{ minRows: 8, maxRows: 18 }}
            placeholder={'# 写周报\n\n1. 汇总本周完成的事项\n2. 列出下周计划\n3. 整理成简洁的几段话'}
          />
          <span className={styles.hint}>用 Markdown 写下助手该照着做的步骤。</span>
        </div>
      </div>
    </Modal>
  );
}

function ImportModal({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const { styles, cx } = useStyles();
  const { message } = App.useApp();
  const [items, setItems] = useState<ExternalSkill[] | null>(null);
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setItems(null);
    setSel({});
    discoverExternalSkills()
      .then(setItems)
      .catch(() => setItems([]));
  }, [open]);

  const importable = (items ?? []).filter((s) => !s.already);
  const selCount = Object.values(sel).filter(Boolean).length;
  const allSel = importable.length > 0 && importable.every((s) => sel[s.path]);
  const toggleAll = () => {
    if (allSel) return setSel({});
    const next: Record<string, boolean> = {};
    importable.forEach((s) => (next[s.path] = true));
    setSel(next);
  };
  const doImport = async () => {
    const paths = importable.filter((s) => sel[s.path]).map((s) => s.path);
    if (!paths.length) return;
    setBusy(true);
    try {
      const r = await importSkills(paths);
      message.success(`已导入 ${r.imported.length} 个技能(默认关闭,按需启用)`);
      onDone();
      onClose();
    } catch {
      message.error('导入失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="从其它 Agent 导入技能"
      open={open}
      onCancel={onClose}
      onOk={doImport}
      okText={selCount ? `导入 ${selCount} 个` : '导入'}
      okButtonProps={{ disabled: !selCount }}
      cancelText="取消"
      confirmLoading={busy}
      width={600}
      destroyOnHidden
    >
      {items === null ? (
        <div className={styles.empty}>
          <Spin />
        </div>
      ) : items.length === 0 ? (
        <div className={styles.empty}>
          <Layers size={26} />
          没有发现可导入的技能
          <div className={styles.hint} style={{ maxWidth: 340, textAlign: 'center' }}>
            会扫描 ~/.claude/skills 与 ~/.agents/skills(Claude Code 等使用的标准目录)。把其它 Agent 的技能放到那里后再试。
          </div>
        </div>
      ) : (
        <div style={{ paddingTop: 4 }}>
          <div className={styles.impHead}>
            <span className={styles.hint}>
              发现 {items.length} 个 · 可导入 {importable.length} 个
            </span>
            <Button size="small" type="text" onClick={toggleAll} disabled={!importable.length}>
              {allSel ? '取消全选' : '全选'}
            </Button>
          </div>
          <div className={styles.impList}>
            {items.map((s) => (
              <label key={s.path} className={cx(styles.impRow, s.already && styles.impRowDone)}>
                <Checkbox
                  checked={!!sel[s.path]}
                  disabled={s.already}
                  onChange={(e) => setSel((p) => ({ ...p, [s.path]: e.target.checked }))}
                />
                <div className={styles.body}>
                  <div className={styles.name}>
                    {s.name}
                    <span className={styles.badge}>{s.source}</span>
                  </div>
                  <div className={styles.desc} style={s.description ? undefined : { fontStyle: 'italic' }}>
                    {s.description || '未填写说明'}
                  </div>
                </div>
                {s.already && <span className={styles.hint}>已导入</span>}
              </label>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function SettingsSkills() {
  const { styles, cx } = useStyles();
  const { message, modal } = App.useApp();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [openSet, setOpenSet] = useState<Record<string, SkillDetail | 'loading'>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<SkillDetail | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const load = () => {
    setLoadError(false);
    return listSkills()
      .then((list) => {
        setSkills(list);
        setLoaded(true);
      })
      .catch(() => setLoadError(true));
  };
  useEffect(() => {
    load();
  }, []);

  const toggle = async (s: Skill) => {
    const enabled = !s.enabled;
    setSkills((prev) => prev.map((x) => (x.name === s.name ? { ...x, enabled } : x)));
    try {
      await setEnabled(s.name, enabled);
    } catch {
      setSkills((prev) => prev.map((x) => (x.name === s.name ? { ...x, enabled: s.enabled } : x)));
      message.error('保存失败');
    }
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

  const startEdit = (name: string) =>
    getSkill(name)
      .then((d) => setEditing(d))
      .catch(() => message.error('加载技能失败'));

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
        <div className={styles.headBtns}>
          <Button icon={<DownloadCloud size={15} />} onClick={() => setImportOpen(true)}>
            导入
          </Button>
          <Button type="primary" icon={<Plus size={15} />} onClick={() => setAddOpen(true)}>
            添加技能
          </Button>
        </div>
      </div>

      {!loaded && !loadError ? (
        <div className={styles.empty}>
          <Spin />
        </div>
      ) : loadError ? (
        <div className={styles.empty}>
          <Zap size={28} />
          加载失败
          <Button size="small" onClick={() => load()}>
            重试
          </Button>
        </div>
      ) : skills.length === 0 ? (
        <div className={styles.empty}>
          <Zap size={28} />
          还没有技能
          <div className={styles.hint} style={{ maxWidth: 280, textAlign: 'center' }}>
            技能是你教助手处理常见任务的步骤,需要时它会自动按步骤执行。
          </div>
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
                    <div className={styles.name}>
                      {s.name}
                      {s.source === 'imported' && <span className={styles.badge}>导入</span>}
                    </div>
                    <div className={styles.desc} style={s.description ? undefined : { fontStyle: 'italic' }}>
                      {s.description || '未填写说明'}
                    </div>
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
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} onDone={load} />
    </div>
  );
}
