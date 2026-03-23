// src/services/tonVerify.js
// Verifies a TON transaction using TonAPI

const TON_API_BASE = 'https://tonapi.io/v2'
const RECIPIENT = process.env.TON_RECIPIENT_ADDRESS
const API_KEY = process.env.TON_API_KEY

export async function verifyTonTransaction(boc, expectedTON) {
  try {
    if (!RECIPIENT) {
      // Dev mode — skip verification
      if (process.env.NODE_ENV === 'development') {
        return { ok: true, txHash: `dev_${Date.now()}` }
      }
      return { ok: false, reason: 'Recipient not configured' }
    }

    // Decode the BOC to get transaction hash
    const decodeRes = await fetch(`${TON_API_BASE}/blockchain/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
      },
      body: JSON.stringify({ boc }),
    })

    if (!decodeRes.ok) {
      const txt = await decodeRes.text()
      console.error('TON decode error:', txt)
      return { ok: false, reason: 'Failed to decode transaction' }
    }

    const decoded = await decodeRes.json()
    const txHash = decoded.message_hash || decoded.hash

    // Wait a moment for chain confirmation
    await new Promise(r => setTimeout(r, 3000))

    // Fetch the transaction details
    const txRes = await fetch(`${TON_API_BASE}/blockchain/transactions/${txHash}`, {
      headers: API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {},
    })

    if (!txRes.ok) return { ok: false, reason: 'Transaction not found on chain' }

    const tx = await txRes.json()

    // Verify recipient
    const toAddress = tx.out_msgs?.[0]?.destination?.address
    if (toAddress && !toAddress.toLowerCase().includes(RECIPIENT.toLowerCase().slice(-20))) {
      return { ok: false, reason: 'Wrong recipient address' }
    }

    // Verify amount (allow 1% tolerance for fees)
    const sentNano = BigInt(tx.out_msgs?.[0]?.value || 0)
    const expectedNano = BigInt(Math.round(expectedTON * 1e9))
    const minNano = (expectedNano * BigInt(99)) / BigInt(100)
    if (sentNano < minNano) {
      return { ok: false, reason: `Insufficient payment: sent ${sentNano}, expected ${expectedNano}` }
    }

    return { ok: true, txHash }
  } catch (err) {
    console.error('TON verify error:', err)
    // Dev fallback
    if (process.env.NODE_ENV === 'development') {
      return { ok: true, txHash: `dev_${Date.now()}` }
    }
    return { ok: false, reason: 'Verification error' }
  }
}
