# 📱 Buddy Finanzas - WhatsApp Webhook

Servidor para procesar transacciones automáticamente desde WhatsApp Business.

## 🚀 Despliegue en Netlify

### 1. Subir a GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/tu-usuario/buddy-finanzas-whatsapp.git
git push -u origin main
```

### 2. Conectar con Netlify
1. Ve a [netlify.com](https://netlify.com)
2. Conecta tu repositorio de GitHub
3. Configura las variables de entorno

### 3. Variables de Entorno
En Netlify, ve a **Site settings** → **Environment variables**:
```
WHATSAPP_VERIFY_TOKEN=buddy_finanzas_webhook
WHATSAPP_ACCESS_TOKEN=tu_token_real
WHATSAPP_PHONE_NUMBER_ID=tu_phone_id_real
```

## 🔧 Configuración Local

### Instalar dependencias
```bash
pip install -r requirements.txt
```

### Configurar variables
```bash
cp env.example .env
# Editar .env con tus credenciales
```

### Ejecutar servidor
```bash
python app.py
```

## 📱 Configuración de WhatsApp

### Webhook URL
```
https://tu-app.netlify.app/webhook
```

### Verify Token
```
buddy_finanzas_webhook
```

## 🧪 Pruebas

### Health Check
```
GET https://tu-app.netlify.app/health
```

### Webhook Test
```
GET https://tu-app.netlify.app/webhook?hub.mode=subscribe&hub.verify_token=buddy_finanzas_webhook&hub.challenge=test
```

## 📊 Mensajes Soportados

**Gastos:**
- "Gasté Q100 en comida"
- "Compré Q50 de gasolina"
- "Pagué Q200 de renta"

**Ingresos:**
- "Recibí Q1000 de salario"
- "Gané Q500"
- "Ingresó Q2000"
