#!/usr/bin/env python3
"""
Script optimizado para Netlify Functions
Lee mensajes de Telegram y los devuelve en formato JSON
"""
import asyncio
import json
import os
import sys
from telethon import TelegramClient

# Configuración
API_ID = os.getenv('TELEGRAM_API_ID')
API_HASH = os.getenv('TELEGRAM_API_HASH')
PHONE = os.getenv('TELEGRAM_PHONE')
SESSION_NAME = 'buddy_finanzas_session'

async def read_messages():
    """Leer mensajes de Telegram y devolver en formato JSON"""
    try:
        if not all([API_ID, API_HASH, PHONE]):
            return []
            
        client = TelegramClient(SESSION_NAME, int(API_ID), API_HASH)
        
        await client.start(phone=PHONE)
        
        # Obtener el usuario actual
        me = await client.get_me()
        
        # Leer mensajes guardados (últimos 5)
        messages = await client.get_messages(me.id, limit=5)
        
        results = []
        for message in messages:
            if message.text and message.text.strip():
                results.append({
                    'id': message.id,
                    'text': message.text,
                    'date': message.date.isoformat(),
                    'sender': str(me.id)
                })
        
        await client.disconnect()
        return results
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return []

if __name__ == "__main__":
    # Ejecutar y devolver JSON
    messages = asyncio.run(read_messages())
    print(json.dumps(messages, ensure_ascii=False))
