# 🤖 Buddy Finanzas - Telegram API Server

Servidor para procesar mensajes de Telegram y guardar transacciones en Firebase.

## 🚀 Características

- ✅ **Procesamiento inteligente** de transacciones
- ✅ **Integración con Firebase** por usuario
- ✅ **Despliegue en Netlify** como funciones serverless
- ✅ **Configuración segura** con variables de entorno
- ✅ **Sin dependencias de Python** (solo JavaScript)

## 📱 Cómo funciona

1. **Envías mensajes** a "Mensajes guardados" en Telegram
2. **El servidor procesa** los mensajes (simulado por ahora)
3. **Procesa transacciones** automáticamente
4. **Guarda en Firebase** por usuario
5. **Aparece en tu app** web

## 🔧 Configuración

### 1. Variables de entorno en Netlify:

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

### 2. URLs de prueba:

- **Health check:** `https://tu-sitio.netlify.app/.netlify/functions/health`
- **Procesar mensajes:** `https://tu-sitio.netlify.app/.netlify/functions/process-telegram`

## 📝 Ejemplos de mensajes

### Gastos:
- "Gasté Q50 en comida"
- "Pagué Q200 de renta"
- "Compré Q30 en supermercado"

### Ingresos:
- "Recibí Q3000 de salario"
- "Gané Q500 de venta"
- "Ingresó Q100 de inversión"

## 🔄 Automatización

### Cron job en Netlify:
```toml
[[plugins]]
  package = "@netlify/plugin-cron"

[[plugins.inputs]]
  schedule = "*/5 * * * *"  # Cada 5 minutos
  command = "curl https://tu-sitio.netlify.app/.netlify/functions/process-telegram"
```

## 🛠️ Desarrollo local

```bash
# Instalar dependencias
pip install -r requirements.txt

# Configurar variables de entorno
cp telegram_config.env.example telegram_config.env
# Editar telegram_config.env con tus credenciales

# Probar conexión
python netlify_telegram_reader.py
```

## 🔐 Seguridad

- ✅ **Variables de entorno** en Netlify (no en código)
- ✅ **Credenciales seguras** de Telegram y Firebase
- ✅ **Acceso limitado** solo a tus mensajes
- ✅ **Datos privados** por usuario en Firebase

## 📚 Documentación

- [Configuración de Telegram API](TELEGRAM_API_SETUP.md)
- [Configuración de Netlify](NETLIFY_SETUP.md)

## 🎯 Flujo completo

1. **Usuario envía mensaje** a Telegram (Mensajes guardados)
2. **Función Netlify** lee mensajes cada 5 minutos
3. **Procesa transacciones** automáticamente
4. **Guarda en Firebase** por usuario
5. **Datos aparecen** en la app web

## 🚀 Despliegue

Este repositorio está configurado para desplegarse automáticamente en Netlify cuando se hace push a la rama `main`.

**¡Solo necesitas configurar las variables de entorno en Netlify!**
