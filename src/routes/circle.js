// src/routes/circle.js
import { Router } from 'express'
import { prisma } from '../lib/prisma.js'

const router = Router()

function calcTrustScore(verifiedCount) {
  return Math.round((verifiedCount / 5) * 100)
}

// GET /api/circle
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id
    const [members, incoming] = await Promise.all([
      prisma.circleMember.findMany({
        where: { ownerId: userId },
        include: { member: { select: { id:true, username:true, firstName:true, telegramId:true } } },
      }),
      prisma.circleRequest.findMany({
        where: { receiverId: userId, status: 'pending' },
        include: { sender: { select: { id:true, username:true, firstName:true, telegramId:true } } },
      }),
    ])

    const verifiedCount = members.filter(m => m.verified).length
    const trustScore = calcTrustScore(verifiedCount)

    res.json({
      members: members.map(m => ({
        id: m.id,
        memberId: m.memberId,
        name: m.member.username || m.member.firstName,
        verified: m.verified,
        addedAt: m.addedAt,
      })),
      incoming: incoming.map(r => ({
        id: r.id,
        senderId: r.senderId,
        name: r.sender.username || r.sender.firstName,
        since: r.createdAt,
      })),
      trustScore,
      verifiedCount,
      slots: 5,
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed' })
  }
})

// POST /api/circle/invite — send circle request to another user
router.post('/invite', async (req, res) => {
  try {
    const { telegramId } = req.body
    const user = req.user

    const currentCount = await prisma.circleMember.count({ where: { ownerId: user.id } })
    if (currentCount >= 5) return res.status(400).json({ error: 'Circle is full' })

    const target = await prisma.user.findUnique({ where: { telegramId: BigInt(telegramId) } })
    if (!target) return res.status(404).json({ error: 'User not found' })
    if (target.id === user.id) return res.status(400).json({ error: 'Cannot add yourself' })

    await prisma.circleRequest.upsert({
      where: { senderId_receiverId: { senderId: user.id, receiverId: target.id } },
      update: { status: 'pending' },
      create: { senderId: user.id, receiverId: target.id },
    })

    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to invite' })
  }
})

// POST /api/circle/accept
router.post('/accept', async (req, res) => {
  try {
    const { requestId } = req.body
    const user = req.user

    const request = await prisma.circleRequest.findFirst({
      where: { id: requestId, receiverId: user.id, status: 'pending' },
    })
    if (!request) return res.status(404).json({ error: 'Request not found' })

    const currentCount = await prisma.circleMember.count({ where: { ownerId: request.senderId } })
    if (currentCount >= 5) return res.status(400).json({ error: 'Their circle is full' })

    const [, updated] = await Promise.all([
      prisma.circleRequest.update({ where: { id: requestId }, data: { status: 'accepted' } }),
      prisma.circleMember.upsert({
        where: { ownerId_memberId: { ownerId: request.senderId, memberId: user.id } },
        update: { verified: true },
        create: { ownerId: request.senderId, memberId: user.id, verified: true },
      }),
    ])

    // Update trust score for the requester
    const verifiedCount = await prisma.circleMember.count({ where: { ownerId: request.senderId, verified: true } })
    await prisma.user.update({
      where: { id: request.senderId },
      data: { trustScore: calcTrustScore(verifiedCount) },
    })

    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to accept' })
  }
})

// POST /api/circle/decline
router.post('/decline', async (req, res) => {
  try {
    const { requestId } = req.body
    const request = await prisma.circleRequest.findFirst({
      where: { id: requestId, receiverId: req.user.id },
    })
    if (!request) return res.status(404).json({ error: 'Not found' })
    await prisma.circleRequest.update({ where: { id: requestId }, data: { status: 'declined' } })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed' })
  }
})

// DELETE /api/circle/:memberId
router.delete('/:memberId', async (req, res) => {
  try {
    await prisma.circleMember.deleteMany({
      where: { ownerId: req.user.id, memberId: Number(req.params.memberId) },
    })
    const verifiedCount = await prisma.circleMember.count({ where: { ownerId: req.user.id, verified: true } })
    await prisma.user.update({
      where: { id: req.user.id },
      data: { trustScore: calcTrustScore(verifiedCount) },
    })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed' })
  }
})

export default router
