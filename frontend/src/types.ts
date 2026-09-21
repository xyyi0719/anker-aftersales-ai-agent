// ========== Dify 事件类型 ==========

export type DifyEvent =
  | { event: 'message'; message_id: string; conversation_id: string; answer: string; created_at: number }
  | { event: 'agent_message'; message_id: string; conversation_id: string; answer: string; created_at: number }
  | { event: 'agent_thought'; message_id: string; conversation_id: string; position: number; thought: string; tool?: string; tool_input?: any; message_files?: string[]; observation?: string }
  | { event: 'tool_call'; message_id: string; conversation_id: string; tool_name: string; tool_input: any; tool_output: any }
  | { event: 'message_end'; message_id: string; conversation_id: string; metadata?: { retriever_resources?: any[]; usage?: any } }
  | { event: 'message_file'; message_id: string; conversation_id: string; type: string; url: string; belongs_to: string }
  | { event: 'error'; message_id?: string; conversation_id?: string; code: string; message: string; status: number }
  | { event: 'ping'; timestamp: number };

// ========== 业务事件（从 agent_thought 中解析） ==========

export interface ParsedEvent {
  id: string;
  timestamp: number;
  type: 'intent' | 'emotion' | 'vision' | 'tool_call' | 'tool_result' | 'retrieval' | 'routing' | 'state_change' | 'message' | 'escalation';
  title: string;
  detail: string;
  data?: any;
}

// ========== 聊天消息 ==========

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  thinking?: string;
  toolCalls?: Array<{ name: string; input: any; output?: any }>;
  attachments?: Array<{ type: string; url: string }>;
  retrieverResources?: Array<{
    position?: number;
    dataset_id?: string;
    dataset_name?: string;
    document_id?: string;
    document_name?: string;
    segment_id?: string;
    score?: number;
    content?: string;
  }>;
}

// ========== 排障状态 ==========

export interface TroubleshootingState {
  intent?: string;
  emotionLevel?: 'normal' | 'upset' | 'angry' | 'angry_escalated' | 'complaint';
  emotionIntensity?: 'L0_none' | 'L1_mild' | 'L2_strong' | 'L3_priority';
  emotionTrigger?: string;
  emotionHistory?: Array<{ level: string; trigger: string; query: string }>;
  consecutiveAngry?: number;
  empathyApplied?: boolean;
  productModel?: string;
  productCategory?: string;
  currentNode?: string;
  action?: string;
  safety?: boolean;
  ambiguous?: boolean;
  candidates?: string[];
  path: Array<{ node: string; choice: string; timestamp: number }>;
  toolCalls: Array<{ name: string; input: any; output?: any; timestamp: number; status: 'running' | 'success' | 'failed' }>;
  visionEvidence?: {
    brand?: string;
    product_model: string;
    fault_location: string;
    fault_phenomenon: string;
    confidence: number;
    is_anker_product: boolean;
  };
  /** 契约 B：会话摘要（模型产出，透传） */
  summary?: string;
  /** 契约 B：情绪档位 L0–L3（模型判定） */
  emotion?: string;
  /** 契约 B：本轮意图数组（待 A 端回填 state.intents） */
  intents?: string[];
  /** 契约 B：排障追问的可点选项（最多 3 个） */
  options?: Array<{ label: string; value: string }>;
  /** 契约 B：依据快照，中层「处理依据」渲染 */
  citations?: Array<{ chunk_id: string; text: string; metadata?: { source?: string; source_url?: string } }>;
  /** 契约 B：模拟工单及其状态 */
  ticket?: { ticket_id: string; status?: string; dispatched?: boolean };
  orderId?: string;
  safetyLatched?: boolean;
  /** 契约 B：用户档案（待 A 端回填 state.user） */
  user?: UserProfile;
}

// ========== 可点选项芯片（B2）==========

export interface OptionChip {
  label: string;
  value: string;
}

// ========== 用户辅助气泡（B2）==========

export interface UserInsight {
  emotion?: string;
  intents?: string[];
  product?: string;
  keyInfo?: string;
}

// ========== 用户档案 ==========

export interface UserProfile {
  name?: string;
  tier?: string;
  order_id?: string;
  channel?: string;
  region?: string;
  warranty?: string;
}

// ========== 路由路径 ==========

export interface RoutingStep {
  id: string;
  type: 'intent' | 'emotion' | 'disambiguation' | 'order' | 'warranty' | 'troubleshooting' | 'policy' | 'tool' | 'escalation' | 'vision' | 'routing';
  label: string;
  result?: string;
  timestamp: number;
  status: 'pending' | 'running' | 'success' | 'failed';
}

// ========== 检索日志 ==========

export interface RetrievalRecord {
  id: string;
  query: string;
  results: Array<{
    chunk_id: string;
    text: string;
    score: number;
    metadata?: any;
  }>;
  confidence: number;
  answerable: boolean;
  timestamp: number;
}

// ========== 情绪时间线 ==========

export interface EmotionPoint {
  timestamp: number;
  level: 'normal' | 'upset' | 'angry' | 'angry_escalated' | 'complaint';
  trigger?: string;
}

// ========== 任务列表项 ==========

export interface TaskItem {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  detail?: string;
  timestamp: number;
}