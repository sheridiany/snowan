import { useEffect, useState } from 'react';
import { Select } from 'antd';
import { createStyles } from 'antd-style';
import { listProviders, setActiveImage, type ProvidersState } from '../../api/providers';
import { ProviderIcon } from '../settings/providerIcon';

const EMPTY: ProvidersState = {
  active: { provider: null, model: '' },
  active_image: { provider: null, model: '' },
  providers: [],
};
const SEP = ' '; // model ids never contain a NUL

const useStyles = createStyles(({ token, css }) => ({
  chip: css`
    display: inline-flex;
    align-items: center;
    height: 30px;
    padding: 0 4px 0 8px;
    border-radius: 8px;
    background: ${token.colorFillTertiary};
  `,
  select: css`
    min-width: 90px;
    max-width: 220px;
    .ant-select-selector {
      background: transparent !important;
      border: none !important;
      box-shadow: none !important;
      padding-inline: 0 !important;
      height: 28px !important;
    }
    .ant-select-selection-item {
      font-size: 12px;
      font-weight: 500;
      line-height: 28px !important;
      color: ${token.colorTextSecondary};
    }
  `,
  opt: css`
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
  `,
  optName: css`
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
}));

// The image-model picker — mirrors ModelSelect but filtered to image-capable
// models and bound to active_image (separate from the chat active model).
export default function ImageModelSelect() {
  const { styles } = useStyles();
  const [state, setState] = useState<ProvidersState>(EMPTY);

  const load = () => listProviders().then(setState).catch(() => {});
  useEffect(() => {
    load();
  }, []);

  // Only providers with a key, and only their image-generation models.
  const groups = state.providers
    .filter((p) => p.has_api_key)
    .map((p) => ({
      label: p.name,
      title: p.name,
      options: p.models
        .filter((m) => m.image_gen === true)
        .map((m) => ({
          value: `${p.id}${SEP}${m.id}`,
          label: (
            <span className={styles.opt}>
              <ProviderIcon kind={p.kind} size={16} />
              <span className={styles.optName}>{m.name}</span>
            </span>
          ),
        })),
    }))
    .filter((g) => g.options.length > 0);

  const value =
    state.active_image.provider && state.active_image.model
      ? `${state.active_image.provider}${SEP}${state.active_image.model}`
      : undefined;

  const onChange = async (v: string) => {
    const i = v.indexOf(SEP);
    try {
      setState(await setActiveImage(v.slice(0, i), v.slice(i + 1)));
    } catch {
      /* ignore */
    }
  };

  return (
    <div className={styles.chip}>
      <Select
        className={styles.select}
        value={value}
        onChange={onChange}
        onDropdownVisibleChange={(o) => o && load()}
        options={groups}
        variant="borderless"
        popupMatchSelectWidth={false}
        placement="topLeft"
        placeholder="选择模型"
        styles={{ popup: { root: { minWidth: 220 } } }}
        notFoundContent="无可用画图模型 · 去设置 → AI"
      />
    </div>
  );
}
