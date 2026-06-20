import { useEffect, useState } from 'react';
import { Button, Text } from '@lobehub/ui';
import { App, Dropdown, Input, InputNumber, Modal, Select, Spin, Tag } from 'antd';
import { createStyles } from 'antd-style';
import {
  Brain,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { Section } from './_kit';
import {
  listEntries,
  createEntry,
  updateEntry,
  deleteEntry,
  getProfile,
  saveProfile,
  consolidate,
  applyConsolidation,
  type MemoryEntry,
  type MemoryType,
  type ConsolidationDiff,
  type DiffItem,
} from '../../api/memory';

const TYPE_LABELS: Record<MemoryType, string> = {
  fact: '事实',
  preference: '偏好',
  decision: '决定',
  project: '项目',
  todo: '待办',
  person: '人物',
};
const TYPE_OPTIONS = (Object.keys(TYPE_LABELS) as MemoryType[]).map((t) => ({
  value: t,
  label: TYPE_LABELS[t],
}));

const KIND_LABELS: Record<DiffItem['kind'], string> = {
  add: '新增',
  update: '更新',
  deprecate: '弃用',
  promote: '提升到画像',
};
const KIND_COLORS: Record<DiffItem['kind'], string> = {
  add: 'success',
  update: 'processing',
  deprecate: 'warning',
  promote: 'purple',
};

const useStyles = createStyles(({ token, css }) => ({
  wrap: css`
    display: flex;
    flex-direction: column;
    gap: 28px;
  `,
  note: css`
    font-size: 12.5px;
    line-height: 1.6;
    color: ${token.colorTextTertiary};
  `,
  profileFoot: css`
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 10px;
  `,
  toolbar: css`
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 4px;
  `,
  cards: css`
    display: flex;
    flex-direction: column;
    gap: 10px;
  `,
  card: css`
    display: flex;
    align-items: flex-start;
    gap: 11px;
    padding: 12px 12px 12px 13px;
    border-radius: ${token.borderRadiusLG}px;
    border: 1px solid ${token.colorBorderSecondary};
    background: ${token.colorFillQuaternary};
  `,
  cardIcon: css`
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
  cardBody: css`
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
  `,
  cardContent: css`
    font-size: 13.5px;
    line-height: 1.55;
    color: ${token.colorText};
    word-break: break-word;
  `,
  meta: css`
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    font-size: 11.5px;
    color: ${token.colorTextTertiary};
  `,
  cardMenu: css`
    flex: none;
    width: 26px;
    height: 26px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: ${token.borderRadiusSM}px;
    color: ${token.colorTextTertiary};
    cursor: pointer;
    &:hover {
      background: ${token.colorFillSecondary};
      color: ${token.colorText};
    }
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
  inline: css`
    display: flex;
    gap: 12px;
  `,
  diffList: css`
    display: flex;
    flex-direction: column;
    gap: 10px;
  `,
  diffItem: css`
    display: flex;
    gap: 11px;
    padding: 12px 13px;
    border-radius: ${token.borderRadiusLG}px;
    border: 1px solid ${token.colorBorderSecondary};
    background: ${token.colorBgContainer};
  `,
  diffDropped: css`
    opacity: 0.5;
  `,
  diffBody: css`
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
  `,
  diffContent: css`
    font-size: 13px;
    line-height: 1.55;
    color: ${token.colorText};
    word-break: break-word;
  `,
  diffReason: css`
    font-size: 12px;
    line-height: 1.5;
    color: ${token.colorTextTertiary};
  `,
  evidence: css`
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  `,
}));

function relTime(iso: string | null): string {
  if (!iso) return '从未召回';
  const days = Math.max(0, (Date.now() - new Date(iso).getTime()) / 86400000);
  if (days < 1) return '今天召回';
  if (days < 30) return `${Math.round(days)} 天前召回`;
  return `${Math.round(days / 30)} 个月前召回`;
}

function EntryModal({
  open,
  edit,
  onClose,
  onDone,
}: {
  open: boolean;
  edit?: MemoryEntry | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { styles } = useStyles();
  const { message } = App.useApp();
  const [content, setContent] = useState('');
  const [type, setType] = useState<MemoryType>('fact');
  const [importance, setImportance] = useState(3);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setContent(edit?.content ?? '');
      setType(edit?.type ?? 'fact');
      setImportance(edit?.importance ?? 3);
    }
  }, [open, edit]);

  const save = async () => {
    if (!content.trim()) return message.warning('需要内容');
    setSaving(true);
    try {
      if (edit) await updateEntry(edit.id, { content: content.trim(), type, importance });
      else await createEntry({ content: content.trim(), type, importance });
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
      title={edit ? '编辑记忆' : '新建记忆'}
      open={open}
      onCancel={onClose}
      onOk={save}
      okText="保存"
      cancelText="取消"
      confirmLoading={saving}
      width={520}
      destroyOnHidden
    >
      <div style={{ paddingTop: 6 }}>
        <div className={styles.field}>
          <span className={styles.label}>内容</span>
          <Input.TextArea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            autoSize={{ minRows: 3, maxRows: 8 }}
            placeholder="一条原子化的事实,如「喜欢用中文交流」"
          />
        </div>
        <div className={styles.inline}>
          <div className={styles.field} style={{ flex: 1 }}>
            <span className={styles.label}>类型</span>
            <Select value={type} options={TYPE_OPTIONS} onChange={setType} />
          </div>
          <div className={styles.field} style={{ width: 120 }}>
            <span className={styles.label}>重要度(1-5)</span>
            <InputNumber
              value={importance}
              min={1}
              max={5}
              onChange={(v) => setImportance(v ?? 3)}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default function SettingsMemory() {
  const { styles, cx } = useStyles();
  const { message, modal } = App.useApp();

  // L3 profile
  const [profile, setProfile] = useState('');
  const [savedProfile, setSavedProfile] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // L2 entries
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<MemoryEntry | null>(null);

  // consolidation
  const [diff, setDiff] = useState<ConsolidationDiff | null>(null);
  const [proposing, setProposing] = useState(false);
  const [applying, setApplying] = useState(false);

  const loadEntries = () => {
    setLoadError(false);
    return listEntries()
      .then((list) => {
        setEntries(list);
        setLoaded(true);
      })
      .catch(() => setLoadError(true));
  };

  useEffect(() => {
    getProfile()
      .then((p) => {
        setProfile(p.text);
        setSavedProfile(p.text);
      })
      .catch(() => undefined);
    loadEntries();
  }, []);

  const profileDirty = profile !== savedProfile;
  const persistProfile = async () => {
    setSavingProfile(true);
    try {
      const p = await saveProfile(profile);
      setProfile(p.text);
      setSavedProfile(p.text);
      message.success('已保存');
    } catch {
      message.error('保存失败,请重试');
    } finally {
      setSavingProfile(false);
    }
  };

  const remove = (e: MemoryEntry) =>
    modal.confirm({
      title: '删除这条记忆?',
      content: e.content,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        const prev = entries;
        setEntries((list) => list.filter((x) => x.id !== e.id)); // optimistic
        try {
          await deleteEntry(e.id);
          message.success('已删除');
        } catch {
          setEntries(prev); // revert on failure
          message.error('删除失败');
        }
      },
    });

  const propose = async () => {
    setProposing(true);
    setDiff(null);
    try {
      setDiff(await consolidate());
    } catch {
      message.error('整理失败,请重试');
    } finally {
      setProposing(false);
    }
  };

  const toggleItem = (idx: number) =>
    setDiff((d) =>
      d
        ? {
            ...d,
            items: d.items.map((it, i) => (i === idx ? { ...it, approved: !it.approved } : it)),
          }
        : d,
    );

  const apply = async () => {
    if (!diff) return;
    const approved = diff.items.filter((it) => it.approved).length;
    if (approved === 0) return message.warning('没有勾选任何改动');
    setApplying(true);
    try {
      await applyConsolidation(diff);
      message.success(`已应用 ${approved} 项改动`);
      setDiff(null);
      await loadEntries();
      const p = await getProfile().catch(() => null);
      if (p) {
        setProfile(p.text);
        setSavedProfile(p.text);
      }
    } catch {
      message.error('应用失败,请重试');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className={styles.wrap}>
      {/* L3 — 画像 */}
      <Section
        title="画像"
        subtitle="关于你的稳定身份与偏好,每轮对话都会注入。只在你保存或批准整理时才会写入。"
        bare
      >
        <Input.TextArea
          value={profile}
          onChange={(e) => setProfile(e.target.value)}
          autoSize={{ minRows: 5, maxRows: 16 }}
          placeholder={'# 画像\n\n- 称呼:…\n- 偏好:…'}
        />
        <div className={styles.profileFoot}>
          <Button
            type="primary"
            size="small"
            disabled={!profileDirty}
            loading={savingProfile}
            onClick={persistProfile}
          >
            保存
          </Button>
        </div>
      </Section>

      {/* L2 — 记忆条目 */}
      <Section bare>
        <div className={styles.toolbar}>
          <Text style={{ fontSize: 15, fontWeight: 700, flex: 1 }}>记忆条目</Text>
          <Button type="primary" icon={<Plus size={15} />} onClick={() => setAddOpen(true)}>
            新建
          </Button>
        </div>
        <Text className={styles.note} style={{ padding: '0 2px 6px' }}>
          助手从日常对话中distill出的原子事实。越常被召回的记忆越牢固;少用的会慢慢沉底,但不会被删除。
        </Text>

        {!loaded && !loadError ? (
          <div className={styles.empty}>
            <Spin />
          </div>
        ) : loadError ? (
          <div className={styles.empty}>
            <Brain size={28} />
            加载失败
            <Button size="small" onClick={() => loadEntries()}>
              重试
            </Button>
          </div>
        ) : entries.length === 0 ? (
          <div className={styles.empty}>
            <Brain size={28} />
            还没有记忆条目
            <Button size="small" onClick={() => setAddOpen(true)}>
              新建第一条
            </Button>
          </div>
        ) : (
          <div className={styles.cards}>
            {entries.map((e) => (
              <div key={e.id} className={styles.card}>
                <span className={styles.cardIcon}>
                  <Brain size={16} />
                </span>
                <div className={styles.cardBody}>
                  <div className={styles.cardContent}>{e.content}</div>
                  <div className={styles.meta}>
                    <Tag bordered={false}>{TYPE_LABELS[e.type] ?? e.type}</Tag>
                    <span>重要度 {e.importance}</span>
                    <span>·</span>
                    <span>强度 {e.strength.toFixed(1)}</span>
                    <span>·</span>
                    <span>{relTime(e.last_recalled)}</span>
                  </div>
                </div>
                <Dropdown
                  trigger={['click']}
                  menu={{
                    items: [
                      { key: 'edit', label: '编辑' },
                      { key: 'remove', label: '删除', danger: true },
                    ],
                    onClick: ({ key }) => (key === 'edit' ? setEditing(e) : remove(e)),
                  }}
                >
                  <span className={styles.cardMenu} role="button" tabIndex={0} aria-label="更多操作">
                    <MoreHorizontal size={16} />
                  </span>
                </Dropdown>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* 整理 — consolidation governance gate */}
      <Section
        title="整理"
        subtitle="让助手回顾日志与现有记忆,提出一份可审阅的改动清单。在你勾选并应用之前,什么都不会被写入。"
        bare
      >
        <div className={styles.toolbar}>
          <Button
            icon={<Sparkles size={15} />}
            loading={proposing}
            onClick={propose}
          >
            整理记忆
          </Button>
          {diff && (
            <Button size="small" type="text" icon={<RefreshCw size={14} />} onClick={propose}>
              重新整理
            </Button>
          )}
        </div>

        {proposing ? (
          <div className={styles.empty}>
            <Spin />
            正在回顾与提议…
          </div>
        ) : diff && diff.items.length === 0 ? (
          <Text className={styles.note}>没有需要整理的改动,记忆已是最新。</Text>
        ) : diff ? (
          <>
            {diff.summary && (
              <Text className={styles.note} style={{ marginBottom: 4 }}>
                {diff.summary}
              </Text>
            )}
            <div className={styles.diffList}>
              {diff.items.map((it, i) => (
                <label key={i} className={cx(styles.diffItem, !it.approved && styles.diffDropped)}>
                  <input
                    type="checkbox"
                    checked={it.approved}
                    onChange={() => toggleItem(i)}
                    style={{ marginTop: 3 }}
                  />
                  <div className={styles.diffBody}>
                    <div className={styles.meta}>
                      <Tag color={KIND_COLORS[it.kind]} bordered={false}>
                        {KIND_LABELS[it.kind]}
                      </Tag>
                      {it.type && <span>{TYPE_LABELS[it.type] ?? it.type}</span>}
                    </div>
                    {it.content && <div className={styles.diffContent}>{it.content}</div>}
                    <div className={styles.diffReason}>{it.reason}</div>
                    {it.evidence && it.evidence.length > 0 && (
                      <div className={styles.evidence}>
                        {it.evidence.map((ev) => (
                          <Tag key={ev} bordered={false}>
                            {ev}
                          </Tag>
                        ))}
                      </div>
                    )}
                  </div>
                </label>
              ))}
            </div>
            <div className={styles.profileFoot}>
              <Button type="primary" loading={applying} onClick={apply}>
                应用
              </Button>
            </div>
          </>
        ) : null}
      </Section>

      <EntryModal open={addOpen} onClose={() => setAddOpen(false)} onDone={loadEntries} />
      <EntryModal
        open={!!editing}
        edit={editing}
        onClose={() => setEditing(null)}
        onDone={loadEntries}
      />
    </div>
  );
}
