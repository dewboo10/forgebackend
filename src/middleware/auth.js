// src/middleware/auth.js
import crypto from 'crypto'
import { prisma } from '../lib/prisma.js'

function validateTelegramData(initData) {
  if (!initData) return null
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) return null
  params.delete('hash')
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(process.env.TELEGRAM_BOT_TOKEN)
    .digest()
  const expectedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex')
  if (expectedHash !== hash) return null
  const user = params.get('user')
  return user ? JSON.parse(user) : null
}

export async function authMiddleware(req, res, next) {
  try {
    const initData = req.headers['x-telegram-init-data']

    // Dev bypass
    if (process.env.NODE_ENV === 'development' && !initData) {
      req.user = await prisma.user.upsert({
        where: { telegramId: BigInt(999999) },
        update: {},
        create: {
          telegramId: BigInt(999999),
          username: 'dev_user',
          firstName: 'Dev',
          referralCode: 'FORGE-DEV99',
        },
      })
      return next()
    }

    const tgUser = validateTelegramData(initData)
    if (!tgUser) return res.status(401).json({ error: 'Unauthorized' })

    const refCode = `FORGE-${tgUser.id.toString(36).toUpperCase().slice(-6)}`
    req.user = await prisma.user.upsert({
      where: { telegramId: BigInt(tgUser.id) },
      update: { username: tgUser.username, firstName: tgUser.first_name, lastName: tgUser.last_name },
      create: {
        telegramId: BigInt(tgUser.id),
        username: tgUser.username,
        firstName: tgUser.first_name,
        lastName: tgUser.last_name,
        referralCode: refCode,
      },
    })
    next()
  } catch (err) {
    console.error('Auth error:', err)
    res.status(500).json({ error: 'Auth failed' })
  }
}
