import { useEffect, useRef, useState } from 'react';
import { IconCameraVision, IconAlertTriangle, IconCheckCircle } from './SvgIcons';
import { BENCHMARK_CASES, BENCHMARK_CATEGORIES, type BenchmarkCase } from '../data/benchmarkCases';

const ALL = '全部';
const TABS = [ALL, ...BENCHMARK_CATEGORIES];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelectCase: (testCase: BenchmarkCase, imageUrl: string) => void;
}

// 用例数据全部来自生成文件；此处不写死任何一条用例或一句期望描述。
export default function BenchmarkDrawer({ isOpen, onClose, onSelectCase }: Props) {
  const [filter, setFilter] = useState<string>(ALL);
  // 图片加载失败要看得见：静默隐藏会让人以为「这张图本来就没有内容」。
  const [brokenFiles, setBrokenFiles] = useState<string[]>([]);
  const closeRef = useRef<HTMLButtonElement>(null);

  // 打开时把焦点移进对话框，关闭时监听一起撤掉。
  useEffect(() => {
    if (!isOpen) return;
    closeRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filtered = filter === ALL ? BENCHMARK_CASES : BENCHMARK_CASES.filter(c => c.category === filter);

  return (
    <div className="benchmark-drawer-overlay" onClick={onClose}>
      <div
        className="benchmark-drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-label="视觉测试集"
        onClick={e => e.stopPropagation()}
      >
        <div className="benchmark-drawer-header">
          <div className="benchmark-header-info">
            <IconCameraVision size={22} color="#0084ff" />
            <div>
              <h3>视觉测试集 · {BENCHMARK_CASES.length} 例</h3>
              <p>图片来自公开网页，用于看图能力的内部回归；点击任一用例可装入会话</p>
            </div>
          </div>
          <button ref={closeRef} className="benchmark-close-btn" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>

        <div className="benchmark-filter-tabs">
          {TABS.map(tab => (
            <button
              key={tab}
              className={`benchmark-tab ${filter === tab ? 'active' : ''}`}
              onClick={() => setFilter(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="benchmark-cards-grid">
          {filtered.map(item => {
            const imageUrl = `/test-images/${encodeURIComponent(item.file)}`;
            const isSafety = item.category === '故障-安全';
            const isBoundary = item.category === '边界';
            const isBroken = brokenFiles.includes(item.file);

            return (
              <button
                key={item.id}
                type="button"
                className={`benchmark-card ${isSafety ? 'danger-edge' : ''}`}
                onClick={() => onSelectCase(item, imageUrl)}
                title="点击装入该测试图片与提问"
              >
                <div className="benchmark-thumb-wrapper">
                  {isBroken ? (
                    <span className="benchmark-thumb-broken">图片未加载</span>
                  ) : (
                    <img
                      src={imageUrl}
                      alt={item.title}
                      className="benchmark-thumb"
                      loading="lazy"
                      onError={() => setBrokenFiles(prev => (prev.includes(item.file) ? prev : [...prev, item.file]))}
                    />
                  )}
                  <span className={`benchmark-category-tag ${isSafety ? 'safety' : isBoundary ? 'boundary' : ''}`}>
                    {item.category}
                  </span>
                </div>
                <div className="benchmark-card-content">
                  <div className="benchmark-card-title">{item.title}</div>
                  <div className="benchmark-card-desc">
                    <strong>期望识别：</strong>
                    {item.expectedReading}
                  </div>
                  <div className={`benchmark-expected-action ${isSafety ? 'safety' : isBoundary ? 'boundary' : ''}`}>
                    {isSafety ? <IconAlertTriangle size={14} /> : <IconCheckCircle size={14} />}
                    <span>{item.expectedAction}</span>
                  </div>
                  <span className="benchmark-use-btn">装入此用例 →</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
