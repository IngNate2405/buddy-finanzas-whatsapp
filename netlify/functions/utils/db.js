const admin = require('firebase-admin')

// ── Firebase init ─────────────────────────────────────────────────────────────
function initFirebase() {
  if (admin.apps.length) return admin.firestore()
  admin.initializeApp({
    credential: admin.credential.cert({
      type: 'service_account',
      project_id:                process.env.FIREBASE_PROJECT_ID,
      private_key_id:            process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key:               process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email:              process.env.FIREBASE_CLIENT_EMAIL,
      client_id:                 process.env.FIREBASE_CLIENT_ID,
      auth_uri:                  'https://accounts.google.com/o/oauth2/auth',
      token_uri:                 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
      client_x509_cert_url:      `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.FIREBASE_CLIENT_EMAIL}`,
    }),
  })
  return admin.firestore()
}

// ── Category mapping → v2 categoryIds ────────────────────────────────────────
const CATEGORY_MAP = {
  // expense — food
  'food':           'food',
  'food & drinks':  'food',
  // expense — transport
  'gas':            'gas',
  'transportation': 'car_costs',
  // expense — entertainment
  'cinema':         'cinema',
  'entertainment':  'entertainment',
  // expense — housing
  'rent':           'rent',
  'housing':        'housing',
  // expense — lifestyle
  'clothing':       'clothes',
  'lifestyle':      'lifestyle',
  // expense — misc
  'miscellaneous':  'misc',
  // income
  'salary':         'salary',
  'income':         'salary',
  'investments':    'investments',
  'investment':     'investments',
  'other':          'income',
}

function toCategoryId(raw) {
  return CATEGORY_MAP[(raw || '').toLowerCase()] || 'misc'
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function toDateString(value) {
  const d = new Date(value)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ── Get default wallet for a user ─────────────────────────────────────────────
async function getDefaultWalletId(db, uid) {
  const settingsSnap = await db.doc(`users/${uid}/meta/settings`).get()
  if (settingsSnap.exists) {
    const { defaultWalletId } = settingsSnap.data()
    if (defaultWalletId) return defaultWalletId
  }
  const wallets = await db.collection(`users/${uid}/wallets`).limit(1).get()
  if (!wallets.empty) return wallets.docs[0].id
  const projectId = process.env.FIREBASE_PROJECT_ID || 'unknown'
  throw new Error(`No wallet found for user ${uid} in project [${projectId}]`)
}

// ── Save transaction to correct subcollection + adjust wallet balance ─────────
async function saveTransaction(db, uid, { type, amount, categoryId, note, date }) {
  const walletId = await getDefaultWalletId(db, uid)
  if (!walletId) throw new Error(`No wallet found for user ${uid}`)

  const txData = {
    type,
    amount,
    categoryId,
    walletId,
    date,
    createdAt: new Date().toISOString(),
  }
  if (note) txData.note = note

  await db.collection(`users/${uid}/transactions`).add(txData)

  // Adjust wallet balance (same logic as v2 frontend)
  const walletRef = db.doc(`users/${uid}/wallets/${walletId}`)
  const walletSnap = await walletRef.get()
  if (walletSnap.exists) {
    const current = walletSnap.data().balance || 0
    await walletRef.update({ balance: type === 'income' ? current + amount : current - amount })
  }

  return walletId
}

// ── Merchant map ──────────────────────────────────────────────────────────────
function normalizeMerchant(name) {
  return (name || '').toLowerCase().trim().replace(/\s+/g, ' ').substring(0, 100)
}

async function getMerchantCategory(db, merchantName) {
  const key = normalizeMerchant(merchantName)
  if (!key) return null
  const snap = await db.doc(`merchant_map/${key}`).get()
  return snap.exists ? snap.data().categoryId : null
}

async function saveMerchantCategory(db, merchantName, categoryId) {
  const key = normalizeMerchant(merchantName)
  if (!key) return
  const ref = db.doc(`merchant_map/${key}`)
  const snap = await ref.get()
  if (snap.exists) {
    await ref.update({ categoryId, usageCount: (snap.data().usageCount || 0) + 1, lastSeen: new Date().toISOString() })
  } else {
    await ref.set({ merchantName: key, categoryId, usageCount: 1, createdAt: new Date().toISOString(), lastSeen: new Date().toISOString() })
  }
}

// ── Gemini AI categorization ──────────────────────────────────────────────────
const VALID_CATEGORIES = ['food','gas','car_costs','cinema','entertainment','rent','housing','clothes','lifestyle','salary','investments','income','misc']

async function getCategoryFromGemini(merchantName, description) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null

  const prompt = `Classify this purchase into ONE category ID. Respond with ONLY the category ID, nothing else.

Purchase: "${merchantName || description}"

Categories:
- food (restaurants, cafes, supermarkets, food)
- gas (gas stations, fuel)
- car_costs (car maintenance, parking, tolls, car wash)
- cinema (movies, theater)
- entertainment (gym, sports, concerts, games, streaming)
- rent (rent, mortgage)
- housing (utilities, internet, electricity, water, phone bill)
- clothes (clothing, shoes, accessories)
- lifestyle (beauty, pharmacy, haircut, personal care)
- salary (income from work, salary)
- investments (dividends, interest, returns)
- income (other income received)
- misc (anything else)

Category ID:`

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    })
    const data = await res.json()
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toLowerCase() || ''
    const categoryId = VALID_CATEGORIES.find(c => raw.includes(c)) || null
    console.log(`🤖 Gemini: "${merchantName}" → ${categoryId} (raw: "${raw}")`)
    return categoryId
  } catch (err) {
    console.error('Gemini error:', err.message)
    return null
  }
}

module.exports = { initFirebase, toCategoryId, toDateString, saveTransaction, getMerchantCategory, saveMerchantCategory, getCategoryFromGemini }
