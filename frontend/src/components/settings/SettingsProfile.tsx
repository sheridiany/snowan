import { useEffect, useState } from 'react';
import { App, Input } from 'antd';
import { createStyles } from 'antd-style';
import { Row, Section } from './_kit';
import { getPrefs, savePrefs, type Profile } from '../../api/system';

const useStyles = createStyles(({ css }) => ({
  wrap: css`
    display: flex;
    flex-direction: column;
    gap: 28px;
  `,
}));

export default function SettingsProfile() {
  const { styles } = useStyles();
  const { message } = App.useApp();
  const [profile, setProfile] = useState<Profile>({ name: '', location: '', notes: '' });

  useEffect(() => {
    getPrefs().then((p) => setProfile(p.profile));
  }, []);

  const persist = async (patch: Partial<Profile>) => {
    try {
      const next = await savePrefs({ profile: { ...profile, ...patch } });
      setProfile(next.profile);
      message.success('已保存');
    } catch {
      message.error('保存失败');
    }
  };

  return (
    <div className={styles.wrap}>
      <Section
        title="个人档案"
        subtitle="这些信息会作为「关于你」注入对话,让助手更懂你。"
      >
        <Row
          label="称呼"
          control={
            <Input
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              onBlur={(e) => persist({ name: e.target.value })}
              style={{ width: 220 }}
            />
          }
        />
        <Row
          label="所在地"
          control={
            <Input
              value={profile.location}
              onChange={(e) => setProfile({ ...profile, location: e.target.value })}
              onBlur={(e) => persist({ location: e.target.value })}
              style={{ width: 220 }}
            />
          }
        />
      </Section>

      <Section title="备注" bare>
        <Input.TextArea
          value={profile.notes}
          autoSize={{ minRows: 3, maxRows: 6 }}
          onChange={(e) => setProfile({ ...profile, notes: e.target.value })}
          onBlur={(e) => persist({ notes: e.target.value })}
        />
      </Section>
    </div>
  );
}
