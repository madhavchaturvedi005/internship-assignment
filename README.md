# Fleet Pulse

Real-time GPS fleet tracking backend. IoT devices stream location pings over TCP. A WebSocket layer broadcasts live updates to authenticated dashboard clients.

## Architecture

```
IoT Device (TCP)
      |
      v
 TCP Server (:5000)
      |
      +---> In-memory queue (batch flush every 1s) ---> PostgreSQL
      |
      +---> WebSocket broadcast ---> Socket.io (:3000)
                                          |
                              JWT-authenticated clients
                              Admin: sees all IMEIs
                              Customer: sees only their IMEIs
```

## Local Setup

### Prerequisites
- Node.js 20+
- PostgreSQL running locally

### Steps

```bash
git clone https://github.com/madhavchaturvedi005/internship-assignment.git
cd internship-assignment/fleet-pulse

npm install

cp .env.example .env
# Edit .env with your DB credentials

npx prisma migrate deploy
npx prisma generate
npm run seed
npm start
```

### With Docker

```bash
make up       # starts postgres + app
make migrate  # runs migrations
make seed     # seeds DB
```

## Live Deployment (EC2)

| Service | URL |
|---------|-----|
| HTTP API | `http://13.49.240.170:3000` |
| WebSocket | `ws://13.49.240.170:3000` |
| TCP | `13.49.240.170:5000` |

## HTTP Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /auth/token | None | Issue JWT |
| GET | /devices | Admin | List all devices |
| GET | /devices/:imei/history | Admin or own Customer | Last 100 location logs |
| GET | /health | None | Status + pending queue count |

## TCP Protocol

```
PING,<imei>,<lat>,<lng>,<speed>,<ignition>\n
```

Example:
```
PING,354678901234561,18.5204,73.8567,42.5,1
```

## Index Strategy

- `Device.imei` — primary key, unique. All lookups are by IMEI.
- `LocationLog.imei` — foreign key + index. History queries filter by IMEI.
- `LocationLog.timestamp` — index. Time-range queries and ordering by recency.
- `User.email` — unique index. Auth lookups are always by email.

These cover the three hot query paths: device registration checks (O(1) in-memory Set), history retrieval by IMEI, and time-ordered log queries.

## TCP → DB Approach

Raw TCP data arrives at high frequency (potentially hundreds of pings/second). Writing each ping as an individual `INSERT` would saturate the DB connection pool quickly.

Instead, incoming parsed pings are pushed into an **in-memory array queue**. A `setInterval` fires every 1 second and calls `prisma.locationLog.createMany()` with the entire batch — a single round-trip regardless of how many pings arrived in that window.

Tradeoff: up to 1 second of data could be lost on a hard crash. The graceful shutdown handler (`SIGTERM`/`SIGINT`) flushes the queue before exit to minimize this window. For production, a write-ahead log or Redis queue would eliminate it entirely.

WebSocket broadcast happens **immediately** on packet receipt — before the DB write — so the dashboard latency is not affected by the batch interval.

## Seed Data

| Email | Role | Password |
|-------|------|----------|
| admin@fleetpulse.com | Admin | admin123 |
| customer@fleetpulse.com | Customer | customer123 |

5 registered IMEIs: `354678901234561` through `354678901234565`

## Known Limitations

- In-memory IMEI set requires restart to pick up newly registered devices
- No rate limiting on HTTP endpoints
- WebSocket runs on same port as HTTP (3000) via Socket.io upgrade — spec says 8080 but co-hosting avoids an extra open port
- `.env` on EC2 is managed manually; a secrets manager (AWS SSM, Vault) would be better in production

## Environment Variables

See `.env.example` for all required variables.
