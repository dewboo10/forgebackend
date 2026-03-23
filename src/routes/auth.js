// src/routes/auth.js
import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'

const router = Router()

// POST /api/auth/login
// Validate Telegram initData, upsert user, return profile
router.post('/login', authMiddleware, async (req, res) => {
  try {
    const user = req.user
    const refCount = await prisma.user.count({ where: { referredById: user.id } })
    res.json({
      id: user.id,
      telegramId: user.telegramId.toString(),
      username: user.username,
      firstName: user.firstName,
      referralCode: user.referralCode,
      balance: user.balance,
      totalMined: user.totalMined,
      upgrades: user.upgrades,
      purchased: user.purchased,
      streakCount: user.streakCount,
      trustScore: user.trustScore,
      referralCount: refCount,
      walletAddress: user.walletAddress,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Login failed' })
  }
})

export default router
