import type { OptionChip } from '../types';

interface Props {
  options: OptionChip[];
  onSelect: (value: string) => void;
  disabled?: boolean;
}

// 契约 B：options 为空时什么都不渲染；最多展示 3 个。
// 点击发送的是 value（故障树选项键），label 只是给人看的文案。
export default function OptionChips({ options, onSelect, disabled }: Props) {
  const shown = (options || []).slice(0, 3);
  if (shown.length === 0) return null;

  return (
    <div className="option-chips">
      {shown.map(o => (
        <button
          key={o.value}
          type="button"
          className="option-chip"
          disabled={disabled}
          onClick={() => onSelect(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
