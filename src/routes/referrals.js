// src/routes/referrals.js
import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { REF_TIERS, REFERRAL_BONUS_FRG } from '../lib/constants.js'

const router = Router()

// GET /api/referrals/info
router.get('/info', async (req, res) => {
  try {
    const user = req.user
    const refCount = await prisma.user.count({ where: { referredById: user.id } })
    const nextTier = REF_TIERS.find(t => refCount < t.refs) || null
    res.json({
      referralCode: user.referralCode,
      referralCount: refCount,
      frgEarned: refCount * REFERRAL_BONUS_FRG,
      nextTier,
      tiers: REF_TIERS.map(t => ({ ...t, reached: refCount >= t.refs })),
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed' })
  }
})

// GET /api/referrals/list
router.get('/list', async (req, res) => {
  try {
    const refs = await prisma.user.findMany({
      where: { referredById: req.user.id },
      select: { id:true, username:true, firstName:true, totalMined:true, createdAt:true },
      orderBy: { totalMined: 'desc' },
      take: 50,
    })
    res.json(refs)
  } catch (err) {
    res.status(500).json({ error: 'Failed' })
  }
})

// GET /api/referrals/tiers
router.get('/tiers', async (req, res) => {
  try {
    const user = req.user
    const refCount = await prisma.user.count({ where: { referredById: user.id } })
    // Get claimed tiers from purchased array (stored as "ref_tier_1", "ref_tier_3" etc)
    const claimedTiers = user.purchased
      .filter(p => p.startsWith('ref_tier_'))
      .map(p => Number(p.replace('ref_tier_', '')))

    res.json(REF_TIERS.map(t => ({
      ...t,
      reached: refCount >= t.refs,
      claimed: claimedTiers.includes(t.refs),
    })))
  } catch (err) {
    res.status(500).json({ error: 'Failed' })
  }
})

// POST /api/referrals/claim
// Body: { refs: number } — which tier to claim
router.post('/claim', async (req, res) => {
  try {
    const { refs } = req.body
    const user = req.user
    const tier = REF_TIERS.find(t => t.refs === refs)
    if (!tier) return res.status(400).json({ error: 'Unknown tier' })

    const tierKey = `ref_tier_${refs}`
    if (user.purchased.includes(tierKey)) {
      return res.status(400).json({ error: 'Already claimed' })
    }

    const refCount = await prisma.user.count({ where: { referredById: user.id } })
    if (refCount < refs) return res.status(400).json({ error: 'Not enough referrals yet' })

       
    // Apply reward

    // Auto-mine rewards
   // Replace the update call with:
const pushItems = [tierKey]
if (tier.rewardType === 'automine') pushItems.push(`reward_auto_${refs}`)
if (tier.rewardType === 'lifetime')  pushItems.push('auto_lifetime')
if (tier.rewardType === 'permanent') pushItems.push('speed_perm')

const updated = await prisma.user.update({
  where: { id: user.id },
  data: {
    balance:    { increment: tier.frgBonus },
    totalMined: { increment: tier.frgBonus },
    purchased:  { push: pushItems },
  },
})
    res.json({ success: true, frgBonus: tier.frgBonus, newBalance: updated.balance, tier })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to claim' })
  }
})

// POST /api/referrals/apply
// Body: { code: string }
router.post('/apply', async (req, res) => {
  try {
    const { code } = req.body
    const user = req.user

    if (user.referredById) return res.status(400).json({ error: 'Already used a referral code' })

    const referrer = await prisma.user.findUnique({ where: { referralCode: code } })
    if (!referrer) return res.status(404).json({ error: 'Invalid referral code' })
    if (referrer.id === user.id) return res.status(400).json({ error: 'Cannot refer yourself' })

    // Bonus for both
    await Promise.all([
      prisma.user.update({
        where: { id: user.id },
        data: { referredById: referrer.id, balance: { increment: 5000 }, totalMined: { increment: 5000 } },
      }),
      prisma.user.update({
        where: { id: referrer.id },
        data: { balance: { increment: 5000 }, totalMined: { increment: 5000 } },
      }),
    ])

    res.json({ success: true, bonus: 5000 })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to apply referral' })
  }
})


export default router
