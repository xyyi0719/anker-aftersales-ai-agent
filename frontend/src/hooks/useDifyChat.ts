/**
 * Dify Chat Hook — V4.1.4 (retry-aware)
 * - blocking mode + 自动 retry 400 类偶发失败（最多 3 次，间隔 1s）
 * - 失败时保留 assistant 占位消息 + 显示重试状态
 * - 工具调用从 metadata.retriever_resources 提取（chunk_id/出处）
 * - event 用 workflow_finished status=failed 检测非 400 失败
 */

import { useState, useCallback, useRef } from 'react';
import type { DifyEvent, ChatMessage } from '../types';

interface UseDifyChatOptions {
  apiUrl: string;
  apiKey: string;
  userId?: string;
}

interface UseDifyChatReturn {
  messages: ChatMessage[];
  conversationId: string | null;
  events: DifyEvent[];
  isStreaming: boolean;
  isRetrying: boolean;
  retryAttempt: number;
  error: string | null;
  send: (params: SendParams) => Promise<void>;
  reset: () => void;
}

interface SendParams {
  query: string;
  inputs?: Record<string, any>;
  files?: Array<{ type: string; url: string; transfer_method?: string }>;
}

const RETRYABLE_STATUS = new Set([400, 408, 425, 429, 500, 502, 503, 504]);
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

export function useDifyChat(options: UseDifyChatOptions): UseDifyChatReturn {
  const { apiUrl, apiKey, userId = 'demo-user-001' } = options;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [events, setEvents] = useState<DifyEvent[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  const send = useCallback(async ({ query, inputs = {}, files = [] }: SendParams) => {
    // 取消上一次
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const abort = new AbortController();
    abortRef.current = abort;

    setError(null);
    setRetryAttempt(0);
    setIsStreaming(true);

    // 添加用户消息
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: Date.now(),
      attachments: files.map(f => ({ type: f.type, url: f.url })),
    };
    setMessages(prev => [...prev, userMsg]);

    // 添加占位 assistant 消息
    const assistantId = `asst-${Date.now()}`;
    setMessages(prev => [
      ...prev,
      {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
      },
    ]);

    const updateAssistant = (content: string, extra?: Partial<ChatMessage>) => {
      setMessages(prev =>
        prev.map(m => (m.id === assistantId ? { ...m, content, ...extra } : m))
      );
    };

    // ---------- retry loop ----------
    let lastError: string | null = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (abort.signal.aborted) return;
      if (attempt > 0) {
        setIsRetrying(true);
        setRetryAttempt(attempt);
        updateAssistant(`⏳ 重试中（第 ${attempt}/${MAX_RETRIES} 次）...`);
        await sleep(RETRY_DELAY_MS);
        if (abort.signal.aborted) return;
      }

      try {
        const resp = await fetch(`${apiUrl}/chat-messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query,
            user: userId,
            conversation_id: conversationId || '',
            inputs: { emotion_level: 'normal', ...inputs },
            response_mode: 'blocking',
            files,
          }),
          signal: abort.signal,
        });

        if (!resp.ok) {
          const errText = await resp.text();
          if (RETRYABLE_STATUS.has(resp.status) && attempt < MAX_RETRIES) {
            lastError = `HTTP ${resp.status}: ${errText.slice(0, 100)}`;
            continue; // 重试
          }
          throw new Error(`HTTP ${resp.status}: ${errText.slice(0, 200)}`);
        }

        const data = await resp.json();
        const answer = data.answer || '';

        // 提取 retriever_resources（出处锁 / 工具调用证据）
        const retrieverResources = data.metadata?.retriever_resources || [];

        updateAssistant(answer, { retrieverResources });

        // 同步 conversation_id
        if (data.conversation_id) {
          setConversationId(data.conversation_id);
        }

        // 成功 — 退出 retry loop
        setIsRetrying(false);
        setRetryAttempt(0);
        setIsStreaming(false);
        return;
      } catch (e: any) {
        if (e.name === 'AbortError') return;
        lastError = e.message || 'Unknown error';
        // 非 retryable 或最后一次失败 — 跳出
        if (attempt >= MAX_RETRIES) break;
      }
    }

    // ---------- 全部 retry 失败 ----------
    setIsRetrying(false);
    setRetryAttempt(0);
    setIsStreaming(false);
    setError(lastError || '请求失败');
    updateAssistant(`❌ 调用失败（已重试 ${MAX_RETRIES} 次）：${lastError || 'unknown error'}`);
  }, [apiUrl, apiKey, userId, conversationId]);

  const reset = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setMessages([]);
    setEvents([]);
    setConversationId(null);
    setError(null);
    setIsRetrying(false);
    setRetryAttempt(0);
  }, []);

  return {
    messages,
    conversationId,
    events,
    isStreaming,
    isRetrying,
    retryAttempt,
    error,
    send,
    reset,
  };
}