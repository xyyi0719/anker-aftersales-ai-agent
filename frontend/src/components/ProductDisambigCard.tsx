import { useState } from 'react';
import { IconCheckCircle, IconSparkles, IconGitBranch } from './SvgIcons';

export interface ProductCandidate {
  id: string;
  name: string;
  category?: string;
  description?: string;
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
    <div className="product-disambig-container">
      <div className="product-disambig-header">
        <IconGitBranch size={16} color="#0084ff" />
        <span className="disambig-title">产品型号消歧确认 (S1 Pro 歧义处理)</span>
      </div>
      <p className="disambig-instruction">
        检测到多款产品共用 "S1 Pro" 命名，请点击确认您正在排查的具体设备：
      </p>

      <div className="disambig-cards-grid">
        {candidates.map(c => {
          const isSelected = selected === c.id;
          const isCleaner = c.name.includes('扫地机') || c.name.includes('RoboVac');
          return (
            <button
              key={c.id}
              className={`disambig-card-btn ${isSelected ? 'selected' : ''}`}
              onClick={() => handleClick(c)}
              disabled={disabled}
            >
              <div className="disambig-card-top">
                <span className="disambig-category-badge">
                  {isCleaner ? '智能清洁系列' : '母婴健康系列'}
                </span>
                {isSelected && <IconCheckCircle size={16} color="#10b981" />}
              </div>
              <div className="disambig-product-name">{c.name}</div>
              <div className="disambig-product-desc">
                {c.description || (isCleaner ? '全能洗地扫地机器人 · 负压滚刷系统' : '穿戴式静音智能吸奶器 · 舒适仿生节奏')}
              </div>
              <div className="disambig-btn-action">
                <span>{isSelected ? '✓ 已确认选择' : '确认是此型号 →'}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="disambig-footer-hint">
        <IconSparkles size={14} color="#f59e0b" />
        <span>选择后 Agent 将自动载入专属 SOP 故障树并继续精准诊断</span>
      </div>
    </div>
  );
}