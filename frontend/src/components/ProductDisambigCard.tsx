import { useState } from 'react';

/**
 * 产品消歧卡片
 *
 * 触发场景：用户 query 含 'S1 Pro' 时，agent 不知道是 eufy 吸奶器还是 eufy RoboVac 扫地机。
 * 后端输出：__PRODUCT_DISAMBIG__{"candidates":[...]}__PRODUCT_DISAMBIG_END__
 * 前端：检测到 marker 后渲染两个候选卡片，点击后通过 onConfirm 回调发送预填消息
 */

export interface ProductCandidate {
  id: string;
  name: string;
  emoji?: string;
  description?: string;
  image?: string;
}

interface Props {
  candidates: ProductCandidate[];
  onConfirm: (candidateId: string, candidateName: string) => void;
  disabled?: boolean;
}

export default function ProductDisambigCard({ candidates, onConfirm, disabled }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  const handleClick = (c: ProductCandidate) => {
    if (disabled) return;
    setSelected(c.id);
    onConfirm(c.id, c.name);
  };

  return (
    <div className="product-disambig">
      <div className="product-disambig-title">
        🔍 请确认您说的是哪款产品
      </div>
      <div className="product-disambig-grid">
        {candidates.map(c => {
          const isSelected = selected === c.id;
          return (
            <button
              key={c.id}
              className={`product-card ${isSelected ? 'selected' : ''}`}
              onClick={() => handleClick(c)}
              disabled={disabled}
              title={`点击确认：${c.name}`}
            >
              <div className="product-card-emoji">
                {c.emoji || '📦'}
              </div>
              <div className="product-card-name">
                {c.name}
              </div>
              {c.description && (
                <div className="product-card-desc">
                  {c.description}
                </div>
              )}
              {isSelected && (
                <div className="product-card-check">✓</div>
              )}
            </button>
          );
        })}
      </div>
      <div className="product-disambig-hint">
        💡 点击对应产品卡片，AI 将继续为您排查问题
      </div>
    </div>
  );
}