# OpenDesk AI

OpenDesk AI is an autonomous, local-first PC desktop companion and multi-tier agent workstation built with **Electron**, **React (Vite)**, and **Node.js/Express (TypeScript)** backed by **MySQL**.

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** (v18 or higher)
- **MySQL Server** (e.g. MySQL Workbench / MySQL 8.x)
- *(Optional)* [Ollama](https://ollama.com/) for local Tier 2 AI tasks (e.g. `qwen2.5-coder:32b`, `llama3.2`)

### 2. Installation
Install dependencies in the root, backend, and frontend:

```bash
# Install root orchestration dependencies
npm install

# Install backend dependencies
cd backend && npm install && cd ..

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### 3. Environment Configuration

Copy the example environment file in `backend/` and configure your credentials:

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your local settings:
- **Database**: Set your `DB_PASSWORD` (MySQL Workbench password), `DB_USER`, and `DB_NAME`.
- **AI Keys**: *(Optional)* Set `GEMINI_API_KEY`, `OPENAI_API_KEY`, or `ANTHROPIC_API_KEY`.
- **Remote Gateway**: Set `WHATSAPP_AUTHORIZED_NUMBER` to your phone number if using WhatsApp remote commands.

> **Security Note:** Never commit your `.env` file or personal keys to version control. The `.gitignore` is pre-configured to keep your secrets private.

### 4. Running OpenDesk AI

Run the complete stack (Electron desktop container + Vite frontend + Node.js backend) with a single command:

```bash
npm run dev
```

---

## 🏗️ Project Architecture

- **`electron/`**: Frameless desktop application container, system tray integration, global shortcuts, and lifecycle management.
- **`frontend/`**: Cyberpunk glassmorphic dashboard built with React, Vite, Lucide Icons, and Tailwind CSS.
- **`backend/`**: Express + TypeScript server with:
  - **3-Tier Routing**: Deterministic OS automation (Tier 1), local Ollama (Tier 2), and Cloud LLMs (Tier 3).
  - **Hardware Telemetry**: Real-time CPU, RAM, disk, and active window monitoring over WebSocket.
  - **File Indexing**: Fast file indexing and code search with MySQL.
  - **WhatsApp Bridge**: Secure remote command execution.
- **`scripts/`**: Windows auto-start scripts and background execution helpers.

---

## 🔒 Security & Privacy

- All sensitive credentials and database passwords are kept in `.env` files and excluded from git.
- Local PC actions require user confirmation or authorized whitelisted phone numbers.
