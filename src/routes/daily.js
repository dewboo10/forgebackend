// src/routes/daily.js
import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { DAILY_REWARDS } from '../lib/constants.js'

const router = Router()

// GET /api/daily-reward
router.get('/', async (req, res) => {
  try {
    const user = req.user
    const now = new Date()
    const lastStreak = user.lastStreakAt ? new Date(user.lastStreakAt) : null

    // Check if already claimed today
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const alreadyClaimed = lastStreak && lastStreak >= todayStart

    // Check if streak is still alive (claimed yesterday or today)
    const yesterdayStart = new Date(todayStart.getTime() - 86400000)
    const streakAlive = lastStreak && lastStreak >= yesterdayStart

    const currentStreak = streakAlive ? user.streakCount : 0
    const dayIndex = currentStreak % DAILY_REWARDS.length
    const reward = DAILY_REWARDS[dayIndex]

    res.json({
      alreadyClaimed,
      currentStreak,
      nextStreak: currentStreak + 1,
      reward,
      nextReward: DAILY_REWARDS[(dayIndex + 1) % DAILY_REWARDS.length],
      allRewards: DAILY_REWARDS,
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed' })
  }
})

// POST /api/daily-reward/claim
router.post('/claim', async (req, res) => {
  try {
    const user = req.user
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterdayStart = new Date(todayStart.getTime() - 86400000)

    const lastStreak = user.lastStreakAt ? new Date(user.lastStreakAt) : null
    if (lastStreak && lastStreak >= todayStart) {
      return res.status(400).json({ error: 'Already claimed today' })
    }

    const streakAlive = lastStreak && lastStreak >= yesterdayStart
    const newStreak = streakAlive ? user.streakCount + 1 : 1
    const dayIndex = (newStreak - 1) % DAILY_REWARDS.length
    const reward = DAILY_REWARDS[dayIndex]

    const [updated] = await Promise.all([
      prisma.user.update({
        where: { id: user.id },
        data: {
          balance: { increment: reward },
          totalMined: { increment: reward },
          streakCount: newStreak,
          lastStreakAt: now,
        },
      }),
      prisma.dailyReward.create({
        data: { userId: user.id, day: newStreak, reward },
      }),
    ])

    res.json({ success: true, reward, newStreak, newBalance: updated.balance })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to claim' })
  }
})

export default router
