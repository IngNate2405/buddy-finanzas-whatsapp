const { initFirebase, saveTransaction } = require('./utils/db')

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method not allowed' }

  try {
    const { uid, type, amount, categoryId, note, date } = JSON.parse(event.body || '{}')

    if (!uid || !amount || !categoryId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Faltan campos: uid, amount, categoryId' }) }
    }

    const db = initFirebase()
    await saveTransaction(db, uid, {
      type: type || 'expense',
      amount: parseFloat(amount),
      categoryId,
      note: note || undefined,
      date: date || new Date().toISOString().slice(0, 10),
    })

    console.log(`✅ Widget tx: ${type || 'expense'} Q${amount} (${categoryId}) uid=${uid}`)
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) }
  } catch (err) {
    console.error('Error:', err)
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) }
  }
}
