import { memo, useEffect, useRef, useState } from 'react';
import { ActionIcon, Markdown } from '@lobehub/ui';
import { App as AntApp, Image } from 'antd';
import { createStyles } from 'antd-style';
import { Check, Code2, Copy, Download, FileDown, ListChecks, NotebookPen, Paperclip, Search } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';

import { workspaceFileUrl } from '../api/chat';
import { imageFileUrl } from '../api/imagegen';
import { getPrefs } from '../api/system';
import ToolGroup from './ToolGroup';
import ApprovalCard from './ApprovalCard';
import DiagramCard from './DiagramCard';
import DisplayHeading from '../ui/DisplayHeading';
import { EASING, fadeRise, lift, staggerContainer, staggerItem } from '../ui/motion';
import { textOfBlocks, type Block, type Message, type ToolStep } from './types';

// Render blocks in order, but coalesce consecutive tool calls into one run so
// they can collapse into a single grouped card.
type RenderItem =
  | { kind: 'text'; key: string; text: string }
  | { kind: 'tools'; key: string; steps: ToolStep[] }
  | { kind: 'artifact'; key: string; path: string; title: string }
  | { kind: 'diagram'; key: string; svg: string; title: string }
  | { kind: 'image'; key: string; ids: string[]; prompt: string; pending?: boolean };

function groupBlocks(blocks: Block[]): RenderItem[] {
  const items: RenderItem[] = [];
  blocks.forEach((b, j) => {
    if (b.kind === 'tool') {
      const last = items[items.length - 1];
      if (last && last.kind === 'tools') last.steps.push(b.step);
      else items.push({ kind: 'tools', key: b.step.id || `t${j}`, steps: [b.step] });
    } else if (b.kind === 'text') {
      items.push({ kind: 'text', key: `x${j}`, text: b.text });
    } else if (b.kind === 'artifact') {
      items.push({ kind: 'artifact', key: `a${j}`, path: b.path, title: b.title });
    } else if (b.kind === 'diagram') {
      items.push({ kind: 'diagram', key: `d${j}`, svg: b.svg, title: b.title });
    } else if (b.kind === 'image') {
      items.push({ kind: 'image', key: `i${j}`, ids: b.ids, prompt: b.prompt, pending: b.pending });
    }
  });
  return items;
}

