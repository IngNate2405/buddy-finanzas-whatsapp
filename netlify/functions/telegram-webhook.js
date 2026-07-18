const { initFirebase, toCategoryId, toDateString, saveTransaction, getMerchantCategory, saveMerchantCategory, getCategoryFromGemini } = require('./utils/db')

exports.handler = async (event, context) => {
  console.log('🤖 Telegram webhook recibido:', JSON.stringify(event, null, 2))
  
  try {
    const data = JSON.parse(event.body)
    console.log('📨 Datos del mensaje:', JSON.stringify(data, null, 2))
    
    const message = data.message
    if (!message || !message.text) {
      console.log('❌ No hay mensaje de texto')
      return {
        statusCode: 200,
        body: 'OK'
      }
    }
    
    const chatId = message.chat.id
    const text = message.text
    const fromUser = message.from
    
    console.log(`📱 Mensaje de ${fromUser.first_name} (${chatId}): ${text}`)
    
    // Manejar pregunta sobre ID (flexible)
    const textLower = text.toLowerCase()
      .replace(/[áàäâ]/g, 'a')
      .replace(/[éèëê]/g, 'e')
      .replace(/[íìïî]/g, 'i')
      .replace(/[óòöô]/g, 'o')
      .replace(/[úùüû]/g, 'u')
      .replace(/[ñ]/g, 'n')
      .replace(/[¿?]/g, '')
      .trim()
    
    if (textLower.includes('cual es mi id') || textLower.includes('cual es mi user id') ||
        textLower.includes('mi id') || textLower.includes('mi user id') ||
        text === '/myid') {
      await sendTelegramMessage(chatId,
        `📱 *Tu Telegram Chat ID:*\n\n` +
        `\`${chatId}\`\n\n` +
        `_Este es tu Chat ID de Telegram, NO tu Firebase UID._\n\n` +
        `Para vincular tu cuenta:\n` +
        `1\\. Abre la app Buddy Finanzas\n` +
        `2\\. Ve a Configuración → Telegram\n` +
        `3\\. Copia tu *Firebase UID* que aparece ahí\n` +
        `4\\. Envía aquí: /link TU\\_FIREBASE\\_UID`
      )
      return { statusCode: 200, body: 'OK' }
    }
    
    // Manejar comando /link
    if (text.startsWith('/link ')) {
      const firebaseUserId = text.split(' ')[1]
      if (firebaseUserId) {
        const db = initFirebase()
        await db.collection('telegram_users').add({
          firebaseUserId: firebaseUserId,
          telegramChatId: chatId.toString(), // Solo el chatId, sin el comando
          linkedAt: new Date().toISOString(),
          userEmail: fromUser.first_name || 'Usuario'
        })
        
        await sendTelegramMessage(chatId, 
          `✅ **¡Cuenta vinculada exitosamente!**\n\n` +
          `Ahora puedes enviar transacciones como:\n\n` +
          `💰 **Mensajes manuales:**\n` +
          `• "Gasté Q50 en comida"\n` +
          `• "Compré pizza el lunes"\n` +
          `• "Gasté 20 en parqueo el martes pasado"\n` +
          `• "Me dieron 25 por trabajo ayer"\n\n` +
          `🏦 **Mensajes del banco BAM:**\n` +
          `• Copia y pega los mensajes de BAM Avisa\n` +
          `• Se procesarán automáticamente\n\n` +
          `🔧 **Comandos útiles:**\n` +
          `• "¿Cuál es mi ID?" - Obtener tu User ID para shortcuts\n\n` +
          `¡Las transacciones se guardarán automáticamente en tu app!`
        )
      } else {
        await sendTelegramMessage(chatId, 
          `❌ **Formato incorrecto**\n\n` +
          `Usa: \`/link TU_ID_DE_FIREBASE\`\n\n` +
          `Para obtener tu ID, ve a tu app web de Buddy Finanzas.`
        )
      }
      return { statusCode: 200, body: 'OK' }
    }
    
    // Verificar si el usuario está vinculado
    const userLink = await checkUserLink(chatId)
    
    if (!userLink) {
      // Usuario no vinculado, enviar instrucciones
      await sendTelegramMessage(chatId,
        `🔗 *Buddy Finanzas Bot*\n\n` +
        `Para usar este bot, primero vincula tu cuenta:\n\n` +
        `1. Abre la app Buddy Finanzas\n` +
        `2. Ve a *Configuración → Telegram*\n` +
        `3. Copia tu Firebase UID\n` +
        `4. Envía aquí: \`/link TU_FIREBASE_UID\`\n\n` +
        `Tu Telegram Chat ID es: \`${chatId}\``
      )
      return { statusCode: 200, body: 'OK' }
    }
    
    // Procesar transacción
    const transaction = parseTransaction(text)

    if (transaction) {
      console.log('✅ Transacción reconocida:', JSON.stringify(transaction))

      try {
        const db = initFirebase()
        console.log('💾 Guardando transacción para uid:', userLink.firebaseUserId)

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

        await saveTransaction(db, userLink.firebaseUserId, {
          type:       transaction.type,
          amount:     transaction.amount,
          categoryId,
          note:       transaction.description,
          date:       toDateString(transaction.date),
          merchant:   transaction.merchant || undefined,
        })
        await sendTelegramMessage(chatId,
          `✅ **Transacción guardada**\n\n` +
          `💰 **Tipo:** ${transaction.type === 'expense' ? 'Gasto' : 'Ingreso'}\n` +
          `💵 **Monto:** Q${transaction.amount}\n` +
          `📂 **Categoría:** ${transaction.category}\n` +
          `📝 **Descripción:** ${transaction.description}\n\n` +
          `¡Revisa tu app para ver todos tus datos!`
        )
      } catch (err) {
        console.error('Error guardando transacción:', err)
        await sendTelegramMessage(chatId, `❌ Error: ${err.message || String(err)}`)
      }
    } else {
      // Enviar mensaje de ayuda
      await sendTelegramMessage(chatId, 
        `📱 **Buddy Finanzas Bot**\n\n` +
        `Para registrar una transacción, envía un mensaje como:\n\n` +
        `💰 **Mensajes manuales:**\n` +
        `• "Gasté Q50 en comida"\n` +
        `• "Compré pizza el lunes"\n` +
        `• "Gasté 20 en parqueo el martes pasado"\n` +
        `• "Me dieron 25 por trabajo ayer"\n\n` +
        `🏦 **Mensajes del banco BAM:**\n` +
        `• Copia y pega los mensajes de BAM Avisa\n` +
        `• Ejemplo: "BAM Avisa: TD 1924 APPLE PAY COMPRA EST. DE SERV. JARDINES del 07/10/2025 por Q100.00..."\n\n` +
        `🔧 **Comandos útiles:**\n` +
        `• "¿Cuál es mi ID?" - Obtener tu User ID para shortcuts\n` +
        `• \`/link [ID]\` - Vincular cuenta\n\n` +
        `¡Las transacciones se guardarán automáticamente en tu app!`
      )
    }
    
    return { statusCode: 200, body: 'OK' }
    
  } catch (error) {
    console.error('🚨 Error procesando mensaje de Telegram:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    }
  }
}

// ── Firebase helpers (now in utils/db.js) — only keeping checkUserLink here ──

// Función para verificar si el usuario está vinculado
async function checkUserLink(telegramChatId) {
  try {
    const db = initFirebase()
    const chatIdStr = telegramChatId.toString()
    console.log(`🔍 Buscando telegram_users con chatId: ${chatIdStr}`)

    const snap = await db.collection('telegram_users')
      .where('telegramChatId', '==', chatIdStr)
      .limit(1)
      .get()

    if (!snap.empty) {
      const userData = snap.docs[0].data()
      console.log(`✅ Usuario vinculado: ${userData.firebaseUserId}`)
      return userData
    }

    console.log(`❌ No vinculado para chatId: ${chatIdStr}`)
    return null
  } catch (error) {
    console.error('Error verificando vinculación:', error)
    return null
  }
}

// Función para enviar mensaje a Telegram
async function sendTelegramMessage(chatId, text) {
  try {
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
    
    if (!TELEGRAM_BOT_TOKEN) {
      console.log('❌ TELEGRAM_BOT_TOKEN no configurado')
      return
    }
    
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown'
      })
    })
    
    if (response.ok) {
      console.log(`✅ Mensaje enviado a ${chatId}`)
    } else {
      console.log(`❌ Error enviando mensaje: ${response.status}`)
    }
  } catch (error) {
    console.error('🚨 Error enviando mensaje a Telegram:', error)
  }
}

