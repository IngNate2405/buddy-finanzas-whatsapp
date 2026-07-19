// BuddyFinanzas Widget — Scriptable
// Guarda como "BuddyFinanzas" en Scriptable

const UID     = "DxuAuPFtBIR0hjTIG2v7UcWPGcQ2"
const API_URL = "https://buddywspserver.netlify.app/widget-summary"
const APP_URL = "https://finanzas-nate.vercel.app"

// ── Fetch ─────────────────────────────────────────────────────────────────────
let data = null
try {
  const req = new Request(`${API_URL}?uid=${UID}`)
  req.timeoutInterval = 10
  data = await req.loadJSON()
} catch (e) { data = null }

// ── Colores ───────────────────────────────────────────────────────────────────
const BG1      = new Color("#0D0D1A")
const BG2      = new Color("#141428")
const PURPLE   = new Color("#A78BFA")
const PURPLE_DIM = new Color("#A78BFA", 0.15)
const GREEN    = new Color("#34D399")
const BLUE     = new Color("#60A5FA")
const WHITE    = Color.white()
const GRAY     = new Color("#6B7280")
const SURFACE  = new Color("#FFFFFF", 0.07)

// ── Widget ────────────────────────────────────────────────────────────────────
const w = new ListWidget()
const grad = new LinearGradient()
grad.colors    = [BG1, BG2]
grad.locations = [0, 1]
w.backgroundGradient = grad
w.setPadding(16, 16, 16, 16)
w.url = APP_URL

if (!data || data.error) {
  const t = w.addText("Sin conexión")
  t.textColor = GRAY
  t.font = Font.mediumSystemFont(13)
  t.centerAlignText()
} else {
  const total     = data.totalBalance   || 0
  const cash      = data.cashBalance    || 0
  const card      = data.cardBalance    || 0
  const expenses  = data.monthExpenses  || 0
  const income    = data.monthIncome    || 0
  const available = Math.max(0, income - expenses)
  const pct       = income > 0 ? Math.min(1, available / income) : (total > 0 ? 1 : 0)

  if (config.widgetFamily === 'small') {
    buildSmall(w, total, pct, cash, card)
  } else {
    buildMedium(w, available, pct, cash, card, expenses)
  }
}

Script.setWidget(w)
if (config.runsInApp) {
  if (config.widgetFamily === 'small') w.presentSmall()
  else w.presentMedium()
}

// ── Widget mediano ─────────────────────────────────────────────────────────────
function buildMedium(w, available, pct, cash, card, expenses) {
  const row = w.addStack()
  row.layoutHorizontally()
  row.centerAlignContent()

  // Gauge izquierda
  const gSize = 130
  const gaugeImg = row.addImage(makeGauge(available, pct, gSize))
  gaugeImg.imageSize = new Size(gSize, gSize)

  row.addSpacer(14)

  // Panel derecho
  const right = row.addStack()
  right.layoutVertically()
  right.spacing = 0

  // Título mes
  const now = new Date()
  const monthName = now.toLocaleDateString('es-GT', { month: 'long' }).toUpperCase()
  const monthLbl = right.addText(monthName)
  monthLbl.textColor = GRAY
  monthLbl.font = Font.boldSystemFont(8)

  right.addSpacer(10)

  // Tarjeta
  addStatBlock(right, "💳", "Tarjeta", card)

  right.addSpacer(8)

  // Efectivo
  addStatBlock(right, "💵", "Efectivo", cash)

  right.addSpacer(10)

  // Divider
  const div = right.addStack()
  div.size = new Size(-1, 1)
  div.backgroundColor = new Color("#FFFFFF", 0.1)

  right.addSpacer(8)

  // Gastos del mes
  const expRow = right.addStack()
  expRow.layoutHorizontally()
  expRow.centerAlignContent()
  const expLbl = expRow.addText("Gastos mes  ")
  expLbl.textColor = GRAY
  expLbl.font = Font.systemFont(9)
  const expAmt = expRow.addText(`-Q ${fmt(expenses)}`)
  expAmt.textColor = new Color("#F87171")
  expAmt.font = Font.boldSystemFont(9)
}

