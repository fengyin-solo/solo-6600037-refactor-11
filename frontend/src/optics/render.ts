// 三个图样共用的渲染流程：准备画布并先清屏 → 校验光强数据 → 按当前波长配色绘制。
// 空数据 / 无效输入时画布被清成底色，绝不保留上一个实验或上一次参数的旧图。

const PATTERN_HEIGHT = 200
const BG_BLACK = 'black'
const BG_INTENSITY = '#0f172a'

export function wavelengthToRGB(nm: number): [number, number, number] {
  let r = 0, g = 0, b = 0
  if (nm >= 380 && nm < 440) { r = -(nm - 440) / 60; b = 1.0 }
  else if (nm >= 440 && nm < 490) { g = (nm - 440) / 50; b = 1.0 }
  else if (nm >= 490 && nm < 510) { g = 1.0; b = -(nm - 510) / 20 }
  else if (nm >= 510 && nm < 580) { r = (nm - 510) / 70; g = 1.0 }
  else if (nm >= 580 && nm < 645) { r = 1.0; g = -(nm - 645) / 65 }
  else if (nm >= 645 && nm <= 780) { r = 1.0 }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}

// 共用数据校验：必须是非平凡的有限数值序列，否则视为无效数据。
export function isValidData(data: readonly number[]): boolean {
  return data.length >= 2 && data.every((v) => Number.isFinite(v))
}

// 每次渲染都重新定尺寸并铺底色，保证画布上不会残留旧帧。
function prepareCanvas(canvas: HTMLCanvasElement | null, bg: string) {
  if (!canvas) return null
  const W = canvas.clientWidth
  if (!W) return null // 隐藏状态下宽度为 0，等恢复可见后由同一流程重绘
  canvas.width = W
  canvas.height = PATTERN_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const H = canvas.height
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  return { ctx, W, H }
}

export function drawPattern(canvas: HTMLCanvasElement | null, wavelength: number, data: readonly number[]) {
  const view = prepareCanvas(canvas, BG_BLACK)
  if (!view || !isValidData(data)) return
  const { ctx, W, H } = view
  const [r, g, b] = wavelengthToRGB(wavelength)
  for (let x = 0; x < W; x++) {
    const idx = Math.round(x / W * (data.length - 1))
    const intensity = data[idx] || 0
    const alpha = Math.min(1, intensity)
    ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`
    ctx.fillRect(x, 0, 1, H)
  }
}

export function drawIntensity(canvas: HTMLCanvasElement | null, wavelength: number, data: readonly number[]) {
  const view = prepareCanvas(canvas, BG_INTENSITY)
  if (!view || !isValidData(data)) return
  const { ctx, W, H } = view
  const [r, g, b] = wavelengthToRGB(wavelength)
  ctx.beginPath()
  ctx.strokeStyle = `rgb(${r},${g},${b})`
  ctx.lineWidth = 2
  data.forEach((v, i) => {
    const x = i / (data.length - 1) * W
    const y = H - v * (H - 10) - 5
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  })
  ctx.stroke()
  // Fill
  ctx.fillStyle = `rgba(${r},${g},${b},0.15)`
  ctx.lineTo(W, H); ctx.lineTo(0, H)
  ctx.closePath(); ctx.fill()
  // Axes
  ctx.strokeStyle = '#475569'; ctx.lineWidth = 1; ctx.setLineDash([3, 3])
  ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = '#94a3b8'; ctx.font = '10px monospace'; ctx.textAlign = 'center'
  ctx.fillText('0', W / 2, H - 2); ctx.fillText('光强 I', 30, 12); ctx.fillText('位置 x', W - 20, H - 2)
}

export function drawHeatmap(canvas: HTMLCanvasElement | null, wavelength: number, data: readonly number[]) {
  const view = prepareCanvas(canvas, BG_BLACK)
  if (!view || !isValidData(data)) return
  const { ctx, W, H } = view
  const [r, g, b] = wavelengthToRGB(wavelength)
  const imgData = ctx.createImageData(W, H)
  for (let x = 0; x < W; x++) {
    const idx = Math.round(x / W * (data.length - 1))
    const intensity = Math.min(1, data[idx] || 0)
    for (let y = 0; y < H; y++) {
      const dist = Math.abs(y - H / 2) / (H / 2)
      const alpha = intensity * (1 - dist * 0.8) * 255
      const pos = (y * W + x) * 4
      imgData.data[pos] = r; imgData.data[pos + 1] = g; imgData.data[pos + 2] = b; imgData.data[pos + 3] = alpha
    }
  }
  ctx.putImageData(imgData, 0, 0)
}