// Función para parsear transacciones
function parseTransaction(text) {
  console.log('🔍 Analizando mensaje:', text)
  
  // Primero verificar si es un mensaje del banco BAM
  if (text.includes('BAM Avisa:')) {
    console.log('🏦 Mensaje del banco BAM detectado')
    return parseBAMTransaction(text)
  }
  
  // Patrones mejorados para mensajes manuales con fechas relativas
  const patterns = {
    expense_patterns: [
      // Patrones con fechas relativas
      /compr[éa]?\s*Q?\s*(\d+(?:\.\d{2})?)\s*(?:en|de)?\s*([^,]+?)\s*(?:el|a)?\s*(lunes|martes|miércoles|jueves|viernes|sábado|domingo)(?:\s+pasado)?/i,
      /gast[éa]?\s*Q?\s*(\d+(?:\.\d{2})?)\s*(?:en|de)?\s*([^,]+?)\s*(?:el|a)?\s*(lunes|martes|miércoles|jueves|viernes|sábado|domingo)(?:\s+pasado)?/i,
      /pagu[éa]?\s*Q?\s*(\d+(?:\.\d{2})?)\s*(?:en|de)?\s*([^,]+?)\s*(?:el|a)?\s*(lunes|martes|miércoles|jueves|viernes|sábado|domingo)(?:\s+pasado)?/i,
      
      // Patrones con "ayer" y "hoy"
      /compr[éa]?\s*Q?\s*(\d+(?:\.\d{2})?)\s*(?:en|de)?\s*([^,]+?)\s*(?:ayer|hoy)/i,
      /gast[éa]?\s*Q?\s*(\d+(?:\.\d{2})?)\s*(?:en|de)?\s*([^,]+?)\s*(?:ayer|hoy)/i,
      /pagu[éa]?\s*Q?\s*(\d+(?:\.\d{2})?)\s*(?:en|de)?\s*([^,]+?)\s*(?:ayer|hoy)/i,
      
      // Patrones simples (sin fecha específica)
      /gast[éa]?\s*Q?\s*(\d+(?:\.\d{2})?)/i,
      /pagu[éa]?\s*Q?\s*(\d+(?:\.\d{2})?)/i,
      /compr[éa]?\s*Q?\s*(\d+(?:\.\d{2})?)/i,
      /debit[óo]?\s*Q?\s*(\d+(?:\.\d{2})?)/i,
      /retir[óo]?\s*Q?\s*(\d+(?:\.\d{2})?)/i,
      /cobr[óo]?\s*Q?\s*(\d+(?:\.\d{2})?)/i
    ],
    income_patterns: [
      // Patrones con fechas relativas
      /(?:me\s+)?dieron\s*Q?\s*(\d+(?:\.\d{2})?)\s*(?:por|de)?\s*([^,]+?)\s*(?:el|a)?\s*(lunes|martes|miércoles|jueves|viernes|sábado|domingo)(?:\s+pasado)?/i,
      /recib[íi]?\s*Q?\s*(\d+(?:\.\d{2})?)\s*(?:por|de)?\s*([^,]+?)\s*(?:el|a)?\s*(lunes|martes|miércoles|jueves|viernes|sábado|domingo)(?:\s+pasado)?/i,
      /gan[éa]?\s*Q?\s*(\d+(?:\.\d{2})?)\s*(?:por|de)?\s*([^,]+?)\s*(?:el|a)?\s*(lunes|martes|miércoles|jueves|viernes|sábado|domingo)(?:\s+pasado)?/i,
      
      // Patrones con "ayer" y "hoy"
      /(?:me\s+)?dieron\s*Q?\s*(\d+(?:\.\d{2})?)\s*(?:por|de)?\s*([^,]+?)\s*(?:ayer|hoy)/i,
      /recib[íi]?\s*Q?\s*(\d+(?:\.\d{2})?)\s*(?:por|de)?\s*([^,]+?)\s*(?:ayer|hoy)/i,
      /gan[éa]?\s*Q?\s*(\d+(?:\.\d{2})?)\s*(?:por|de)?\s*([^,]+?)\s*(?:ayer|hoy)/i,
      
      // Patrones simples (sin fecha específica)
      /recib[íi]?\s*Q?\s*(\d+(?:\.\d{2})?)/i,
      /gan[éa]?\s*Q?\s*(\d+(?:\.\d{2})?)/i,
      /ingres[óo]?\s*Q?\s*(\d+(?:\.\d{2})?)/i,
      /salario\s*Q?\s*(\d+(?:\.\d{2})?)/i
    ]
  }

  // Buscar patrones de gastos
  for (const pattern of patterns.expense_patterns) {
    const match = text.match(pattern)
    if (match) {
      const amount = parseFloat(match[1])
      const description = match[2] ? `${match[0].split(' ')[0]} ${match[2]}` : text
      const category = classifyTransaction(description, 'expense')
      const date = extractRelativeDate(text)
      
      return {
        amount: amount,
        type: 'expense',
        category: category,
        description: description,
        date: date,
        source: 'telegram'
      }
    }
  }

  // Buscar patrones de ingresos
  for (const pattern of patterns.income_patterns) {
    const match = text.match(pattern)
    if (match) {
      const amount = parseFloat(match[1])
      const description = match[2] ? `${match[0].split(' ')[0]} ${match[2]}` : text
      const category = classifyTransaction(description, 'income')
      const date = extractRelativeDate(text)
      
      return {
        amount: amount,
        type: 'income',
        category: category,
        description: description,
        date: date,
        source: 'telegram'
      }
    }
  }

  return null
}

