import { Tag } from 'antd';
import type { ModelInfo } from '../../api/providers';

export function CapabilityTag({ model }: { model: ModelInfo }) {
  if (model.vision === true) {
    return (
      <Tag color="processing" style={{ marginInlineEnd: 0 }}>
        视觉
      </Tag>
    );
  }
  if (model.vision === false) {
    return <Tag style={{ marginInlineEnd: 0 }}>文本</Tag>;
  }
  return <Tag style={{ marginInlineEnd: 0 }}>未检测</Tag>;
}
