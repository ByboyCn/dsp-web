<script setup>
import { onMounted, onBeforeUnmount, reactive, ref } from 'vue'

const CELL = 20
const W = 48, H = 32

const state = reactive({ cells: [], ore: [], produced: {}, running: true, speed: 1, ticks: 0 })
const protos = reactive({ items: [], recipes: [] })
const selected = ref('Belt')
const dir = ref(0)            // 0右 1下 2左 3上
const recipeId = ref(101)
const stats = ref([])

const itemColor = (id) => protos.items.find(i => i.id === id)?.color || '#fff'
const itemName = (id) => protos.items.find(i => i.id === id)?.name || id
const recipeName = (id) => protos.recipes.find(r => r.id === id)?.name || ''
const entityColors = { Miner: '#c8a24a', Smelter: '#e05656', Assembler: '#5680e0', Belt: '#4a4f58', Storage: '#8a6ac0' }
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]]
const dirArrow = ['→', '↓', '←', '↑']

let canvas, ctx, timer

async function load() {
  protos.items = (await (await fetch('/api/protos')).json()).items
  const p = await (await fetch('/api/protos')).json()
  protos.recipes = p.recipes
}

async function poll() {
  try {
    const s = await (await fetch('/api/state')).json()
    state.cells = s.cells; state.ore = s.ore; state.produced = s.produced
    state.running = s.running; state.speed = s.speed; state.ticks = s.ticks
    stats.value = Object.entries(s.produced).map(([id, n]) => ({ name: itemName(+id), color: itemColor(+id), n }))
    draw()
  } catch { /* 后端未就绪时忽略 */ }
}

function draw() {
  if (!ctx) return
  ctx.fillStyle = '#1b1e26'
  ctx.fillRect(0, 0, W * CELL, H * CELL)

  // 矿区
  for (const o of state.ore) {
    ctx.fillStyle = o.itemId === 1 ? 'rgba(120,90,60,.5)' : 'rgba(160,80,40,.5)'
    ctx.fillRect(o.x * CELL, o.y * CELL, CELL, CELL)
  }

  for (const c of state.cells) {
    const px = c.x * CELL, py = c.y * CELL
    ctx.fillStyle = entityColors[c.type] || '#333'
    ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2)

    if (c.type === 'Belt') {
      ctx.strokeStyle = '#666'
      const [dx, dy] = DIRS[c.dir]
      const cx = px + CELL / 2, cy = py + CELL / 2
      ctx.beginPath()
      ctx.moveTo(cx - dx * 6, cy - dy * 6)
      ctx.lineTo(cx + dx * 6, cy + dy * 6)
      ctx.stroke()
      // 带上的物品
      for (const b of c.belt || []) {
        ctx.fillStyle = itemColor(b.itemId)
        ctx.beginPath()
        ctx.arc(cx + dx * (b.pos - 0.5) * (CELL - 6), cy + dy * (b.pos - 0.5) * (CELL - 6), 4, 0, 7)
        ctx.fill()
      }
    } else if (c.type === 'Miner' || c.type === 'Storage') {
      ctx.fillStyle = '#fff'
      ctx.font = '12px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(c.type === 'Miner' ? '⛏' : '📦', px + CELL / 2, py + CELL / 2 + 4)
      const [dx, dy] = DIRS[c.dir]
      ctx.strokeStyle = '#ffd54a'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(px + CELL / 2 + dx * 6, py + CELL / 2 + dy * 6)
        ; ctx.lineTo(px + CELL / 2 + dx * 8, py + CELL / 2 + dy * 8); ctx.stroke(); ctx.lineWidth = 1
    } else {
      // 冶炼炉/制造台：进度环 + 配方名 + 方向
      if (c.progress > 0) {
        ctx.strokeStyle = '#7ee787'; ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(px + CELL / 2, py + CELL / 2, 7, -Math.PI / 2, -Math.PI / 2 + c.progress * Math.PI * 2)
        ctx.stroke(); ctx.lineWidth = 1
      }
      ctx.fillStyle = '#eee'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center'
      ctx.fillText(c.recipeId ? recipeName(c.recipeId) : '?', px + CELL / 2, py + 8)
      ctx.fillText(dirArrow[c.dir], px + CELL / 2, py + CELL - 3)
      // 输入缓冲计数
      const ins = Object.entries(c.input || {})
      if (ins.length) {
        ctx.font = '8px sans-serif'
        ins.forEach(([id, n], i) => {
          ctx.fillStyle = itemColor(+id)
          ctx.fillRect(px + 2 + i * 8, py + CELL - 12, 6, 6)
          ctx.fillStyle = '#fff'
          ctx.fillText(n, px + 5 + i * 8, py + CELL - 13)
        })
      }
    }
  }
}

function cellOf(ev) {
  const r = canvas.getBoundingClientRect()
  return { x: Math.floor((ev.clientX - r.left) / CELL), y: Math.floor((ev.clientY - r.top) / CELL) }
}

