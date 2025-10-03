exports.handler = async (event, context) => {
  const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "buddy_finanzas_webhook"
  const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN
  const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID

  const method = event.httpMethod

  if (method === "GET") {
    const queryParams = event.queryStringParameters || {}
    const mode = queryParams["hub.mode"]
    const token = queryParams["hub.verify_token"]
    const challenge = queryParams["hub.challenge"]

    if (mode === "subscribe" && token === WHATSAPP_VERIFY_TOKEN) {
      return {
        statusCode: 200,
        body: challenge
      }
    } else {
      return {
        statusCode: 403,
        body: "Error"
      }
    }
  }

  if (method === "POST") {
    try {
      const body = event.body || "{}"
      const data = JSON.parse(body)

      if (data.entry && data.entry.length > 0) {
        const entry = data.entry[0]
        if (entry.changes && entry.changes.length > 0) {
          const change = entry.changes[0]
          if (change.value && change.value.messages) {
            return {
              statusCode: 200,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "success", message: "Mensaje procesado" })
            }
          }
        }
      }

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "no_message" })
      }
    } catch (error) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "error", message: error.message })
      }
    }
  }

  return {
    statusCode: 405,
    body: "Method not allowed"
  }
}
