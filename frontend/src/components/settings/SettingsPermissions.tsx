import { useEffect, useState } from 'react';
import { App } from 'antd';
import { Text } from '@lobehub/ui';
import { createStyles, useTheme } from 'antd-style';
import { Check, RotateCw, ShieldAlert, ShieldCheck, Zap } from 'lucide-react';
import { Section } from './_kit';
import { getPrefs, savePrefs, getAudit, type AuditEntry } from '../../api/system';

type Mode = 'auto' | 'ask' | 'strict';

const OPTIONS: {
  value: Mode;
  icon: typeof Zap;
  title: string;
  desc: string;
  recommended?: boolean;
}[] = [
  {
    value: 'auto',
    icon: Zap,
    title: '全自动',
    desc: '所有工具直接执行,不打断。',
  },
  {
    value: 'ask',
    icon: ShieldCheck,
    title: '写操作需确认',
    desc: '读取/搜索直接跑,写文件/改文件/执行命令前要你点允许。',
    recommended: true,
  },
  {
    value: 'strict',
    icon: ShieldAlert,
    title: '全部需确认',
    desc: '每次工具调用都要确认。',
  },
];

const useStyles = createStyles(({ token, css }) => ({
  wrap: css`
    display: flex;
    flex-direction: column;
    gap: 28px;
  `,
  options: css`
    display: flex;
    flex-direction: column;
    gap: 10px;
  `,
  option: css`
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: 13px;
    padding: 14px 16px;
    border-radius: ${token.borderRadiusLG}px;
    border: 1px solid ${token.colorBorderSecondary};
    background: ${token.colorBgContainer};
    cursor: pointer;
    transition: all 0.15s ease;
    &:hover {
      border-color: ${token.colorPrimaryBorder};
      background: ${token.colorFillQuaternary};
    }
  `,
  optionActive: css`
    border-color: ${token.colorPrimary};
    background: ${token.colorPrimaryBg};
    box-shadow: 0 0 0 1px ${token.colorPrimary} inset;
    &:hover {
      border-color: ${token.colorPrimary};
      background: ${token.colorPrimaryBg};
    }
  `,
  icon: css`
    flex: none;
    margin-top: 1px;
    color: ${token.colorTextTertiary};
    display: inline-flex;
  `,
  iconActive: css`
    color: ${token.colorPrimary};
  `,
  body: css`
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  `,
  titleRow: css`
    display: flex;
    align-items: center;
    gap: 8px;
  `,
  title: css`
    font-size: 13.5px;
    font-weight: 600;
    color: ${token.colorText};
  `,
  desc: css`
    font-size: 12.5px;
    line-height: 1.6;
    color: ${token.colorTextTertiary};
  `,
  recommended: css`
    font-size: 10.5px;
    font-weight: 600;
    line-height: 1;
    padding: 3px 7px;
    border-radius: ${token.borderRadiusSM}px;
    color: ${token.colorPrimary};
    background: ${token.colorPrimaryBg};
    border: 1px solid ${token.colorPrimaryBorder};
  `,
  check: css`
    flex: none;
    margin-top: 2px;
    margin-left: auto;
    color: ${token.colorPrimary};
    display: inline-flex;
  `,
  auditHead: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
  `,
  refresh: css`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: ${token.colorTextTertiary};
    cursor: pointer;
    &:hover {
      color: ${token.colorText};
    }
  `,
  auditList: css`
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorFillQuaternary};
    overflow: hidden;
    margin-top: 10px;
  `,
  auditRow: css`
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 14px;
    & + & {
      border-top: 1px solid ${token.colorBorderSecondary};
    }
  `,
  dot: css`
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex: none;
  `,
  auditTool: css`
    font-family: ${token.fontFamilyCode};
    font-size: 12.5px;
    font-weight: 600;
    color: ${token.colorText};
    flex: none;
  `,
  auditSummary: css`
    flex: 1;
    min-width: 0;
    font-size: 12px;
    color: ${token.colorTextTertiary};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  auditTime: css`
    flex: none;
    font-size: 11.5px;
    color: ${token.colorTextQuaternary};
  `,
  auditEmpty: css`
    font-size: 12.5px;
    color: ${token.colorTextQuaternary};
    padding: 12px 2px;
  `,
}));

function auditTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function SettingsPermissions() {
  const { styles, cx } = useStyles();
  const theme = useTheme();
  const { message } = App.useApp();
  const [mode, setMode] = useState<Mode>('ask');
  const [audit, setAudit] = useState<AuditEntry[]>([]);

  const loadAudit = () => getAudit(50).then(setAudit).catch(() => {});

  useEffect(() => {
    getPrefs()
      .then((p) => setMode((p.approval_mode as Mode) || 'ask'))
      .catch(() => {});
    loadAudit();
  }, []);

  const select = async (next: Mode) => {
    if (next === mode) return;
    const prev = mode;
    setMode(next);
    try {
      await savePrefs({ approval_mode: next });
      message.success('已更新审批模式');
    } catch {
      setMode(prev);
      message.error('保存失败,请重试');
    }
  };

  return (
    <div className={styles.wrap}>
      <Section
        title="审批模式"
        subtitle="决定助手调用工具前是否需要你确认。"
        bare
      >
        <div className={styles.options}>
          {OPTIONS.map((o) => {
            const active = o.value === mode;
            const Icon = o.icon;
            return (
              <div
                key={o.value}
                role="button"
                tabIndex={0}
                className={cx(styles.option, active && styles.optionActive)}
                onClick={() => select(o.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    select(o.value);
                  }
                }}
              >
                <span className={cx(styles.icon, active && styles.iconActive)}>
                  <Icon size={18} />
                </span>
                <div className={styles.body}>
                  <div className={styles.titleRow}>
                    <Text className={styles.title}>{o.title}</Text>
                    {o.recommended && (
                      <span className={styles.recommended}>推荐</span>
                    )}
                  </div>
                  <Text className={styles.desc}>{o.desc}</Text>
                </div>
                {active && (
                  <span className={styles.check}>
                    <Check size={16} />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      <Section bare>
        <div className={styles.auditHead}>
          <Text className={styles.title} style={{ fontSize: 15, fontWeight: 700 }}>
            最近的工具调用
          </Text>
          <span
            className={styles.refresh}
            role="button"
            tabIndex={0}
            onClick={loadAudit}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                loadAudit();
              }
            }}
          >
            <RotateCw size={13} />
            刷新
          </span>
        </div>
        {audit.length === 0 ? (
          <div className={styles.auditEmpty}>还没有记录。助手每次调用工具都会记在这里。</div>
        ) : (
          <div className={styles.auditList}>
            {audit.map((e, i) => (
              <div key={i} className={styles.auditRow}>
                <span
                  className={styles.dot}
                  style={{
                    background:
                      e.status === 'denied'
                        ? theme.colorError
                        : e.status === 'error'
                          ? theme.colorWarning
                          : theme.colorSuccess,
                  }}
                />
                <span className={styles.auditTool}>{e.tool}</span>
                <span className={styles.auditSummary}>{e.summary}</span>
                <span className={styles.auditTime}>{auditTime(e.ts)}</span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
