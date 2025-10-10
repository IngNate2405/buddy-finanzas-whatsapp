exports.handler = async (event, context) => {
  console.log('📱 Procesando transacción directa...')
  
  try {
    const { text, userId } = JSON.parse(event.body)
    console.log('📝 Mensaje recibido:', text)
    console.log('👤 Usuario:', userId)
    
    if (!text || !userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Se requiere text y userId' })
      }
    }
    
    // Importar Firebase Admin SDK
    const admin = require('firebase-admin')
    
    // Inicializar Firebase Admin si no está inicializado
    if (!admin.apps.length) {
      const serviceAccount = {
        type: "service_account",
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
        client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.FIREBASE_CLIENT_EMAIL}`
      }
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      })
    }
    
    const db = admin.firestore()
    
    // Procesar transacción
    const transaction = parseTransaction(text)
    
    if (!transaction) {
      console.log('❌ No se pudo procesar la transacción')
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No se pudo procesar la transacción' })
      }
    }
    
    console.log('✅ Transacción procesada:', JSON.stringify(transaction))
    
    // Guardar en Firebase
    const saved = await saveTransactionToFirebase(transaction, userId, db)
    
    if (saved) {
      console.log('✅ Transacción guardada exitosamente')
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: 'Transacción guardada exitosamente',
          transaction: transaction
        })
      }
    } else {
      console.log('❌ Error guardando transacción')
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Error guardando transacción' })
      }
    }
    
  } catch (error) {
    console.error('🚨 Error procesando transacción:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: error.message,
        stack: error.stack 
      })
    }
  }
}

// Función para parsear transacciones (reutilizada del webhook)
function parseTransaction(text) {
  console.log('🔍 Analizando mensaje:', text)
  
  // Primero verificar si es un mensaje del banco BAM
  if (text.includes('BAM Avisa:')) {
    console.log('🏦 Mensaje del banco BAM detectado')
    return parseBAMTransaction(text)
  }
  
  // Patrones para mensajes manuales con fechas relativas
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
        source: 'shortcut'
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
        source: 'shortcut'
      }
    }
  }

  return null
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
  let transactionDate = new Date().toISOString()
  
  const dateMatch = text.match(/(\d{2})\/(\d{2})\/(\d{2,4})/)
  if (dateMatch) {
    const day = parseInt(dateMatch[1])
    const month = parseInt(dateMatch[2]) - 1
    let year = parseInt(dateMatch[3])
    
    if (year < 100) {
      year += 2000
    }
    
    transactionDate = new Date(year, month, day).toISOString()
    console.log('📅 Fecha extraída del mensaje:', transactionDate)
  }
  
  // Determinar tipo de transacción
  let transactionType = 'expense'
  let description = ''
  
  if (text.includes('COMPRA')) {
    transactionType = 'expense'
    console.log('💸 Tipo: Gasto (COMPRA)')
    
    const compraMatch = text.match(/COMPRA\s+([^Q]+?)\s+del\s+\d{2}\/\d{2}\/\d{4}\s+por\s+Q\d+(?:\.\d{2})?/)
    if (compraMatch) {
      description = `COMPRA ${compraMatch[1].trim()}`
    } else {
      const fallbackMatch = text.match(/COMPRA\s+([^Q]+?)\s+Q\d+(?:\.\d{2})?/)
      if (fallbackMatch) {
        description = `COMPRA ${fallbackMatch[1].trim()}`
      } else {
        description = 'COMPRA'
      }
    }
    
  } else if (text.includes('CREDITO')) {
    transactionType = 'income'
    console.log('💵 Tipo: Ingreso (CREDITO)')
    
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
    source: 'shortcut_bam'
  }
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

// Función para clasificar transacciones
function classifyTransaction(text, transactionType) {
  const textLower = text.toLowerCase()
  
  if (transactionType === 'expense') {
    // Categorías para gastos - Solo restaurantes específicos van a Food
    if (textLower.includes('café') || textLower.includes('pollo') || textLower.includes('pizza') || 
        textLower.includes('restaurante') || textLower.includes('comida') || textLower.includes('supermercado') || 
        textLower.includes('comer') || textLower.includes('mcdonalds') || textLower.includes('burger king') ||
        textLower.includes('kfc') || textLower.includes('subway') || textLower.includes('dominos') ||
        textLower.includes('cafe') || textLower.includes('gitane')) {
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
  } else {
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

// Función para guardar en Firebase
async function saveTransactionToFirebase(transaction, firebaseUserId, db) {
  try {
    console.log(`💾 Guardando transacción para usuario: ${firebaseUserId}`)
    
    // Obtener el documento del usuario
    const userRef = db.collection('users').doc(firebaseUserId)
    console.log(`🔍 Obteniendo documento del usuario: ${firebaseUserId}`)
    const userDoc = await userRef.get()
    
    let transactions = []
    if (userDoc.exists) {
      const userData = userDoc.data()
      transactions = userData.transactions || []
      console.log(`📊 Transacciones existentes: ${transactions.length}`)
    } else {
      console.log(`📝 Usuario no existe, creando nuevo documento`)
    }
    
    // Agregar nueva transacción al array
    const newTransaction = {
      ...transaction,
      id: `shortcut_${Date.now()}`, // ID único para la transacción
      createdAt: new Date().toISOString(), // Usar fecha de JavaScript en lugar de serverTimestamp
      updatedAt: new Date().toISOString()  // Usar fecha de JavaScript en lugar de serverTimestamp
    }
    
    console.log(`📝 Nueva transacción:`, JSON.stringify(newTransaction, null, 2))
    transactions.push(newTransaction)
    console.log(`📊 Total de transacciones después de agregar: ${transactions.length}`)
    
    // Guardar el array actualizado en el documento del usuario
    console.log(`💾 Guardando en Firestore...`)
    await userRef.set({
      transactions: transactions,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true })
    console.log(`✅ Guardado exitoso en Firestore`)
    
    console.log(`✅ Transacción guardada exitosamente`)
    return true
  } catch (error) {
    console.error('Error guardando transacción:', error)
    return false
  }
}
