import { Block, Segmented, Text } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import { Moon, Sun } from 'lucide-react';
import { useThemeMode } from '../../theme/ThemeModeContext';

const ACCENT = '#FF7F16';

const useStyles = createStyles(({ token, css }) => ({
  card: css`
    padding: 20px;
    border-radius: ${token.borderRadiusLG}px;
    display: flex;
    flex-direction: column;
    gap: 18px;
  `,
  cardTitle: css`
    font-size: 14px;
    font-weight: 600;
    color: ${token.colorText};
  `,
  row: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  `,
  rowText: css`
    display: flex;
    flex-direction: column;
    gap: 2px;
  `,
  label: css`
    font-size: 13px;
    font-weight: 500;
    color: ${token.colorText};
  `,
  sub: css`
    font-size: 12px;
    color: ${token.colorTextTertiary};
  `,
  divider: css`
    height: 1px;
    background: ${token.colorBorderSecondary};
    margin: 2px 0;
  `,
  swatch: css`
    display: flex;
    align-items: center;
    gap: 10px;
  `,
  chip: css`
    width: 24px;
    height: 24px;
    border-radius: 7px;
    background: ${ACCENT};
    box-shadow: 0 2px 8px ${token.colorPrimaryBorder};
  `,
  mono: css`
    font-family: ${token.fontFamilyCode};
    font-size: 12px;
    color: ${token.colorTextSecondary};
  `,
  seg: css`
    display: inline-flex;
    align-items: center;
    gap: 6px;
  `,
}));

export default function SettingsAppearance() {
  const { styles } = useStyles();
  const { isDark, toggle } = useThemeMode();

  return (
    <Block variant="outlined" className={styles.card}>
      <Text className={styles.cardTitle}>外观</Text>

      <div className={styles.row}>
        <div className={styles.rowText}>
          <span className={styles.label}>主题</span>
          <span className={styles.sub}>选择浅色或深色界面外观</span>
        </div>
        <Segmented
          value={isDark ? 'dark' : 'light'}
          onChange={(v) => {
            if ((v === 'dark') !== isDark) toggle();
          }}
          options={[
            {
              value: 'light',
              label: (
                <span className={styles.seg}>
                  <Sun size={14} /> 浅色
                </span>
              ),
            },
            {
              value: 'dark',
              label: (
                <span className={styles.seg}>
                  <Moon size={14} /> 深色
                </span>
              ),
            },
          ]}
        />
      </div>

      <div className={styles.divider} />

      <div className={styles.row}>
        <div className={styles.rowText}>
          <span className={styles.label}>强调色</span>
          <span className={styles.sub}>用于按钮、链接与活跃状态</span>
        </div>
        <div className={styles.swatch}>
          <span className={styles.chip} />
          <span className={styles.mono}>{ACCENT}</span>
        </div>
      </div>

      <div className={styles.divider} />

      <div className={styles.row}>
        <div className={styles.rowText}>
          <span className={styles.label}>字体</span>
          <span className={styles.sub}>界面默认字体</span>
        </div>
        <span className={styles.mono}>Inter · PingFang SC</span>
      </div>
    </Block>
  );
}
