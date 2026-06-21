import { useEffect, useRef, useState } from 'react';
import { Button, Text } from '@lobehub/ui';
import { App, Input, Tag } from 'antd';
import { createStyles } from 'antd-style';
import { CalendarDays, Check, FileUp, Lock, RotateCw, Upload } from 'lucide-react';
import { Row, Section } from './_kit';
import {
  getCalendar,
  importIcs,
  syncSystem,
  type CalendarData,
  type CalendarSource,
} from '../../api/calendar';

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
  privacy: css`
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    font-weight: 500;
    color: ${token.colorSuccess};
  `,
  synced: css`
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: ${token.colorSuccess};
    font-size: 13px;
    font-weight: 600;
  `,
  head: css`
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 0 2px;
  `,
  title: css`
    font-size: 15px;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: ${token.colorText};
  `,
  importRow: css`
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 12px 0 4px;
  `,
  paste: css`
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 10px;
  `,
  sources: css`
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 4px;
  `,
  card: css`
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 12px 13px;
    border-radius: ${token.borderRadiusLG}px;
    border: 1px solid ${token.colorBorderSecondary};
    background: ${token.colorBgContainer};
  `,
  cardIcon: css`
    flex: none;
    width: 34px;
    height: 34px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 9px;
    background: ${token.colorPrimaryBg};
    color: ${token.colorPrimary};
  `,
  cardBody: css`
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  `,
  cardName: css`
    font-size: 13.5px;
    font-weight: 600;
    color: ${token.colorText};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  cardSub: css`
    font-size: 11.5px;
    color: ${token.colorTextTertiary};
  `,
  cardCount: css`
    flex: none;
    font-size: 12px;
    color: ${token.colorTextTertiary};
    font-variant-numeric: tabular-nums;
  `,
  empty: css`
    font-size: 12.5px;
    color: ${token.colorTextQuaternary};
    padding: 8px 2px;
  `,
}));

const PROVIDER_LABEL: Record<string, string> = {
  system: '系统日历',
  ics: 'ICS 导入',
};

function lastSyncedLabel(s: CalendarSource): string {
  if (!s.lastSyncedAt) return '尚未同步';
  const d = new Date(s.lastSyncedAt);
  if (Number.isNaN(d.getTime())) return '尚未同步';
  return `上次同步 ${d.toLocaleString('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
}

export default function SettingsCalendar() {
  const { styles } = useStyles();
  const { message } = App.useApp();
  const [data, setData] = useState<CalendarData | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [permError, setPermError] = useState('');
  const [showPaste, setShowPaste] = useState(false);
  const [icsName, setIcsName] = useState('');
  const [icsText, setIcsText] = useState('');
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    getCalendar()
      .then((d) => alive && setData(d))
      .catch(() => alive && message.error('加载日历设置失败'));
    return () => {
      alive = false;
    };
  }, [message]);

  const eventCount = (sourceId: string) =>
    data?.events.filter((e) => e.sourceId === sourceId).length ?? 0;

  const onSync = async () => {
    setSyncing(true);
    setPermError('');
    try {
      const next = await syncSystem();
      setData(next);
      if (next.syncStatus === 'failed') {
        setPermError(next.syncError || '无法读取系统日历。请在「系统设置 · 隐私与安全性 · 日历」中允许 Snowan 访问。');
      } else {
        message.success('系统日历已同步');
      }
    } catch {
      message.error('同步失败,请重试');
    } finally {
      setSyncing(false);
    }
  };

  const doImport = async (name: string, text: string) => {
    setImporting(true);
    try {
      const next = await importIcs(name.trim() || '导入日历', text);
      setData(next);
      setShowPaste(false);
      setIcsName('');
      setIcsText('');
      message.success('已导入日程');
    } catch {
      message.error('导入失败,请检查 ICS 内容');
    } finally {
      setImporting(false);
    }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const text = await file.text();
    doImport(file.name.replace(/\.ics$/i, ''), text);
  };

  const systemSource = data?.sources.find((s) => s.provider === 'system');

  return (
    <div className={styles.wrap}>
      <Section
        title="系统日历"
        subtitle="读取 macOS 「日历」应用——它已在本地汇总了你的 iCloud / Gmail / Outlook 日程。所有数据本地存储,不经过云端,无需登录授权。"
      >
        <Row
          label="系统日历"
          subtitle={
            systemSource
              ? `${PROVIDER_LABEL.system} · ${lastSyncedLabel(systemSource)}`
              : '首次同步会弹出 macOS「日历」权限请求,点击允许即可'
          }
          icon={<CalendarDays size={16} />}
          control={
            systemSource ? (
              <Button
                size="small"
                icon={<RotateCw size={14} />}
                loading={syncing}
                onClick={onSync}
              >
                {syncing ? '同步中…' : '重新同步'}
              </Button>
            ) : (
              <Button type="primary" size="small" loading={syncing} onClick={onSync}>
                {syncing ? '连接中…' : '连接'}
              </Button>
            )
          }
        />
      </Section>

      <span className={styles.privacy}>
        <Lock size={13} />
        所有数据本地存储
      </span>

      {permError && (
        <Tag color="warning" style={{ alignSelf: 'flex-start', whiteSpace: 'normal', lineHeight: 1.6 }}>
          {permError}
        </Tag>
      )}
      {systemSource && !permError && (
        <span className={styles.synced}>
          <Check size={15} />
          已连接系统日历
        </span>
      )}

      <Section bare>
        <div className={styles.head}>
          <Text className={styles.title}>导入 ICS</Text>
          <Text className={styles.note}>
            选择 .ics 文件或粘贴 ICS 文本,把会议邀请、订阅日历等导入进来。导入后的日程同样只存在本机。
          </Text>
        </div>

        <div className={styles.importRow}>
          <Button type="primary" icon={<FileUp size={15} />} onClick={() => fileRef.current?.click()}>
            选择 .ics 文件
          </Button>
          <Button size="small" type="text" icon={<Upload size={14} />} onClick={() => setShowPaste((v) => !v)}>
            粘贴文本
          </Button>
          <input ref={fileRef} type="file" accept=".ics,text/calendar" hidden onChange={onFile} />
        </div>

        {showPaste && (
          <div className={styles.paste}>
            <Input
              value={icsName}
              onChange={(e) => setIcsName(e.target.value)}
              placeholder="日历名称(可选,如 团队会议)"
            />
            <Input.TextArea
              value={icsText}
              onChange={(e) => setIcsText(e.target.value)}
              autoSize={{ minRows: 4, maxRows: 10 }}
              placeholder="BEGIN:VCALENDAR&#10;…&#10;END:VCALENDAR"
            />
            <Button
              type="primary"
              loading={importing}
              disabled={!icsText.trim()}
              onClick={() => doImport(icsName, icsText)}
              style={{ alignSelf: 'flex-start' }}
            >
              导入
            </Button>
          </div>
        )}
      </Section>

      <Section title="已连接的日历" bare>
        {!data || data.sources.length === 0 ? (
          <div className={styles.empty}>还没有连接任何日历。</div>
        ) : (
          <div className={styles.sources}>
            {data.sources.map((s) => (
              <div key={s.id} className={styles.card}>
                <span className={styles.cardIcon}>
                  <CalendarDays size={18} />
                </span>
                <div className={styles.cardBody}>
                  <span className={styles.cardName}>{s.name}</span>
                  <span className={styles.cardSub}>
                    {PROVIDER_LABEL[s.provider] ?? s.provider} · {lastSyncedLabel(s)}
                  </span>
                </div>
                <span className={styles.cardCount}>{eventCount(s.id)} 个日程</span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
