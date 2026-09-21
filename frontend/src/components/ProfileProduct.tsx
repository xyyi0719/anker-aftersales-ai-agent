import type { TroubleshootingState } from '../types';
import { safeSource } from '../utils/evidence';
import VisionInspector from './VisionInspector';

interface Props {
  state: TroubleshootingState;
  attachments: Array<{ type: string; url: string }>;
  isStreaming?: boolean;
}

// 契约 C：缺失字段显示占位，不编造数值或型号
function val(v?: string | number | null, placeholder = '未识别'): string {
  if (v === undefined || v === null || v === '' || v === 'unknown') return placeholder;
  return String(v);
}

export default function ProfileProduct({ state, attachments, isStreaming }: Props) {
  const user = state.user;
  const vision = state.visionEvidence;
  const citations = state.citations || [];

  const userText = user?.name
    ? `${user.name}${user.tier ? `（${user.tier}）` : ''}`
    : '未识别';

  return (
    <section className="layer-profile" aria-label="用户档案与产品信息">
      <div className="profile-grid">
        <div className="profile-block">
          <h4 className="block-title">用户档案</h4>
          <dl className="kv-list">
            <div className="kv-row"><dt>用户</dt><dd>{userText}</dd></div>
            <div className="kv-row"><dt>订单</dt><dd>{val(user?.order_id || state.orderId)}</dd></div>
            <div className="kv-row"><dt>渠道</dt><dd>{val(user?.channel)}</dd></div>
            <div className="kv-row"><dt>保修</dt><dd>{val(user?.warranty)}</dd></div>
          </dl>
        </div>

        <div className="profile-block">
          <h4 className="block-title">产品信息</h4>
          <dl className="kv-list">
            <div className="kv-row"><dt>型号</dt><dd>{val(vision?.product_model || state.productModel, '待提取')}</dd></div>
            <div className="kv-row"><dt>品类</dt><dd>{val(state.productCategory)}</dd></div>
            <div className="kv-row"><dt>区域</dt><dd>{val(user?.region)}</dd></div>
            <div className="kv-row"><dt>状态</dt><dd>{state.safetyLatched ? '安全熔断' : '正常'}</dd></div>
          </dl>
          {/* 部位 / 现象 / 置信度 与安全横幅：只用 evidence 的真实视觉数据 */}
          <VisionInspector
            vision={vision}
            attachments={attachments}
            isStreaming={isStreaming}
          />
        </div>
      </div>

      <div className="evidence-block">
        <h4 className="block-title">处理依据</h4>
        {citations.length > 0 ? (
          <ul className="citation-list">
            {citations.map((c, i) => {
              const url = safeSource(c.metadata?.source_url);
              return (
                <li key={i} className="citation-item">
                  <span className="citation-id">{c.chunk_id}</span>
                  <span className="citation-text">{c.text}</span>
                  {url && (
                    <a className="citation-link" href={url} target="_blank" rel="noreferrer">官方来源</a>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="evidence-empty">暂无依据</p>
        )}
      </div>
    </section>
  );
}
