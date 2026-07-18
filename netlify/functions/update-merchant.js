const { initFirebase, saveMerchantCategory } = require('./utils/db')

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' }

  try {
    const rawBody = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('utf8')
      : event.body
    const { merchant, categoryId } = JSON.parse(rawBody || '{}')

    if (!merchant || !categoryId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Faltan campos: merchant y categoryId' }) }
    }

    const db = initFirebase()
    await saveMerchantCategory(db, merchant, categoryId)
    console.log(`✏️ Mapa actualizado: ${merchant} → ${categoryId}`)

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) }
  } catch (err) {
    console.error('Error:', err)
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) }
  }
}
