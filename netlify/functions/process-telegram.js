// Función para leer mensajes de Telegram
async function readTelegramMessages() {
  try {
    const { spawn } = require('child_process');
    
    return new Promise((resolve, reject) => {
      const python = spawn('python', ['netlify_telegram_reader.py'], {
        env: {
          ...process.env,
          TELEGRAM_API_ID: process.env.TELEGRAM_API_ID,
          TELEGRAM_API_HASH: process.env.TELEGRAM_API_HASH,
          TELEGRAM_PHONE: process.env.TELEGRAM_PHONE
        }
      });
      
      let output = '';
      
      python.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        console.error('Python error:', data.toString());
      });
      
      python.on('close', (code) => {
        if (code === 0) {
          try {
            // Parsear la salida del script de Python
            const messages = JSON.parse(output);
            resolve(messages);
          } catch (e) {
            console.log('No hay mensajes nuevos o error parseando:', e);
            resolve([]);
          }
        } else {
          console.error('Python script failed with code:', code);
          resolve([]);
        }
      });
    });
  } catch (error) {
    console.error('Error reading Telegram messages:', error);
    return [];
  }
}

exports.handler = async (event, context) => {
  console.log('📱 Procesando mensajes de Telegram...')
  
  try {
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
    
    // Leer mensajes de Telegram usando la API
    const messages = await readTelegramMessages()
    
    let processedCount = 0
    
    for (const message of messages) {
      // Procesar transacción
      const transaction = parseTransaction(message.text)
      
      if (transaction) {
        console.log(`✅ Transacción reconocida: ${JSON.stringify(transaction)}`)
        
        // Buscar usuario por sender ID (en producción esto sería más complejo)
        const userQuery = await db.collection('telegram_users')
          .where('telegramUserId', '==', message.sender)
          .get()
        
        if (!userQuery.empty) {
          const userData = userQuery.docs[0].data()
          const firebaseUserId = userData.firebaseUserId
          
          // Guardar transacción
          await db.collection('users').doc(firebaseUserId).collection('transactions').add({
            ...transaction,
            source: 'telegram',
            telegramMessageId: message.id,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          })
          
          processedCount++
          console.log(`💾 Transacción guardada para usuario: ${firebaseUserId}`)
        } else {
          console.log(`❌ Usuario no encontrado para sender: ${message.sender}`)
        }
      } else {
        console.log(`❌ Transacción no reconocida: ${message.text}`)
      }
    }
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'success',
        message: `Procesadas ${processedCount} transacciones`,
        processed: processedCount,
        total: messages.length
      })
    }
    
  } catch (error) {
    console.error('🚨 Error procesando mensajes:', error)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'error',
        message: error.message
      })
    }
  }
}

// Función para parsear transacciones (reutilizada del bot)
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
