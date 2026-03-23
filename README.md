# Forge Backend

Node.js + Express + Prisma + PostgreSQL (Supabase)

## Setup

```bash
npm install
cp .env.example .env
# Fill in .env values

npx prisma generate
npx prisma db push   # creates tables in your Supabase DB

npm run dev          # development with auto-restart
npm start            # production
```

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL URL from Supabase |
| `TELEGRAM_BOT_TOKEN` | From @BotFather |
| `TON_RECIPIENT_ADDRESS` | Your TON wallet that receives payments |
| `TON_API_KEY` | From tonapi.io (free tier works) |
| `FRONTEND_URL` | Your frontend URL for CORS |
| `PORT` | Server port (default 3001) |

## API Endpoints

### Auth
- `POST /api/auth/login` — Validate Telegram initData, get/create user

### Mining
- `GET  /api/mining/state` — Get balance, rate, upgrades, auto-mine status
- `POST /api/mining/start` — Start mining session
- `POST /api/mining/stop` — Stop session, calculate earnings
- `POST /api/mining/claim-offline` — Claim auto-mine offline earnings
- `GET  /api/mining/upgrades` — List upgrades with costs
- `POST /api/mining/upgrades/buy` — Buy an upgrade with FRG

### Store
- `GET  /api/store/items` — All items + owned status
- `GET  /api/store/purchased` — User's purchased items
- `POST /api/store/verify` — Verify TON transaction → activate item

### Referrals
- `GET  /api/referrals/info` — Code, count, earnings, next tier
- `GET  /api/referrals/list` — List of referred users
- `GET  /api/referrals/tiers` — All tiers + claimed status
- `POST /api/referrals/claim` — Claim a tier reward

### Missions
- `GET  /api/missions` — All missions + progress + claimable
- `POST /api/missions/claim` — Claim a checkpoint reward

### Security Circle
- `GET    /api/circle` — Members + incoming requests
- `POST   /api/circle/invite` — Send invite to Telegram user
- `POST   /api/circle/accept` — Accept incoming request
- `POST   /api/circle/decline` — Decline incoming request
- `DELETE /api/circle/:memberId` — Remove circle member

### Profile & Misc
- `GET  /api/profile` — Full profile with stats
- `GET  /api/leaderboard?limit=50` — Global leaderboard
- `GET  /api/wallet` — Linked wallet address
- `POST /api/wallet/link` — Link TON wallet address
- `GET  /api/daily-reward` — Status + reward amount
- `POST /api/daily-reward/claim` — Claim today's reward

## Deployment (Render)

1. Create a new **Web Service** on render.com
2. Connect your GitHub repo
3. Build command: `npm install && npx prisma generate`
4. Start command: `npm start`
5. Add all environment variables in Render dashboard

## Database (Supabase)

1. Create project at supabase.com
2. Copy the connection string from Settings → Database
3. Paste as `DATABASE_URL` in your .env
4. Run `npx prisma db push` to create all tables

## TON Payments Flow

1. Frontend calls `tonConnectUI.sendTransaction()`
2. User approves in their TON wallet
3. Frontend receives the `boc` (bag of cells)
4. Frontend calls `POST /api/store/verify` with `{ boc, itemId }`
5. Backend verifies the transaction on TonAPI
6. If valid → item activated, balance credited
