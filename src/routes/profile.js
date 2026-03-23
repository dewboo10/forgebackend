// src/routes/profile.js
import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { calcEffectiveRate } from '../lib/constants.js'

const router = Router()

// GET /api/profile
router.get('/', async (req, res) => {
  try {
    const user = req.user
    const [refCount, missionPoints, sessions] = await Promise.all([
      prisma.user.count({ where: { referredById: user.id } }),
      prisma.missionProgress.findMany({ where: { userId: user.id } }),
      prisma.miningSession.findMany({ where: { userId: user.id }, orderBy: { startedAt: 'desc' }, take: 10 }),
    ])

    const totalMissionRewards = 0 // sum from claimed checkpoints — simplified

    res.json({
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      telegramId: user.telegramId.toString(),
      balance: user.balance,
      totalMined: user.totalMined,
      effectiveRate: calcEffectiveRate(user.upgrades, user.purchased),
      upgrades: user.upgrades,
      purchased: user.purchased,
      referralCode: user.referralCode,
      referralCount: refCount,
      streakCount: user.streakCount,
      trustScore: user.trustScore,
      walletAddress: user.walletAddress,
      missionCheckpointsClaimed: missionPoints.length,
      recentSessions: sessions,
      createdAt: user.createdAt,
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed' })
  }
})

export default router
