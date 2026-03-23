// src/lib/constants.js

export const BASE_RATE = 0.1 // FRG per second

export const UPGRADES = [
  { id: 1, name: 'Neural Boost',  rateBonus: 0.5,  baseCost: 500,    maxLevel: 5 },
  { id: 2, name: 'Plasma Array',  rateBonus: 2.5,  baseCost: 2500,   maxLevel: 5 },
  { id: 3, name: 'Quantum Forge', rateBonus: 8,    baseCost: 10000,  maxLevel: 4 },
  { id: 4, name: 'Dark Matter',   rateBonus: 25,   baseCost: 40000,  maxLevel: 3 },
  { id: 5, name: 'Singularity',   rateBonus: 80,   baseCost: 180000, maxLevel: 2 },
]

// purchaseType:
//   'permanent'   — buy once, never expires, block repurchase (auto_lifetime, speed_perm)
//   'expirable'   — has a duration, can repurchase after expiry (auto_7d, auto_30d, speed_3x etc)
//   'consumable'  — can always buy again, no ownership check (boosts, chests, ref amps)

export const STORE_ITEMS = {
  // Auto-mine
  auto_7d:       { priceTON: 3,  type: 'automine', purchaseType: 'expirable',  daysActive: 7,    label: 'Auto-Mine 7 Days'   },
  auto_30d:      { priceTON: 10, type: 'automine', purchaseType: 'expirable',  daysActive: 30,   label: 'Auto-Mine 30 Days'  },
  auto_lifetime: { priceTON: 30, type: 'automine', purchaseType: 'permanent',  daysActive: null, label: 'Auto-Mine Lifetime' },
  // Speed multipliers
  speed_3x:      { priceTON: 4,  type: 'speed', purchaseType: 'expirable',  mult: 3, daysActive: 7,   label: '3× Speed 7 Days'   },
  speed_5x:      { priceTON: 8,  type: 'speed', purchaseType: 'expirable',  mult: 5, daysActive: 7,   label: '5× Speed 7 Days'   },
  speed_perm:    { priceTON: 18, type: 'speed', purchaseType: 'permanent',  mult: 2, daysActive: null,label: 'Permanent 2× Core'  },
  // Chests — consumable, buy as many as you want
  chest_s:       { priceTON: 2,  type: 'chest', purchaseType: 'consumable', frg: 25000,  label: 'Head Start S'  },
  chest_m:       { priceTON: 5,  type: 'chest', purchaseType: 'consumable', frg: 100000, label: 'Head Start M'  },
  chest_xl:      { priceTON: 14, type: 'chest', purchaseType: 'consumable', frg: 500000, label: 'Head Start XL' },
  // Referral amps — consumable
  ref_2x:        { priceTON: 5,  type: 'ref_amp', purchaseType: 'consumable', mult: 2, label: 'Referral 2× Amp' },
  ref_5x:        { priceTON: 15, type: 'ref_amp', purchaseType: 'consumable', mult: 5, label: 'Referral 5× Amp' },
  // Boosts — consumable, buy every time after free charges run out
  boost_surge:   { priceTON: 1,  type: 'boost', purchaseType: 'consumable', mult: 3, rem: 60,  label: '3× SURGE Boost' },
  boost_turbo:   { priceTON: 2,  type: 'boost', purchaseType: 'consumable', mult: 2, rem: 90,  label: 'TURBO Boost'    },
}

export const REF_TIERS = [
  { refs: 1,   rewardType: 'speed',    reward: '3× Speed 24H',      frgBonus: 5000    },
  { refs: 3,   rewardType: 'automine', reward: 'Auto-Mine 3 Days',  frgBonus: 15000   },
  { refs: 5,   rewardType: 'speed',    reward: '5× Speed 7 Days',   frgBonus: 30000   },
  { refs: 10,  rewardType: 'automine', reward: 'Auto-Mine 30 Days', frgBonus: 75000   },
  { refs: 25,  rewardType: 'permanent',reward: 'Permanent 2× Core', frgBonus: 200000  },
  { refs: 50,  rewardType: 'automine', reward: 'Auto-Mine 60 Days', frgBonus: 500000  },
  { refs: 100, rewardType: 'automine', reward: 'Auto-Mine 60 Days', frgBonus: 1000000 },
  { refs: 200, rewardType: 'lifetime', reward: 'Auto-Mine Lifetime', frgBonus: 5000000},
]

export const MISSIONS = [
  { id: 'm1', key: 'total_mined', checkpoints: [
    { at: 1000,   reward: 500   },
    { at: 5000,   reward: 1500  },
    { at: 20000,  reward: 5000  },
    { at: 100000, reward: 20000 },
    { at: 500000, reward: 80000 },
  ]},
  { id: 'm2', key: 'blocks_found', checkpoints: [
    { at: 1,  reward: 500   },
    { at: 5,  reward: 2500  },
    { at: 20, reward: 8000  },
    { at: 50, reward: 20000 },
  ]},
  { id: 'm3', key: 'referrals', checkpoints: [
    { at: 1,  reward: 5000   },
    { at: 5,  reward: 30000  },
    { at: 10, reward: 100000 },
    { at: 25, reward: 500000 },
  ]},
  { id: 'm4', key: 'effective_rate', checkpoints: [
    { at: 1,  reward: 500   },
    { at: 5,  reward: 3000  },
    { at: 20, reward: 12000 },
    { at: 50, reward: 30000 },
  ]},
]

export const DAILY_REWARDS = [500, 1000, 1500, 2000, 2500, 3500, 5000]
export const REFERRAL_BONUS_FRG = 5000
export const REFERRAL_PASSIVE_PCT = 0.10

export function calcUpgradeCost(upgradeId, currentLevel) {
  const u = UPGRADES.find(x => x.id === upgradeId)
  if (!u) throw new Error('Unknown upgrade')
  return Math.round(u.baseCost * Math.pow(2.2, currentLevel))
}

export function calcEffectiveRate(upgrades = {}, purchased = []) {
  const upgradeBonus = Object.entries(upgrades).reduce((acc, [id, lv]) => {
    const u = UPGRADES.find(x => x.id === Number(id))
    return acc + (u ? u.rateBonus * lv : 0)
  }, 0)
  const arr = Array.isArray(purchased) ? purchased : Object.keys(purchased)
  const permMult = arr.includes('speed_perm') ? 2 : 1
  return (BASE_RATE + upgradeBonus) * permMult
}

export function hasAutoMine(purchased = []) {
  const arr = Array.isArray(purchased) ? purchased : Object.keys(purchased)
  return arr.some(id =>
    id === 'auto_7d' || id === 'auto_30d' || id === 'auto_lifetime' ||
    id.startsWith('reward_auto_')
  )
}

// Check if an expirable item is currently active based on purchase history
export function isItemActive(purchases = [], itemId) {
  const item = STORE_ITEMS[itemId]
  if (!item) return false
  if (item.purchaseType === 'permanent') return purchases.some(p => p.itemId === itemId && p.status === 'confirmed')
  if (item.purchaseType === 'expirable') {
    const latest = purchases
      .filter(p => p.itemId === itemId && p.status === 'confirmed')
      .sort((a, b) => new Date(b.confirmedAt) - new Date(a.confirmedAt))[0]
    if (!latest) return false
    const expiresAt = new Date(latest.confirmedAt)
    expiresAt.setDate(expiresAt.getDate() + item.daysActive)
    return expiresAt > new Date()
  }
  return false
}
