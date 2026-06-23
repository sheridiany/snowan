import { Button, Text } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import { ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';
import Surface from '../ui/Surface';
import IconOrb from '../ui/IconOrb';
import { EASING, fadeRise } from '../ui/motion';

const useStyles = createStyles(({ token, css }) => ({
  // A small floating decision card — glass is sanctioned here (overlay/small),
  // not a long list. A brand glow sits under the glass, matching the brand orb,
  // to read as "waiting on you" without the old flat warning bar.
  shell: css`
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px 10px 12px;
    border-radius: inherit;
    overflow: hidden;
  `,
  glow: css`
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: radial-gradient(
      120% 140% at 0% 0%,
      ${token.colorBrandGlow} 0%,
      transparent 60%
    );
    opacity: 0.9;
  `,
  text: css`
    flex: 1;
    min-width: 0;
    font-size: 12.5px;
    font-weight: 500;
    color: ${token.colorText};
    z-index: 1;
  `,
  actions: css`
    flex: none;
    display: flex;
    gap: 8px;
    z-index: 1;
  `,
  approve: css`
    transition: transform ${EASING.spring} 0.18s;
    &:hover {
      transform: translateY(-1px);
    }
    &:active {
      transform: translateY(0);
    }
  `,
  reject: css`
    transition:
      transform ${EASING.spring} 0.18s,
      color ${EASING.standard} 0.18s,
      border-color ${EASING.standard} 0.18s;
    &:hover {
      transform: translateY(-1px);
      color: ${token.colorError};
      border-color: ${token.colorError};
    }
    &:active {
      transform: translateY(0);
    }
  `,
  orb: css`
    flex: none;
    z-index: 1;
  `,
}));

// Shown once below the pending tool rows of a paused turn. Allow / 拒绝 resolves
// every pending call at once; the rows then transition in place, so this card
// just disappears — no lingering JSON dump.
export default function ApprovalCard({
  count,
  onDecide,
}: {
  count: number;
  onDecide: (approve: boolean) => void;
}) {
  const { styles } = useStyles();
  return (
    <motion.div variants={fadeRise} initial="hidden" animate="visible">
      <Surface variant="glass">
        <div className={styles.shell}>
          <span className={styles.glow} />
          <span className={styles.orb}>
            <IconOrb icon={ShieldAlert} size="sm" tone="brand" />
          </span>
          <Text className={styles.text}>
            {count > 1
              ? `助手想执行 ${count} 个操作,需要你确认`
              : '助手想执行此操作,需要你确认'}
          </Text>
          <div className={styles.actions}>
            <Button
              className={styles.approve}
              type="primary"
              size="small"
              onClick={() => onDecide(true)}
            >
              允许
            </Button>
            <Button className={styles.reject} size="small" onClick={() => onDecide(false)}>
              拒绝
            </Button>
          </div>
        </div>
      </Surface>
    </motion.div>
  );
}
