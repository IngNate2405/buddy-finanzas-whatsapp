import json
import os
from datetime import datetime

def handler(event, context):
    """Netlify function para health check"""
    
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps({
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "whatsapp_configured": bool(os.environ.get('WHATSAPP_ACCESS_TOKEN') and os.environ.get('WHATSAPP_PHONE_NUMBER_ID'))
        })
    }
