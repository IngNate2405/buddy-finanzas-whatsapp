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
        `💰 **Gastos:**\n` +
        `• "Gasté Q50 en comida"\n` +
        `• "Pagué Q200 de renta"\n` +
        `• "Compré Q30 en supermercado"\n\n` +
        `💵 **Ingresos:**\n` +
        `• "Recibí Q3000 de salario"\n` +
        `• "Gané Q500 de venta"\n\n` +
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
    const telegramUsers = await db.collection('telegram_users')
      .where('telegramChatId', '==', telegramChatId.toString())
      .get()
    
    if (!telegramUsers.empty) {
      const userData = telegramUsers.docs[0].data()
      console.log(`✅ Usuario vinculado encontrado: ${userData.firebaseUserId}`)
      return userData
    } else {
      console.log(`❌ Usuario no vinculado para chatId: ${telegramChatId}`)
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
    
    // Guardar transacción en Firestore
    await db.collection('users').doc(firebaseUserId).collection('transactions').add({
      ...transaction,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    })
    
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

// Función para clasificar transacciones
function classifyTransaction(text, transactionType) {
  const textLower = text.toLowerCase()

  if (transactionType === 'expense') {
    if (textLower.includes('comida') || textLower.includes('restaurante') || textLower.includes('supermercado') || textLower.includes('café') || textLower.includes('comer')) {
      return 'Food & drinks'
    } else if (textLower.includes('gasolina') || textLower.includes('gas') || textLower.includes('transporte') || textLower.includes('taxi') || textLower.includes('uber') || textLower.includes('carro')) {
      return 'Transportation'
    } else if (textLower.includes('cine') || textLower.includes('entretenimiento') || textLower.includes('gym') || textLower.includes('deporte') || textLower.includes('fiesta')) {
      return 'Entertainment'
    } else if (textLower.includes('renta') || textLower.includes('servicio') || textLower.includes('internet') || textLower.includes('teléfono') || textLower.includes('luz') || textLower.includes('agua')) {
      return 'Housing'
    } else if (textLower.includes('ropa') || textLower.includes('farmacia') || textLower.includes('corte') || textLower.includes('cuidado')) {
      return 'Lifestyle'
    } else {
      return 'Miscellaneous'
    }
  } else { // income
    if (textLower.includes('salario') || textLower.includes('trabajo') || textLower.includes('sueldo') || textLower.includes('pago')) {
      return 'Income'
    } else if (textLower.includes('inversión') || textLower.includes('interés') || textLower.includes('dividendo')) {
      return 'Investments'
    } else {
      return 'Other'
    }
  }
}
