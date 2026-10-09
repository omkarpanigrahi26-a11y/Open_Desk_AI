# OpenDesk AI - Backend Service

Production-grade Node.js + TypeScript layered backend architecture for OpenDesk AI, featuring Express REST APIs, real-time WebSocket telemetry, 3-Tier Multi-Agent routing, local file crawler, WhatsApp remote gateway, and Sequelize ORM connected to MySQL.

---

## 🏗️ Architecture

```
backend/
├── .env                              # Environment configuration
├── .env.example                      # Environment template
├── package.json                      # Dependencies and scripts
├── tsconfig.json                     # TypeScript compiler configuration
├── dist/                             # Compiled production build
└── src/
    ├── app.ts                        # Express application setup, middlewares, CORS
    ├── server.ts                     # Server bootstrap, HTTP + WebSocket integration
    ├── config/
    │   └── database.ts               # Sequelize MySQL connection pool & auto-db creation
    ├── models/
    │   ├── FileIndex.ts              # File metadata and snippet index model
    │   ├── TokenMetric.ts            # LLM token routing and usage metrics model
    │   └── index.ts                  # Barrel export & auto-synchronization (alter: true)
    ├── services/
    │   ├── indexing/
    │   │   └── fileCrawler.service.ts # Recursive disk scanner, code parser & MySQL upsert
    │   ├── remote/
    │   │   └── whatsapp.service.ts    # WhatsApp webhook, phone auth & formatted reply generator
    │   ├── router/
    │   │   ├── tier1Light.service.ts  # OS deterministic commands (0 tokens, sub-10ms)
    │   │   ├── tier2Moderate.service.ts # Local Ollama HTTP bridge (qwen2.5-coder / llama3.2)
    │   │   ├── tier3Complex.service.ts # Cloud reasoning model with unified git diffs
    │   │   └── classifier.service.ts  # 3-tier classifier, baseline calculation & MySQL metrics
    │   └── telemetry/
    │       ├── hardware.service.ts    # CPU, RAM, Disk, top processes & process termination
    │       └── window.service.ts      # Active window title, app name & PID
    ├── controllers/
    │   ├── files.controller.ts        # Search & reindexing controller
    │   ├── remote.controller.ts       # WhatsApp webhook & remote status controller
    │   └── dispatch.controller.ts     # Query dispatching & token savings controller
    ├── routes/
    │   ├── index.ts                   # API route aggregation (/api/...)
    │   ├── files.routes.ts            # /api/files/search, /api/files/reindex, /api/files/status
    │   ├── remote.routes.ts           # /api/remote/status
    │   ├── webhook.routes.ts          # /api/webhook/whatsapp (POST and GET)
    │   └── dispatch.routes.ts         # /api/dispatch, /api/dispatch/savings
    └── websocket/
        └── telemetrySocket.ts         # Real-time WebSocket stream on /ws/telemetry
```

---

## 🐬 MySQL Database & Auto-Creation

On launch, OpenDesk AI automatically connects to your MySQL server:
1. **Checks if database exists**: Automatically runs `CREATE DATABASE IF NOT EXISTS \`opendesk_db\` ...` if missing.
2. **Environment Controlled Model Sync (`DB_SYNC`)**:
   * If `DB_SYNC=true` in `.env`: Sequelize synchronizes model definitions (`sequelize.sync({ alter: true })`), reflecting tables (`file_indices`, `token_metrics`) in MySQL Workbench.
   * If `DB_SYNC=false` or omitted/undefined in `.env`: Model synchronization is skipped.

---

## 📡 API Endpoints

### 1. 3-Tier Multi-Agent Dispatch
* `POST /api/dispatch`: Dispatches query across Tier 1, Tier 2, or Tier 3.
  ```json
  { "query": "check cpu stats" }
  ```
* `GET /api/dispatch/savings`: Dynamic token savings metrics (today, all-time, % saved, USD savings).

### 2. File Indexer & Search
* `GET /api/files/search?q={query}&limit=10`: Searches files by name or code snippet in MySQL.
* `POST /api/files/reindex`: Triggers recursive scan on `~/Projects`, `~/Documents` (or custom paths in body/`.env`).
* `GET /api/files/status`: Returns current indexing stats and counts.

### 3. WhatsApp Remote Gateway
* `POST /api/webhook/whatsapp`: Receives mobile messages / voice transcripts from authorized phone number, executes action, and returns formatted reply.
  ```json
  {
    "from": "919876543210",
    "message": "check ram usage"
  }
  ```
* `GET /api/webhook/whatsapp`: Verification handshake for Meta WhatsApp Cloud API.
* `GET /api/remote/status`: Status of remote bridge, authorized numbers, and total processed requests.

### 4. Telemetry WebSocket
* `ws://localhost:3000/ws/telemetry`: Broadcasts live hardware snapshot (CPU, RAM, Disk, Top 5 processes) and active desktop window every 500ms.

---

## ⚙️ Environment Configuration (`backend/.env`)

```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_NAME=opendesk_db
DB_USER=root
DB_PASSWORD=your_password
DB_SYNC=true
NODE_ENV=development

# WhatsApp Remote Bridge
WHATSAPP_AUTHORIZED_NUMBER=919876543210
WHATSAPP_VERIFY_TOKEN=opendesk_verify_token

# File Indexer (Optional comma-separated paths; defaults to ~/Projects, ~/Documents)
INDEX_PATHS=
```

---

## 🚀 Quick Start

```bash
cd backend
npm run build
npm run start
```
*(For hot-reloading development server: `npm run dev`)*
