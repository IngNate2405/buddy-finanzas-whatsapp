// BuddyFinanzas Widget — Scriptable
// ─────────────────────────────────
// 1. Instala "Scriptable" desde el App Store
// 2. Abre Scriptable → "+" → pega este script → guarda como "BuddyFinanzas"
// 3. Agrega widget Scriptable al inicio → Edit Widget → selecciona el script

const UID           = "DxuAuPFtBIR0hjTIG2v7UcWPGcQ2"
const API_URL       = "https://buddywspserver.netlify.app/widget-summary"
const APP_URL       = "https://finanzas-nate.vercel.app"
const NEW_TX        = `${APP_URL}/transacciones/nueva`
const SC_HOME = "shortcuts://run-shortcut?name=BuddyFinanzas"
const SC_NUEVA = "shortcuts://run-shortcut?name=BuddyNueva"

function scCat(categoryId) {
  return `${SC_NUEVA}&input=${encodeURIComponent(categoryId)}`
}

// Categorías de acceso rápido (emoji, color, categoryId de la app)
const QUICK_CATS = [
  { emoji: "🍽️", color: "#FF6B9D", id: "food"          },
  { emoji: "⛽",  color: "#F59E0B", id: "gas"           },
  { emoji: "🛍️", color: "#8B5CF6", id: "lifestyle"     },
  { emoji: "🎬",  color: "#3B82F6", id: "entertainment" },
]

// ── Fetch ─────────────────────────────────────────────────────────────────────
let data = null
try {
  const req = new Request(`${API_URL}?uid=${UID}`)
  req.timeoutInterval = 8
  data = await req.loadJSON()
} catch (e) { data = null }

// ── Colors ────────────────────────────────────────────────────────────────────
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
widget.url = SC_HOME

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

  // ── Fila principal: gauge + botones ────────────────────────────────────────
  const mainRow = widget.addStack()
  mainRow.layoutHorizontally()
  mainRow.centerAlignContent()

  // Gauge izquierda
  const gSize = isLarge ? 150 : 118
  const gImg = mainRow.addImage(makeGauge(leftToSpend, leftPct, gSize))
  gImg.imageSize = new Size(gSize, gSize)

  mainRow.addSpacer(10)

  // Botones derecha (2x2 grid)
  const btnSize = isLarge ? 54 : 46
  const right = mainRow.addStack()
  right.layoutVertically()
  right.spacing = 8

  for (let i = 0; i < 2; i++) {
    const row = right.addStack()
    row.layoutHorizontally()
    row.spacing = 8

    for (let j = 0; j < 2; j++) {
      const idx = i * 2 + j
      const cat = QUICK_CATS[idx]
      const btn = row.addImage(makeCatButton(cat.emoji, new Color(cat.color), btnSize))
      btn.imageSize = new Size(btnSize, btnSize)
      btn.url = scCat(cat.id)
    }
  }

  mainRow.addSpacer()

  // Botón "+" (abre nueva transacción sin categoría)
  const plusCol = mainRow.addStack()
  plusCol.layoutVertically()
  plusCol.centerAlignContent()

  const plusBtn = plusCol.addImage(makePlusButton(btnSize))
  plusBtn.imageSize = new Size(btnSize, btnSize)
  plusBtn.url = SC_NUEVA

  if (isLarge) {
    // Stats + recientes en widget grande
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
  const bgPath = new Path()
  bgPath.addArc(new Point(cx, cy), r, startAngle, startAngle + sweep, false)
  ctx.addPath(bgPath)
  ctx.setStrokeColor(new Color("#C084FC25"))
  ctx.setLineWidth(lw)
  ctx.strokePath()

  // Progreso
  if (leftPct > 0.01) {
    const pPath = new Path()
    pPath.addArc(new Point(cx, cy), r, startAngle, startAngle + leftPct * sweep, false)
    ctx.addPath(pPath)
    ctx.setStrokeColor(new Color("#C084FC"))
    ctx.setLineWidth(lw)
    ctx.strokePath()
  }

  // Texto monto
  ctx.setTextAlignedCenter()
  ctx.setFont(Font.boldSystemFont(size * 0.145))
  ctx.setTextColor(Color.white())
  ctx.drawTextInRect(`Q ${fmtShort(leftToSpend)}`, new Rect(6, cy - size * 0.14, size - 12, size * 0.22))

  // Texto etiqueta
  ctx.setFont(Font.systemFont(size * 0.082))
  ctx.setTextColor(new Color("#888899"))
  ctx.drawTextInRect("DISPONIBLE", new Rect(0, cy + size * 0.07, size, size * 0.14))

  return ctx.getImage()
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

// ── Helpers de layout ─────────────────────────────────────────────────────────
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

function getMonthLabel() {
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  const d = new Date()
  return `${months[d.getMonth()]} ${d.getFullYear()}`
}
