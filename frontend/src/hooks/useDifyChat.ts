import { useState, useCallback, useRef } from 'react';
import type { ChatMessage } from '../types';

function visitorId() {
  try {
    const existing = sessionStorage.getItem('anker-visitor');
    if (existing) return existing;
    const id = crypto.randomUUID(); sessionStorage.setItem('anker-visitor',id); return id;
  } catch { return `visitor-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
}
export function useDifyChat({apiUrl = '/dify-api'}: {apiUrl?: string} = {}) {
  const [messages,setMessages] = useState<ChatMessage[]>([]);
  const [conversationId,setConversationId] = useState<string | null>(null);
  const [isStreaming,setBusy] = useState(false);
  const [error,setError] = useState<string | null>(null);
  const [connected,setConnected] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const userId = useRef(visitorId());
  const send = useCallback(async ({query,files=[]}: {query:string;files?:Array<{type:string;url:string}>}) => {
    if (busy.current || (!query.trim() && !files.length)) return;
    busy.current = true;
    const abort = new AbortController(); abortRef.current = abort;
    const timer = window.setTimeout(()=>abort.abort('timeout'),120000);
    setBusy(true); setError(null);
    const id = `assistant-${Date.now()}`;
    setMessages(prev=>[...prev,{id:`user-${Date.now()}`,role:'user',content:query,timestamp:Date.now(),attachments:files},
      {id,role:'assistant',content:'',timestamp:Date.now()}]);
    const update = (content:string,extra:Partial<ChatMessage>={})=>setMessages(prev=>prev.map(m=>m.id===id?{...m,content,...extra}:m));
    try {
      const uploaded = await Promise.all(files.map(async f=>{
        const blob = await (await fetch(f.url,{signal:abort.signal})).blob();
        const form = new FormData();
        form.append('file',blob,blob.type==='image/jpeg'?'image.jpg':'image.png'); form.append('user',userId.current);
        const response = await fetch(`${apiUrl}/files/upload`,{method:'POST',body:form,signal:abort.signal});
        if (!response.ok) throw new Error(`图片上传失败（${response.status}）`);
        const file = await response.json();
        if (!file.id) throw new Error('图片上传未返回文件编号');
        return {type:'image',transfer_method:'local_file',upload_file_id:file.id};
      }));
      const response = await fetch(`${apiUrl}/chat-messages`,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({query:query.trim()||'请查看图片并帮我排查',user:userId.current,conversation_id:conversationId||'',inputs:{},response_mode:'blocking',files:uploaded}),signal:abort.signal});
      if (!response.ok) throw new Error(`暂时无法获取回复（${response.status}），请稍后再试`);
      const data = await response.json();
      if (typeof data.answer !== 'string' || !data.conversation_id) throw new Error('服务响应不完整，请稍后再试');
      if (abort.signal.aborted) return;
      update(data.answer,{retrieverResources:data.metadata?.retriever_resources||[]});
      setConversationId(data.conversation_id);setConnected(true);
    } catch (e) {
      if (abort.signal.aborted && abort.signal.reason !== 'timeout') return;
      const message = abort.signal.reason === 'timeout' ? '等待回复超时，办理结果尚未确认，请稍后核实。' : (e instanceof Error?e.message:'连接失败，请重试');
      update(message); setError(message);setConnected(false);
    } finally {
      window.clearTimeout(timer);
      if (abortRef.current === abort) {setBusy(false);busy.current=false;}
    }
  },[apiUrl,conversationId]);
  const reset = useCallback(()=>{abortRef.current?.abort();abortRef.current=null;busy.current=false;setMessages([]);setConversationId(null);setError(null);setBusy(false);},[]);
  return {messages,conversationId,isStreaming,error,connected,send,reset};
}
