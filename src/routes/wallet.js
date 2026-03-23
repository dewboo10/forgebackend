// src/routes/wallet.js
import { Router } from 'express'
import { prisma } from '../lib/prisma.js'

const router = Router()

router.post('/link', async (req, res) => {
  try {
    const { address } = req.body
    if (!address) return res.status(400).json({ error: 'Missing address' })
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: { walletAddress: address },
    })
    res.json({ success: true, walletAddress: updated.walletAddress })
  } catch (err) {
    res.status(500).json({ error: 'Failed' })
  }
})

router.get('/', async (req, res) => {
  res.json({ walletAddress: req.user.walletAddress })
})

export default router
