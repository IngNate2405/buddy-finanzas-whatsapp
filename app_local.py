#!/usr/bin/env python3
"""
Aplicación simplificada para WhatsApp Business API
Versión para despliegue en la nube
"""

import os
import json
import re
import requests
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Configuración desde variables de entorno
WHATSAPP_VERIFY_TOKEN = os.getenv('WHATSAPP_VERIFY_TOKEN', 'buddy_finanzas_webhook')
WHATSAPP_ACCESS_TOKEN = os.getenv('WHATSAPP_ACCESS_TOKEN')
WHATSAPP_PHONE_NUMBER_ID = os.getenv('WHATSAPP_PHONE_NUMBER_ID')

class WhatsAppHandler:
    def __init__(self):
        self.verify_token = WHATSAPP_VERIFY_TOKEN
        self.access_token = WHATSAPP_ACCESS_TOKEN
        self.phone_number_id = WHATSAPP_PHONE_NUMBER_ID
        
    def verify_webhook(self, mode, token, challenge):
        """Verificar el webhook de WhatsApp"""
        if mode == 'subscribe' and token == self.verify_token:
            print("✅ Webhook verificado correctamente")
            return challenge
        return None
    
    def process_message(self, message_data):
        """Procesar mensaje recibido de WhatsApp"""
        try:
            # Extraer información del mensaje
            message = message_data.get('messages', [{}])[0]
            from_number = message.get('from', '')
            message_text = message.get('text', {}).get('body', '')
            message_id = message.get('id', '')
            
            print(f"📱 Mensaje recibido de {from_number}: {message_text}")
            
            # Procesar el mensaje como posible transacción
            transaction = self.parse_transaction(message_text)
            
            if transaction:
                # Enviar confirmación al usuario
                self.send_confirmation(from_number, transaction)
                return {"status": "success", "message": "Transacción procesada"}
            else:
                # Enviar mensaje de ayuda si no se reconoce como transacción
                self.send_help_message(from_number)
                return {"status": "info", "message": "Mensaje de ayuda enviado"}
                
        except Exception as e:
            print(f"❌ Error procesando mensaje: {e}")
            return {"status": "error", "message": str(e)}
    
    def parse_transaction(self, text):
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
                category = self.classify_transaction(text, 'expense')
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
                category = self.classify_transaction(text, 'income')
                return {
                    'amount': amount,
                    'type': 'income',
                    'category': category,
                    'description': text,
                    'date': datetime.now().isoformat(),
                    'source': 'whatsapp'
                }
        
        return None
    
    def classify_transaction(self, text, transaction_type):
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
    
    def send_confirmation(self, phone_number, transaction):
        """Enviar confirmación al usuario"""
        try:
            message = f"✅ Transacción registrada:\n"
            message += f"💰 {transaction['type'].title()}: Q{transaction['amount']}\n"
            message += f"📂 Categoría: {transaction['category']}\n"
            message += f"📝 Descripción: {transaction['description']}"
            
            self.send_whatsapp_message(phone_number, message)
            
        except Exception as e:
            print(f"❌ Error enviando confirmación: {e}")
    
    def send_help_message(self, phone_number):
        """Enviar mensaje de ayuda"""
        try:
            message = """🤖 Buddy Finanzas - Ayuda

Para registrar una transacción, envía un mensaje como:
• "Gasté Q100 en comida"
• "Compré Q50 de gasolina" 
• "Recibí Q1000 de salario"
• "Pagué Q200 de renta"

¡Soy inteligente y clasifico automáticamente tus transacciones! 💡"""
            
            self.send_whatsapp_message(phone_number, message)
            
        except Exception as e:
            print(f"❌ Error enviando ayuda: {e}")
    
    def send_whatsapp_message(self, phone_number, message):
        """Enviar mensaje a través de WhatsApp API"""
        try:
            if not self.access_token or not self.phone_number_id:
                print("⚠️ Credenciales de WhatsApp no configuradas")
                return
            
            url = f"https://graph.facebook.com/v17.0/{self.phone_number_id}/messages"
            headers = {
                'Authorization': f'Bearer {self.access_token}',
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

# Inicializar handler
whatsapp_handler = WhatsAppHandler()

@app.route('/webhook', methods=['GET', 'POST'])
def handle_webhook():
    """Manejar webhook de WhatsApp"""
    if request.method == 'GET':
        # Verificación del webhook
        mode = request.args.get('hub.mode')
        token = request.args.get('hub.verify_token')
        challenge = request.args.get('hub.challenge')
        
        result = whatsapp_handler.verify_webhook(mode, token, challenge)
        if result:
            return result
        else:
            return 'Error', 403
    
    elif request.method == 'POST':
        # Procesar mensaje
        try:
            data = request.get_json()
            print(f"📨 Webhook recibido: {json.dumps(data, indent=2)}")
            
            # Verificar que es un mensaje válido
            if 'entry' in data and len(data['entry']) > 0:
                entry = data['entry'][0]
                if 'changes' in entry and len(entry['changes']) > 0:
                    change = entry['changes'][0]
                    if 'value' in change and 'messages' in change['value']:
                        result = whatsapp_handler.process_message(change['value'])
                        return jsonify(result)
            
            return jsonify({"status": "no_message"})
            
        except Exception as e:
            print(f"❌ Error procesando webhook: {e}")
            return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Verificar estado del servicio"""
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "whatsapp_configured": bool(WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID)
    })

@app.route('/', methods=['GET'])
def home():
    """Página de inicio"""
    return """
    <h1>🤖 Buddy Finanzas - WhatsApp Webhook</h1>
    <p>Servidor funcionando correctamente</p>
    <p>Webhook URL: <code>/webhook</code></p>
    <p>Health Check: <code>/health</code></p>
    """

if __name__ == '__main__':
    print("🚀 Iniciando servidor de WhatsApp Webhook...")
    print("📱 Configuración:")
    print(f"   - Verify Token: {WHATSAPP_VERIFY_TOKEN}")
    print(f"   - Access Token: {'✅ Configurado' if WHATSAPP_ACCESS_TOKEN else '❌ No configurado'}")
    print(f"   - Phone Number ID: {'✅ Configurado' if WHATSAPP_PHONE_NUMBER_ID else '❌ No configurado'}")
    
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)), debug=False)
