import json
import os
import re
import requests
from datetime import datetime

def handler(event, context):
    """Netlify function para manejar webhook de WhatsApp"""
    
    # Configuración
    WHATSAPP_VERIFY_TOKEN = os.environ.get('WHATSAPP_VERIFY_TOKEN', 'buddy_finanzas_webhook')
    WHATSAPP_ACCESS_TOKEN = os.environ.get('WHATSAPP_ACCESS_TOKEN')
    WHATSAPP_PHONE_NUMBER_ID = os.environ.get('WHATSAPP_PHONE_NUMBER_ID')
    
    # Obtener método HTTP
    method = event.get('httpMethod', 'GET')
    
    if method == 'GET':
        # Verificación del webhook
        query_params = event.get('queryStringParameters', {})
        mode = query_params.get('hub.mode')
        token = query_params.get('hub.verify_token')
        challenge = query_params.get('hub.challenge')
        
        if mode == 'subscribe' and token == WHATSAPP_VERIFY_TOKEN:
            return {
                'statusCode': 200,
                'body': challenge
            }
        else:
            return {
                'statusCode': 403,
                'body': 'Error'
            }
    
    elif method == 'POST':
        # Procesar mensaje
        try:
            body = event.get('body', '{}')
            data = json.loads(body)
            
            # Verificar que es un mensaje válido
            if 'entry' in data and len(data['entry']) > 0:
                entry = data['entry'][0]
                if 'changes' in entry and len(entry['changes']) > 0:
                    change = entry['changes'][0]
                    if 'value' in change and 'messages' in change['value']:
                        result = process_message(change['value'], WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID)
                        return {
                            'statusCode': 200,
                            'headers': {'Content-Type': 'application/json'},
                            'body': json.dumps(result)
                        }
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({"status": "no_message"})
            }
            
        except Exception as e:
            return {
                'statusCode': 500,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({"status": "error", "message": str(e)})
            }
    
    return {
        'statusCode': 405,
        'body': 'Method not allowed'
    }

def process_message(message_data, access_token, phone_number_id):
    """Procesar mensaje recibido de WhatsApp"""
    try:
        # Extraer información del mensaje
        message = message_data.get('messages', [{}])[0]
        from_number = message.get('from', '')
        message_text = message.get('text', {}).get('body', '')
        
        print(f"📱 Mensaje recibido de {from_number}: {message_text}")
        
        # Procesar el mensaje como posible transacción
        transaction = parse_transaction(message_text)
        
        if transaction:
            # Enviar confirmación al usuario
            send_confirmation(from_number, transaction, access_token, phone_number_id)
            return {"status": "success", "message": "Transacción procesada"}
        else:
            # Enviar mensaje de ayuda si no se reconoce como transacción
            send_help_message(from_number, access_token, phone_number_id)
            return {"status": "info", "message": "Mensaje de ayuda enviado"}
            
    except Exception as e:
        print(f"❌ Error procesando mensaje: {e}")
        return {"status": "error", "message": str(e)}

def parse_transaction(text):
    """Analizar texto para extraer información de transacción"""
    # Patrones comunes para transacciones
    patterns = {
        # Patrones para gastos
        'expense_patterns': [
            r'gasté?\s*Q?\s*(\d+(?:\.\d{2})?)',  # "gasté Q100"
            r'compré?\s*Q?\s*(\d+(?:\.\d{2})?)',  # "compré Q50"
            r'pagué?\s*Q?\s*(\d+(?:\.\d{2})?)',   # "pagué Q25"
            r'Q?\s*(\d+(?:\.\d{2})?)\s*en\s*(.+)', # "Q100 en comida"
            r'Q?\s*(\d+(?:\.\d{2})?)\s*para\s*(.+)', # "Q50 para gasolina"
        ],
        # Patrones para ingresos
        'income_patterns': [
            r'recibí?\s*Q?\s*(\d+(?:\.\d{2})?)',  # "recibí Q1000"
            r'gané?\s*Q?\s*(\d+(?:\.\d{2})?)',   # "gané Q500"
            r'ingresó?\s*Q?\s*(\d+(?:\.\d{2})?)', # "ingresó Q2000"
            r'salario\s*Q?\s*(\d+(?:\.\d{2})?)', # "salario Q3000"
        ]
    }
    
    # Buscar patrones de gastos
    for pattern in patterns['expense_patterns']:
        match = re.search(pattern, text.lower())
        if match:
            amount = float(match.group(1))
            category = classify_transaction(text, 'expense')
            return {
                'amount': amount,
                'type': 'expense',
                'category': category,
                'description': text,
                'date': datetime.now().isoformat(),
                'source': 'whatsapp'
            }
    
    # Buscar patrones de ingresos
    for pattern in patterns['income_patterns']:
        match = re.search(pattern, text.lower())
        if match:
            amount = float(match.group(1))
            category = classify_transaction(text, 'income')
            return {
                'amount': amount,
                'type': 'income',
                'category': category,
                'description': text,
                'date': datetime.now().isoformat(),
                'source': 'whatsapp'
            }
    
    return None

