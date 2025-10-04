# 📱 Configuración de Telegram API para Buddy Finanzas

## 🔧 Paso 1: Configurar credenciales

### 1.1 Crear archivo de configuración:
```bash
cp telegram_config.env.example telegram_config.env
```

### 1.2 Editar telegram_config.env:
```env
TELEGRAM_API_ID=TU_API_ID_AQUI
TELEGRAM_API_HASH=TU_API_HASH_AQUI
TELEGRAM_PHONE=+50249141812
```

## 🧪 Paso 2: Probar la conexión

### 2.1 Instalar dependencias:
```bash
pip install -r requirements.txt
```

### 2.2 Ejecutar prueba:
```bash
python netlify_telegram_reader.py
```

**Primera vez:** Te pedirá un código de verificación que llegará por SMS.

## 📱 Paso 3: Configurar en Netlify

### 3.1 Variables de entorno en Netlify:
```
TELEGRAM_API_ID=tu_api_id
TELEGRAM_API_HASH=tu_api_hash
TELEGRAM_PHONE=+50249141812
FIREBASE_PROJECT_ID=tu-project-id
FIREBASE_PRIVATE_KEY_ID=tu-private-key-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\ntu-private-key\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@tu-project.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=tu-client-id
```

## 🚀 Paso 4: Usar el sistema

### 4.1 Enviar mensajes:
- **A "Mensajes guardados"** en Telegram
- **A un grupo privado** que crees
- **A tu propio número** (si tienes dos números)

### 4.2 Ejemplos de mensajes:
```
Gasté Q50 en comida
Pagué Q200 de renta
Recibí Q3000 de salario
Compré Q30 en supermercado
```

### 4.3 Procesar mensajes:
```bash
# Probar función localmente
curl https://tu-sitio.netlify.app/.netlify/functions/process-telegram
```

## 🔄 Paso 5: Automatización (Opcional)

### 5.1 Cron job en Netlify:
```toml
# netlify.toml
[[plugins]]
  package = "@netlify/plugin-cron"

[[plugins.inputs]]
  schedule = "*/5 * * * *"  # Cada 5 minutos
  command = "curl https://tu-sitio.netlify.app/.netlify/functions/process-telegram"
```

### 5.2 GitHub Actions:
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

### Error de autenticación:
- ✅ Verifica que el API_ID y API_HASH sean correctos
- ✅ Asegúrate de que el número de teléfono sea válido
- ✅ Revisa que tengas conexión a internet

### No aparecen mensajes:
- ✅ Envía un mensaje a "Mensajes guardados" en Telegram
- ✅ Verifica que el script tenga permisos de lectura
- ✅ Revisa los logs en la consola

### Error de Firebase:
- ✅ Verifica que las credenciales de Firebase sean correctas
- ✅ Asegúrate de que el proyecto de Firebase esté activo
- ✅ Revisa que las reglas de Firestore permitan escritura

## 📋 URLs importantes

- **Función de procesamiento:** `https://tu-sitio.netlify.app/.netlify/functions/process-telegram`
- **Health check:** `https://tu-sitio.netlify.app/.netlify/functions/health`
- **Configuración API:** https://my.telegram.org/auth

## 🎯 Flujo completo

1. **Envías mensaje** a Telegram (Mensajes guardados o grupo)
2. **Script lee** mensajes cada 5 minutos (o manualmente)
3. **Procesa transacciones** automáticamente
4. **Guarda en Firebase** por usuario
5. **Aparece en tu app** web

## 🔐 Seguridad

- ✅ **Credenciales seguras:** Nunca subas telegram_config.env a Git
- ✅ **Variables de entorno:** Usa Netlify Environment Variables
- ✅ **Acceso limitado:** Solo tu número puede leer mensajes
- ✅ **Datos privados:** Cada usuario solo ve sus transacciones
