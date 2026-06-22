import { useEffect, useState } from 'react';
import { Button, Text } from '@lobehub/ui';
import { App, Dropdown, Input, InputNumber, Modal, Select, Spin, Switch } from 'antd';
import { createStyles, useTheme } from 'antd-style';
import { ChevronRight, Dot, MoreHorizontal, Pencil, Plus, Sparkles } from 'lucide-react';
import {
  listEntries,
  createEntry,
  updateEntry,
  deleteEntry,
  clearAllMemory,
  getProfile,
  saveProfile,
  consolidate,
  applyConsolidation,
  type MemoryEntry,
  type MemoryType,
  type ConsolidationDiff,
  type DiffItem,
} from '../../api/memory';
import { getPrefs, savePrefs } from '../../api/system';
import PersonaInterview from '../persona/PersonaInterview';

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

// Plain-language labels for each proposed change — no pipeline jargon.
const KIND_LABELS: Record<DiffItem['kind'], string> = {
  add: '新记一条',
  update: '改一改',
  deprecate: '不再使用',
  promote: '记得更牢',
};

const useStyles = createStyles(({ token, css }) => ({
  wrap: css`
    display: flex;
    flex-direction: column;
    gap: 30px;
  `,
  head: css`
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  `,
  hTitle: css`
    font-size: 15.5px;
    font-weight: 600;
    color: ${token.colorText};
  `,
  hSub: css`
    font-size: 12.5px;
    color: ${token.colorTextTertiary};
    margin-top: 2px;
    line-height: 1.5;
  `,
  link: css`
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 13px;
    color: ${token.colorTextSecondary};
    cursor: pointer;
    flex: none;
    &:hover {
      color: ${token.colorText};
    }
  `,
  profileCard: css`
    margin-top: 11px;
    background: ${token.colorBgContainer};
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    padding: 15px 18px;
    line-height: 1.8;
    color: ${token.colorTextSecondary};
    font-size: 13.5px;
  `,
  profileEmpty: css`
    color: ${token.colorTextTertiary};
  `,
  foot: css`
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 10px;
  `,
  list: css`
    display: flex;
    flex-direction: column;
    margin-top: 4px;
  `,
  row: css`
    display: flex;
    gap: 9px;
    align-items: flex-start;
    padding: 13px 4px;
    border-top: 1px solid ${token.colorBorderSecondary};
    &:last-child {
      border-bottom: 1px solid ${token.colorBorderSecondary};
    }
    &:hover .mem-menu {
      opacity: 1;
    }
  `,
  rowDot: css`
    flex: none;
    margin-top: 2px;
    color: ${token.colorTextQuaternary};
  `,
  rowBody: css`
    flex: 1;
    min-width: 0;
  `,
  rowText: css`
    font-size: 13.5px;
    line-height: 1.55;
    color: ${token.colorText};
    word-break: break-word;
  `,
  rowMeta: css`
    font-size: 11.5px;
    color: ${token.colorTextTertiary};
    margin-top: 3px;
  `,
  menu: css`
    flex: none;
    width: 24px;
    height: 24px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: ${token.borderRadiusSM}px;
    color: ${token.colorTextTertiary};
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.12s;
    &:hover {
      background: ${token.colorFillSecondary};
      color: ${token.colorText};
    }
  `,
  empty: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 34px 0;
    color: ${token.colorTextTertiary};
    font-size: 13px;
    text-align: center;
  `,
  suggest: css`
    background: ${token.colorFillQuaternary};
    border-radius: ${token.borderRadiusLG}px;
    padding: 16px 18px;
  `,
  suggestHead: css`
    display: flex;
    align-items: center;
    gap: 8px;
  `,
  diffRow: css`
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 11px 0;
    border-top: 1px solid ${token.colorBorderSecondary};
    cursor: pointer;
  `,
  diffDropped: css`
    opacity: 0.45;
  `,
  pill: css`
    display: inline-flex;
    font-size: 11.5px;
    padding: 1px 8px;
    border-radius: ${token.borderRadiusSM}px;
    margin-bottom: 3px;
  `,
  reason: css`
    font-size: 12px;
    line-height: 1.5;
    color: ${token.colorTextTertiary};
    margin-top: 2px;
  `,
  footer: css`
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: ${token.colorTextSecondary};
    font-size: 13px;
    cursor: pointer;
    &:hover {
      color: ${token.colorText};
    }
  `,
  footRow: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    border-top: 1px solid ${token.colorBorderSecondary};
    padding-top: 16px;
  `,
  footRight: css`
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 12.5px;
    color: ${token.colorTextTertiary};
  `,
  danger: css`
    color: ${token.colorError};
    cursor: pointer;
    &:hover {
      opacity: 0.8;
    }
  `,
  pausedBanner: css`
    background: ${token.colorWarningBg};
    color: ${token.colorWarningText};
    border-radius: ${token.borderRadiusLG}px;
    padding: 10px 14px;
    font-size: 12.5px;
    line-height: 1.5;
  `,
  archHead: css`
    display: inline-flex;
    align-items: center;
    gap: 5px;
    margin-top: 14px;
    font-size: 12.5px;
    color: ${token.colorTextTertiary};
    cursor: pointer;
    &:hover {
      color: ${token.colorText};
    }
  `,
  archDim: css`
    opacity: 0.55;
  `,
  field: css`
    display: flex;
    flex-direction: column;
    gap: 5px;
    margin-bottom: 12px;
  `,
  fLabel: css`
    font-size: 12.5px;
    color: ${token.colorTextSecondary};
  `,
  inline: css`
    display: flex;
    gap: 12px;
  `,
}));

