import { useEffect, useState } from 'react';
import { Button, Text } from '@lobehub/ui';
import { App, Dropdown, Input, Modal, Segmented, Select, Switch } from 'antd';
import { createStyles } from 'antd-style';
import {
  AlertTriangle,
  ChevronRight,
  MoreHorizontal,
  Plug,
  Plus,
  RefreshCw,
} from 'lucide-react';
import {
  listServers,
  addServer,
  pasteConfig,
  setEnabled,
  setToolPolicy,
  removeServer,
  probe,
  type McpServer,
  type ToolPolicy,
} from '../../api/mcp';

type ProbeState = { status: 'loading' | 'ok' | 'fail'; tools?: { name: string; description: string }[]; error?: string };
const NEXT: Record<ToolPolicy, ToolPolicy> = { ask: 'auto', auto: 'off', off: 'ask' };
const POLICY_LABEL: Record<ToolPolicy, string> = { ask: '询问', auto: '自动', off: '关闭' };

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
    gap: 10px;
    padding: 12px 14px;
    cursor: pointer;
  `,
  dot: css`
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex: none;
  `,
  name: css`
    font-family: ${token.fontFamilyCode};
    font-size: 13px;
    font-weight: 600;
    color: ${token.colorText};
  `,
  badge: css`
    font-size: 11px;
    padding: 1px 7px;
    border-radius: ${token.borderRadiusSM}px;
    background: ${token.colorFillSecondary};
    color: ${token.colorTextSecondary};
  `,
  meta: css`
    font-size: 12px;
    color: ${token.colorTextTertiary};
    margin-left: auto;
    max-width: 240px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  chevron: css`
    color: ${token.colorTextQuaternary};
    transition: transform 0.15s ease;
  `,
  chevronOpen: css`
    transform: rotate(90deg);
  `,
  tools: css`
    border-top: 1px solid ${token.colorBorderSecondary};
    padding: 4px 14px 10px;
  `,
  toolRow: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 7px 0;
    border-bottom: 0.5px solid ${token.colorBorderSecondary};
    &:last-child {
      border-bottom: none;
    }
  `,
  toolName: css`
    font-family: ${token.fontFamilyCode};
    font-size: 12.5px;
    color: ${token.colorText};
  `,
  toolDesc: css`
    font-size: 12px;
    color: ${token.colorTextTertiary};
    margin-left: 8px;
  `,
  chip: css`
    flex: none;
    font-size: 11px;
    font-weight: 600;
    padding: 2px 10px;
    border-radius: ${token.borderRadiusSM}px;
    cursor: pointer;
    user-select: none;
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
    display: grid;
    grid-template-columns: 72px 1fr;
    gap: 10px;
    align-items: center;
    margin-bottom: 10px;
  `,
  label: css`
    font-size: 12.5px;
    color: ${token.colorTextSecondary};
  `,
  warn: css`
    display: flex;
    gap: 8px;
    padding: 9px 11px;
    border-radius: ${token.borderRadius}px;
    background: ${token.colorWarningBg};
    border: 1px solid ${token.colorWarningBorder};
    color: ${token.colorWarningText};
    font-size: 12px;
    line-height: 1.55;
    margin: 4px 0 12px;
  `,
}));

function AddModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { styles, cx } = useStyles();
  const { message } = App.useApp();
  const [tab, setTab] = useState<'form' | 'json'>('form');
  const [name, setName] = useState('');
  const [transport, setTransport] = useState<'stdio' | 'http'>('stdio');
  const [command, setCommand] = useState('');
  const [args, setArgs] = useState('');
  const [url, setUrl] = useState('');
  const [json, setJson] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName('');
    setCommand('');
    setArgs('');
    setUrl('');
    setJson('');
    setTab('form');
  };

  const save = async () => {
    setSaving(true);
    try {
      if (tab === 'json') {
        const parsed = JSON.parse(json);
        const r = await pasteConfig(parsed);
        message.success(`已添加:${r.names.join('、')}`);
      } else if (transport === 'stdio') {
        if (!name.trim() || !command.trim()) return message.warning('需要名称和命令');
        await addServer({ name: name.trim(), command: command.trim(), args: args.trim() ? args.trim().split(/\s+/) : [] });
        message.success('已添加');
      } else {
        if (!name.trim() || !url.trim()) return message.warning('需要名称和 URL');
        await addServer({ name: name.trim(), url: url.trim() });
        message.success('已添加');
      }
      reset();
      onDone();
      onClose();
    } catch (e) {
      message.error(tab === 'json' ? 'JSON 解析或导入失败' : `添加失败:${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="添加 MCP 服务器"
      open={open}
      onCancel={onClose}
      onOk={save}
      okText={tab === 'form' && transport === 'stdio' ? '确认并保存' : '保存'}
      cancelText="取消"
      confirmLoading={saving}
      width={520}
      destroyOnHidden
    >
      <div style={{ paddingTop: 6 }}>
        <Segmented
          value={tab}
          onChange={(v) => setTab(v as 'form' | 'json')}
          options={[
            { value: 'form', label: '表单' },
            { value: 'json', label: '粘贴 JSON' },
          ]}
          style={{ marginBottom: 14 }}
        />
        {tab === 'json' ? (
          <>
            <Input.TextArea
              value={json}
              onChange={(e) => setJson(e.target.value)}
              autoSize={{ minRows: 8, maxRows: 16 }}
              placeholder={'{\n  "mcpServers": {\n    "filesystem": {\n      "command": "npx",\n      "args": ["-y", "@modelcontextprotocol/server-filesystem", "~/Documents"]\n    }\n  }\n}'}
              style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 12 }}
            />
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8 }}>
              直接粘贴 Claude Desktop / Cursor 的 mcpServers 配置即可。
            </div>
          </>
        ) : (
          <>
            <div className={styles.field}>
              <span className={styles.label}>名称</span>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如 filesystem" />
              <span className={styles.label}>传输</span>
              <Select
                value={transport}
                onChange={setTransport}
                options={[
                  { value: 'stdio', label: 'stdio（本地命令）' },
                  { value: 'http', label: 'Streamable HTTP（远程）' },
                ]}
              />
              {transport === 'stdio' ? (
                <>
                  <span className={styles.label}>命令</span>
                  <Input value={command} onChange={(e) => setCommand(e.target.value)} placeholder="npx / uvx / node …" />
                  <span className={styles.label}>参数</span>
                  <Input value={args} onChange={(e) => setArgs(e.target.value)} placeholder="-y @modelcontextprotocol/server-filesystem ~/Documents" />
                </>
              ) : (
                <>
                  <span className={styles.label}>URL</span>
                  <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/mcp" />
                </>
              )}
            </div>
            {transport === 'stdio' && command.trim() && (
              <div className={cx(styles.warn)}>
                <AlertTriangle size={16} style={{ flex: 'none' }} />
                <span>
                  保存后将在本机运行:<code>{command.trim()} {args.trim()}</code>。确认命令可信再继续。需要 API key 的服务器请用「粘贴 JSON」带上 env。
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

export default function SettingsMcp() {
  const { styles, cx, theme } = useStyles();
  const { message, modal } = App.useApp();
  const [servers, setServers] = useState<McpServer[]>([]);
  const [probes, setProbes] = useState<Record<string, ProbeState>>({});
  const [openSet, setOpenSet] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);

  const doProbe = (name: string) => {
    setProbes((p) => ({ ...p, [name]: { status: 'loading' } }));
    probe(name)
      .then((r) =>
        setProbes((p) => ({ ...p, [name]: r.ok ? { status: 'ok', tools: r.tools } : { status: 'fail', error: r.error } })),
      )
      .catch(() => setProbes((p) => ({ ...p, [name]: { status: 'fail', error: '探测失败' } })));
  };

  const load = () =>
    listServers().then((list) => {
      setServers(list);
      list.filter((s) => s.enabled).forEach((s) => doProbe(s.name));
    });

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const toggle = async (s: McpServer) => {
    const enabled = !s.enabled;
    setServers((prev) => prev.map((x) => (x.name === s.name ? { ...x, enabled } : x)));
    await setEnabled(s.name, enabled).catch(() => {});
    if (enabled) doProbe(s.name);
  };

  const cyclePolicy = async (name: string, tool: string, cur: ToolPolicy) => {
    const next = NEXT[cur];
    setServers((prev) => prev.map((s) => (s.name === name ? { ...s, tools: { ...s.tools, [tool]: next } } : s)));
    await setToolPolicy(name, tool, next).catch(() => message.error('保存失败'));
  };

  const remove = (name: string) =>
    modal.confirm({
      title: `移除 ${name}?`,
      okText: '移除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        await removeServer(name);
        setServers((prev) => prev.filter((s) => s.name !== name));
      },
    });

  const dotColor = (s: McpServer): string => {
    if (!s.enabled) return theme.colorTextQuaternary;
    const p = probes[s.name];
    if (!p || p.status === 'loading') return theme.colorWarning;
    return p.status === 'ok' ? theme.colorSuccess : theme.colorError;
  };

  const chipStyle = (policy: ToolPolicy) => {
    const map = {
      ask: { background: theme.colorWarningBg, color: theme.colorWarningText },
      auto: { background: theme.colorSuccessBg, color: theme.colorSuccess },
      off: { background: theme.colorFillSecondary, color: theme.colorTextTertiary },
    } as const;
    return map[policy];
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <div>
          <Text className={styles.title}>MCP 服务器</Text>
          <div className={styles.sub}>连接外部工具(文件、GitHub、浏览器…),它们会自动并入助手的工具集。</div>
        </div>
        <Button type="primary" icon={<Plus size={15} />} onClick={() => setAddOpen(true)}>
          添加服务器
        </Button>
      </div>

      {servers.length === 0 ? (
        <div className={styles.empty}>
          <Plug size={28} />
          还没有 MCP 服务器
          <Button size="small" onClick={() => setAddOpen(true)}>
            添加第一个
          </Button>
        </div>
      ) : (
        <div className={styles.cards}>
          {servers.map((s) => {
            const p = probes[s.name];
            const open = openSet.has(s.name);
            const meta = !s.enabled
              ? '已停用'
              : !p || p.status === 'loading'
                ? '连接中…'
                : p.status === 'ok'
                  ? `${p.tools?.length ?? 0} 工具`
                  : `连接失败:${p.error ?? ''}`;
            return (
              <div key={s.name} className={styles.card}>
                <div
                  className={styles.cardHead}
                  onClick={() =>
                    setOpenSet((prev) => {
                      const n = new Set(prev);
                      n.has(s.name) ? n.delete(s.name) : n.add(s.name);
                      return n;
                    })
                  }
                >
                  <span className={styles.dot} style={{ background: dotColor(s) }} />
                  <span className={styles.name}>{s.name}</span>
                  <span className={styles.badge}>{s.transport === 'http' ? 'HTTP' : 'stdio'}</span>
                  <span
                    className={styles.meta}
                    style={s.enabled && p?.status === 'fail' ? { color: theme.colorError } : undefined}
                  >
                    {meta}
                  </span>
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
                          { key: 'probe', label: '重新探测' },
                          { key: 'remove', label: '移除', danger: true },
                        ],
                        onClick: ({ key }) => (key === 'probe' ? doProbe(s.name) : remove(s.name)),
                      }}
                    >
                      <MoreHorizontal size={16} style={{ color: theme.colorTextTertiary, cursor: 'pointer' }} />
                    </Dropdown>
                  </span>
                  <ChevronRight size={15} className={cx(styles.chevron, open && styles.chevronOpen)} />
                </div>

                {open && (
                  <div className={styles.tools}>
                    {p?.status === 'ok' && p.tools && p.tools.length > 0 ? (
                      <>
                        {p.tools.map((t) => {
                          const policy = (s.tools[t.name] ?? 'ask') as ToolPolicy;
                          return (
                            <div key={t.name} className={styles.toolRow}>
                              <div style={{ minWidth: 0 }}>
                                <span className={styles.toolName}>{t.name}</span>
                                {t.description && <span className={styles.toolDesc}>{t.description}</span>}
                              </div>
                              <span
                                className={styles.chip}
                                style={chipStyle(policy)}
                                title="点击循环:询问 → 自动 → 关闭"
                                onClick={() => cyclePolicy(s.name, t.name, policy)}
                              >
                                {POLICY_LABEL[policy]}
                              </span>
                            </div>
                          );
                        })}
                        <div style={{ fontSize: 11, color: theme.colorTextTertiary, marginTop: 9 }}>
                          策略点击循环:<span style={{ color: theme.colorWarningText }}>询问</span> →{' '}
                          <span style={{ color: theme.colorSuccess }}>自动</span> →{' '}
                          <span style={{ color: theme.colorTextTertiary }}>关闭</span>
                        </div>
                      </>
                    ) : p?.status === 'loading' ? (
                      <div style={{ fontSize: 12, color: theme.colorTextTertiary, padding: '8px 0' }}>连接中…</div>
                    ) : p?.status === 'fail' ? (
                      <div style={{ fontSize: 12, color: theme.colorError, padding: '8px 0', display: 'flex', gap: 10, alignItems: 'center' }}>
                        {p.error}
                        <Button size="small" icon={<RefreshCw size={13} />} onClick={() => doProbe(s.name)}>
                          重连
                        </Button>
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: theme.colorTextTertiary, padding: '8px 0' }}>启用后探测工具。</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AddModal open={addOpen} onClose={() => setAddOpen(false)} onDone={load} />
    </div>
  );
}