const useStyles = createStyles(({ token, css }) => ({
  scroll: css`
    flex: 1;
    overflow-y: auto;
  `,
  list: css`
    width: 100%;
    max-width: 760px;
    margin: 0 auto;
    padding: 28px 16px 24px;
    display: flex;
    flex-direction: column;
    gap: 22px;
  `,
  emptyScroll: css`
    flex: 1;
    min-height: 0;
    display: flex;
  `,
  hero: css`
    position: relative;
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 24px;
  `,
  // Soft top-down bloom behind the greeting; sits under content, never intercepts clicks.
  heroGlow: css`
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: ${token.colorHeroGlow};
    z-index: 0;
  `,
  greeting: css`
    position: relative;
    z-index: 1;
    text-align: center;
  `,
  greetingName: css`
    color: ${token.colorPrimary};
  `,
  heroDesc: css`
    position: relative;
    z-index: 1;
    font-size: 13.5px;
    color: ${token.colorTextTertiary};
    margin-bottom: 12px;
  `,
  cardGrid: css`
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
    width: 100%;
    max-width: 560px;
  `,
  promptCard: css`
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 13px 16px;
    border-radius: ${token.borderRadius}px;
    background: ${token.colorBgContainer};
    border: 1px solid ${token.colorBorder};
    text-align: left;
    cursor: pointer;
    transition:
      border-color ${EASING.standard} 0.18s,
      background ${EASING.standard} 0.18s;
    &:hover {
      background: ${token.colorFillQuaternary};
      border-color: ${token.colorTextQuaternary};
    }
    &:focus-visible {
      outline: none;
      border-color: ${token.colorPrimaryBorder};
      box-shadow: 0 0 0 2px ${token.colorBrandGlow};
    }
  `,
  promptIcon: css`
    flex: none;
    display: flex;
    color: ${token.colorTextTertiary};
  `,
  promptText: css`
    flex: 1;
    min-width: 0;
    font-size: 14px;
    line-height: 1.5;
    color: ${token.colorText};
  `,
  user: css`
    align-self: flex-end;
    max-width: 80%;
    padding: 11px 16px;
    border-radius: 18px 18px 5px 18px;
    background: ${token.colorPrimary};
    color: #fff;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
    box-shadow:
      inset 0 1px 0 0 rgba(255, 255, 255, 0.22),
      0 4px 12px -4px rgba(0, 0, 0, 0.14);
  `,
  attachRow: css`
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-bottom: 7px;
  `,
  attachChip: css`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    max-width: 200px;
    padding: 2px 8px;
    border-radius: 7px;
    background: rgba(255, 255, 255, 0.2);
    font-size: 11.5px;
    line-height: 1.5;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,
  assistant: css`
    align-self: stretch;
    display: flex;
    flex-direction: column;
    gap: 9px;
    color: ${token.colorText};
    /* Comfortable long-form reading: roomy lines, breathing room around blocks. */
    .lobe-markdown,
    & p,
    & li {
      line-height: 1.72;
    }
    & p {
      margin: 0 0 0.7em;
    }
    & p:last-child {
      margin-bottom: 0;
    }
    /* reveal per-message actions on hover */
    &:hover .msg-actions {
      opacity: 1;
    }
  `,
  tool: css`
    align-self: stretch;
    width: 100%;
  `,
  actions: css`
    display: flex;
    align-items: center;
    gap: 2px;
    margin-top: -2px;
    opacity: 0;
    transition: opacity ${EASING.standard} 0.18s;
  `,
  thinking: css`
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 0;
    & span {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: ${token.colorTextQuaternary};
      animation: dotpulse 1.3s ${EASING.standard} infinite both;
    }
    & span:nth-child(2) {
      animation-delay: 0.16s;
    }
    & span:nth-child(3) {
      animation-delay: 0.32s;
    }
    @keyframes dotpulse {
      0%,
      80%,
      100% {
        opacity: 0.28;
        transform: scale(0.8);
      }
      40% {
        opacity: 1;
        transform: scale(1);
      }
    }
  `,
  caret: css`
    display: inline-block;
    width: 7px;
    height: 1.05em;
    margin-top: 2px;
    border-radius: 1px;
    background: ${token.colorText};
    animation: caretblink 1s steps(2, start) infinite;
    @keyframes caretblink {
      50% {
        opacity: 0;
      }
    }
  `,
  artifactCard: css`
    align-self: flex-start;
    max-width: 100%;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorFillQuaternary};
    overflow: hidden;
  `,
  artifactImg: css`
    display: block;
    max-width: 100%;
    max-height: 320px;
    object-fit: contain;
    background: ${token.colorBgContainer};
  `,
  artifactRow: css`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 11px;
    color: ${token.colorTextSecondary};
  `,
  artifactName: css`
    flex: 1;
    min-width: 0;
    font-size: 13px;
    color: ${token.colorText};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  artifactDl: css`
    flex: none;
    font-size: 12.5px;
    font-weight: 500;
    color: ${token.colorPrimary};
    cursor: pointer;
  `,
  imageGrid: css`
    align-self: stretch;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 12px;
  `,
  imageCard: css`
    position: relative;
    border-radius: ${token.borderRadiusLG}px;
    overflow: hidden;
    background: ${token.colorFillTertiary};
    border: 1px solid ${token.colorBorderSecondary};
    &:hover .img-actions {
      opacity: 1;
    }
    & .ant-image {
      display: block;
      width: 100%;
    }
    & .ant-image-img {
      display: block;
      width: 100%;
      height: auto;
      cursor: zoom-in;
    }
  `,
  // Mirrors ImgLibraryPanel's hover scrim: legible white icons over any photo.
  imgActions: css`
    position: absolute;
    top: 6px;
    right: 6px;
    z-index: 2;
    display: flex;
    gap: 2px;
    padding: 3px;
    border-radius: ${token.borderRadius}px;
    background: rgba(0, 0, 0, 0.62);
    opacity: 0;
    transition: opacity 0.15s ease;
    button,
    a {
      color: #fff !important;
    }
    button:hover,
    a:hover {
      color: #fff !important;
      background: rgba(255, 255, 255, 0.22) !important;
    }
  `,
  imgPending: css`
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 1;
    color: ${token.colorTextTertiary};
    font-size: 12px;
    background: linear-gradient(
      100deg,
      ${token.colorFillTertiary} 30%,
      ${token.colorFillSecondary} 50%,
      ${token.colorFillTertiary} 70%
    );
    background-size: 200% 100%;
    animation: imgshimmer 1.4s ease-in-out infinite;
    @keyframes imgshimmer {
      from {
        background-position: 200% 0;
      }
      to {
        background-position: -200% 0;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      animation: none;
    }
  `,
}));