async function click(ev) {
  if (ev.button === 2) { const { x, y } = cellOf(ev); await post('/api/remove', { x, y }); return }
  const { x, y } = cellOf(ev)
  const needRecipe = selected.value === 'Smelter' || selected.value === 'Assembler'
  await post('/api/place', { x, y, type: selected.value, dir: dir.value, recipeId: needRecipe ? recipeId.value : null })
}
async function post(url, body) { await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); poll() }

const onKey = (e) => { if (e.key === 'r' || e.key === 'R') dir.value = (dir.value + 1) % 4 }

const presets = {
  '铁块生产线': async () => {
    for (let y = 3; y < 9; y++) await post('/api/place', { x: 3, y, type: 'Miner', dir: 0 })
    for (let x = 4; x < 12; x++) await post('/api/place', { x, y: 3, type: 'Belt', dir: 0 })
    for (let x = 4; x < 12; x++) await post('/api/place', { x, y: 5, type: 'Belt', dir: 0 })
    for (let x = 4; x < 12; x++) await post('/api/place', { x, y: 7, type: 'Belt', dir: 0 })
    for (let y = 3; y < 8; y++) await post('/api/place', { x: 12, y, type: 'Smelter', dir: 0, recipeId: 101 })
    for (let y = 3; y < 8; y++) await post('/api/place', { x: 13, y, type: 'Storage', dir: 0 })
  },
}

onMounted(async () => {
  canvas = document.getElementById('cv')
  ctx = canvas.getContext('2d')
  await load(); poll()
  timer = setInterval(poll, 120)
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => { clearInterval(timer); window.removeEventListener('keydown', onKey) })
</script>

<template>
  <div style="padding:16px">
    <h2 style="margin:0 0 8px">🏭 戴森球计划 · 网页工厂原型 <small style="color:#888;font-weight:400">C# 后端 + Vue 前端 · 机制逆向自 Assembly-CSharp.dll</small></h2>

    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px">
      <button v-for="(c, t) in entityColors" :key="t" @click="selected = t"
        :style="{ background: selected === t ? c : '#2a2e38', border: '1px solid #555', color: '#fff', padding: '6px 12px', borderRadius: 6, cursor: 'pointer' }">
        {{ { Miner: '⛏ 采矿机', Smelter: '🔥 冶炼炉', Assembler: '🔧 制造台', Belt: '➡ 传送带', Storage: '📦 仓库' }[t] }}
      </button>
      <span style="color:#aaa">方向 <b>{{ dirArrow[dir] }}</b>（按 R 旋转）</span>
      <select v-if="['Smelter', 'Assembler'].includes(selected)" v-model.number="recipeId"
        style="background:#2a2e38;color:#fff;border:1px solid #555;padding:4px">
        <option v-for="r in protos.recipes.filter(r => r.type === (selected === 'Smelter' ? 'Smelt' : 'Assemble'))" :key="r.id" :value="r.id">
          {{ r.name }}（{{ r.in.map(i => `${i.count}×${itemName(i.item)}`).join(' + ') }} → {{ r.out.map(o => `${o.count}×${itemName(o.item)}`).join(' + ') }}）
        </option>
      </select>
    </div>

    <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
      <button @click="post('/api/run', { running: !state.running })" style="padding:4px 14px">{{ state.running ? '⏸ 暂停' : '▶ 运行' }}</button>
      <button v-for="s in [1, 2, 5]" :key="s" @click="post('/api/speed', { value: s })"
        :style="{ padding: '4px 10px', background: state.speed === s ? '#5680e0' : '#2a2e38', color: '#fff', border: '1px solid #555', borderRadius: 4 }">×{{ s }}</button>
      <span style="color:#888">tick {{ Math.round(state.ticks) }}</span>
      <span style="margin-left:16px;color:#aaa">累计产出：</span>
      <span v-for="s in stats" :key="s.name" style="margin-right:10px">
        <span :style="{ color: s.color }">●</span> {{ s.name }} ×{{ s.n }}
      </span>
      <button @click="presets['铁块生产线']()" style="margin-left:auto;padding:4px 10px;background:#2a5a38;color:#fff;border:1px solid #4a7;border-radius:4px">🚀 一键铺「铁块生产线」</button>
    </div>

    <canvas id="cv" :width="W * CELL" :height="H * CELL" style="border:1px solid #444;border-radius:6px;display:block"
      @mousedown="click" @contextmenu.prevent></canvas>

    <p style="color:#888;font-size:13px;max-width:1000px">
      操作：选建筑 → 左键放置 → 右键拆除 → R 旋转方向。采矿机只能放在矿区（深色地块）上，产物从箭头方向输出；
      冶炼炉/制造台直接朝相邻传送带投料（原型未含分拣器）。带速 6 格/s（DSP Mk1）、采矿 0.5 件/s、制造台 MkI 0.75×，
      配方耗时取自游戏 tick 数。
    </p>
  </div>
</template>