// Función para extraer fechas relativas
function extractRelativeDate(text) {
  const textLower = text.toLowerCase()
  const today = new Date()
  
  // Días de la semana en español
  const daysOfWeek = {
    'lunes': 1, 'martes': 2, 'miércoles': 3, 'jueves': 4, 
    'viernes': 5, 'sábado': 6, 'domingo': 0
  }
  
  // Buscar "ayer"
  if (textLower.includes('ayer')) {
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    console.log('📅 Fecha detectada: ayer =', yesterday.toISOString())
    return yesterday.toISOString()
  }
  
  // Buscar "hoy"
  if (textLower.includes('hoy')) {
    console.log('📅 Fecha detectada: hoy =', today.toISOString())
    return today.toISOString()
  }
  
  // Buscar días de la semana
  for (const [dayName, dayNumber] of Object.entries(daysOfWeek)) {
    if (textLower.includes(dayName)) {
      const isPastWeek = textLower.includes('pasado')
      const targetDate = new Date(today)
      
      // Calcular el día de la semana objetivo
      const currentDay = today.getDay()
      let daysToSubtract = currentDay - dayNumber
      
      if (isPastWeek) {
        // Si es "pasado", ir a la semana anterior
        daysToSubtract += 7
      } else if (daysToSubtract <= 0) {
        // Si el día ya pasó esta semana, ir a la semana anterior
        daysToSubtract += 7
      }
      
      targetDate.setDate(targetDate.getDate() - daysToSubtract)
      console.log(`📅 Fecha detectada: ${dayName}${isPastWeek ? ' pasado' : ''} =`, targetDate.toISOString())
      return targetDate.toISOString()
    }
  }
  
  // Si no se encuentra fecha relativa, usar fecha actual
  console.log('📅 No se detectó fecha relativa, usando fecha actual')
  return today.toISOString()
}

