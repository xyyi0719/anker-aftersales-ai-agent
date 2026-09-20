# 前端工作台 · 块5

## 功能
- 左：流式聊天窗
- 右：多面板（任务列表 / 排障进度 / 路由路径 / 情绪曲线 / 检索日志）
- 实时联动 Dify Chatflow（agent_thought / tool_call 事件流）

## 技术栈
- React 18 + TypeScript
- Vite（启动快、HMR 好）
- 纯手写 CSS（无 UI 库依赖，调试快、可控）

## 启动

```bash
cd frontend
npm install
cp .env.example .env
# 编辑 .env 填 Dify URL 和 key
npm run dev
```

开发模式跑在 `http://localhost:5173`

## 构建 + 公网化

```bash
npm run build      # 输出到 dist/
npm run preview    # 本地预览 build 产物
```

部署选项：
- **Vercel / Netlify**：拖 `dist/` 上去即得公网 URL
- **Cloudflare Pages**：连接 GitHub 自动部署
- **Nginx**：把 `dist/` 部署到服务器

决赛前必须公网化，工作台要和 Dify 跨域调用。

## 环境变量

| 变量 | 必填 | 说明 |
|---|---|---|
| `VITE_DIFY_API_URL` | ✅ | Dify 服务地址，如 `https://dify.xxx.com/v1` |
| `VITE_DIFY_API_KEY` | ✅ | Dify App 的 API key |
| `VITE_USE_MOCK` | ❌ | 设 `true` 走内置 Mock（演示前可断网演示） |

## 目录

```
frontend/
├── src/
│   ├── App.tsx               # 主应用
│   ├── main.tsx              # 入口
│   ├── styles.css            # 全部样式
│   ├── types.ts              # TS 类型
│   ├── components/
│   │   ├── ChatWindow.tsx    # 左聊天窗
│   │   ├── SidePanel.tsx     # 右面板容器
│   │   ├── TaskList.tsx      # 任务列表 / 排障进度
│   │   ├── RoutingPath.tsx   # 路由路径
│   │   ├── EmotionChart.tsx  # 情绪曲线
│   │   └── RetrievalLog.tsx  # 检索日志
│   └── hooks/
│       ├── useDifyChat.ts    # Dify 流式 chat
│       └── useEventParser.ts # 事件类型解析
├── index.html
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## 演示钩子（决定性瞬间截图素材）

### 截图 1：看图跳级
1. 上传一张 737 鼓包的照片
2. 聊天窗显示：「我看到照片里似乎是 Anker 737 底部鼓包，请问您已经停止使用了吗？」
3. **右面板检索日志**显示视觉识别四元组 + 置信度 ≥ 0.8 触发跳级
4. **右面板路由路径**显示：`根 → 视觉识别 → 鼓包分支（跳级）`
5. 📸 截这一屏

### 截图 2：多意图歧义 + 路由
1. 输入：「我的 S1 Pro 不吸了」
2. 系统识别歧义 → 给出「吸奶器 vs 扫地机器人」二选一追问
3. **右面板路由路径**显示：`意图:故障报修 → 消歧:产品歧义 → 追问`
4. 用户选「扫地机器人」→ 路由表匹配 → 转到 Anker 客服处理
5. 📸 截这一屏

### 截图 3：诚实升级
1. 输入：「我买的 Anker 737 鼓包了，能不能保修？」（情绪词）
2. 系统识别情绪 upset → 主动升级
3. **右面板情绪曲线**显示当前等级 upset
4. 转人工摘要显示：「P1 紧急，建议直接换货」
5. 📸 截这一屏

## 降级预案（块5.3）

如果工作台没成型：
1. 用 Dify 自带的 Chatflow 测试页（更稳）
2. 在 Dify 自带页跑演示
3. 截图作为证据

工作台是有则加分的，没成型不纠结。

## 公网化（决赛必做）

最快方案：**Vercel**

```bash
npm install -g vercel
vercel --prod
```

会得到 `https://xxx.vercel.app` 公网 URL，1 分钟搞定。