// Generated-image hover bar: download the file, or copy its prompt — mirrors the
// 收藏 panel's actions. No 重新生成 (would need lifting Composer's input — out of scope).
const ImageActions = memo(function ImageActions({ id, prompt }: { id: string; prompt: string }) {
  const { styles } = useStyles();
  const { message } = AntApp.useApp();
  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      message.success('提示词已复制');
    } catch {
      // clipboard unavailable — nothing to recover
    }
  };
  return (
    <div className={`${styles.imgActions} img-actions`}>
      <a href={imageFileUrl(id)} download={`${id}.png`} title="下载">
        <ActionIcon icon={Download} size="small" title="下载" />
      </a>
      <ActionIcon icon={Copy} size="small" title="复制提示词" onClick={copyPrompt} />
    </div>
  );
});

const CopyAction = memo(function CopyAction({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1400);
    } catch {
      // clipboard unavailable — nothing to recover, the user can select manually
    }
  };
  return (
    <ActionIcon
      icon={done ? Check : Copy}
      size="small"
      title={done ? '已复制' : '复制'}
      onClick={copy}
    />
  );
});

const ArtifactCard = memo(function ArtifactCard({ path, title }: { path: string; title: string }) {
  const { styles } = useStyles();
  const name = path.split('/').pop() || path;
  const isImg = /\.(png|jpe?g|gif|webp|svg)$/i.test(name);
  return (
    <div className={styles.artifactCard}>
      {isImg && (
        <img className={styles.artifactImg} src={workspaceFileUrl(path)} alt={title || name} />
      )}
      <div className={styles.artifactRow}>
        <FileDown size={16} />
        <span className={styles.artifactName} title={name}>
          {title || name}
        </span>
        <a className={styles.artifactDl} href={workspaceFileUrl(path, true)} download={name}>
          下载
        </a>
      </div>
    </div>
  );
});

type Props = {
  messages: Message[];
  busy?: boolean;
  onApprovalDecision?: (messageIndex: number, approve: boolean) => void;
  onSaveNote?: (messageIndex: number) => void;
  onPickPrompt?: (text: string) => void;
};

const SUGGESTED_PROMPTS = [
  { text: '把这段对话存成笔记', icon: NotebookPen },
  { text: '总结一下今天的工作', icon: ListChecks },
  { text: '搜索最新的 AI 进展', icon: Search },
  { text: '帮我解释一段代码', icon: Code2 },
] as const;