// Función específica para parsear mensajes del banco BAM
function parseBAMTransaction(text) {
  console.log('🏦 Procesando mensaje BAM:', text)
  
  // Extraer el monto (Q seguido de números)
  const amountMatch = text.match(/Q\s*(\d+(?:\.\d{2})?)/)
  if (!amountMatch) {
    console.log('❌ No se encontró monto en mensaje BAM')
    return null
  }
  
  const amount = parseFloat(amountMatch[1])
  console.log('💰 Monto extraído:', amount)
  
  // Extraer la fecha del mensaje
  let transactionDate = new Date().toISOString() // Por defecto fecha actual
  
  // Buscar fecha en formato DD/MM/YYYY o DD/MM/YY
  const dateMatch = text.match(/(\d{2})\/(\d{2})\/(\d{2,4})/)
  if (dateMatch) {
    const day = parseInt(dateMatch[1])
    const month = parseInt(dateMatch[2]) - 1 // JavaScript months are 0-indexed
    let year = parseInt(dateMatch[3])
    
    // Si el año es de 2 dígitos, asumir 20XX
    if (year < 100) {
      year += 2000
    }
    
    transactionDate = new Date(year, month, day).toISOString()
    console.log('📅 Fecha extraída del mensaje:', transactionDate)
  } else {
    console.log('⚠️ No se encontró fecha en el mensaje, usando fecha actual')
  }
  
  // Determinar tipo de transacción
  let transactionType = 'expense' // Por defecto
  let description = ''
  
  let merchantName = null

  if (text.includes('COMPRA')) {
    transactionType = 'expense'
    console.log('💸 Tipo: Gasto (COMPRA)')

    const compraMatch = text.match(/COMPRA\s+([^Q]+?)\s+del\s+\d{2}\/\d{2}\/\d{4}\s+por\s+Q\d+(?:\.\d{2})?/)
    if (compraMatch) {
      merchantName = compraMatch[1].trim()
      description = `COMPRA ${merchantName}`
    } else {
      const fallbackMatch = text.match(/COMPRA\s+([^Q]+?)\s+Q\d+(?:\.\d{2})?/)
      if (fallbackMatch) {
        merchantName = fallbackMatch[1].trim()
        description = `COMPRA ${merchantName}`
      } else {
        description = 'COMPRA'
      }
    }

  } else if (text.includes('CREDITO')) {
    transactionType = 'income'
    console.log('💵 Tipo: Ingreso (CREDITO)')
    
    // Extraer descripción: desde CREDITO hasta el monto
    const creditoMatch = text.match(/CREDITO\s+([^Q]+?)\s+Q\d+(?:\.\d{2})?/)
    if (creditoMatch) {
      description = `CREDITO ${creditoMatch[1].trim()}`
    } else {
      description = 'CREDITO'
    }
  }
  
  console.log('📝 Descripción extraída:', description)
  
  // Clasificar categoría
  const category = classifyTransaction(description, transactionType)
  console.log('📂 Categoría clasificada:', category)
  
  return {
    amount: amount,
    type: transactionType,
    category: category,
    description: description,
    date: transactionDate,
    merchant: merchantName,
    source: 'telegram_bam'
  }
}

