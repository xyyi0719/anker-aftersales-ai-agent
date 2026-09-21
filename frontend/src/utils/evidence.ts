export interface Evidence {
  schema_version: number;
  mock: boolean;
  product?: string;
  emotion?: string;
  node?: string;
  tasks?: Array<{kind: string; status: string}>;
  citations?: Array<{chunk_id: string; text: string; metadata?: {source?: string; source_url?: string}}>;
  history?: Array<{from_node: string; to_node: string; reason?: string; response?: string}>;
  vision?: {
    brand?: string;
    product_model?: string;
    fault_location?: string;
    fault_phenomenon?: string;
    confidence?: number;
    is_anker_product?: boolean;
  };
  ticket?: {ticket_id: string; dispatched: boolean};
  transfer_summary?: {reason?: string};
}
const MARKER = /__EVIDENCE_V1__([A-Za-z0-9+/=]+)__EVIDENCE_END__/;
export function parseEvidence(content: string): Evidence | null {
  const m = content.match(MARKER);
  if (!m) return null;
  try {
    const bytes = Uint8Array.from(atob(m[1]), c => c.charCodeAt(0));
    const data = JSON.parse(new TextDecoder().decode(bytes));
    if (data?.schema_version !== 1 || data.mock !== true) return null;
    return data;
  } catch { return null; }
}
export function visibleAnswer(content: string): string {
  return content.replace(MARKER, '').replace(/__STATE__\{[\s\S]*?\}__STATE__/g, '')
    .replace(/__PRODUCT_DISAMBIG__[\s\S]*?__PRODUCT_DISAMBIG_END__/g, '').trim();
}
export function safeSource(url?: string): string | undefined {
  try { const u = new URL(url || ''); return u.protocol === 'https:' ? u.href : undefined; } catch { return undefined; }
}
