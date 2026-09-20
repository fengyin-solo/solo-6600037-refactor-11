import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  computeOptics,
  sanitizeParams,
  DEFAULT_PARAMS,
  type ExperimentId,
  type OpticsParams,
} from '../physics/optics'

export const useOpticsStore = defineStore('optics', () => {
  const currentExperiment = ref<ExperimentId>('double')
  const params = ref<OpticsParams>({ ...DEFAULT_PARAMS })
  const intensityData = ref<number[]>([])
  const result = ref<{ fringe?: number; centralWidth?: number }>({})

  // 唯一更新入口：校正参数 → 推导条纹与光强 → 一次性提交
  // 参数到边界、连续拖动、切换实验都走这同一套默认与顺序
  function update() {
    params.value = sanitizeParams(params.value)
    const out = computeOptics(currentExperiment.value, params.value)
    result.value = { fringe: out.fringe, centralWidth: out.centralWidth }
    intensityData.value = out.intensityData
  }

  function setExperiment(id: ExperimentId) {
    currentExperiment.value = id
    update()
  }

  return { currentExperiment, params, intensityData, result, setExperiment, update }
})
