// BuddyFinanzas Widget — Scriptable
// ─────────────────────────────────
// 1. Instala la app "Scriptable" desde el App Store (gratis)
// 2. Abre Scriptable → "+" → pega este script
// 3. Cambia UID y API_URL abajo
// 4. Agrega el widget "Scriptable" a tu pantalla de inicio y selecciona este script

const UID     = "DxuAuPFtBIR0hjTIG2v7UcWPGcQ2"   // Tu Firebase UID
const API_URL = "https://buddywspserver.netlify.app/widget-summary"

// ── Fetch data ──────────────────────────────────────────────────────────────
let data = null
try {
  const req = new Request(`${API_URL}?uid=${UID}`)
  req.timeoutInterval = 8
  data = await req.loadJSON()
} catch (e) {
  data = null
}

// ── Colors ───────────────────────────────────────────────────────────────────
const C = {
  bg1:     new Color("#131320"),
  bg2:     new Color("#1E1040"),
  white:   Color.white(),
  gray:    new Color("#888899"),
  pink:    new Color("#FF6B9D"),
  green:   new Color("#4ADE80"),
  purple:  new Color("#C084FC"),
}

// ── Widget ───────────────────────────────────────────────────────────────────
const widget = new ListWidget()
const gradient = new LinearGradient()
gradient.colors   = [C.bg1, C.bg2]
gradient.locations = [0, 1]
widget.backgroundGradient = gradient
widget.setPadding(14, 16, 14, 16)

if (!data || data.error) {
  const t = widget.addText("No se pudo cargar")
  t.textColor = C.gray
  t.font = Font.systemFont(13)
} else {
  // ── Header ────────────────────────────────────────────────────────────────
  const header = widget.addStack()
  header.layoutHorizontally()
  header.centerAlignContent()

  const appName = header.addText("Buddy Finanzas")
  appName.textColor = C.purple
  appName.font = Font.boldSystemFont(11)

  header.addSpacer()

  const monthLabel = header.addText(getMonthLabel())
  monthLabel.textColor = C.gray
  monthLabel.font = Font.systemFont(10)

  widget.addSpacer(6)

  // ── Balance ───────────────────────────────────────────────────────────────
  const balLabel = widget.addText("Balance total")
  balLabel.textColor = C.gray
  balLabel.font = Font.systemFont(10)

  widget.addSpacer(2)

  const balText = widget.addText(`Q ${fmt(data.totalBalance)}`)
  balText.textColor = C.white
  balText.font = Font.boldSystemFont(28)
  balText.minimumScaleFactor = 0.6

  widget.addSpacer(10)

  // ── Divider ───────────────────────────────────────────────────────────────
  const divider = widget.addStack()
  divider.size = new Size(-1, 1)
  divider.backgroundColor = new Color("#FFFFFF22")

  widget.addSpacer(10)

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = widget.addStack()
  stats.layoutHorizontally()

  // Ingresos
  const incStack = stats.addStack()
  incStack.layoutVertically()
  incStack.spacing = 2
  const incLbl = incStack.addText("↑ Ingresos")
  incLbl.textColor = C.gray
  incLbl.font = Font.systemFont(9)
  const incAmt = incStack.addText(`Q ${fmt(data.monthIncome)}`)
  incAmt.textColor = C.green
  incAmt.font = Font.boldSystemFont(14)

  stats.addSpacer()

  // Gastos
  const expStack = stats.addStack()
  expStack.layoutVertically()
  expStack.spacing = 2
  const expLbl = expStack.addText("↓ Gastos")
  expLbl.textColor = C.gray
  expLbl.font = Font.systemFont(9)
  const expAmt = expStack.addText(`Q ${fmt(data.monthExpenses)}`)
  expAmt.textColor = C.pink
  expAmt.font = Font.boldSystemFont(14)

  // ── Recent transactions (solo en widget grande) ────────────────────────────
  if (config.widgetFamily === 'large' && data.recentTx?.length) {
    widget.addSpacer(12)
    const recLabel = widget.addText("Últimas transacciones")
    recLabel.textColor = C.gray
    recLabel.font = Font.systemFont(9)
    widget.addSpacer(4)

    for (const tx of data.recentTx) {
      const row = widget.addStack()
      row.layoutHorizontally()
      row.spacing = 6
      row.centerAlignContent()

      const dot = row.addText(tx.type === 'income' ? '●' : '●')
      dot.textColor = tx.type === 'income' ? C.green : C.pink
      dot.font = Font.systemFont(8)

      const desc = row.addText(tx.note || tx.categoryId)
      desc.textColor = C.white
      desc.font = Font.systemFont(11)
      desc.lineLimit = 1

      row.addSpacer()

      const amt = row.addText(`${tx.type === 'income' ? '+' : '-'}Q${fmt(tx.amount)}`)
      amt.textColor = tx.type === 'income' ? C.green : C.pink
      amt.font = Font.boldSystemFont(11)

      widget.addSpacer(3)
    }
  }
}

Script.setWidget(widget)
if (config.runsInApp) widget.presentMedium()

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n) {
  return (n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function getMonthLabel() {
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  const d = new Date()
  return `${months[d.getMonth()]} ${d.getFullYear()}`
}
