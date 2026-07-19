// BuddyFinanzas Widget — Scriptable
// ─────────────────────────────────
// 1. Instala "Scriptable" desde el App Store
// 2. Abre Scriptable → "+" → pega este script → guarda como "BuddyFinanzas"
// 3. Agrega widget Scriptable al inicio → Edit Widget → selecciona el script

const UID     = "DxuAuPFtBIR0hjTIG2v7UcWPGcQ2"
const API_URL = "https://buddywspserver.netlify.app/widget-summary"
const ADD_URL = "https://buddywspserver.netlify.app/add-transaction"
const APP_URL = "https://finanzas-nate.vercel.app"

// Categorías de acceso rápido
const QUICK_CATS = [
  { emoji: "🍽️", label: "Comida",        color: "#FF6B9D", id: "food"          },
  { emoji: "⛽",  label: "Gasolina",      color: "#F59E0B", id: "gas"           },
  { emoji: "🛍️", label: "Estilo de vida",color: "#8B5CF6", id: "lifestyle"     },
  { emoji: "🎬",  label: "Ocio",          color: "#3B82F6", id: "entertainment" },
]

// ── ¿Se ejecuta desde un botón del widget? ───────────────────────────────────
const q = args.queryParameters || {}

if (q.action === 'new') {
  // Mostrar diálogo nativo para registrar transacción rápida
  const cat = QUICK_CATS.find(c => c.id === q.category)
  const label = cat ? `${cat.emoji} ${cat.label}` : '➕ Nueva transacción'

  const alert = new Alert()
  alert.title = label
  alert.message = 'Ingresa el monto (Q)'
  alert.addTextField('0.00', '')
  alert.addAction('Guardar')
  alert.addCancelAction('Cancelar')

  const choice = await alert.presentAlert()

  if (choice === 0) {
    const amount = parseFloat(alert.textFieldValue(0).replace(',', '.'))
    if (amount > 0) {
      const now = new Date()
      const date = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`

      const req = new Request(ADD_URL)
      req.method = 'POST'
      req.headers = { 'Content-Type': 'application/json' }
      req.body = JSON.stringify({
        uid: UID,
        type: 'expense',
        amount,
        categoryId: q.category || 'misc',
        date,
      })

      try {
        await req.loadJSON()
        const ok = new Alert()
        ok.title = '✅ Guardado'
        ok.message = `Q ${amount.toFixed(2)} en ${cat ? cat.label : 'misc'}`
        ok.addAction('OK')
        await ok.presentAlert()
      } catch (e) {
        const err = new Alert()
        err.title = '❌ Error'
        err.message = 'No se pudo guardar. Revisa tu conexión.'
        err.addAction('OK')
        await err.presentAlert()
      }
    }
  }

  Script.complete()
  return
}

if (q.action === 'open') {
  Safari.open(APP_URL)
  Script.complete()
  return
}

// ── Fetch datos para el widget ────────────────────────────────────────────────
let data = null
try {
  const req = new Request(`${API_URL}?uid=${UID}`)
  req.timeoutInterval = 8
  data = await req.loadJSON()
} catch (e) { data = null }

// ── Colores ───────────────────────────────────────────────────────────────────
const C = {
  bg1:    new Color("#131320"),
  bg2:    new Color("#1E1040"),
  white:  Color.white(),
  gray:   new Color("#888899"),
  pink:   new Color("#FF6B9D"),
  green:  new Color("#4ADE80"),
  purple: new Color("#C084FC"),
}

// ── Widget ────────────────────────────────────────────────────────────────────
const widget = new ListWidget()
const grad = new LinearGradient()
grad.colors    = [C.bg1, C.bg2]
grad.locations = [0, 1]
widget.backgroundGradient = grad
widget.setPadding(14, 14, 14, 14)
// Tap en el gauge/fondo → abre la app
widget.url = `scriptable:///run?scriptName=BuddyFinanzas&action=open`

if (!data || data.error) {
  const t = widget.addText("No se pudo cargar")
  t.textColor = C.gray
  t.font = Font.systemFont(13)
} else {
  const leftToSpend = Math.max(0, (data.monthIncome || 0) - (data.monthExpenses || 0))
  const leftPct     = data.monthIncome > 0
    ? Math.max(0, Math.min(1, leftToSpend / data.monthIncome))
    : 0

  const isLarge = config.widgetFamily === 'large'

  // ── Fila principal: gauge + botones ──────────────────────────────────────
  const mainRow = widget.addStack()
  mainRow.layoutHorizontally()
  mainRow.centerAlignContent()

  // Gauge izquierda
  const gSize = isLarge ? 150 : 118
  const gImg = mainRow.addImage(makeGauge(leftToSpend, leftPct, gSize))
  gImg.imageSize = new Size(gSize, gSize)

  mainRow.addSpacer(10)

  // Botones 2x2 de categorías
  const btnSize = isLarge ? 54 : 46
  const right = mainRow.addStack()
  right.layoutVertically()
  right.spacing = 8

  for (let i = 0; i < 2; i++) {
    const row = right.addStack()
    row.layoutHorizontally()
    row.spacing = 8

    for (let j = 0; j < 2; j++) {
      const cat = QUICK_CATS[i * 2 + j]
      const btn = row.addImage(makeCatButton(cat.emoji, new Color(cat.color), btnSize))
      btn.imageSize = new Size(btnSize, btnSize)
      // Llama a Scriptable con acción 'new' y la categoría
      btn.url = `scriptable:///run?scriptName=BuddyFinanzas&action=new&category=${cat.id}`
    }
  }

  mainRow.addSpacer()

  // Botón "+" (nueva transacción sin categoría predefinida)
  const plusCol = mainRow.addStack()
  plusCol.layoutVertically()
  plusCol.centerAlignContent()
  const plusBtn = plusCol.addImage(makePlusButton(btnSize))
  plusBtn.imageSize = new Size(btnSize, btnSize)
  plusBtn.url = `scriptable:///run?scriptName=BuddyFinanzas&action=new`

  if (isLarge) {
    widget.addSpacer(10)
    addDivider(widget)
    widget.addSpacer(8)
    addStats(widget, data)

    if (data.recentTx?.length) {
      widget.addSpacer(8)
      addDivider(widget)
      widget.addSpacer(6)
      addRecentTx(widget, data.recentTx, 4)
    }
  }
}

Script.setWidget(widget)
if (config.runsInApp) widget.presentMedium()

// ── Gauge ─────────────────────────────────────────────────────────────────────
function makeGauge(leftToSpend, leftPct, size) {
  const ctx = new DrawContext()
  ctx.size = new Size(size, size)
  ctx.opaque = false
  ctx.respectScreenScale = true

  const cx = size / 2, cy = size / 2
  const r  = (size - 18) / 2
  const lw = size * 0.088

  const startAngle = Math.PI * 0.75
  const sweep      = Math.PI * 1.5

  // Track
  ctx.addPath(arcPath(cx, cy, r, startAngle, startAngle + sweep, 60))
  ctx.setStrokeColor(new Color("#C084FC25"))
  ctx.setLineWidth(lw)
  ctx.strokePath()

  // Progreso
  if (leftPct > 0.01) {
    ctx.addPath(arcPath(cx, cy, r, startAngle, startAngle + leftPct * sweep, 60))
    ctx.setStrokeColor(new Color("#C084FC"))
    ctx.setLineWidth(lw)
    ctx.strokePath()
  }

  // Monto
  ctx.setTextAlignedCenter()
  ctx.setFont(Font.boldSystemFont(size * 0.145))
  ctx.setTextColor(Color.white())
  ctx.drawTextInRect(`Q ${fmtShort(leftToSpend)}`, new Rect(6, cy - size * 0.14, size - 12, size * 0.22))

  // Etiqueta
  ctx.setFont(Font.systemFont(size * 0.082))
  ctx.setTextColor(new Color("#888899"))
  ctx.drawTextInRect("DISPONIBLE", new Rect(0, cy + size * 0.07, size, size * 0.14))

  return ctx.getImage()
}

function arcPath(cx, cy, r, start, end, steps) {
  const path = new Path()
  for (let i = 0; i <= steps; i++) {
    const angle = start + (end - start) * i / steps
    const x = cx + r * Math.cos(angle)
    const y = cy + r * Math.sin(angle)
    if (i === 0) path.move(new Point(x, y))
    else path.addLine(new Point(x, y))
  }
  return path
}

// ── Botón de categoría ────────────────────────────────────────────────────────
function makeCatButton(emoji, bgColor, size) {
  const ctx = new DrawContext()
  ctx.size = new Size(size, size)
  ctx.opaque = false
  ctx.respectScreenScale = true

  const path = new Path()
  path.addEllipse(new Rect(0, 0, size, size))
  ctx.addPath(path)
  ctx.setFillColor(bgColor)
  ctx.fillPath()

  ctx.setFont(Font.systemFont(size * 0.42))
  ctx.setTextAlignedCenter()
  ctx.drawTextInRect(emoji, new Rect(0, size * 0.22, size, size * 0.56))

  return ctx.getImage()
}

// ── Botón "+" ─────────────────────────────────────────────────────────────────
function makePlusButton(size) {
  const ctx = new DrawContext()
  ctx.size = new Size(size, size)
  ctx.opaque = false
  ctx.respectScreenScale = true

  const path = new Path()
  path.addEllipse(new Rect(0, 0, size, size))
  ctx.addPath(path)
  ctx.setFillColor(new Color("#FFFFFF18"))
  ctx.fillPath()

  ctx.setFont(Font.boldSystemFont(size * 0.5))
  ctx.setTextColor(Color.white())
  ctx.setTextAlignedCenter()
  ctx.drawTextInRect("+", new Rect(0, size * 0.1, size, size * 0.7))

  return ctx.getImage()
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function addStats(w, data) {
  const row = w.addStack()
  row.layoutHorizontally()
  const inc = row.addStack(); inc.layoutVertically(); inc.spacing = 2
  const il = inc.addText("↑ Ingresos"); il.textColor = C.gray; il.font = Font.systemFont(9)
  const ia = inc.addText(`Q ${fmt(data.monthIncome)}`); ia.textColor = C.green; ia.font = Font.boldSystemFont(13)
  row.addSpacer()
  const exp = row.addStack(); exp.layoutVertically(); exp.spacing = 2
  const el = exp.addText("↓ Gastos"); el.textColor = C.gray; el.font = Font.systemFont(9)
  const ea = exp.addText(`Q ${fmt(data.monthExpenses)}`); ea.textColor = C.pink; ea.font = Font.boldSystemFont(13)
}

function addDivider(w) {
  const d = w.addStack()
  d.size = new Size(-1, 1)
  d.backgroundColor = new Color("#FFFFFF18")
}

function addRecentTx(w, txList, max) {
  for (const tx of txList.slice(0, max)) {
    const row = w.addStack(); row.layoutHorizontally(); row.spacing = 5; row.centerAlignContent()
    const dot = row.addText("●"); dot.textColor = tx.type === 'income' ? C.green : C.pink; dot.font = Font.systemFont(7)
    const desc = row.addText(tx.note || tx.categoryId); desc.textColor = C.white; desc.font = Font.systemFont(11); desc.lineLimit = 1
    row.addSpacer()
    const amt = row.addText(`${tx.type === 'income' ? '+' : '-'}Q${fmtShort(tx.amount)}`); amt.textColor = tx.type === 'income' ? C.green : C.pink; amt.font = Font.boldSystemFont(11)
    w.addSpacer(3)
  }
}

function fmt(n) {
  return (n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtShort(n) {
  const v = n || 0
  if (v >= 10000) return (v / 1000).toFixed(1) + 'K'
  return v.toLocaleString('es-GT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
