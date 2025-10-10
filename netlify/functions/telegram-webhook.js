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
    
    // Manejar comando /link
    if (text.startsWith('/link ')) {
      const firebaseUserId = text.split(' ')[1]
      if (firebaseUserId) {
        // Guardar vinculación en Firebase
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
        
        // Guardar vinculación
        await db.collection('telegram_users').add({
          firebaseUserId: firebaseUserId,
          telegramChatId: chatId.toString(), // Solo el chatId, sin el comando
          linkedAt: admin.firestore.FieldValue.serverTimestamp(),
          userEmail: fromUser.first_name || 'Usuario'
        })
        
        await sendTelegramMessage(chatId, 
          `✅ **¡Cuenta vinculada exitosamente!**\n\n` +
          `Ahora puedes enviar transacciones como:\n\n` +
          `💰 **Mensajes manuales:**\n` +
          `• "Gasté Q50 en comida"\n` +
          `• "Recibí Q1000 de salario"\n` +
          `• "Pagué Q200 de renta"\n\n` +
          `🏦 **Mensajes del banco BAM:**\n` +
          `• Copia y pega los mensajes de BAM Avisa\n` +
          `• Se procesarán automáticamente\n\n` +
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
        `🔗 **Buddy Finanzas Bot**\n\n` +
        `Para usar este bot, primero debes vincular tu cuenta:\n\n` +
        `1. Ve a tu app web de Buddy Finanzas\n` +
        `2. Inicia sesión con tu cuenta\n` +
        `3. Ve a Configuración → Telegram\n` +
        `4. Envía el comando: \`/link ${chatId}\`\n\n` +
        `¡Después podrás enviar transacciones directamente!`
      )
      return { statusCode: 200, body: 'OK' }
    }
    
    // Procesar transacción
    const transaction = parseTransaction(text)
    
    if (transaction) {
      console.log('✅ Transacción reconocida:', JSON.stringify(transaction))
      
      // Guardar en Firebase
      const saved = await saveTransactionToFirebase(transaction, userLink.firebaseUserId)
      
      if (saved) {
        // Enviar confirmación
        await sendTelegramMessage(chatId, 
          `✅ **Transacción guardada**\n\n` +
          `💰 **Tipo:** ${transaction.type === 'expense' ? 'Gasto' : 'Ingreso'}\n` +
          `💵 **Monto:** Q${transaction.amount}\n` +
          `📂 **Categoría:** ${transaction.category}\n` +
          `📝 **Descripción:** ${transaction.description}\n\n` +
          `¡Revisa tu app web para ver todos tus datos!`
        )
      } else {
        await sendTelegramMessage(chatId, '❌ Error guardando la transacción. Intenta de nuevo.')
      }
    } else {
      // Enviar mensaje de ayuda
      await sendTelegramMessage(chatId, 
        `📱 **Buddy Finanzas Bot**\n\n` +
        `Para registrar una transacción, envía un mensaje como:\n\n` +
        `💰 **Mensajes manuales:**\n` +
        `• "Gasté Q50 en comida"\n` +
        `• "Pagué Q200 de renta"\n` +
        `• "Recibí Q3000 de salario"\n\n` +
        `🏦 **Mensajes del banco BAM:**\n` +
        `• Copia y pega los mensajes de BAM Avisa\n` +
        `• Ejemplo: "BAM Avisa: TD 1924 APPLE PAY COMPRA EST. DE SERV. JARDINES del 07/10/2025 por Q100.00..."\n\n` +
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

// Función para verificar si el usuario está vinculado
async function checkUserLink(telegramChatId) {
  try {
    console.log(`🔍 Verificando vinculación para chatId: ${telegramChatId}`)
    
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
    
    // Buscar usuario vinculado
    console.log(`🔍 Buscando en colección telegram_users con chatId: ${telegramChatId.toString()}`)
    const telegramUsers = await db.collection('telegram_users')
      .where('telegramChatId', '==', telegramChatId.toString())
      .get()
    
    console.log(`📊 Resultados de la consulta: ${telegramUsers.size} documentos encontrados`)
    
    if (!telegramUsers.empty) {
      const userData = telegramUsers.docs[0].data()
      console.log(`✅ Usuario vinculado encontrado: ${userData.firebaseUserId}`)
      console.log(`📋 Datos del usuario:`, JSON.stringify(userData, null, 2))
      return userData
    } else {
      console.log(`❌ Usuario no vinculado para chatId: ${telegramChatId}`)
      
      // Buscar todos los documentos para debugging
      const allUsers = await db.collection('telegram_users').get()
      console.log(`🔍 Total de usuarios vinculados: ${allUsers.size}`)
      allUsers.forEach(doc => {
        console.log(`📋 Usuario: ${doc.id} - Datos:`, JSON.stringify(doc.data(), null, 2))
      })
      
      return null
    }
  } catch (error) {
    console.error('Error verificando vinculación:', error)
    return null
  }
}

// Función para guardar transacción en Firebase
async function saveTransactionToFirebase(transaction, firebaseUserId) {
  try {
    console.log(`💾 Guardando transacción para usuario: ${firebaseUserId}`)
    
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
      id: `telegram_${Date.now()}`, // ID único para la transacción
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
  
  // Patrones para mensajes manuales
  const patterns = {
    expense_patterns: [
      /gast[éa]?\s*Q?\s*(\d+(?:\.\d{2})?)/i,
      /pagu[éa]?\s*Q?\s*(\d+(?:\.\d{2})?)/i,
      /compr[éa]?\s*Q?\s*(\d+(?:\.\d{2})?)/i,
      /debit[óo]?\s*Q?\s*(\d+(?:\.\d{2})?)/i,
      /retir[óo]?\s*Q?\s*(\d+(?:\.\d{2})?)/i,
      /cobr[óo]?\s*Q?\s*(\d+(?:\.\d{2})?)/i
    ],
    income_patterns: [
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
      const category = classifyTransaction(text, 'expense')
      return {
        amount: amount,
        type: 'expense',
        category: category,
        description: text,
        date: new Date().toISOString(),
        source: 'telegram'
      }
    }
  }

  // Buscar patrones de ingresos
  for (const pattern of patterns.income_patterns) {
    const match = text.match(pattern)
    if (match) {
      const amount = parseFloat(match[1])
      const category = classifyTransaction(text, 'income')
      return {
        amount: amount,
        type: 'income',
        category: category,
        description: text,
        date: new Date().toISOString(),
        source: 'telegram'
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
  
  // Determinar tipo de transacción
  let transactionType = 'expense' // Por defecto
  let description = ''
  
  if (text.includes('COMPRA')) {
    transactionType = 'expense'
    console.log('💸 Tipo: Gasto (COMPRA)')
    
    // Extraer descripción: desde COMPRA hasta el monto
    const compraMatch = text.match(/COMPRA\s+([^Q]+?)\s+del\s+\d{2}\/\d{2}\/\d{4}\s+por\s+Q\d+(?:\.\d{2})?/)
    if (compraMatch) {
      description = `COMPRA ${compraMatch[1].trim()}`
    } else {
      // Fallback: extraer todo después de COMPRA hasta el monto
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
    date: new Date().toISOString(),
    source: 'telegram_bam'
  }
}

// Función para clasificar transacciones
function classifyTransaction(text, transactionType) {
  const textLower = text.toLowerCase()
  console.log('🔍 Clasificando transacción:', textLower, 'Tipo:', transactionType)

  if (transactionType === 'expense') {
    // Categorías para gastos
    if (textLower.includes('comida') || textLower.includes('restaurante') || textLower.includes('supermercado') || 
        textLower.includes('café') || textLower.includes('comer') || textLower.includes('apple pay') ||
        textLower.includes('jardines') || textLower.includes('est. de serv.')) {
      return 'Food' // Subcategoría específica, no sección
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
      return 'Other' // Subcategoría específica, no sección
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
