<template>
  <div class="min-h-screen bg-slate-900 text-slate-200">
    <header class="border-b border-slate-700 px-6 py-4">
      <h1 class="text-2xl font-bold text-cyan-400">光学干涉衍射仿真实验台</h1>
      <p class="text-sm text-slate-500 mt-1">双缝干涉 · 单缝衍射 · 牛顿环 · 波长调节 · 光强热力图</p>
    </header>
    <div class="flex flex-col lg:flex-row gap-4 p-4">
      <div class="lg:w-1/4 space-y-4">
        <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <h3 class="text-sm font-bold text-slate-400 mb-3">实验类型</h3>
          <div class="space-y-1">
            <button v-for="exp in experiments" :key="exp.id" @click="store.setExperiment(exp.id)"
              :class="['w-full text-left p-2 rounded border text-sm transition-all', store.currentExperiment === exp.id ? 'border-cyan-500 bg-cyan-900/30 text-cyan-400' : 'border-slate-700 text-slate-300 hover:border-slate-500']">
              {{ exp.name }}
            </button>
          </div>
        </div>
        <div class="bg-slate-800 rounded-lg p-4 border border-slate-700 space-y-4">
          <h3 class="text-sm font-bold text-slate-400">参数调节</h3>
          <div>
            <label class="text-xs text-slate-500">波长 λ = {{ store.params.wavelength }} nm</label>
            <input type="range"
              :min="limits.wavelength.min" :max="limits.wavelength.max" :step="limits.wavelength.step"
              :value="store.params.wavelength"
              @input="onParam('wavelength', $event)"
              class="w-full accent-cyan-500" />
            <div class="flex justify-between text-xs mt-0.5">
              <span style="color:#8b5cf6">380</span><span style="color:#06b6d4">500</span><span style="color:#22c55e">550</span><span style="color:#eab308">600</span><span style="color:#dc2626">780</span>
            </div>
          </div>
          <div v-if="store.currentExperiment !== 'newton'">
            <label class="text-xs text-slate-500">缝宽/间距 d = {{ store.params.slitWidth }} μm</label>
            <input type="range"
              :min="limits.slitWidth.min" :max="limits.slitWidth.max" :step="limits.slitWidth.step"
              :value="store.params.slitWidth"
              @input="onParam('slitWidth', $event)"
              class="w-full accent-purple-500" />
          </div>
          <div v-if="store.currentExperiment === 'double'">
            <label class="text-xs text-slate-500">缝间距 D = {{ store.params.slitSeparation }} μm</label>
            <input type="range"
              :min="limits.slitSeparation.min" :max="limits.slitSeparation.max" :step="limits.slitSeparation.step"
              :value="store.params.slitSeparation"
              @input="onParam('slitSeparation', $event)"
              class="w-full accent-green-500" />
          </div>
          <div>
            <label class="text-xs text-slate-500">屏幕距离 L = {{ store.params.screenDistance }} mm</label>
            <input type="range"
              :min="limits.screenDistance.min" :max="limits.screenDistance.max" :step="limits.screenDistance.step"
              :value="store.params.screenDistance"
              @input="onParam('screenDistance', $event)"
              class="w-full accent-orange-500" />
          </div>
        </div>
        <div class="bg-slate-800 rounded-lg p-4 border border-slate-700 text-sm">
          <h3 class="text-sm font-bold text-slate-400 mb-3">理论公式</h3>
          <div class="space-y-2 text-xs text-slate-400">
            <div v-if="store.currentExperiment === 'double'" class="bg-slate-900 rounded p-2">
              <div class="text-cyan-400 font-bold">双缝干涉</div>
              <div>亮纹: y = kλL/d (k=0,±1,±2...)</div>
              <div>条纹间距: Δy = λL/d</div>
              <div class="text-yellow-400 mt-1">Δy = {{ store.result.fringe?.toFixed(2) }} mm</div>
            </div>
            <div v-if="store.currentExperiment === 'single'" class="bg-slate-900 rounded p-2">
              <div class="text-cyan-400 font-bold">单缝衍射</div>
              <div>暗纹: a·sinθ = kλ</div>
              <div>中央亮纹宽: 2λL/a</div>
              <div class="text-yellow-400 mt-1">中央宽 = {{ store.result.centralWidth?.toFixed(2) }} mm</div>
            </div>
            <div v-if="store.currentExperiment === 'newton'" class="bg-slate-900 rounded p-2">
              <div class="text-cyan-400 font-bold">牛顿环</div>
              <div>暗环半径: r = √(nλR)</div>
              <div>R: 曲率半径</div>
            </div>
          </div>
        </div>
      </div>
      <div ref="canvasPaneRef" class="lg:w-3/4 space-y-4">
        <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <h3 class="text-sm font-bold text-slate-400 mb-3">干涉/衍射图样</h3>
          <canvas ref="patternRef" class="w-full rounded" style="height: 200px; background: black;"></canvas>
        </div>
        <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <h3 class="text-sm font-bold text-slate-400 mb-3">光强分布曲线</h3>
          <canvas ref="intensityRef" class="w-full rounded" style="height: 200px; background: #0f172a;"></canvas>
        </div>
        <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <h3 class="text-sm font-bold text-slate-400 mb-3">2D 热力图</h3>
          <canvas ref="heatmapRef" class="w-full rounded" style="height: 200px; background: black;"></canvas>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useOpticsStore } from './store/optics'
