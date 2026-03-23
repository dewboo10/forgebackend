// src/routes/missions.js
import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { MISSIONS, calcEffectiveRate } from '../lib/constants.js'

const router = Router()

function getMissionProgress(user, missionKey, refCount) {
  if (missionKey === 'total_mined') return user.totalMined
  if (missionKey === 'blocks_found') {
    const sessions = 0 // simplified — in prod track separately
    return sessions
  }
  if (missionKey === 'referrals') return refCount
  if (missionKey === 'effective_rate') return calcEffectiveRate(user.upgrades, user.purchased)
  return 0
}

// GET /api/missions
router.get('/', async (req, res) => {
  try {
    const user = req.user
    const refCount = await prisma.user.count({ where: { referredById: user.id } })
    const claimed = await prisma.missionProgress.findMany({ where: { userId: user.id } })
    const claimedSet = new Set(claimed.map(c => `${c.missionId}:${c.checkpointIndex}`))

    const result = MISSIONS.map(m => {
      const progress = getMissionProgress(user, m.key, refCount)
      return {
        ...m,
        progress,
        checkpoints: m.checkpoints.map((cp, i) => ({
          ...cp,
          index: i,
          claimed: claimedSet.has(`${m.id}:${i}`),
          claimable: progress >= cp.at && !claimedSet.has(`${m.id}:${i}`),
        })),
      }
    })

    res.json(result)
  } catch (err) {
    res.status(500).json({ error: 'Failed' })
  }
})

// POST /api/missions/claim
router.post('/claim', async (req, res) => {
  try {
    const { missionId, checkpointIndex } = req.body
    const user = req.user

    const mission = MISSIONS.find(m => m.id === missionId)
    if (!mission) return res.status(400).json({ error: 'Unknown mission' })

    const cp = mission.checkpoints[checkpointIndex]
    if (!cp) return res.status(400).json({ error: 'Unknown checkpoint' })

    // Check not already claimed
    const existing = await prisma.missionProgress.findUnique({
      where: { userId_missionId_checkpointIndex: { userId: user.id, missionId, checkpointIndex } },
    })
    if (existing) return res.status(400).json({ error: 'Already claimed' })

    // Check progress
    const refCount = await prisma.user.count({ where: { referredById: user.id } })
    const progress = getMissionProgress(user, mission.key, refCount)
    if (progress < cp.at) return res.status(400).json({ error: 'Not reached yet' })

    const [, updated] = await Promise.all([
      prisma.missionProgress.create({ data: { userId: user.id, missionId, checkpointIndex } }),
      prisma.user.update({
        where: { id: user.id },
        data: { balance: { increment: cp.reward }, totalMined: { increment: cp.reward } },
      }),
    ])

    res.json({ success: true, reward: cp.reward, newBalance: updated.balance })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to claim' })
  }
})

export default router