export default function ChatView({
  messages,
  busy,
  onApprovalDecision,
  onSaveNote,
  onPickPrompt,
}: Props) {
  const { styles } = useStyles();
  // framer-motion's JS transform/opacity tweens aren't covered by the global
  // CSS prefers-reduced-motion rule, so honour the setting explicitly: when
  // reduced, skip the entrance/stagger/lift props entirely.
  const reduceMotion = useReducedMotion();
  const scrollRef = useRef<HTMLDivElement>(null);
  // Stick to the bottom only while the user is already there; if they scroll up
  // to read history, streamed updates must not yank them back down.
  const stickRef = useRef(true);
  // The empty-state greeting personalizes with the profile name when set.
  const [name, setName] = useState('');
  useEffect(() => {
    getPrefs()
      .then((p) => setName(p.profile?.name ?? ''))
      .catch(() => {});
  }, []);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // A message the user just sent always pins us to the bottom.
    if (messages[messages.length - 1]?.role === 'user') stickRef.current = true;
    if (stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  if (messages.length === 0) {
    const h = new Date().getHours();
    const greeting =
      h < 6 ? '晚上好' : h < 11 ? '早上好' : h < 13 ? '上午好' : h < 18 ? '下午好' : '晚上好';
    return (
      <div className={styles.emptyScroll} ref={scrollRef}>
        <div className={styles.hero}>
          <DisplayHeading level={1} className={styles.greeting}>
            {greeting}
            {name && <span className={styles.greetingName}>,{name}</span>}
          </DisplayHeading>
          <div className={styles.heroDesc}>今天想从哪里开始?</div>
          <motion.div
            className={styles.cardGrid}
            {...(reduceMotion
              ? {}
              : { variants: staggerContainer, initial: 'hidden', animate: 'visible' })}
          >
            {SUGGESTED_PROMPTS.map((p) => (
              <motion.button
                key={p.text}
                type="button"
                className={styles.promptCard}
                {...(reduceMotion ? {} : { variants: staggerItem, whileHover: lift })}
                onClick={() => onPickPrompt?.(p.text)}
              >
                <span className={styles.promptIcon}>
                  <p.icon size={18} strokeWidth={1.75} />
                </span>
                <span className={styles.promptText}>{p.text}</span>
              </motion.button>
            ))}
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.scroll} ref={scrollRef} onScroll={onScroll}>
      <div className={styles.list}>
        {messages.map((m, i) =>
          m.role === 'user' ? (
            <motion.div
              key={i}
              className={styles.user}
              {...(!reduceMotion && i === messages.length - 1
                ? { variants: fadeRise, initial: 'hidden', animate: 'visible' }
                : {})}
            >
              {m.attachments && m.attachments.length > 0 && (
                <div className={styles.attachRow}>
                  {m.attachments.map((a, k) => (
                    <span key={k} className={styles.attachChip} title={a.name}>
                      <Paperclip size={11} />
                      {a.name}
                    </span>
                  ))}
                </div>
              )}
              {textOfBlocks(m.blocks)}
            </motion.div>
          ) : (
            (() => {
              const isStreaming = !!busy && i === messages.length - 1;
              const textContent = textOfBlocks(m.blocks);
              const hasTool = m.blocks.some((b) => b.kind === 'tool');
              const lastBlock = m.blocks[m.blocks.length - 1];
              const showThinking = isStreaming && !textContent && !hasTool;
              const showCaret = isStreaming && lastBlock?.kind === 'text' && !!textContent;
              const pending = m.blocks.filter(
                (b) => b.kind === 'tool' && b.step.approval === 'pending',
              ).length;

              return (
                <motion.div
                  key={i}
                  className={styles.assistant}
                  {...(!reduceMotion && i === messages.length - 1
                    ? { variants: fadeRise, initial: 'hidden', animate: 'visible' }
                    : {})}
                >
                  {groupBlocks(m.blocks).map((item) =>
                    item.kind === 'text' ? (
                      item.text ? (
                        <Markdown key={item.key} variant="chat">
                          {item.text}
                        </Markdown>
                      ) : null
                    ) : item.kind === 'artifact' ? (
                      <ArtifactCard key={item.key} path={item.path} title={item.title} />
                    ) : item.kind === 'diagram' ? (
                      <DiagramCard key={item.key} svg={item.svg} title={item.title} />
                    ) : item.kind === 'image' ? (
                      <div key={item.key} className={styles.imageGrid}>
                        {item.pending && item.ids.length === 0 ? (
                          <div className={styles.imageCard}>
                            <div className={styles.imgPending}>生成中…</div>
                          </div>
                        ) : (
                          item.ids.map((id) => (
                            <div key={id} className={styles.imageCard}>
                              <Image
                                src={imageFileUrl(id)}
                                alt={item.prompt}
                                preview={{ mask: false }}
                              />
                              <ImageActions id={id} prompt={item.prompt} />
                            </div>
                          ))
                        )}
                      </div>
                    ) : (
                      <div key={item.key} className={styles.tool}>
                        <ToolGroup steps={item.steps} />
                      </div>
                    ),
                  )}

                  {showThinking && (
                    <div className={styles.thinking}>
                      <span />
                      <span />
                      <span />
                    </div>
                  )}
                  {showCaret && <span className={styles.caret} />}

                  {pending > 0 && (
                    <div className={styles.tool}>
                      <ApprovalCard
                        count={pending}
                        onDecide={(approve) => onApprovalDecision?.(i, approve)}
                      />
                    </div>
                  )}

                  {textContent && !isStreaming && (
                    <div className={`${styles.actions} msg-actions`}>
                      <CopyAction text={textContent} />
                      {onSaveNote && (
                        <ActionIcon
                          icon={NotebookPen}
                          size="small"
                          title="存为笔记"
                          onClick={() => onSaveNote(i)}
                        />
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })()
          ),
        )}
      </div>
    </div>
  );
}
