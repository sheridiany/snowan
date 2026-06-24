import { useEffect, useRef, useState } from 'react';
import { Button } from '@lobehub/ui';
import { App } from 'antd';
import { createStyles } from 'antd-style';
import { Check, DownloadCloud, Mic } from 'lucide-react';
import { Section } from './_kit';
import { getAsrStatus, downloadAsr, type AsrStatus } from '../../api/recording';

const useStyles = createStyles(({ token, css }) => ({
  wrap: css`
    display: flex;
    flex-direction: column;
    gap: 28px;
  `,
  row: css`
    display: flex;
    align-items: center;
    gap: 13px;
    padding: 14px 16px;
  `,
  icon: css`
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
  body: css`
    flex: 1;
    min-width: 0;
  `,
  name: css`
    font-size: 14px;
    font-weight: 500;
    color: ${token.colorText};
  `,
  sub: css`
    font-size: 12px;
    color: ${token.colorTextTertiary};
    margin-top: 1px;
  `,
  ready: css`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12.5px;
    font-weight: 500;
    color: ${token.colorSuccess};
  `,
  hint: css`
    font-size: 12.5px;
    line-height: 1.6;
    color: ${token.colorTextTertiary};
    padding: 0 2px;
  `,
}));

export default function SettingsVoice() {
  const { styles } = useStyles();
  const { message } = App.useApp();
  const [status, setStatus] = useState<AsrStatus | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const refresh = () => getAsrStatus().then(setStatus).catch(() => {});
  useEffect(() => {
    refresh();
    return () => clearInterval(timer.current);
  }, []);
  // Poll while a download is in flight, then stop once it lands.
  useEffect(() => {
    clearInterval(timer.current);
    if (status?.downloading) timer.current = setInterval(refresh, 2000);
    return () => clearInterval(timer.current);
  }, [status?.downloading]);

  const start = async () => {
    try {
      await downloadAsr();
      message.info('开始下载语音模型,完成后即可转写');
      setStatus((s) => (s ? { ...s, downloading: true } : s));
    } catch {
      message.error('下载启动失败');
    }
  };

  return (
    <div className={styles.wrap}>
      <Section title="语音模型" subtitle="录音转写与语音输入(麦克风)使用的本地模型,完全离线">
        <div className={styles.row}>
          <span className={styles.icon}>
            <Mic size={18} />
          </span>
          <div className={styles.body}>
            <div className={styles.name}>{status?.model ?? 'faster-whisper small'}</div>
            <div className={styles.sub}>本地语音转文字 · 约 {status?.size_mb ?? 480}MB</div>
          </div>
          {status?.ready ? (
            <span className={styles.ready}>
              <Check size={15} /> 已就绪
            </span>
          ) : status?.downloading ? (
            <Button size="small" loading disabled>
              下载中…
            </Button>
          ) : (
            <Button size="small" type="primary" icon={<DownloadCloud size={15} />} onClick={start}>
              下载模型
            </Button>
          )}
        </div>
      </Section>

      <Section title="怎么用" bare>
        <div className={styles.hint}>
          下载后:在输入框点麦克风按钮即可语音输入(说完再点一次,自动转成文字填进输入框);右侧「录音」面板的转写也会用它。模型存放在 ~/.snowan/models,可随时删除。
        </div>
      </Section>
    </div>
  );
}