// When this memory was first added, in everyday language.
function recordedAt(iso: string): string {
  const days = Math.max(0, (Date.now() - new Date(iso).getTime()) / 86400000);
  if (days < 1) return '今天';
  if (days < 30) return `${Math.round(days)} 天前`;
  return `${Math.round(days / 30)} 个月前`;
}

// Read-mode profile: drop a leading "# 画像" heading + per-line bullet markers so it
// reads like prose, not a markdown source file. Editing still shows the raw text.
function profileLines(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l, i) => !(i === 0 && l.startsWith('#')))
    .map((l) => l.replace(/^[-*]\s+/, '').replace(/^#+\s*/, '').trim())
    .filter(Boolean);
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
    if (!content.trim()) return message.warning('写点内容');
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
      title={edit ? '编辑这条记忆' : '手动添加一条'}
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
          <span className={styles.fLabel}>内容</span>
          <Input.TextArea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            autoSize={{ minRows: 3, maxRows: 8 }}
            placeholder="一句话,如「喜欢用中文交流」"
          />
        </div>
        <div className={styles.inline}>
          <div className={styles.field} style={{ flex: 1 }}>
            <span className={styles.fLabel}>类型</span>
            <Select value={type} options={TYPE_OPTIONS} onChange={setType} />
          </div>
          <div className={styles.field} style={{ width: 120 }}>
            <span className={styles.fLabel}>重要度</span>
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
  const theme = useTheme();
  const { message, modal } = App.useApp();

  const [profile, setProfile] = useState('');
  const [savedProfile, setSavedProfile] = useState('');
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileUpdated, setProfileUpdated] = useState<string | null>(null);
  const [interviewOpen, setInterviewOpen] = useState(false);

  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<MemoryEntry | null>(null);

  const [diff, setDiff] = useState<ConsolidationDiff | null>(null);
  const [proposing, setProposing] = useState(false);
  const [applying, setApplying] = useState(false);

  const [memOn, setMemOn] = useState(true);

  const [archivedOpen, setArchivedOpen] = useState(false);

  const loadEntries = () => {
    setLoadError(false);
    return listEntries(true) // include archived (deprecated) so they stay visible + restorable
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
    getPrefs()
      .then((p) => setMemOn(p.memory_enabled !== false))
      .catch(() => undefined);
    loadEntries();
  }, []);

  const toggleMem = async (v: boolean) => {
    setMemOn(v);
    try {
      await savePrefs({ memory_enabled: v });
    } catch {
      setMemOn(!v);
      message.error('保存失败');
    }
  };

  const clearAll = () =>
    modal.confirm({
      title: '清空所有记忆?',
      content: 'Snowan 会忘掉关于你的一切,包括它记得的事和对你的印象。此操作不可撤销。',
      okText: '清空',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await clearAllMemory();
          setEntries([]);
          setProfile('');
          setSavedProfile('');
          setDiff(null);
          message.success('已清空');
        } catch {
          message.error('清空失败');
        }
      },
    });

  const persistProfile = async () => {
    setSavingProfile(true);
    try {
      const p = await saveProfile(profile);
      setProfile(p.text);
      setSavedProfile(p.text);
      setProfileUpdated(new Date().toISOString());
      setEditingProfile(false);
      message.success('已保存');
    } catch {
      message.error('保存失败,请重试');
    } finally {
      setSavingProfile(false);
    }
  };

  const cancelProfile = () => {
    setProfile(savedProfile);
    setEditingProfile(false);
  };

  const reloadProfile = () =>
    getProfile()
      .then((p) => {
        setProfile(p.text);
        setSavedProfile(p.text);
        setProfileUpdated(new Date().toISOString());
      })
      .catch(() => undefined);

  const forget = (e: MemoryEntry) =>
    modal.confirm({
      title: '让 Snowan 忘掉这条?',
      content: e.content,
      okText: '忘掉',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        const prev = entries;
        setEntries((list) => list.filter((x) => x.id !== e.id));
        try {
          await deleteEntry(e.id);
        } catch {
          setEntries(prev);
          message.error('操作失败');
        }
      },
    });

  const setValid = async (e: MemoryEntry, valid: boolean) => {
    const prev = entries;
    setEntries((list) => list.map((x) => (x.id === e.id ? { ...x, valid } : x)));
    try {
      await updateEntry(e.id, { valid });
    } catch {
      setEntries(prev);
      message.error('操作失败');
    }
  };

  const propose = async () => {
    setProposing(true);
    setDiff(null);
    try {
      setDiff(await consolidate());
    } catch {
      message.error('暂时没法整理,请重试');
    } finally {
      setProposing(false);
    }
  };

  const toggleItem = (idx: number) =>
    setDiff((d) =>
      d ? { ...d, items: d.items.map((it, i) => (i === idx ? { ...it, approved: !it.approved } : it)) } : d,
    );

  const apply = async () => {
    if (!diff) return;
    const approved = diff.items.filter((it) => it.approved).length;
    if (approved === 0) return message.warning('还没勾选任何一条');
    setApplying(true);
    try {
      await applyConsolidation(diff);
      message.success(`已更新 ${approved} 条记忆`);
      setDiff(null);
      await loadEntries();
      const p = await getProfile().catch(() => null);
      if (p) {
        setProfile(p.text);
        setSavedProfile(p.text);
      }
    } catch {
      message.error('更新失败,请重试');
    } finally {
      setApplying(false);
    }
  };

  const lines = profileLines(profile);
  const active = entries.filter((e) => e.valid);
  const archived = entries.filter((e) => !e.valid);

  return (
    <div className={styles.wrap}>
      {!memOn && (
        <div className={styles.pausedBanner}>
          已暂停记忆 — 这段时间聊的内容,Snowan 不会记下来,也不会拿来参考。下面已经记得的不受影响,随时可以重新开启。
        </div>
      )}
      {/* L3 — 画像 */}
      <section>
        <div className={styles.head}>
          <div>
            <div className={styles.hTitle}>Snowan 记得你</div>
            <div className={styles.hSub}>
              对你的长期印象,会一直记着
              {profileUpdated ? ` · 刚刚更新` : ''}
            </div>
          </div>
          {!editingProfile && (
            <div style={{ display: 'flex', gap: 16, flex: 'none' }}>
              <span className={styles.link} onClick={() => setInterviewOpen(true)}>
                <Sparkles size={14} />
                让 Snowan 访谈我
              </span>
              <span className={styles.link} onClick={() => setEditingProfile(true)}>
                <Pencil size={14} />
                编辑
              </span>
            </div>
          )}
        </div>

        {editingProfile ? (
          <>
            <Input.TextArea
              style={{ marginTop: 11 }}
              value={profile}
              onChange={(e) => setProfile(e.target.value)}
              autoSize={{ minRows: 5, maxRows: 16 }}
              placeholder={'用一两句话描述你的长期偏好,如:\n喜欢用中文交流,回答要简短、结果先行。'}
            />
            <div className={styles.foot}>
              <Button size="small" onClick={cancelProfile}>
                取消
              </Button>
              <Button type="primary" size="small" loading={savingProfile} onClick={persistProfile}>
                保存
              </Button>
            </div>
          </>
        ) : (
          <div className={styles.profileCard}>
            {lines.length > 0 ? (
              lines.map((l, i) => <div key={i}>{l}</div>)
            ) : (
              <span className={styles.profileEmpty}>
                Snowan 还不太了解你。聊几句,或点「编辑」写下你的长期偏好。
              </span>
            )}
          </div>
        )}
      </section>

      {/* L2 — 记得的事 */}
      <section>
        <div className={styles.hTitle}>Snowan 记得的事</div>
        <div className={styles.hSub}>这些是 Snowan 在你们的对话里慢慢记下的。</div>

        {!loaded && !loadError ? (
          <div className={styles.empty}>
            <Spin />
          </div>
        ) : loadError ? (
          <div className={styles.empty}>
            加载失败
            <Button size="small" onClick={() => loadEntries()}>
              重试
            </Button>
          </div>
        ) : active.length === 0 && archived.length === 0 ? (
          <div className={styles.empty}>
            <div>Snowan 还在认识你。</div>
            <div>聊得越多,它记得越多——也可以直接说「记住…」。</div>
          </div>
        ) : (
          <>
            {active.length > 0 ? (
              <div className={styles.list}>
                {active.map((e) => (
                  <div key={e.id} className={styles.row}>
                    <Dot size={18} className={styles.rowDot} />
                    <div className={styles.rowBody}>
                      <div className={styles.rowText}>{e.content}</div>
                      <div className={styles.rowMeta}>{recordedAt(e.created_at)} 记下</div>
                    </div>
                    <Dropdown
                      trigger={['click']}
                      menu={{
                        items: [
                          { key: 'edit', label: '编辑' },
                          { key: 'archive', label: '暂时别用(保留不删)' },
                          { key: 'forget', label: '忘掉', danger: true },
                        ],
                        onClick: ({ key }) =>
                          key === 'edit'
                            ? setEditing(e)
                            : key === 'archive'
                              ? setValid(e, false)
                              : forget(e),
                      }}
                    >
                      <span className={cx(styles.menu, 'mem-menu')} role="button" tabIndex={0} aria-label="更多操作">
                        <MoreHorizontal size={16} />
                      </span>
                    </Dropdown>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.empty}>在用的记忆都清空了。</div>
            )}

            {archived.length > 0 && (
              <>
                <span className={styles.archHead} onClick={() => setArchivedOpen((v) => !v)}>
                  <ChevronRight
                    size={13}
                    style={{ transform: archivedOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}
                  />
                  不再使用的记忆 · {archived.length}
                </span>
                {archivedOpen && (
                  <div className={cx(styles.list, styles.archDim)}>
                    {archived.map((e) => (
                      <div key={e.id} className={styles.row}>
                        <Dot size={18} className={styles.rowDot} />
                        <div className={styles.rowBody}>
                          <div className={styles.rowText}>{e.content}</div>
                          <div className={styles.rowMeta}>暂时没在用 · {recordedAt(e.created_at)} 记下</div>
                        </div>
                        <Dropdown
                          trigger={['click']}
                          menu={{
                            items: [
                              { key: 'restore', label: '恢复' },
                              { key: 'forget', label: '忘掉', danger: true },
                            ],
                            onClick: ({ key }) => (key === 'restore' ? setValid(e, true) : forget(e)),
                          }}
                        >
                          <span className={cx(styles.menu, 'mem-menu')} role="button" tabIndex={0} aria-label="更多操作">
                            <MoreHorizontal size={16} />
                          </span>
                        </Dropdown>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </section>

      {/* 整理 — gentle suggestion card */}
      <section className={styles.suggest}>
        <div className={styles.suggestHead}>
          <Sparkles size={17} style={{ color: theme.colorPrimary, flex: 'none' }} />
          <Text style={{ fontSize: 15, fontWeight: 600, flex: 1 }}>整理一下记忆</Text>
          {!diff && !proposing && (
            <Button size="small" onClick={propose}>
              看看建议
            </Button>
          )}
        </div>
        <div className={styles.hSub} style={{ marginTop: 2 }}>
          Snowan 会列出几条它觉得可以新记、修改或不再使用的内容,供你过目。你勾选确认后才会生效。
        </div>

        {proposing ? (
          <div className={styles.empty}>
            <Spin />
            正在整理…
          </div>
        ) : diff && diff.items.length === 0 ? (
          <div className={styles.empty}>暂时没有要更新的,记忆已是最新。</div>
        ) : diff ? (
          <>
            <div style={{ marginTop: 6 }}>
              {diff.items.map((it, i) => (
                <label key={i} className={cx(styles.diffRow, !it.approved && styles.diffDropped)}>
                  <input
                    type="checkbox"
                    checked={it.approved}
                    onChange={() => toggleItem(i)}
                    style={{ marginTop: 4, flex: 'none' }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span
                      className={styles.pill}
                      style={{ background: theme.colorFillSecondary, color: theme.colorTextSecondary }}
                    >
                      {KIND_LABELS[it.kind]}
                    </span>
                    {it.content && <div className={styles.rowText}>{it.content}</div>}
                    {it.reason && <div className={styles.reason}>{it.reason}</div>}
                  </div>
                </label>
              ))}
            </div>
            <div className={styles.foot}>
              <Button size="small" type="text" onClick={propose}>
                重新看看
              </Button>
              <Button type="primary" loading={applying} onClick={apply}>
                应用 {diff.items.filter((it) => it.approved).length} 条
              </Button>
            </div>
          </>
        ) : null}
      </section>

      {/* footer — manual add demoted + pause / clear */}
      <div className={styles.footRow}>
        <span className={styles.footer} onClick={() => setAddOpen(true)}>
          <Plus size={15} />
          手动添加一条
        </span>
        <div className={styles.footRight}>
          <span>{memOn ? '记忆开启中' : '记忆已暂停'}</span>
          <Switch size="small" checked={memOn} onChange={toggleMem} aria-label="开启或暂停记忆" />
          <span className={styles.danger} role="button" tabIndex={0} onClick={clearAll}>
            清空所有记忆
          </span>
        </div>
      </div>

      <EntryModal open={addOpen} onClose={() => setAddOpen(false)} onDone={loadEntries} />
      <EntryModal open={!!editing} edit={editing} onClose={() => setEditing(null)} onDone={loadEntries} />
      <PersonaInterview
        open={interviewOpen}
        onClose={() => setInterviewOpen(false)}
        onSaved={reloadProfile}
      />
    </div>
  );
}
