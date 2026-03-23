// src/services/autoMine.js
// Runs every hour — credits auto-mine earnings to all users
// who have an active auto-mine purchase

import { prisma } from '../lib/prisma.js'
import { calcEffectiveRate, hasAutoMine } from '../lib/constants.js'

const PROCESS_INTERVAL_MS = 60 * 60 * 1000 // every hour

export function startAutoMineProcessor() {
  console.log('⚙️  Auto-mine processor started')
  // Run immediately on start, then every hour
  processAutoMine()
  setInterval(processAutoMine, PROCESS_INTERVAL_MS)
}

async function processAutoMine() {
  try {
    const now = new Date()
    console.log(`[AutoMine] Processing at ${now.toISOString()}`)

    // Get all users who have auto-mine and haven't been credited in >50 mins
    const cutoff = new Date(now.getTime() - 50 * 60 * 1000)

    const users = await prisma.user.findMany({
      where: {
        lastClaimAt: { lt: cutoff },
      },
      select: {
        id: true,
        upgrades: true,
        purchased: true,
        lastClaimAt: true,
        referredById: true,
      },
    })

    let credited = 0
    for (const user of users) {
      if (!hasAutoMine(user.purchased)) continue

      const rate = calcEffectiveRate(user.upgrades, user.purchased)
      const secondsElapsed = Math.floor((now.getTime() - new Date(user.lastClaimAt).getTime()) / 1000)
      const earned = rate * secondsElapsed

      if (earned <= 0) continue

      await prisma.user.update({
        where: { id: user.id },
        data: {
          balance: { increment: earned },
          totalMined: { increment: earned },
          lastClaimAt: now,
        },
      })

      // 10% passive to referrer
      if (user.referredById) {
        const refBonus = earned * 0.10
        await prisma.user.update({
          where: { id: user.referredById },
          data: { balance: { increment: refBonus }, totalMined: { increment: refBonus } },
        })
      }

      credited++
    }

    console.log(`[AutoMine] Credited ${credited} users`)
  } catch (err) {
    console.error('[AutoMine] Error:', err)
  }
}