// ── Widget pequeño ─────────────────────────────────────────────────────────────
function buildSmall(w, total, pct, cash, card) {
  w.addSpacer()
  const img = w.addImage(makeGauge(total, pct, 110))
  img.centerAlignImage()
  img.imageSize = new Size(110, 110)
  w.addSpacer(8)

  const row = w.addStack()
  row.layoutHorizontally()
  row.centerAlignContent()

  const cashLbl = row.addText(`💵 Q${fmtShort(cash)}`)
  cashLbl.textColor = GREEN
  cashLbl.font = Font.boldSystemFont(9)
  row.addSpacer()
  const cardLbl = row.addText(`💳 Q${fmtShort(card)}`)
  cardLbl.textColor = BLUE
  cardLbl.font = Font.boldSystemFont(9)

  w.addSpacer()
}

// ── Bloque de stat (tarjeta / efectivo) ───────────────────────────────────────
function addStatBlock(parent, icon, label, amount) {
  const stack = parent.addStack()
  stack.layoutVertically()
  stack.spacing = 2
  stack.setPadding(8, 10, 8, 10)
  stack.cornerRadius = 10
  stack.backgroundColor = SURFACE

  const topRow = stack.addStack()
  topRow.layoutHorizontally()
  topRow.centerAlignContent()

  const ico = topRow.addText(icon)
  ico.font = Font.systemFont(10)
  topRow.addSpacer(4)

  const lbl = topRow.addText(label)
  lbl.textColor = GRAY
  lbl.font = Font.boldSystemFont(9)

  const amtColor = label === 'Tarjeta' ? BLUE : GREEN
  const amt = stack.addText(`Q ${fmt(amount)}`)
  amt.textColor = amtColor
  amt.font = Font.boldSystemFont(14)
}

// ── Gauge ─────────────────────────────────────────────────────────────────────
function makeGauge(amount, pct, size) {
  const ctx = new DrawContext()
  ctx.size = new Size(size, size)
  ctx.opaque = false
  ctx.respectScreenScale = true

  const cx = size / 2
  const cy = size / 2
  const r  = (size - 20) / 2
  const lw = size * 0.10

  const startA = Math.PI * 0.75        // 135° (abajo-izquierda)
  const sweep  = Math.PI * 1.5         // 270°

  // Track
  ctx.addPath(arcPath(cx, cy, r, startA, startA + sweep, 80))
  ctx.setStrokeColor(PURPLE_DIM)
  ctx.setLineWidth(lw)
  ctx.strokePath()

  // Progreso
  if (pct > 0.005) {
    const filledSweep = pct * sweep
    ctx.addPath(arcPath(cx, cy, r, startA, startA + filledSweep, 80))
    ctx.setStrokeColor(PURPLE)
    ctx.setLineWidth(lw)
    ctx.strokePath()

    // Punto de progreso al final del arco
    const endA = startA + filledSweep
    const dotX = cx + r * Math.cos(endA)
    const dotY = cy + r * Math.sin(endA)
    const dotPath = new Path()
    const dotR = lw * 0.6
    dotPath.addEllipse(new Rect(dotX - dotR, dotY - dotR, dotR * 2, dotR * 2))
    ctx.addPath(dotPath)
    ctx.setFillColor(WHITE)
    ctx.fillPath()
  }

  // Monto disponible
  ctx.setTextAlignedCenter()
  ctx.setFont(Font.boldSystemFont(size * 0.155))
  ctx.setTextColor(WHITE)
  ctx.drawTextInRect(
    `Q ${fmtShort(amount)}`,
    new Rect(8, cy - size * 0.13, size - 16, size * 0.22)
  )

  // Etiqueta
  ctx.setFont(Font.boldSystemFont(size * 0.082))
  ctx.setTextColor(GRAY)
  ctx.drawTextInRect(
    "DISPONIBLE",
    new Rect(0, cy + size * 0.08, size, size * 0.15)
  )

  // Porcentaje abajo-centro
  if (pct >= 0) {
    ctx.setFont(Font.boldSystemFont(size * 0.09))
    ctx.setTextColor(PURPLE)
    ctx.drawTextInRect(
      `${Math.round(pct * 100)}%`,
      new Rect(0, cy + size * 0.24, size, size * 0.16)
    )
  }

  return ctx.getImage()
}

function arcPath(cx, cy, r, start, end, steps) {
  const path = new Path()
  for (let i = 0; i <= steps; i++) {
    const a = start + (end - start) * (i / steps)
    const x = cx + r * Math.cos(a)
    const y = cy + r * Math.sin(a)
    if (i === 0) path.move(new Point(x, y))
    else path.addLine(new Point(x, y))
  }
  return path
}

function fmt(n) {
  return (n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtShort(n) {
  const v = n || 0
  if (v >= 10000) return (v / 1000).toFixed(1) + 'K'
  return v.toLocaleString('es-GT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
