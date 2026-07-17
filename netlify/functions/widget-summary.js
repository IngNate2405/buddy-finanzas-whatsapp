const { initFirebase } = require('./utils/db')

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  }

  const uid = event.queryStringParameters?.uid
  if (!uid) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing uid' }) }

  try {
    const db = initFirebase()
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const startDate = `${y}-${m}-01`
    const endDate   = `${y}-${m}-31`

    const [walletsSnap, txSnap] = await Promise.all([
      db.collection(`users/${uid}/wallets`).get(),
      db.collection(`users/${uid}/transactions`)
        .where('date', '>=', startDate)
        .where('date', '<=', endDate)
        .orderBy('date', 'desc')
        .get(),
    ])

    const totalBalance = walletsSnap.docs.reduce((sum, d) => sum + (d.data().balance || 0), 0)

    const txs = txSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    const monthExpenses = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    const monthIncome   = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const recentTx = txs.slice(0, 3).map(t => ({
      type: t.type,
      amount: t.amount,
      categoryId: t.categoryId,
      note: t.note || '',
      date: t.date,
    }))

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ totalBalance, monthExpenses, monthIncome, recentTx, month: `${y}-${m}` }),
    }
  } catch (err) {
    console.error('widget-summary error:', err)
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) }
  }
}
