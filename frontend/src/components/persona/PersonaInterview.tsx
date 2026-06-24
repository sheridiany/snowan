import { useEffect, useState } from 'react';
import { App, Button, Input, Modal, Spin } from 'antd';
import { createStyles } from 'antd-style';

import { getPersonaQuestions, draftPersona, type PersonaQuestion } from '../../api/persona';
import { saveProfile } from '../../api/memory';
import { savePrefs } from '../../api/system';

// A skippable onboarding interview: warm questions one at a time, then an editable
// draft of the persona Snowan wrote. Closing in any way marks onboarded=true so the
// nudge never nags again; the profile is only written when the user confirms a draft.

const useStyles = createStyles(({ token, css }) => ({
  loading: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 48px 0;
    color: ${token.colorTextTertiary};
    font-size: 13px;
  `,
  step: css`
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding-top: 4px;
  `,
  progress: css`
    font-size: 12px;
    color: ${token.colorTextQuaternary};
  `,
  question: css`
    font-size: 16px;
    font-weight: 600;
    color: ${token.colorText};
    line-height: 1.5;
  `,
  hint: css`
    font-size: 12.5px;
    color: ${token.colorTextTertiary};
    margin-top: -6px;
  `,
  draftIntro: css`
    font-size: 13px;
    color: ${token.colorTextSecondary};
    line-height: 1.6;
  `,
  footer: css`
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
  `,
  spacer: css`
    margin-right: auto;
  `,
}));

type Props = { open: boolean; onClose: () => void; onSaved?: () => void };

type Phase = 'loading' | 'asking' | 'drafting' | 'review';

export default function PersonaInterview({ open, onClose, onSaved }: Props) {
  const { styles } = useStyles();
  const { message } = App.useApp();
  const [phase, setPhase] = useState<Phase>('loading');
  const [questions, setQuestions] = useState<PersonaQuestion[]>([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [current, setCurrent] = useState('');
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPhase('loading');
    setQuestions([]);
    setIdx(0);
    setAnswers({});
    setCurrent('');
    setDraft('');
    getPersonaQuestions()
      .then((qs) => {
        setQuestions(qs);
        setPhase(qs.length ? 'asking' : 'review');
      })
      .catch(() => {
        message.error('问题加载失败,请稍后再试');
        onClose();
      });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const q = questions[idx];

  // Stop interviewing and turn whatever we have into a draft.
  const toDraft = async (collected: Record<string, string>) => {
    if (Object.keys(collected).length === 0) {
      // Nothing to draft from — skip straight to a blank review.
      setDraft('');
      setPhase('review');
      return;
    }
    setPhase('drafting');
    try {
      const { draft: d } = await draftPersona(collected);
      setDraft(d);
    } catch {
      message.error('起草画像失败,请稍后再试');
    } finally {
      setPhase('review');
    }
  };

  const advance = (collected: Record<string, string>) => {
    if (idx + 1 < questions.length) {
      setAnswers(collected);
      setIdx(idx + 1);
      setCurrent('');
    } else {
      setAnswers(collected);
      void toDraft(collected);
    }
  };

  const next = () => {
    const text = current.trim();
    advance(text ? { ...answers, [q.id]: text } : answers);
  };

  const skipQuestion = () => advance(answers);

  // "以后再说" anywhere before confirming: mark onboarded so we don't nag, write nothing.
  const later = async () => {
    try {
      await savePrefs({ onboarded: true });
    } catch {
      /* the card already hides locally; a failed flag just shows it next launch */
    }
    onClose();
  };

  const confirm = async () => {
    setSaving(true);
    try {
      await saveProfile(draft.trim());
      await savePrefs({ onboarded: true });
      message.success('画像已保存,Snowan 会更懂你');
      onSaved?.();
      onClose();
    } catch (e) {
      message.error(`保存失败:${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="让 Snowan 更懂你"
      open={open}
      onCancel={later}
      width={720}
      centered
      footer={null}
      destroyOnHidden
    >
      {phase === 'loading' || phase === 'drafting' ? (
        <div className={styles.loading}>
          <Spin />
          {phase === 'drafting' ? '正在为你起草画像…' : '正在准备几个小问题…'}
        </div>
      ) : phase === 'asking' ? (
        <div className={styles.step}>
          <span className={styles.progress}>
            第 {idx + 1} / {questions.length} 个
          </span>
          <span className={styles.question}>{q.question}</span>
          {q.hint && <span className={styles.hint}>{q.hint}</span>}
          <Input.TextArea
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            placeholder="随便聊聊,几句话就好"
            autoSize={{ minRows: 5, maxRows: 12 }}
            autoFocus
          />
          <div className={styles.footer}>
            <Button type="text" className={styles.spacer} onClick={later}>
              以后再说
            </Button>
            <Button onClick={skipQuestion}>跳过这题</Button>
            <Button type="primary" onClick={next}>
              {idx + 1 < questions.length ? '下一题' : '完成'}
            </Button>
          </div>
        </div>
      ) : (
        <div className={styles.step}>
          <span className={styles.draftIntro}>
            这是 Snowan 为你起草的画像,改完点确认。
          </span>
          <Input.TextArea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="还没有内容,你可以直接在这里写下自己的画像"
            autoSize={{ minRows: 12, maxRows: 22 }}
          />
          <div className={styles.footer}>
            <Button type="text" className={styles.spacer} onClick={later}>
              以后再说
            </Button>
            <Button type="primary" loading={saving} disabled={!draft.trim()} onClick={confirm}>
              确认
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
