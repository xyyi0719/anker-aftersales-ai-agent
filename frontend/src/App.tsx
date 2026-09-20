import {useState} from 'react';
import {useDifyChat} from './hooks/useDifyChat';
import ChatWindow from './components/ChatWindow';
import {parseEvidence,safeSource} from './utils/evidence';

const taskNames: Record<string,string> = {order:'订单查询',warranty:'保修核验',policy:'政策分流',troubleshooting:'故障排查',faq:'资料检索',handoff:'人工交接',safety:'安全处理',emotion:'情绪处理',product:'产品确认',recall:'召回核实',scope:'服务范围'};
const statusNames: Record<string,string> = {waiting_user:'等待补充',found:'已找到',checked:'已核验',simulated:'模拟结果',answered:'已回答',resolved:'用户确认恢复',mock_pending:'模拟待接单',no_evidence:'依据不足',escalated:'需升级',not_found:'未找到',needs_review:'待审核',unsupported:'暂不支持'};
const nodeNames: Record<string,string> = {start:'确认故障现象',cable:'检查线材与充电头',output:'检查设备输出',display:'确认屏幕状态',hardware:'售后硬件核实',resolved:'已恢复',slow:'充电功率核实',uvp:'错误提示核实',balance:'检查音频平衡',pair:'重新连接',device:'更换设备验证'};
const nodeLabel = (name?: string) => name ? nodeNames[name] || '待确认步骤' : '见处理结果';
export default function App() {
  const chat = useDifyChat();
  const [details,setDetails] = useState(false);
  const lastAnswer = [...chat.messages].reverse().find(m=>m.role==='assistant');
  const evidence = parseEvidence(lastAnswer?.content||'');
  const examples = ['Anker 737 充不进电','DEMO-US-001 保修多久','这个型号有召回吗','我的 S1 Pro 不吸了'];
  return <div className="app-shell">
    <header className="app-header"><a className="brand" href="#main"><span className="brand-mark">A</span><span>Anker <strong>售后助手</strong></span></a>
      <div className="header-meta"><span className="demo-badge">参赛演示</span><span className="connection" role="status">{chat.isStreaming?'正在处理':chat.connected?'已收到服务回复':chat.error?'连接异常':'准备就绪'}</span></div></header>
    <main id="main" className={details?'workspace with-details':'workspace'}>
      <section className="conversation" aria-label="售后对话">
        <div className="conversation-heading"><div><p className="eyebrow">新航无Bug · 智能服务</p><h1>把问题说清，把售后办稳。</h1><p className="subheading">描述故障或上传照片，我们一起确认下一步。</p></div>
          <button className="button secondary" onClick={()=>setDetails(v=>!v)} aria-expanded={details} aria-controls="evidence-panel">{details?'收起处理依据':'查看处理依据'}</button></div>
        <div className="examples" aria-label="示例问题">{examples.map(q=><button key={q} disabled={chat.isStreaming} onClick={()=>chat.send({query:q})}>{q}</button>)}</div>
        <ChatWindow messages={chat.messages} isStreaming={chat.isStreaming} onSend={(query,files)=>chat.send({query,files})} onReset={chat.reset} error={chat.error}/>
        <p className="demo-note">订单、权益与工单为模拟数据；真实售后请联系官方客服。</p>
      </section>
      {details&&<aside id="evidence-panel" className="evidence-panel" aria-label="处理依据"><div className="panel-heading"><h2>处理依据</h2><span>本轮结果</span></div>
        {!evidence?<div className="evidence-empty"><span className="evidence-symbol">—</span><h3>{chat.isStreaming?'等待处理结果':'暂无结构化结果'}</h3><p>{lastAnswer?.content?'当前回复未提供可核验的结构化记录，暂不显示推断状态。':'完成一次对话后，可查看产品、排障路径和资料来源。'}</p></div>:<>
          <dl className="facts"><div><dt>产品</dt><dd>{evidence.product==='Anker737'?'Anker 737':evidence.product||'待确认'}</dd></div><div><dt>当前步骤</dt><dd>{nodeLabel(evidence.node)}</dd></div></dl>
          <section><h3>处理结果</h3><ul className="task-list">{evidence.tasks?.map((t,i)=><li key={i}><span>{taskNames[t.kind]||t.kind}</span><span className="task-status">{statusNames[t.status]||t.status}</span></li>)}</ul></section>
          {!!evidence.history?.length&&<details open><summary>排障记录 · {evidence.history.length} 步</summary><ol className="path-list">{evidence.history.map((h,i)=><li key={i}>{nodeLabel(h.from_node)} → {nodeLabel(h.to_node)}<small>{h.reason==='vision_symptom_only'?'图片辅助确认现象':h.response}</small></li>)}</ol></details>}
          {!!evidence.citations?.length&&<details open><summary>参考资料 · {evidence.citations.length} 条</summary>{evidence.citations.map(c=><article className="citation" key={c.chunk_id}><strong>{c.chunk_id}</strong><p>{c.text}</p>{safeSource(c.metadata?.source_url)?<a href={safeSource(c.metadata?.source_url)} target="_blank" rel="noreferrer">查看参考来源 ↗</a>:<small>{c.metadata?.source||'模拟配置'}</small>}</article>)}</details>}
          {evidence.vision?.product_model&&<details><summary>图片识别记录</summary><p>型号：{evidence.vision.product_model}</p><p>现象：{evidence.vision.phenomenon||'待确认'}</p><p>模型自评：{typeof evidence.vision.confidence==='number'?evidence.vision.confidence.toFixed(2):'未提供'}，不代表识别准确率。</p></details>}
          {evidence.ticket&&<div className="handoff"><h3>模拟交接已记录</h3><code>{evidence.ticket.ticket_id}</code><p>尚未发送给真实客服。</p></div>}
        </>}
      </aside>}
    </main>
  </div>;
}
