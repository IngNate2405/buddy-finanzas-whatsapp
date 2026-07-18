const { initFirebase, toCategoryId, toDateString, saveTransaction, getMerchantCategory, saveMerchantCategory, getCategoryFromGemini } = require('./utils/db')

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' }

  try {
    const rawBody = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('utf8')
      : event.body
    const body = JSON.parse(rawBody || '{}')
    const text   = body.mensaje || body.text || ''
    const userId = body.userId  || body.firebaseUserId || ''

    if (!text || !userId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Faltan campos: mensaje y userId' }) }
    }

    console.log(`📨 Procesando para ${userId}: ${text.substring(0, 80)}`)

    const transaction = parseTransaction(text)
    if (!transaction) {
      return { statusCode: 200, headers, body: JSON.stringify({ status: 'ignored', reason: 'No se reconoció como transacción' }) }
    }

    const db = initFirebase()

    // 1. Merchant map, 2. Gemini, 3. Keywords
    let categoryId = null
    if (transaction.merchant) {
      categoryId = await getMerchantCategory(db, transaction.merchant)
      if (categoryId) {
        console.log(`🗺️ Mapa: ${transaction.merchant} → ${categoryId}`)
      } else {
        categoryId = await getCategoryFromGemini(transaction.merchant, transaction.description)
        if (!categoryId) categoryId = toCategoryId(transaction.category)
        await saveMerchantCategory(db, transaction.merchant, categoryId)
        console.log(`💾 Guardado: ${transaction.merchant} → ${categoryId}`)
      }
    } else {
      categoryId = toCategoryId(transaction.category)
    }

    await saveTransaction(db, userId, {
      type:       transaction.type,
      amount:     transaction.amount,
      categoryId,
      note:       transaction.description,
      date:       toDateString(transaction.date),
      merchant:   transaction.merchant || undefined,
    })

    console.log(`✅ Guardado: ${transaction.type} Q${transaction.amount} (${categoryId})`)
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ status: 'ok', type: transaction.type, amount: transaction.amount, categoryId }),
    }

  } catch (err) {
    console.error('Error:', err)
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) }
  }
}

// ── Parseo de transacciones ───────────────────────────────────────────────────

function parseTransaction(text) {
  if (text.includes('BAM Avisa:')) return parseBAM(text)
  return parseManual(text)
}

function parseBAM(text) {
  if (/rechazad[ao]/i.test(text)) return null
  const amountMatch = text.match(/Q\s*(\d+(?:\.\d{2})?)/)
  if (!amountMatch) return null
  const amount = parseFloat(amountMatch[1])

  // Fecha
  let date = new Date().toISOString()
  const dateMatch = text.match(/(\d{2})\/(\d{2})\/(\d{2,4})/)
  if (dateMatch) {
    let year = parseInt(dateMatch[3])
    if (year < 100) year += 2000
    date = new Date(year, parseInt(dateMatch[2]) - 1, parseInt(dateMatch[1])).toISOString()
  }

  let type = 'expense', description = '', merchant = null

  if (/compra/i.test(text)) {
    type = 'expense'
    const m = text.match(/compra\s+(.+?)\s+del\s+\d{2}\/\d{2}\/\d{2,4}\s+por\s+Q/i)
           || text.match(/compra\s+(.+?)\s+Q\s*\d/i)
    if (m) { merchant = m[1].trim(); description = `COMPRA ${merchant}` }
    else    { description = 'COMPRA' }
  } else if (/credito/i.test(text)) {
    type = 'income'
    const m = text.match(/credito\s+(.+?)\s+(?:el\s+)?\d{2}\/\d{2}\/\d{2,4}/i)
           || text.match(/credito\s+(.+?)\s+Q\s*\d/i)
    if (m) { description = `CREDITO ${m[1].trim()}` }
    else    { description = 'CREDITO' }
  } else if (/debito/i.test(text)) {
    type = 'expense'
    const m = text.match(/debito\s+(.+?)\s+(?:el\s+)?\d{2}\/\d{2}\/\d{2,4}/i)
           || text.match(/debito\s+(.+?)\s+Q\s*\d/i)
    if (m) { description = `DEBITO ${m[1].trim()}` }
    else    { description = 'DEBITO' }
  } else {
    return null
  }

  return { amount, type, category: classifyBAM(description, type), description, merchant, date, source: 'shortcut_bam' }
}

function parseManual(text) {
  const expensePatterns = [
    /gast[éea]+\s*Q?\s*(\d+(?:\.\d{2})?)/i,
    /pagu[éea]+\s*Q?\s*(\d+(?:\.\d{2})?)/i,
    /compr[éea]+\s*Q?\s*(\d+(?:\.\d{2})?)/i,
  ]
  const incomePatterns = [
    /recib[íi]+\s*Q?\s*(\d+(?:\.\d{2})?)/i,
    /(?:me\s+)?dieron\s*Q?\s*(\d+(?:\.\d{2})?)/i,
    /gan[éea]+\s*Q?\s*(\d+(?:\.\d{2})?)/i,
    /ingres[óo]+\s*Q?\s*(\d+(?:\.\d{2})?)/i,
  ]

  for (const p of expensePatterns) {
    const m = text.match(p)
    if (m) return { amount: parseFloat(m[1]), type: 'expense', category: classifyManual(text, 'expense'), description: text, merchant: null, date: new Date().toISOString(), source: 'shortcut_manual' }
  }
  for (const p of incomePatterns) {
    const m = text.match(p)
    if (m) return { amount: parseFloat(m[1]), type: 'income', category: classifyManual(text, 'income'), description: text, merchant: null, date: new Date().toISOString(), source: 'shortcut_manual' }
  }
  return null
}

function classifyBAM(text, type) {
  const t = text.toLowerCase()
  if (type === 'expense') {
    if (/café|pollo|pizza|restaurante|comida|super|comer|mcdonalds|burger|kfc|subway/.test(t)) return 'Food'
    if (/gasolina|gas|transporte|taxi|uber|carro|esso|shell/.test(t)) return 'Gas'
    if (/cine|gym|deporte|entretenimiento/.test(t)) return 'Cinema'
    if (/renta|internet|teléfono|luz|agua|servicio/.test(t)) return 'Rent'
    if (/ropa|farmacia|corte/.test(t)) return 'Clothing'
    return 'Miscellaneous'
  }
  if (/salario|sueldo|trabajo|pago|credito/.test(text.toLowerCase())) return 'Salary'
  return 'Other'
}

function classifyManual(text, type) {
  const t = text.toLowerCase()
  if (type === 'expense') {
    if (/comida|restaurante|café|super|pizza|pollo/.test(t)) return 'Food'
    if (/gasolina|gas|uber|taxi|carro/.test(t)) return 'Gas'
    if (/cine|gym|entretenimiento/.test(t)) return 'Cinema'
    if (/renta|servicio|internet|luz/.test(t)) return 'Rent'
    return 'Miscellaneous'
  }
  if (/salario|sueldo|trabajo/.test(t)) return 'Salary'
  return 'Other'
}
