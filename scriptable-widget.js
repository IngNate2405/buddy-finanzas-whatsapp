// BuddyFinanzas Widget — Scriptable
// Guarda como "BuddyFinanzas" en Scriptable

const UID     = "DxuAuPFtBIR0hjTIG2v7UcWPGcQ2"
const API_URL = "https://buddywspserver.netlify.app/widget-summary"
const APP_URL = "https://finanzas-nate.vercel.app"

// ── Cache ─────────────────────────────────────────────────────────────────────
const fm        = FileManager.local()
const cachePath = fm.joinPath(fm.documentsDirectory(), "buddy_widget_cache.json")

let cached = null
try {
  if (fm.fileExists(cachePath)) cached = JSON.parse(fm.readString(cachePath))
} catch (e) {}

// ── Fetch ─────────────────────────────────────────────────────────────────────
let data = null
try {
  const req = new Request(`${API_URL}?uid=${UID}`)
  req.timeoutInterval = 10
  data = await req.loadJSON()
} catch (e) {
  data = cached // usa caché si no hay red
}

// Guarda si cambió algo; ajusta intervalo de refresco en consecuencia
const changed = JSON.stringify(data) !== JSON.stringify(cached)
if (changed && data) {
  try { fm.writeString(cachePath, JSON.stringify(data)) } catch (e) {}
}

// ── Traducciones ──────────────────────────────────────────────────────────────
const STRINGS = {
  es: {
    noConnection:  "Sin conexión",
    available:     "DISPONIBLE",
    monthExpenses: "Gastos mes",
    noWidget:      "Activa 'Show in widget'\nen tu billetera",
    locale:        "es-GT",
  },
  en: {
    noConnection:  "No connection",
    available:     "AVAILABLE",
    monthExpenses: "Month expenses",
    noWidget:      "Enable 'Show in widget'\nin your wallet",
    locale:        "en-US",
  },
}

// ── Colores ───────────────────────────────────────────────────────────────────
const BG1     = new Color("#0D0D1A")
const BG2     = new Color("#141428")
const PURPLE  = new Color("#A78BFA")
const PURPLE_DIM = new Color("#A78BFA", 0.15)
const WHITE   = Color.white()
const GRAY    = new Color("#6B7280")
const SURFACE = new Color("#FFFFFF", 0.07)

// ── Widget ────────────────────────────────────────────────────────────────────
const w = new ListWidget()
const grad = new LinearGradient()
grad.colors    = [BG1, BG2]
grad.locations = [0, 1]
w.backgroundGradient = grad
w.setPadding(16, 16, 16, 16)
w.url = APP_URL
// Si hubo cambios: vuelve a verificar en 5 min; si no: en 30 min
w.refreshAfterDate = new Date(Date.now() + (changed ? 5 : 30) * 60 * 1000)

const lang = STRINGS[data?.language] ? data.language : 'es'
const S    = STRINGS[lang]

if (!data || data.error) {
  const t = w.addText(S.noConnection)
  t.textColor = GRAY
  t.font = Font.mediumSystemFont(13)
  t.centerAlignText()
} else {
  const expenses  = data.monthExpenses  || 0
  const income    = data.monthIncome    || 0
  const available = Math.max(0, income - expenses)
  const pct       = income > 0 ? Math.min(1, available / income) : 0
  const wallets   = data.widgetWallets  || []

  if (config.widgetFamily === 'small') {
    buildSmall(w, available, pct, wallets, S)
  } else {
    buildMedium(w, available, pct, wallets, expenses, S)
  }
}

Script.setWidget(w)
if (config.runsInApp) {
  if (config.widgetFamily === 'small') w.presentSmall()
  else w.presentMedium()
}

