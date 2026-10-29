# SriNamo Farms Resort - Property Management System

## Quick Start

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- [Python 3.12+](https://www.python.org/downloads/) (for local dev)
- [Node.js 22+](https://nodejs.org/) (for frontend only)

### Option 1: Full Docker (everything in containers)

```bash
# 1. Clone and enter project
cd SriNamoFarms_Booking

# 2. Create .env from example
cp .env.example .env

# 3. Start everything (Postgres, Redis, MinIO, Backend, Frontend, n8n, Nginx)
docker-compose up -d

# 4. Wait for services to be healthy (~30 seconds), then run migrations + seed
docker-compose exec backend python -m prisma migrate dev --name init
docker-compose exec backend python seed.py
```

**Done. Open http://localhost in your browser.**

### Option 2: Docker for DB/Redis + Local Dev (recommended for development)

**Terminal 1 - Start infrastructure:**
```bash
docker-compose up -d postgres redis minio n8n
```

**Terminal 2 - Backend (Python + FastAPI):**
```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
# source venv/bin/activate

pip install -r requirements.txt
python seed.py
python -m uvicorn app.main:app --reload --port 3000
```

**Terminal 3 - Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**Done. Open http://localhost:5173 in your browser.**

> For local dev, update `.env` to use `localhost` instead of container names:
> ```
> DATABASE_URL=postgresql://srinamo:srinamo_secret_change_me@localhost:5432/srinamo_pms
> REDIS_HOST=localhost
> MINIO_ENDPOINT=http://localhost:9000
> ```

---

## Login Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@srinamo.com | admin123 |
| Receptionist | reception@srinamo.com | reception123 |

---

## Services & Ports

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | http://localhost:5173 | React PMS Dashboard |
| Backend API | http://localhost:3000/api | FastAPI REST API |
| API Docs | http://localhost:3000/docs | Swagger UI (auto-generated) |
| Nginx | http://localhost | Reverse proxy (production) |
| n8n | http://localhost:5678 | WhatsApp automation workflows |
| MinIO Console | http://localhost:9001 | File storage admin |
| PostgreSQL | localhost:5432 | Database |
| Redis | localhost:6379 | Cache |

---

## Useful Commands

```bash
# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Generate new migration after schema changes
cd backend && python -m alembic revision --autogenerate -m "description"

# Apply migrations
cd backend && python -m alembic upgrade head

# Stop everything
docker-compose down

# Stop and remove all data
docker-compose down -v
```

---

## Database lifecycle

A fresh database is created by `python seed.py`: it runs `create_all`, then stamps Alembic at head only when `alembic_version` is missing or empty. An existing database is updated with `alembic upgrade head` only. Do not stamp a database that already has a version row.

New schema changes are new revisions after `003_partner_geo`. Do not edit `001`, `002`, or `003`. Every revision includes `downgrade()`.

## Backup

ID files are kept forever on the backend disk (`uploads/`). A database dump does not include them. Back up both.

Postgres:

```bash
docker compose exec -T postgres pg_dump -U srinamo srinamo_pms > srinamo-backup.sql
```

Private uploads (ID documents, invoice PDFs, and call recordings in `uploads/call-recordings`). Recordings are not deleted automatically. The copy below includes that folder:

```bash
docker compose cp backend:/app/uploads ./srinamo-uploads-backup
```

Restore Postgres into an empty database, then put the files back:

```bash
docker compose exec -T postgres psql -U srinamo srinamo_pms < srinamo-backup.sql
docker compose cp ./srinamo-uploads-backup/. backend:/app/uploads
```

There is no scheduled backup job. Run these on a cadence you control.

## WhatsApp

Staff buttons in the CRM enqueue a message, check consent and DND, then POST to `{N8N_WEBHOOK_BASE}/{templateKey}` with `X-Webhook-Secret` when `WHATSAPP_ENABLED=true`. Import `n8n/workflows/booking-confirmation.json`, `checkin-reminder.json`, and `review-ask.json`. The send step is a placeholder: connect your own WhatsApp node in n8n. No Meta token is required in the PMS. When the flag is false, the outbox row is skipped.

`N8N_BLOCK_ENV_ACCESS_IN_NODE=false` lets Code nodes read `$env` (used for `N8N_WEBHOOK_SECRET`). Only trusted admins may edit n8n workflows.

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui + Recharts
- **Backend**: FastAPI (Python) + SQLAlchemy 2.0 async + asyncpg + Alembic + python-jose JWT
- **Database**: PostgreSQL 16 + Redis 7
- **Storage**: MinIO (S3-compatible)
- **Task Queue**: arq (async, Redis-backed)
- **Automation**: n8n (WhatsApp workflows)
- **Infra**: Docker Compose + Nginx
