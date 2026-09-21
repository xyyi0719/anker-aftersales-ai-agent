// 动作接口：经同源代理访问 Mock 服务（开发环境见 vite.config.ts，生产见 deploy/nginx.conf 的 /mock-api）。
// 只发本动作请求，绝不伪装成聊天消息发给 Dify。

export interface TicketSnapshot {
  ticket_id: string;
  status: string;
  dispatched?: boolean;
}

export interface ActionResult {
  ok: boolean;
  ticket?: TicketSnapshot;
  message?: string;
  error?: string;
}

export async function transferToAgent(conversationId: string, ticketId: string): Promise<ActionResult> {
  try {
    const res = await fetch('/mock-api/api/chat/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversation_id: conversationId,
        action: 'transfer_to_agent',
        ticket_id: ticketId,
      }),
    });
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!res.ok || !data?.ok || !data?.ticket) {
      return { ok: false, error: data?.error || `http_${res.status}` };
    }
    return { ok: true, ticket: data.ticket, message: data.message };
  } catch {
    // 网络失败：交给调用方显示可重试提示，绝不假装成功
    return { ok: false, error: 'network_error' };
  }
}
