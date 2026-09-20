// 光学实验共用物理推导管线：
// 默认值 → 边界钳制/无效回退 → 单位换算 → 条纹间距（或中央亮纹宽） → 光强采样数据。
// 初始载入、频繁拖动滑杆、切换实验均经过 computeOptics 这同一条流程。

export type ExperimentId = 'double' | 'single' | 'newton'

export const EXPERIMENTS: readonly ExperimentId[] = ['double', 'single', 'newton']

export interface OpticsParams {
  wavelength: number       // nm
  slitWidth: number        // μm
  slitSeparation: number   // μm
  screenDistance: number   // mm
}

export interface ParamLimit {
  min: number
  max: number
  step: number
}

// 唯一的参数边界来源，滑杆 min/max/step 与钳制逻辑共用。
export const PARAM_LIMITS: Record<keyof OpticsParams, ParamLimit> = {
  wavelength: { min: 380, max: 780, step: 5 },
  slitWidth: { min: 10, max: 200, step: 5 },
  slitSeparation: { min: 50, max: 500, step: 10 },
  screenDistance: { min: 100, max: 2000, step: 50 },
}

// 唯一的默认值来源（初始状态、边界外/NaN 回退、切换实验共用）。
export const DEFAULT_PARAMS: OpticsParams = {
  wavelength: 550,
  slitWidth: 50,
  slitSeparation: 200,
  screenDistance: 1000,
}

const SAMPLE_COUNT = 800   // 光强采样点数（保持原画面）
const X_MAX = 20e-3        // 双缝/单缝屏幕半宽，单位 m
const NEWTON_R_MAX = 5e-3  // 牛顿环采样最大半径，单位 m
const NEWTON_R = 1.0       // 牛顿环透镜曲率半径，单位 m

export interface OpticsResult {
  fringe?: number
  centralWidth?: number
}

export interface OpticsOutput {
  data: number[]
  result: OpticsResult
}

const EMPTY_OUTPUT: OpticsOutput = { data: [], result: {} }

function clampParam(value: unknown, limit: ParamLimit, fallback: number): number {
  // 空字符串等空输入先回退默认值（Number('') === 0 会绕过 NaN 判断，需显式排除）。
  if (value === null || value === undefined || value === '') return fallback
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(limit.max, Math.max(limit.min, n))
}

// 固定更新顺序：波长 → 缝宽 → 缝间距 → 屏幕距离。
// 任何无效输入（空值、NaN、越界）都回退到默认值或钳制到边界。
export function sanitizeParams(raw: Partial<Record<keyof OpticsParams, unknown>>): OpticsParams {
  return {
    wavelength: clampParam(raw.wavelength, PARAM_LIMITS.wavelength, DEFAULT_PARAMS.wavelength),
    slitWidth: clampParam(raw.slitWidth, PARAM_LIMITS.slitWidth, DEFAULT_PARAMS.slitWidth),
    slitSeparation: clampParam(raw.slitSeparation, PARAM_LIMITS.slitSeparation, DEFAULT_PARAMS.slitSeparation),
    screenDistance: clampParam(raw.screenDistance, PARAM_LIMITS.screenDistance, DEFAULT_PARAMS.screenDistance),
  }
}

const round2 = (v: number): number => Math.round(v * 100) / 100

// 单缝衍射包络 sin(β)/β；调用方保证 β=0 时已按原推导替换为极小值（中心处包络≈1）。
function slitEnvelope(beta: number): number {
  return Math.sin(beta) / beta
}

// β = π·a·x/(λL)，x=0 时与原实现一致回退到 1e-10。
function betaOf(aM: number, x: number, lambda: number, LM: number): number {
  return ((Math.PI * aM * x) / (lambda * LM)) || 1e-10
}

export function computeOptics(experiment: string, rawParams: Partial<Record<keyof OpticsParams, unknown>> = {}): OpticsOutput {
  // 1. 默认值 + 边界钳制（与滑杆更新完全相同的入口）。
  const p = sanitizeParams(rawParams)

  // 2. 统一单位换算。
  const lambda = p.wavelength * 1e-9
  const aM = p.slitWidth * 1e-6
  const dM = p.slitSeparation * 1e-6
  const LM = p.screenDistance * 1e-3

  const data: number[] = []
  const result: OpticsResult = {}

  if (experiment === 'double') {
    // 3. 条纹间距 Δy = λL/d（mm，保留两位小数，与原画面一致）。
    result.fringe = round2((lambda * LM) / dM * 1e3)
    // 4. 共用位置采样 + 光强数据：cos²(δ)·[sin(β)/β]²。
    for (let i = 0; i < SAMPLE_COUNT; i++) {
      const x = (i / SAMPLE_COUNT - 0.5) * X_MAX * 2
      const delta = (Math.PI * dM * x) / (lambda * LM)
      const beta = betaOf(aM, x, lambda, LM)
      const envelope = slitEnvelope(beta)
      data.push(Math.max(0, Math.cos(delta) ** 2 * envelope ** 2))
    }
    return { data, result }
  }

  if (experiment === 'single') {
    // 中央亮纹宽 2λL/a（mm）。
    result.centralWidth = round2((2 * lambda * LM) / aM * 1e3)
    // 共用位置采样 + 光强数据：[sin(β)/β]²。
    for (let i = 0; i < SAMPLE_COUNT; i++) {
      const x = (i / SAMPLE_COUNT - 0.5) * X_MAX * 2
      const beta = betaOf(aM, x, lambda, LM)
      data.push(Math.max(0, slitEnvelope(beta) ** 2))
    }
    return { data, result }
  }

  if (experiment === 'newton') {
    // 牛顿环：I = ½(1 − cos φ)，φ = 2π·r²/(2Rλ) + π。
    for (let i = 0; i < SAMPLE_COUNT; i++) {
      const r = (i / SAMPLE_COUNT) * NEWTON_R_MAX
      const path = (r * r) / (2 * NEWTON_R)
      const phi = (2 * Math.PI * path) / lambda + Math.PI
      data.push(Math.max(0, 0.5 * (1 - Math.cos(phi))))
    }
    return { data, result }
  }

  // 未知实验 / 无效输入：空数据 + 空结果，渲染层据此清屏而不是保留旧图。
  return EMPTY_OUTPUT
}