// ── Widget mediano ─────────────────────────────────────────────────────────────
function buildMedium(w, available, pct, wallets, expenses, S) {
  const row = w.addStack()
  row.layoutHorizontally()
  row.centerAlignContent()

  // Gauge izquierda
  const gSize = 130
  const gaugeImg = row.addImage(makeGauge(available, pct, gSize, S))
  gaugeImg.imageSize = new Size(gSize, gSize)

  row.addSpacer(14)

  // Panel derecho
  const right = row.addStack()
  right.layoutVertically()
  right.spacing = 0

  // Mes actual
  const now = new Date()
  const monthName = now.toLocaleDateString(S.locale, { month: 'long' }).toUpperCase()
  const monthLbl = right.addText(monthName)
  monthLbl.textColor = GRAY
  monthLbl.font = Font.boldSystemFont(8)

  right.addSpacer(10)

  if (wallets.length === 0) {
    const hint = right.addText(S.noWidget)
    hint.textColor = GRAY
    hint.font = Font.systemFont(10)
    hint.lineLimit = 3
  } else {
    const maxShow = Math.min(wallets.length, 3)
    for (let i = 0; i < maxShow; i++) {
      if (i > 0) right.addSpacer(8)
      addWalletBlock(right, wallets[i], S)
    }
  }

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
  const expLbl = expRow.addText(`${S.monthExpenses}  `)
  expLbl.textColor = GRAY
  expLbl.font = Font.systemFont(9)
  const expAmt = expRow.addText(`-Q ${fmt(expenses, S.locale)}`)
  expAmt.textColor = new Color("#F87171")
  expAmt.font = Font.boldSystemFont(9)
}

// ── Widget pequeño ─────────────────────────────────────────────────────────────
function buildSmall(w, available, pct, wallets, S) {
  w.addSpacer()
  const img = w.addImage(makeGauge(available, pct, 110, S))
  img.centerAlignImage()
  img.imageSize = new Size(110, 110)
  w.addSpacer(8)

  if (wallets.length > 0) {
    const row = w.addStack()
    row.layoutHorizontally()
    row.centerAlignContent()

    const max = Math.min(wallets.length, 2)
    for (let i = 0; i < max; i++) {
      if (i > 0) row.addSpacer()
      const wl = wallets[i]
      const lbl = row.addText(`Q${fmtShort(wl.balance)}`)
      lbl.textColor = wl.balance < 0 ? new Color("#F87171") : new Color("#34D399")
      lbl.font = Font.boldSystemFont(9)
    }
  }

  w.addSpacer()
}

// ── Bloque de billetera ────────────────────────────────────────────────────────
function addWalletBlock(parent, wallet, S) {
  const stack = parent.addStack()
  stack.layoutVertically()
  stack.spacing = 2
  stack.setPadding(8, 10, 8, 10)
  stack.cornerRadius = 10
  stack.backgroundColor = SURFACE

  const nameLbl = stack.addText(wallet.name.toUpperCase())
  nameLbl.textColor = GRAY
  nameLbl.font = Font.boldSystemFont(8)
  nameLbl.lineLimit = 1

  const amtColor = wallet.balance < 0 ? new Color("#F87171") : new Color("#34D399")
  const amtLbl = stack.addText(`Q ${fmt(wallet.balance, S.locale)}`)
  amtLbl.textColor = amtColor
  amtLbl.font = Font.boldSystemFont(14)
}

function makeGauge(amount, pct, size, S) {
  const ctx = new DrawContext()
  ctx.size = new Size(size, size)
  ctx.opaque = false
  ctx.respectScreenScale = true

  const cx = size / 2
  const cy = size / 2
  const r  = (size - 20) / 2
  const lw = size * 0.10

  const startA = Math.PI * 0.75
  const sweep  = Math.PI * 1.5

  // Track
  ctx.addPath(arcPath(cx, cy, r, startA, startA + sweep, 80))
  ctx.setStrokeColor(PURPLE_DIM)
  ctx.setLineWidth(lw)
  ctx.strokePath()

  // Progreso
  if (pct > 0.005) {
    ctx.addPath(arcPath(cx, cy, r, startA, startA + pct * sweep, 80))
    ctx.setStrokeColor(PURPLE)
    ctx.setLineWidth(lw)
    ctx.strokePath()

    // Punto al final del arco
    const endA = startA + pct * sweep
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
    S.available,
    new Rect(0, cy + size * 0.08, size, size * 0.15)
  )

  // Porcentaje
  ctx.setFont(Font.boldSystemFont(size * 0.09))
  ctx.setTextColor(PURPLE)
  ctx.drawTextInRect(
    `${Math.round(pct * 100)}%`,
    new Rect(0, cy + size * 0.24, size, size * 0.16)
  )

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

function fmt(n, locale) {
  return (n || 0).toLocaleString(locale || 'es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtShort(n, locale) {
  const v = n || 0
  if (v >= 10000) return (v / 1000).toFixed(1) + 'K'
  return v.toLocaleString(locale || 'es-GT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
