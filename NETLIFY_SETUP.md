# 🚀 Configuración de Netlify para Telegram API

## 📋 Variables de entorno necesarias en Netlify

Ve a **Netlify Dashboard → Site settings → Environment variables** y agrega:

### 🔑 Telegram API:
```
TELEGRAM_API_ID=12345678
TELEGRAM_API_HASH=abc123def456ghi789jkl012mno345pqr678stu901vwx234yz
TELEGRAM_PHONE=+50249141812
```

### 🔥 Firebase Admin SDK:
```
FIREBASE_PROJECT_ID=tu-project-id
FIREBASE_PRIVATE_KEY_ID=tu-private-key-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\ntu-private-key\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@tu-project.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=tu-client-id
```

## 🧪 URLs de prueba

### Health Check:
```
https://tu-sitio.netlify.app/.netlify/functions/health
```

### Procesar mensajes de Telegram:
```
https://tu-sitio.netlify.app/.netlify/functions/process-telegram
```

## 🔄 Configuración de automatización

### Opción 1: Cron job en Netlify
```toml
# netlify.toml
[[plugins]]
  package = "@netlify/plugin-cron"

[[plugins.inputs]]
  schedule = "*/5 * * * *"  # Cada 5 minutos
  command = "curl https://tu-sitio.netlify.app/.netlify/functions/process-telegram"
```

### Opción 2: GitHub Actions
```yaml
# .github/workflows/telegram-polling.yml
name: Telegram Polling
on:
  schedule:
    - cron: '*/5 * * * *'

jobs:
  poll:
    runs-on: ubuntu-latest
    steps:
      - name: Process Telegram Messages
        run: |
          curl -X POST https://tu-sitio.netlify.app/.netlify/functions/process-telegram
```

## 🛠️ Troubleshooting

### Error de Python:
- ✅ Verifica que `runtime.txt` esté en la raíz
- ✅ Asegúrate de que `requirements.txt` tenga las dependencias
- ✅ Revisa los logs de Netlify Functions

### Error de Telegram:
- ✅ Verifica que las credenciales sean correctas
- ✅ Asegúrate de que el número de teléfono sea válido
- ✅ Revisa que tengas mensajes en "Mensajes guardados"

### Error de Firebase:
- ✅ Verifica que las credenciales de Firebase sean correctas
- ✅ Asegúrate de que el proyecto esté activo
- ✅ Revisa las reglas de Firestore

## 📱 Cómo usar

1. **Envía mensajes** a "Mensajes guardados" en Telegram
2. **Ejemplos:** "Gasté Q50 en comida", "Recibí Q3000 de salario"
3. **Llama a la función** manualmente o automáticamente
4. **Las transacciones aparecen** en tu app web

## 🔐 Seguridad

- ✅ **Variables de entorno** en Netlify (no en código)
- ✅ **Credenciales seguras** de Telegram y Firebase
- ✅ **Acceso limitado** solo a tus mensajes
- ✅ **Datos privados** por usuario en Firebase
