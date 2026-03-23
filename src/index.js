// src/index.js
import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'

import authRouter from './routes/auth.js'
import miningRouter from './routes/mining.js'
import storeRouter from './routes/store.js'
import referralsRouter from './routes/referrals.js'
import missionsRouter from './routes/missions.js'
import circleRouter from './routes/circle.js'
import profileRouter from './routes/profile.js'
import walletRouter from './routes/wallet.js'
import leaderboardRouter from './routes/leaderboard.js'
import dailyRouter from './routes/daily.js'

import { authMiddleware } from './middleware/auth.js'
import { prisma } from './lib/prisma.js'
import { startAutoMineProcessor } from './services/autoMine.js'

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: process.env.FRONTEND_URL, methods: ['GET','POST'] }
})

// ── Middleware ──────────────────────────────────────────────
app.use(helmet())
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }))
app.use(express.json())
app.use(rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true }))

// ── Health check ────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }))

// ── Public routes ───────────────────────────────────────────
app.use('/api/auth', authRouter)

// ── Protected routes ────────────────────────────────────────
app.use('/api/mining',     authMiddleware, miningRouter)
app.use('/api/store',      authMiddleware, storeRouter)
app.use('/api/referrals',  authMiddleware, referralsRouter)
app.use('/api/missions',   authMiddleware, missionsRouter)
app.use('/api/circle',     authMiddleware, circleRouter)
app.use('/api/profile',    authMiddleware, profileRouter)
app.use('/api/wallet',     authMiddleware, walletRouter)
app.use('/api/leaderboard',authMiddleware, leaderboardRouter)
app.use('/api/daily-reward',authMiddleware, dailyRouter)

// ── Socket.io — real-time balance updates ───────────────────
io.use((socket, next) => {
  const userId = socket.handshake.auth.userId
  if (!userId) return next(new Error('Unauthorized'))
  socket.userId = Number(userId)
  next()
})
io.on('connection', socket => {
  socket.join(`user:${socket.userId}`)
  socket.on('disconnect', () => {})
})
export { io }

// ── Start ───────────────────────────────────────────────────
const PORT = process.env.PORT || 3001
httpServer.listen(PORT, async () => {
  console.log(`⛏  Forge backend running on port ${PORT}`)
  startAutoMineProcessor()
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  await prisma.$disconnect()
  process.exit(0)
})
