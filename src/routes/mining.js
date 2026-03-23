// src/routes/mining.js
import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { calcEffectiveRate, calcUpgradeCost, UPGRADES, hasAutoMine } from '../lib/constants.js'

const router = Router()

// GET /api/mining/state
router.get('/state', async (req, res) => {
  try {
    const user = req.user
    const rate = calcEffectiveRate(user.upgrades, user.purchased)
    const autoMine = hasAutoMine(user.purchased)

    // Calculate offline earnings if auto-mine active
    let offlineEarnings = 0
    if (autoMine && user.lastClaimAt) {
      const secondsOffline = Math.floor((Date.now() - new Date(user.lastClaimAt).getTime()) / 1000)
      offlineEarnings = rate * secondsOffline
    }

    const refCount = await prisma.user.count({ where: { referredById: user.id } })

    res.json({
      balance: user.balance,
      totalMined: user.totalMined,
      effectiveRate: rate,
      upgrades: user.upgrades,
      purchased: user.purchased,
      isMining: !!user.miningStartedAt,
      miningStartedAt: user.miningStartedAt,
      hasAutoMine: autoMine,
      offlineEarnings: Math.floor(offlineEarnings),
      referralCount: refCount,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to get mining state' })
  }
})

// POST /api/mining/start
router.post('/start', async (req, res) => {
  try {
    const user = req.user
    if (user.miningStartedAt) return res.json({ already: true })

    const rate = calcEffectiveRate(user.upgrades, user.purchased)
    const [updated] = await Promise.all([
      prisma.user.update({
        where: { id: user.id },
        data: { miningStartedAt: new Date() },
      }),
      prisma.miningSession.create({
        data: { userId: user.id, rateAtStart: rate },
      }),
    ])

    res.json({ started: true, rate, miningStartedAt: updated.miningStartedAt })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to start mining' })
  }
})

// POST /api/mining/stop
router.post('/stop', async (req, res) => {
  try {
    const user = req.user
    if (!user.miningStartedAt) return res.json({ alreadyStopped: true })

    const rate = calcEffectiveRate(user.upgrades, user.purchased)
    const secondsMined = Math.floor((Date.now() - new Date(user.miningStartedAt).getTime()) / 1000)
    const earned = rate * secondsMined

    // Block chance: ~1.6% per 10 seconds = ~1 every ~625 seconds
    const blockBonus = Math.random() < (secondsMined / 625) ? rate * 12 : 0
    const total = earned + blockBonus

    const [updated] = await Promise.all([
      prisma.user.update({
        where: { id: user.id },
        data: {
          balance: { increment: total },
          totalMined: { increment: total },
          miningStartedAt: null,
          lastClaimAt: new Date(),
        },
      }),
      prisma.miningSession.updateMany({
        where: { userId: user.id, stoppedAt: null },
        data: { stoppedAt: new Date(), earnedFRG: total },
      }),
    ])

    // Passive referral income for whoever referred this user
    if (user.referredById && total > 0) {
      const refBonus = total * 0.10
      await prisma.user.update({
        where: { id: user.referredById },
        data: { balance: { increment: refBonus }, totalMined: { increment: refBonus } },
      })
    }

    res.json({
      earned: total,
      blockBonus,
      newBalance: updated.balance,
      totalMined: updated.totalMined,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to stop mining' })
  }
})

// POST /api/mining/claim-offline
router.post('/claim-offline', async (req, res) => {
  try {
    const user = req.user
    if (!hasAutoMine(user.purchased)) return res.status(403).json({ error: 'No auto-mine' })

    const rate = calcEffectiveRate(user.upgrades, user.purchased)
    const secondsOffline = Math.floor((Date.now() - new Date(user.lastClaimAt).getTime()) / 1000)
    const earned = rate * secondsOffline

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        balance: { increment: earned },
        totalMined: { increment: earned },
        lastClaimAt: new Date(),
      },
    })

    res.json({ earned, newBalance: updated.balance })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to claim offline earnings' })
  }
})

// GET /api/mining/upgrades
router.get('/upgrades', async (req, res) => {
  const user = req.user
  const result = UPGRADES.map(u => {
    const currentLevel = (user.upgrades)[u.id] || 0
    const cost = calcUpgradeCost(u.id, currentLevel)
    return { ...u, currentLevel, cost, maxed: currentLevel >= u.maxLevel }
  })
  res.json(result)
})

// POST /api/mining/upgrades/buy
router.post('/upgrades/buy', async (req, res) => {
  try {
    const { upgradeId } = req.body
    const user = req.user
    const u = UPGRADES.find(x => x.id === Number(upgradeId))
    if (!u) return res.status(400).json({ error: 'Unknown upgrade' })

    const currentLevel = (user.upgrades)[upgradeId] || 0
    if (currentLevel >= u.maxLevel) return res.status(400).json({ error: 'Already maxed' })

    const cost = calcUpgradeCost(u.id, currentLevel)
    if (user.balance < cost) return res.status(400).json({ error: 'Insufficient balance' })

    const newUpgrades = { ...user.upgrades, [upgradeId]: currentLevel + 1 }
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { balance: { decrement: cost }, upgrades: newUpgrades },
    })

    res.json({
      newLevel: currentLevel + 1,
      newBalance: updated.balance,
      newRate: calcEffectiveRate(newUpgrades, user.purchased),
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to buy upgrade' })
  }
})

export default router
