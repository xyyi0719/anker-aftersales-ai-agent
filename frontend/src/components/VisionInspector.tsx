import { IconCameraVision, IconSkipAhead, IconCheckCircle, IconAlertTriangle } from './SvgIcons';

export interface VisionTuple {
  brand?: string;
  product_model?: string;
  fault_location?: string;
  fault_phenomenon?: string;
  confidence?: number;
  is_anker_product?: boolean;
}

// 与 mock_apis/engine.py 的 VISION_SAFETY 保持一致；置信度阈值与后端同为 0.8。
const SAFETY_PHENOMENA = ['鼓包', '冒烟', '起火', '漏液', '焦黑', '异味'];
const CONFIDENCE_THRESHOLD = 0.8;

// 模型返回 unknown 表示"看了但看不出"，显示为未识别，不要留英文占位。
function readable(value?: string): string | undefined {
  return value && value !== 'unknown' ? value : undefined;
}

interface Props {
  vision?: VisionTuple;
  attachments?: Array<{ type: string; url: string }>;
  isStreaming?: boolean;
  onOpenBenchmark?: () => void;
}

export default function VisionInspector({ vision, attachments = [], isStreaming, onOpenBenchmark }: Props) {
  const hasImage = attachments.length > 0;
  const isConfidenceHigh = (vision?.confidence ?? 0) >= CONFIDENCE_THRESHOLD;
  const isSafetyRisk = SAFETY_PHENOMENA.some(p => vision?.fault_phenomenon?.includes(p));
  const product = readable(vision?.product_model);
  const location = readable(vision?.fault_location);
  const phenomenon = readable(vision?.fault_phenomenon);
  const brand = readable(vision?.brand);

  return (
    <div className="vision-inspector-card">
      <div className="vision-card-header">
        <div className="vision-header-title">
          <IconCameraVision size={18} color="#0084ff" />
          <span>看图办事 · 结构化四元组提取</span>
        </div>
        {onOpenBenchmark && (
          <button className="vision-benchmark-btn" onClick={onOpenBenchmark} title="查看12张基准测试集">
            <span>12张测试图集</span>
          </button>
        )}
      </div>

      {!hasImage && !vision ? (
        <div className="vision-empty-box">
          <IconCameraVision size={32} color="#64748b" />
          <p className="vision-empty-text">
            用户上传故障图后，自动提取「型号/部位/现象/置信度」四元组，并驱动排障树跳级。
          </p>
          {onOpenBenchmark && (
            <button className="vision-empty-action" onClick={onOpenBenchmark}>
              从 12 张基准测试集载入示例图 ↗
            </button>
          )}
        </div>
      ) : (
        <div className="vision-content-body">
          {/* 图片预览栏 */}
          {attachments.length > 0 && (
            <div className="vision-thumbnails-row">
              {attachments.map((img, i) => (
                <div key={i} className="vision-thumb-wrap">
                  <img src={img.url} alt={`上传图片 ${i + 1}`} className="vision-thumb-img" />
                  <span className="vision-thumb-badge">图 {i + 1}</span>
                </div>
              ))}
            </div>
          )}

          {/* 四元组参数卡 */}
          <div className="vision-tuple-grid">
            <div className="tuple-item">
              <span className="tuple-label">产品型号</span>
              <span className="tuple-value highlight">
                {product || (isStreaming ? '识别中...' : '待提取')}
              </span>
              {brand && <span className="tuple-sub">图上品牌：{brand}</span>}
            </div>
            <div className="tuple-item">
              <span className="tuple-label">故障部位</span>
              <span className="tuple-value">
                {location || (isStreaming ? '定位中...' : '待确认')}
              </span>
            </div>
            <div className="tuple-item">
              <span className="tuple-label">故障现象</span>
              <span className={`tuple-value ${isSafetyRisk ? 'danger' : ''}`}>
                {phenomenon || (isStreaming ? '分析中...' : '待确认')}
              </span>
            </div>
            <div className="tuple-item">
              <span className="tuple-label">提取置信度</span>
              <span className={`tuple-value ${isConfidenceHigh ? 'success' : 'muted'}`}>
                {typeof vision?.confidence === 'number'
                  ? `${(vision.confidence * 100).toFixed(0)}%`
                  : isStreaming
                  ? '测算中...'
                  : '—'}
              </span>
            </div>
          </div>

          {/* 安全类现象：不受置信度门槛限制，与 engine 的行为一致 */}
          {isSafetyRisk && (
            <div className="vision-skip-banner safety">
              <div className="skip-banner-icon">
                <IconAlertTriangle size={18} />
              </div>
              <div className="skip-banner-text">
                <span className="skip-title">🚨 安全高危故障 · 紧急终止排障</span>
                <span className="skip-desc">
                  检测到电芯物理形变/高温险情，系统已拦截普通换线流程，直升 P0 人工专员工单
                </span>
              </div>
            </div>
          )}

          {/* 只有屏幕异常会真正跳过现象提问；其余现象由对话回复说明，不在此宣称跳级 */}
          {!isSafetyRisk && isConfidenceHigh && phenomenon === '屏幕异常' && (
            <div className="vision-skip-banner skip">
              <div className="skip-banner-icon">
                <IconSkipAhead size={18} />
              </div>
              <div className="skip-banner-text">
                <span className="skip-title">⚡ 视觉置信度达标 · 排障树已跳级</span>
                <span className="skip-desc">
                  图片已确认「{phenomenon}」，自动跳过现象提问，仍需核验用户已尝试的动作
                </span>
              </div>
            </div>
          )}

          {vision?.is_anker_product === false && (
            <div className="vision-skip-banner boundary">
              <div className="skip-banner-icon">
                <IconCheckCircle size={18} color="#f59e0b" />
              </div>
              <div className="skip-banner-text">
                <span className="skip-title">非 Anker 生态产品 · 边界拒答生效</span>
                <span className="skip-desc">
                  图像识别判定为竞品设备，Agent 诚实提示服务范围，拒绝无关答复。
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