// Función para clasificar transacciones
function classifyTransaction(text, transactionType) {
  const textLower = text.toLowerCase()
  console.log('🔍 Clasificando transacción:', textLower, 'Tipo:', transactionType)

  if (transactionType === 'expense') {
    // Categorías para gastos - Solo restaurantes específicos van a Food
    if (textLower.includes('café') || textLower.includes('pollo') || textLower.includes('pizza') || 
        textLower.includes('restaurante') || textLower.includes('comida') || textLower.includes('supermercado') || 
        textLower.includes('comer') || textLower.includes('mcdonalds') || textLower.includes('burger king') ||
        textLower.includes('kfc') || textLower.includes('subway') || textLower.includes('dominos')) {
      return 'Food' // Solo restaurantes específicos
    } else if (textLower.includes('gasolina') || textLower.includes('gas') || textLower.includes('transporte') || 
               textLower.includes('taxi') || textLower.includes('uber') || textLower.includes('carro')) {
      return 'Gas' // Subcategoría específica, no sección
    } else if (textLower.includes('cine') || textLower.includes('entretenimiento') || textLower.includes('gym') || 
               textLower.includes('deporte') || textLower.includes('fiesta')) {
      return 'Cinema' // Subcategoría específica, no sección
    } else if (textLower.includes('renta') || textLower.includes('servicio') || textLower.includes('internet') || 
               textLower.includes('teléfono') || textLower.includes('luz') || textLower.includes('agua')) {
      return 'Rent' // Subcategoría específica, no sección
    } else if (textLower.includes('ropa') || textLower.includes('farmacia') || textLower.includes('corte') || 
               textLower.includes('cuidado')) {
      return 'Clothing' // Subcategoría específica, no sección
    } else {
      return 'Miscellaneous' // Por defecto para transacciones BAM variadas
    }
  } else { // income
    // Categorías para ingresos
    if (textLower.includes('salario') || textLower.includes('trabajo') || textLower.includes('sueldo') || 
        textLower.includes('pago') || textLower.includes('credito') || textLower.includes('cuenta')) {
      return 'Salary' // Subcategoría específica, no sección
    } else if (textLower.includes('inversión') || textLower.includes('interés') || textLower.includes('dividendo')) {
      return 'Investment' // Subcategoría específica, no sección
    } else {
      return 'Other' // Subcategoría específica, no sección
    }
  }
}