import { PARAM_LIMITS, type OpticsParams } from './optics/physics'
import { drawHeatmap, drawIntensity, drawPattern } from './optics/render'

const store = useOpticsStore()
const patternRef = ref<HTMLCanvasElement | null>(null)
const intensityRef = ref<HTMLCanvasElement | null>(null)
const heatmapRef = ref<HTMLCanvasElement | null>(null)
const canvasPaneRef = ref<HTMLElement | null>(null)

const experiments = [
  { id: 'double', name: '双缝干涉 (Young实验)' },
  { id: 'single', name: '单缝衍射 (Fraunhofer)' },
  { id: 'newton', name: '牛顿环干涉' },
] as const

// 滑杆边界全部取自共用常量，与物理层钳制范围保持一致。
const limits = PARAM_LIMITS

// 所有滑杆输入走同一个参数更新入口（钳制 + 同一更新顺序 + 重算），
// 不再用 v-model 绕过 store 直接改参数。
function onParam(key: keyof OpticsParams, e: Event) {
  store.updateParam(key, (e.target as HTMLInputElement).value)
}

// 三个画布始终从 store 当前状态重新绘制；绘制函数内部会先清屏，
// 因此空数据 / 无效输入 / 切换实验都不会残留旧帧。
function renderAll() {
  const { wavelength } = store.params
  const data = store.intensityData
  drawPattern(patternRef.value, wavelength, data)
  drawIntensity(intensityRef.value, wavelength, data)
  drawHeatmap(heatmapRef.value, wavelength, data)
}

// 数据可能在一帧内频繁更新（拖动滑杆），用 rAF 合并成一次重绘。
let rafId = 0
function scheduleRender() {
  if (rafId) return
  rafId = requestAnimationFrame(() => {
    rafId = 0
    renderAll()
  })
}

function onVisibility() {
  // 标签页 / 元素从隐藏恢复时，用同一渲染流程按当前数据重画，不显示旧图。
  if (!document.hidden) scheduleRender()
}

let observer: IntersectionObserver | null = null
function onResize() {
  scheduleRender()
}

onMounted(() => {
  // 两帧后布局宽度已确定（替代原来的 setTimeout 碰运气）。
  requestAnimationFrame(() => requestAnimationFrame(renderAll))
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('resize', onResize)
  // 覆盖面板自身被隐藏（display:none / v-show 容器）后恢复的情况。
  if ('IntersectionObserver' in window && canvasPaneRef.value) {
    observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) scheduleRender()
    })
    observer.observe(canvasPaneRef.value)
  }
})

onBeforeUnmount(() => {
  if (rafId) cancelAnimationFrame(rafId)
  document.removeEventListener('visibilitychange', onVisibility)
  window.removeEventListener('resize', onResize)
  observer?.disconnect()
})

watch(() => store.intensityData, scheduleRender)
</script>
