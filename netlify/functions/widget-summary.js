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

    const wallets = walletsSnap.docs.map(d => ({ id: d.id, ...d.data() }))

    // Wallets marcadas para el widget (con nombre y saldo)
    const widgetWallets = wallets
      .filter(w => w.showInWidget === true && !w.archived)
      .map(w => ({ name: w.name, balance: w.balance || 0, color: w.color || '#888' }))

    const totalBalance = wallets.reduce((s, w) => s + (w.balance || 0), 0)

    const txs = txSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    const monthExpenses = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    const monthIncome   = txs.filter(t => t.type === 'income') .reduce((s, t) => s + t.amount, 0)

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        totalBalance,
        widgetWallets,
        monthExpenses,
        monthIncome,
        month: `${y}-${m}`,
      }),
    }
  } catch (err) {
    console.error('widget-summary error:', err)
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) }
  }
}
