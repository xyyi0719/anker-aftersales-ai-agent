import {useEffect,useRef,useState,KeyboardEvent} from 'react';
import type {ChatMessage} from '../types';
import {visibleAnswer} from '../utils/evidence';
interface Props {messages:ChatMessage[];isStreaming:boolean;onSend:(text:string,files?:Array<{type:string;url:string}>)=>void;onReset:()=>void;error:string|null}
export default function ChatWindow({messages,isStreaming,onSend,onReset,error}:Props) {
  const [input,setInput]=useState('');const [images,setImages]=useState<string[]>([]);const [fileError,setFileError]=useState('');
  const fileRef=useRef<HTMLInputElement>(null);const end=useRef<HTMLDivElement>(null);
  useEffect(()=>{end.current?.scrollIntoView({block:'nearest'});},[messages]);
  function send() {if(isStreaming||(!input.trim()&&!images.length))return;onSend(input.trim(),images.map(url=>({type:'image',url})));setInput('');setImages([]);}
  function keyDown(e:KeyboardEvent<HTMLTextAreaElement>) {if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();send();}}
  async function upload(files:FileList|null) {
    setFileError('');if(!files)return;
    const all=Array.from(files);
    if(images.length+all.length>3){setFileError('最多上传 3 张图片');return;}
    if(all.some(f=>!['image/jpeg','image/png'].includes(f.type)||f.size>5*1024*1024)){setFileError('请上传 5 MB 以内的 JPG 或 PNG 图片');return;}
    try {const urls=await Promise.all(all.map(file=>new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=reject;r.readAsDataURL(file);})));setImages(v=>[...v,...urls]);}catch{setFileError('读取图片失败，请重新选择');}
  }
  return <div className="chat">
    <div className="messages" role="log" aria-label="聊天记录" aria-live="polite">
      {!messages.length&&<div className="welcome"><span className="welcome-mark">A</span><h2>你好，有什么可以帮你？</h2><p>可以从产品型号和故障现象说起。<br/>信息不足时，我会先问清楚。</p></div>}
      {messages.map(m=><article key={m.id} className={`message ${m.role}`}><div className="message-author">{m.role==='user'?'你':'售后助手'}</div><div className="message-content">{visibleAnswer(m.content)|| (m.role==='assistant'?<span className="working">正在核实，请稍候<span className="loading-dots">…</span></span>:'图片已上传')}</div>
        {!!m.attachments?.length&&<div className="attached-images">{m.attachments.map((a,i)=><img src={a.url} alt={`故障图片 ${i+1}`} key={i}/>)}</div>}
      </article>)}<div ref={end}/>
    </div>
    <div className="composer"><label className="sr-only" htmlFor="message-input">描述你的售后问题</label>
      {!!images.length&&<div className="image-previews">{images.map((src,i)=><div key={i}><img src={src} alt={`待发送图片 ${i+1}`}/><button aria-label={`移除图片 ${i+1}`} onClick={()=>setImages(v=>v.filter((_,j)=>i!==j))}>×</button></div>)}</div>}
      <textarea id="message-input" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={keyDown} placeholder="例如：Anker 737 充不进电，换过线还是没反应…" rows={3} disabled={isStreaming}/>
      {(fileError||error)&&<p role="alert" className="input-error">{fileError||error}</p>}
      <div className="composer-actions"><div><input ref={fileRef} type="file" accept="image/jpeg,image/png" multiple hidden onChange={e=>{upload(e.target.files);e.target.value='';}}/><button className="button secondary" disabled={isStreaming} onClick={()=>fileRef.current?.click()}>添加图片</button><button className="button quiet" disabled={!messages.length||isStreaming} onClick={()=>{onReset();setImages([]);setInput('');setFileError('');}}>新对话</button></div><button className="button primary" disabled={isStreaming||(!input.trim()&&!images.length)} onClick={send}>{isStreaming?'处理中…':'发送 ↑'}</button></div>
      <p className="input-hint">Enter 发送 · Shift + Enter 换行 · 最多 3 张图片</p>
    </div>
  </div>;
}
