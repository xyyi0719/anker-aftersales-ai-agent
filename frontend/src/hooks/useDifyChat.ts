/**
 * Dify Chat Hook — V4.2 (image-aware)
 * - blocking mode + 自动 retry 400 类偶发失败（最多 3 次，间隔 1s）
 * - 失败时保留 assistant 占位消息 + 显示重试状态
 * - 图片支持：上传到 /files/upload 拿到 file_id，再用 file_id 调 chat-messages
 * - 工具调用从 metadata.retriever_resources 提取（chunk_id/出处）
 * - 单独发图片时自动用 placeholder query（Dify 不接受空 query）
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

interface DifyUploadedFile {
  id: string;
  name: string;
  size: number;
  mime_type: string;
  source_url?: string;
}

const RETRYABLE_STATUS = new Set([400, 408, 425, 429, 500, 502, 503, 504]);
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// 当用户只发图片没有文字时，Dify 后端要求 query 非空
const IMAGE_ONLY_PLACEHOLDER = '请帮我看看这张图片';

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

  /**
   * 将 data:URL/base64 转换为 File 对象
   */
  const dataUrlToFile = async (dataUrl: string, filename: string = 'image.png'): Promise<File> => {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return new File([blob], filename, { type: blob.type || 'image/png' });
  };

  /**
   * 上传单个文件到 Dify /files/upload
   */
  const uploadFile = async (file: File, retries: number = 2): Promise<DifyUploadedFile> => {
    for (let i = 0; i <= retries; i++) {
      try {
        const form = new FormData();
        form.append('file', file);
        form.append('user', userId);
        const resp = await fetch(`${apiUrl}/files/upload`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}` },
          body: form,
          signal: abortRef.current?.signal,
        });
        if (resp.ok) {
          return await resp.json();
        }
        if (i < retries) {
          await sleep(RETRY_DELAY_MS);
          continue;
        }
        const errText = await resp.text();
        throw new Error(`upload failed: HTTP ${resp.status}: ${errText.slice(0, 200)}`);
      } catch (e: any) {
        if (e.name === 'AbortError') throw e;
        if (i < retries) {
          await sleep(RETRY_DELAY_MS);
          continue;
        }
        throw e;
      }
    }
    throw new Error('upload max retries');
  };

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

    // Dify 要求 query 非空。如果只发图片，自动用 placeholder
    const hasFiles = files && files.length > 0;
    const hasText = query && query.trim().length > 0;
    const finalQuery = hasText ? query.trim() : (hasFiles ? IMAGE_ONLY_PLACEHOLDER : '');

    if (!finalQuery && !hasFiles) {
      setIsStreaming(false);
      setError('请输入消息或上传图片');
      return;
    }

    // 添加用户消息
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: hasText ? query.trim() : '',  // UI 显示空（图片单独发）
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

    try {
      // 1. 上传所有图片到 Dify /files/upload 拿 file_id
      let uploadedFiles: DifyUploadedFile[] = [];
      if (hasFiles) {
        updateAssistant('⏳ 上传图片中...');
        try {
          uploadedFiles = await Promise.all(
            files.map(async (f, i) => {
              // data:URL → File → upload
              if (f.url.startsWith('data:')) {
                const file = await dataUrlToFile(f.url, `image-${i}.png`);
                return await uploadFile(file);
              } else if (f.url.startsWith('http')) {
                // remote_url: Dify 支持远程 URL，但有些部署需要先下载再上传
                // 简化处理：直接传 remote_url
                return { id: f.url, name: `remote-${i}`, size: 0, mime_type: f.type, source_url: f.url };
              }
              throw new Error(`unsupported file url: ${f.url.slice(0, 30)}`);
            })
          );
        } catch (e: any) {
          setIsStreaming(false);
          setIsRetrying(false);
          setError(`图片上传失败: ${e.message || 'unknown'}`);
          updateAssistant(`❌ 图片上传失败：${e.message || 'unknown'}`);
          return;
        }
      }

      // 2. 构造 Dify API 的 files 参数
      const difyFiles = uploadedFiles.map((f, i) => ({
        type: 'image',
        transfer_method: f.source_url ? 'remote_url' : 'local_file',
        upload_file_id: f.source_url ? undefined : f.id,
        url: f.source_url,
      }));

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
              query: finalQuery,
              user: userId,
              conversation_id: conversationId || '',
              inputs: { emotion_history: '', ...inputs },
              response_mode: 'blocking',
              files: difyFiles.length > 0 ? difyFiles : undefined,
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
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      setIsStreaming(false);
      setIsRetrying(false);
      setError(e.message || 'Unknown error');
      updateAssistant(`❌ 错误：${e.message || 'unknown'}`);
    }
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