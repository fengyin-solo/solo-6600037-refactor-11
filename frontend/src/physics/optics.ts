// 光学实验共用推导流程：参数(波长/缝宽/缝间距/屏距) → 条纹间距 + 光强数据
// 双缝干涉、单缝衍射、牛顿环统一从这里进入，保证默认值与更新顺序一致

export type ExperimentId = 'double' | 'single' | 'newton'

export interface OpticsParams {
  wavelength: number      // 波长 nm
  slitWidth: number       // 缝宽 μm
  slitSeparation: number  // 缝间距 μm
  screenDistance: number  // 屏幕距离 mm
}

export interface OpticsResult {
  fringe?: number        // 双缝条纹间距 Δy = λL/d (mm)
  centralWidth?: number  // 单缝中央亮纹宽度 2λL/a (mm)
  intensityData: number[]
}

export const DEFAULT_PARAMS: OpticsParams = {
  wavelength: 550,
  slitWidth: 50,
  slitSeparation: 200,
  screenDistance: 1000,
}

export const PARAM_LIMITS: Record<keyof OpticsParams, { min: number; max: number }> = {
  wavelength: { min: 380, max: 780 },
  slitWidth: { min: 10, max: 200 },
  slitSeparation: { min: 50, max: 500 },
  screenDistance: { min: 100, max: 2000 },
}

const SAMPLE_COUNT = 800
const SCREEN_HALF_WIDTH = 20e-3 // 屏幕半宽 m
const NEWTON_CURVATURE_R = 1.0  // 牛顿环曲率半径 m
const NEWTON_MAX_RADIUS = 5e-3  // 牛顿环最大环半径 m

function clampParam(key: keyof OpticsParams, value: number): number {
  const { min, max } = PARAM_LIMITS[key]
  if (!Number.isFinite(value)) return DEFAULT_PARAMS[key]
  return Math.min(max, Math.max(min, value))
}

// 无效输入回退默认值，越界输入钳到边界，保证后续计算只见到合法参数
export function sanitizeParams(raw: Partial<OpticsParams>): OpticsParams {
  return {
    wavelength: clampParam('wavelength', raw.wavelength ?? NaN),
    slitWidth: clampParam('slitWidth', raw.slitWidth ?? NaN),
    slitSeparation: clampParam('slitSeparation', raw.slitSeparation ?? NaN),
    screenDistance: clampParam('screenDistance', raw.screenDistance ?? NaN),
  }
}

// 参数已校正的前提下推导条纹间距与光强分布；未知实验返回空数据
export function computeOptics(experiment: ExperimentId, params: OpticsParams): OpticsResult {
  const lambda = params.wavelength * 1e-9
  const a = params.slitWidth * 1e-6
  const d = params.slitSeparation * 1e-6
  const L = params.screenDistance * 1e-3
  const data: number[] = []
  const result: OpticsResult = { intensityData: data }

  if (experiment === 'double') {
    result.fringe = Math.round(lambda * L / d * 1e3 * 100) / 100
    for (let i = 0; i < SAMPLE_COUNT; i++) {
      const x = (i / SAMPLE_COUNT - 0.5) * SCREEN_HALF_WIDTH * 2
      const delta = Math.PI * d * x / (lambda * L)
      const beta = Math.PI * a * x / (lambda * L) || 1e-10
      const single = Math.sin(beta) / beta
      const intensity = Math.cos(delta) ** 2 * single ** 2
      data.push(Math.max(0, intensity))
    }
  } else if (experiment === 'single') {
    result.centralWidth = Math.round(2 * lambda * L / a * 1e3 * 100) / 100
    for (let i = 0; i < SAMPLE_COUNT; i++) {
      const x = (i / SAMPLE_COUNT - 0.5) * SCREEN_HALF_WIDTH * 2
      const beta = Math.PI * a * x / (lambda * L) || 1e-10
      const intensity = (Math.sin(beta) / beta) ** 2
      data.push(Math.max(0, intensity))
    }
  } else if (experiment === 'newton') {
    for (let i = 0; i < SAMPLE_COUNT; i++) {
      const r = (i / SAMPLE_COUNT) * NEWTON_MAX_RADIUS
      const path = r * r / (2 * NEWTON_CURVATURE_R)
      const phi = 2 * Math.PI * path / lambda + Math.PI
      const intensity = 0.5 * (1 - Math.cos(phi))
      data.push(Math.max(0, intensity))
    }
  }

  return result
}
