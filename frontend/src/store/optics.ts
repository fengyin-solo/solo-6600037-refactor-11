import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  computeOptics,
  DEFAULT_PARAMS,
  EXPERIMENTS,
  sanitizeParams,
  type ExperimentId,
  type OpticsParams,
  type OpticsResult,
} from '../optics/physics'

export const useOpticsStore = defineStore('optics', () => {
  const currentExperiment = ref<ExperimentId>('double')
  // 初始状态直接取自共用默认值，并立即经过同一条推导管线。
  const params = ref<OpticsParams>({ ...DEFAULT_PARAMS })
  const intensityData = ref<number[]>([])
  const result = ref<OpticsResult>({})

  // 唯一的更新与重算顺序：写状态 → 共用物理管线 → 刷新光强数据与条纹间距。
  // 初始载入、参数到边界、频繁拖动、切换实验都经过这里。
  function recompute() {
    const { data, result: r } = computeOptics(currentExperiment.value, { ...params.value })
    // 整体替换，避免上一个实验残留的 fringe / centralWidth 字段。
    intensityData.value = data
    result.value = r
  }

  // 参数变更：钳制到边界（无效输入回退默认值）后按同一顺序重算。
  function updateParam(key: keyof OpticsParams, value: unknown) {
    const next = sanitizeParams({ ...params.value, [key]: value })
    // 钳制后的值回写，保证滑杆停在边界而不是非法位置。
    params.value[key] = next[key]
    recompute()
  }

  // 切换实验：实验 id 无效时保持现状；有效时沿用同一默认/更新顺序重算。
  function setExperiment(id: string) {
    if (!EXPERIMENTS.includes(id as ExperimentId)) return
    currentExperiment.value = id as ExperimentId
    recompute()
  }

  recompute()

  return { currentExperiment, params, intensityData, result, updateParam, setExperiment, recompute }
})
