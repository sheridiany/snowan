import { Claude, Gemini, OpenAI } from '@lobehub/icons';

export function ProviderIcon({ kind, size = 40 }: { kind: string; size?: number }) {
  if (kind === 'anthropic') return <Claude.Avatar size={size} />;
  if (kind === 'openai') return <OpenAI.Avatar size={size} />;
  if (kind === 'google') return <Gemini.Avatar size={size} />;
  return (
    <img
      src="/snowan-icon.png"
      width={size}
      height={size}
      alt="Snowan"
      style={{ borderRadius: size > 24 ? 9 : 6 }}
    />
  );
}