def classify_transaction(text, transaction_type):
    """Clasificar automáticamente la categoría de la transacción"""
    text_lower = text.lower()
    
    if transaction_type == 'expense':
        # Clasificación de gastos
        if any(word in text_lower for word in ['comida', 'restaurante', 'supermercado', 'café', 'comer']):
            return 'Food & drinks'
        elif any(word in text_lower for word in ['gasolina', 'gas', 'transporte', 'taxi', 'uber', 'carro']):
            return 'Transportation'
        elif any(word in text_lower for word in ['cine', 'entretenimiento', 'gym', 'deporte', 'fiesta']):
            return 'Entertainment'
        elif any(word in text_lower for word in ['renta', 'servicio', 'internet', 'teléfono', 'luz', 'agua']):
            return 'Housing'
        elif any(word in text_lower for word in ['ropa', 'farmacia', 'corte', 'cuidado']):
            return 'Lifestyle'
        else:
            return 'Miscellaneous'
    
    else:  # income
        if any(word in text_lower for word in ['salario', 'trabajo', 'sueldo', 'pago']):
            return 'Income'
        elif any(word in text_lower for word in ['inversión', 'interés', 'dividendo']):
            return 'Investments'
        else:
            return 'Other'

def send_confirmation(phone_number, transaction, access_token, phone_number_id):
    """Enviar confirmación al usuario"""
    try:
        message = f"✅ Transacción registrada:\n"
        message += f"💰 {transaction['type'].title()}: Q{transaction['amount']}\n"
        message += f"📂 Categoría: {transaction['category']}\n"
        message += f"📝 Descripción: {transaction['description']}"
        
        send_whatsapp_message(phone_number, message, access_token, phone_number_id)
        
    except Exception as e:
        print(f"❌ Error enviando confirmación: {e}")

def send_help_message(phone_number, access_token, phone_number_id):
    """Enviar mensaje de ayuda"""
    try:
        message = """🤖 Buddy Finanzas - Ayuda

Para registrar una transacción, envía un mensaje como:
• "Gasté Q100 en comida"
• "Compré Q50 de gasolina" 
• "Recibí Q1000 de salario"
• "Pagué Q200 de renta"

¡Soy inteligente y clasifico automáticamente tus transacciones! 💡"""
        
        send_whatsapp_message(phone_number, message, access_token, phone_number_id)
        
    except Exception as e:
        print(f"❌ Error enviando ayuda: {e}")

def send_whatsapp_message(phone_number, message, access_token, phone_number_id):
    """Enviar mensaje a través de WhatsApp API"""
    try:
        if not access_token or not phone_number_id:
            print("⚠️ Credenciales de WhatsApp no configuradas")
            return
        
        url = f"https://graph.facebook.com/v17.0/{phone_number_id}/messages"
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        }
        
        data = {
            'messaging_product': 'whatsapp',
            'to': phone_number,
            'type': 'text',
            'text': {'body': message}
        }
        
        response = requests.post(url, headers=headers, json=data)
        
        if response.status_code == 200:
            print(f"✅ Mensaje enviado a {phone_number}")
        else:
            print(f"❌ Error enviando mensaje: {response.text}")
            
    except Exception as e:
        print(f"❌ Error en envío de WhatsApp: {e}")
