// src/routes/leaderboard.js
import { Router } from 'express'
import { prisma } from '../lib/prisma.js'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100)
    const top = await prisma.user.findMany({
      orderBy: { totalMined: 'desc' },
      take: limit,
      select: { id:true, username:true, firstName:true, totalMined:true, trustScore:true, purchased:true, createdAt:true },
    })

    const userRank = await prisma.user.count({
      where: { totalMined: { gt: req.user.totalMined } },
    })

    res.json({
      leaderboard: top.map((u, i) => ({
        rank: i + 1,
        name: u.username || u.firstName || `Miner_${u.id}`,
        totalMined: u.totalMined,
        trustScore: u.trustScore,
        isYou: u.id === req.user.id,
        badge: u.purchased.includes('auto_lifetime') ? 'SOVEREIGN' : u.totalMined > 1000000 ? 'ELITE' : 'MINER',
      })),
      yourRank: userRank + 1,
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed' })
  }
})

export default router
