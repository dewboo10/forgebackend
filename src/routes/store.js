// src/routes/store.js
import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { STORE_ITEMS, calcEffectiveRate, isItemActive } from '../lib/constants.js'
import { verifyTonTransaction } from '../services/tonVerify.js'

const router = Router()

// GET /api/store/items
// Returns all items with their current active/owned status
router.get('/items', async (req, res) => {
  const user = req.user
  // Get full purchase history to check expiry
  const purchases = await prisma.purchase.findMany({
    where: { userId: user.id, status: 'confirmed' },
    select: { itemId: true, confirmedAt: true, status: true },
  })

  const items = Object.entries(STORE_ITEMS).map(([id, item]) => {
    let owned = false
    let active = false
    let expiresAt = null

    if (item.purchaseType === 'permanent') {
      owned = purchases.some(p => p.itemId === id)
      active = owned
    } else if (item.purchaseType === 'expirable') {
      const latest = purchases
        .filter(p => p.itemId === id)
        .sort((a, b) => new Date(b.confirmedAt) - new Date(a.confirmedAt))[0]
      if (latest) {
        const exp = new Date(latest.confirmedAt)
        exp.setDate(exp.getDate() + item.daysActive)
        active = exp > new Date()
        expiresAt = exp.toISOString()
        owned = active // owned = currently active for expirables
      }
    }
    // consumable: never owned/active permanently

    return { id, ...item, owned, active, expiresAt }
  })

  res.json(items)
})

// GET /api/store/purchased
router.get('/purchased', async (req, res) => {
  const purchases = await prisma.purchase.findMany({
    where: { userId: req.user.id, status: 'confirmed' },
    select: { itemId: true, confirmedAt: true },
    orderBy: { confirmedAt: 'desc' },
  })

  // Build active purchased list
  const active = []
  for (const [id, item] of Object.entries(STORE_ITEMS)) {
    if (item.purchaseType === 'permanent') {
      if (purchases.some(p => p.itemId === id)) active.push(id)
    } else if (item.purchaseType === 'expirable') {
      const latest = purchases.filter(p => p.itemId === id)[0]
      if (latest) {
        const exp = new Date(latest.confirmedAt)
        exp.setDate(exp.getDate() + item.daysActive)
        if (exp > new Date()) active.push(id)
      }
    }
  }

  res.json({ purchased: active })
})

// POST /api/store/verify
router.post('/verify', async (req, res) => {
  try {
    const { boc, itemId } = req.body
    const user = req.user

    if (!boc || !itemId) return res.status(400).json({ error: 'Missing boc or itemId' })

    const item = STORE_ITEMS[itemId]
    if (!item) return res.status(400).json({ error: 'Unknown item' })

    // Block repurchase of permanent items only
    if (item.purchaseType === 'permanent') {
      const alreadyOwned = await prisma.purchase.findFirst({
        where: { userId: user.id, itemId, status: 'confirmed' },
      })
      if (alreadyOwned) return res.status(400).json({ error: 'Already owned permanently' })
    }

    // Block duplicate transaction hash (prevents replay attacks)
    const dupBoc = await prisma.purchase.findFirst({ where: { boc } })
    if (dupBoc) return res.status(400).json({ error: 'Transaction already used' })

    // Verify TON payment on-chain
    const verified = await verifyTonTransaction(boc, item.priceTON)
    if (!verified.ok) return res.status(400).json({ error: verified.reason })

    // Record in DB
    await prisma.purchase.create({
      data: {
        userId: user.id,
        itemId,
        priceTON: item.priceTON,
        boc,
        txHash: verified.txHash,
        status: 'confirmed',
        confirmedAt: new Date(),
      },
    })

    // ── Apply effects ────────────────────────────────────────

    // Consumable boosts — just verify payment, frontend activates
    if (item.type === 'boost') {
      return res.json({
        success: true,
        itemId,
        boost: { mult: item.mult, rem: item.rem },
        newBalance: user.balance,
      })
    }

    // Chests — instant FRG credit
    if (item.type === 'chest') {
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { balance: { increment: item.frg }, totalMined: { increment: item.frg } },
      })
      return res.json({
        success: true,
        itemId,
        frgCredited: item.frg,
        newBalance: updated.balance,
      })
    }

    // Permanent speed — mark in user.purchased for fast lookup
    if (item.purchaseType === 'permanent') {
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { purchased: { push: itemId } },
      })
      return res.json({
        success: true,
        itemId,
        purchased: updated.purchased,
        newBalance: updated.balance,
        newRate: calcEffectiveRate(updated.upgrades, updated.purchased),
      })
    }

    // Expirable items (auto_7d, auto_30d, speed_3x etc)
    // No change to purchased array — expiry is tracked via Purchase table
    return res.json({
      success: true,
      itemId,
      daysActive: item.daysActive,
      expiresAt: new Date(Date.now() + item.daysActive * 86400000).toISOString(),
      newBalance: user.balance,
    })

  } catch (err) {
    console.error('Store verify error:', err)
    res.status(500).json({ error: 'Verification failed' })
  }
})

export default router
