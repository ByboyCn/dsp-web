<script setup>
import { onMounted, onBeforeUnmount, ref, reactive } from 'vue'
import * as THREE from 'three'
import { Factory, BUILD_TYPES, BUILD_ITEM, BUILD_INFO, applyBuildingsDesign, RECIPES, ITEMS, TECHS, UPGRADES, costFor } from './pipeline.js'
import ItemIcon from './ItemIcon.vue'
import BuildingIcon from './BuildingIcon.vue'

// ---------- 常量 ----------
const R = 60            // 星球半径
const ORE_TYPES = [
  { id: 1, name: '铁矿', color: 0x8a6a4a, n: 14 },
  { id: 2, name: '铜矿', color: 0xd06a30, n: 12 },
  { id: 3, name: '石矿', color: 0x9aa0a8, n: 12 },
  { id: 4, name: '硅矿', color: 0x7ab8d8, n: 8 },
  { id: 5, name: '钛矿', color: 0xb8c8d8, n: 6 },
  { id: 6, name: '煤矿', color: 0x5a5f6a, n: 10 },
]
const MINE_TIME = 1.6   // 采集一座矿簇需要按住 E 的秒数

// ---------- 噪声地形（周期函数叠加 + 房间种子相位：同房间所有玩家地形一致） ----------
let worldSeed = 0
let terrainPhase = [0, 0, 0, 0]
const worldReady = ref(false)
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }
function setWorldSeed(seed) {
  worldSeed = seed
  const rng = mulberry32(seed || 1)
  terrainPhase = [rng() * 6.28, rng() * 6.28, rng() * 6.28, rng() * 6.28]
}
function terrainH(d) { // d: 单位向量 → 高程偏移
  const [p0, p1, p2, p3] = terrainPhase
  return (
    Math.sin(d.x * 2.1 + d.y * 3.3 + p0) * 0.9 +
    Math.sin(d.y * 2.7 - d.z * 2.2 + p1) * 0.7 +
    Math.sin(d.z * 3.1 + d.x * 1.7 + p2) * 0.6 +
    Math.sin(d.x * 5.2 + d.z * 4.4 + d.y * 3.7 + p3) * 0.35
  )
}
// 种子随机方向（替代 Math.random，保证同种子矿脉分布一致）
function rngDir(rng) {
  const z = rng() * 2 - 1, t = rng() * Math.PI * 2, r = Math.sqrt(Math.max(0, 1 - z * z))
  return new THREE.Vector3(r * Math.cos(t), z, r * Math.sin(t))
}
const surfaceAt = (dirV) => R + terrainH(dirV)

// ---------- HUD ----------
const hud = reactive({ inventory: {}, hint: '', mining: 0, fps: 0, pos: '' })
const invList = ref([])
const buildMenu = ref(false)
const buildMode = ref(null)
const assemblerRecipe = ref('a1')
const factoryStats = ref(null)
const pathPending = ref(false)
const charPanel = ref(false) // 人物面板：背包 + 手动制造
const craftMsg = reactive({ ok: true, text: '' }) // 制造结果反馈（面板内显示，不被 HUD 覆盖）
function addItem(id, n = 1) {
  hud.inventory[id] = (hud.inventory[id] || 0) + n
  refreshInv()
}
function refreshInv() {
  invList.value = Object.keys(ITEMS).map(Number).filter(id => hud.inventory[id]).map(id => ({ id, name: ITEMS[id].name, color: ITEMS[id].color, n: hud.inventory[id] }))
}
function handCraft(r) {
  const lack = Object.entries(r.in).filter(([id, n]) => (hud.inventory[id] || 0) < n)
  if (lack.length) {
    craftMsg.ok = false
    craftMsg.text = `材料不足，还差：${lack.map(([id, n]) => (n - (hud.inventory[id] || 0)) + '×' + ITEMS[id].name).join('、')}`
    return
  }
  for (const [id, n] of Object.entries(r.in)) hud.inventory[id] -= n
  addItem(+Object.keys(r.out)[0], r.out[+Object.keys(r.out)[0]])
  refreshInv()
  craftMsg.ok = true
  craftMsg.text = `✅ 制造完成：${r.name} ×1`
}
function exitBuild() {
  buildMode.value = null
  pathPending.value = false
  factory?.hideGhost()
  factory?.cancelPath()
}
function setBuildMode(t) { buildMode.value = t; pathPending.value = false; factory?.cancelPath() }

// ---------- 多人账号 ----------
const auth = reactive({
  loggedIn: false, user: '', passwd: '', color: localStorage.getItem('dsp_color') || '#e05656',
  token: localStorage.getItem('dsp_token') || '',
  room: localStorage.getItem('dsp_room') || 'room1', mode: 'login', msg: '',
})
const remotes = ref([])        // [{id,name,color,pos,yaw}]
const remoteMeshes = new Map() // id -> {group, label}
let bodyMat = null             // 主角染色材质
const recipePanel = ref(null)  // 打开配方面板的机器
let nearMachine = null         // 最近的机器（E 交互用）

async function doAuth() {
  auth.msg = ''
  const url = auth.mode === 'login' ? '/api/login' : '/api/register'
  try {
    const r = await (await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: auth.user, pass: auth.passwd, color: auth.color }) })).json()
    if (!r.ok) { auth.msg = r.msg; return }
    auth.token = r.token; auth.loggedIn = true; auth.color = r.color
    localStorage.setItem('dsp_token', r.token)
    localStorage.setItem('dsp_room', auth.room)
    applyColor(r.color)
    startSync()
  } catch { auth.msg = '无法连接服务器' }
}

async function changeColor(e) {
  auth.color = e.target.value
  localStorage.setItem('dsp_color', auth.color)
  applyColor(auth.color)
  if (auth.loggedIn) fetch('/api/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: auth.token, color: auth.color }) })
}

async function startSync() {
  if (!auth.token) return
  const send = async () => {
    if (!auth.loggedIn) return
    try {
      const r = await (await fetch('/api/sync', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: auth.token, room: auth.room, color: auth.color,
          pos: playerMesh ? [playerMesh.position.x, playerMesh.position.y, playerMesh.position.z] : [0, 0, 60],
          yaw: player.yaw,
          seed: worldSeed || undefined,
          tech: worldReady.value && techState.unlocked ? JSON.stringify(serializeTech()) : undefined,
        }),
      })).json()
      if (!r.ok) {
        // 令牌失效（服务器重启清档等）→ 自动登出回到登录页
        if ((r.msg || '').includes('未登录')) {
          auth.token = ''; auth.loggedIn = false
          localStorage.removeItem('dsp_token')
        }
        return
      }
      // 星系种子：第一个进房间的人设置，全房间共用；拿到种子立即构建世界
      if (!worldReady.value) {
        const seed = r.seed || Math.floor(Math.random() * 1e9)
        initWorld(seed)
        seedPending.value = !r.seed // 本地生成的种子，下次 sync 上报给服务器
      } else if (r.seed && r.seed !== worldSeed) {
        worldSeed = r.seed // 房间种子以服务器为准（后进房间者对齐）
      }
      if (r.tech) mergeTech(JSON.parse(r.tech))
      syncRemotes(r.others)
    } catch { /* 后端未就绪 */ }
  }
  send()
  setInterval(send, 150)
}

// ---------- 房间共享科技 ----------
const techMenu = ref(false)
const techState = reactive({ unlocked: {}, levels: {}, active: null, paused: false })
const seedPending = ref(false)

function serializeTech() {
  return {
    u: Object.keys(techState.unlocked),
    l: techState.levels,
    a: techState.active ? { ...techState.active, entry: undefined, by: auth.user } : null,
  }
}
function mergeTech(remote) {
  if (!remote) return
  for (const k of remote.u || []) techState.unlocked[k] = true
  for (const [k, v] of Object.entries(remote.l || {})) techState.levels[k] = Math.max(techState.levels[k] || 0, v)
  // 远端有进行中的研究且本机没有 → 采纳显示（推进仍由发起者完成）
  if (remote.a && !techState.active && remote.a.by !== auth.user) {
    techState.active = { ...remote.a, entry: TECHS.find(t => t.id === remote.a.id) || UPGRADES.find(u => u.id === remote.a.id), remote: true }
  }
}

// 研究消耗（从全仓库逐步扣除）
function totalStored(item) {
  let n = 0
  for (const b of factory?.buildings || []) if (b.type === 'Storage') n += b.store[item] || 0
  return n
}
function takeStored(item, n) {
  let need = n
  for (const b of factory?.buildings || []) {
    if (b.type !== 'Storage') continue
    const have = Math.min(need, b.store[item] || 0)
    if (have > 0) { b.store[item] -= have; need -= have }
    if (need <= 0) break
  }
  return need <= 0
}
function startResearch(entry, kind) {
  if (techState.active || !worldReady) return
  if (entry.requires && !techState.unlocked[entry.requires]) return
  const cost = costFor(entry, kind === 'upgrade' ? (techState.levels[entry.id] || 0) : 0)
  const queue = []
  for (const [id, n] of Object.entries(cost)) for (let i = 0; i < n; i++) queue.push(+id)
  techState.active = { id: entry.id, kind, time: entry.time, queue, paid: 0, acc: 0, by: auth.user, entry }
}
function unlockKeyOf(entry) { return entry.unlocks || null }

// ---------- 任务链（DSP 式新手引导，数据可由后台设计覆盖） ----------
const DEFAULT_QUESTS = [
  { name: '采集矿物', desc: '对准矿簇按住左键/E，采集 5 个矿物', target: 5, reward: { 16: 2 }, cur: () => Object.values(hud.inventory).reduce((a, b) => a + b, 0) },
  { name: '第一台采矿机', desc: '人物面板(C)搓采矿机 → 按 1 放在矿旁（指向传送带）', target: 1, reward: { 16: 2 }, cur: () => factoryStats.value?.machines.Miner || 0 },
  { name: '铺一条传送带', desc: '按 4，点击两点自动铺 4 段传送带', target: 4, reward: { 16: 3 }, cur: () => factoryStats.value?.machines.Belt || 0 },
  { name: '炼出铁块', desc: '放冶炼炉(2)接上传送带 — 注意烧煤！找黑色煤矿簇采矿供电炉', target: 3, reward: { 16: 3 }, cur: () => factoryStats.value?.produced[11] || 0 },
  { name: '建造仓库', desc: '搓一个仓库(5)接在产线末端收产物', target: 1, reward: { 16: 3 }, cur: () => factoryStats.value?.machines.Storage || 0 },
  { name: '造个齿轮', desc: '搓制造台(3)放好选齿轮配方，生产 2 个齿轮', target: 2, reward: { 16: 4 }, cur: () => factoryStats.value?.produced[13] || 0 },
  { name: '蓝糖启动', desc: '仓库里攒 10 个电磁矩阵（磁铁+电路板 → 蓝糖）', target: 10, reward: {}, cur: () => totalStored(16) + (hud.inventory[16] || 0) },
  { name: '研究风电', desc: '按 T 打开科技面板，研究「风力发电」', target: 1, reward: { 17: 2 }, cur: () => techState.unlocked.t_power ? 1 : 0 },
  { name: '红糖时代', desc: '攒 20 蓝糖研究能量矩阵，再生产 5 个红糖', target: 5, reward: {}, cur: () => totalStored(17) + (hud.inventory[17] || 0) },
]
const questState = reactive({ idx: 0, toast: '' })
const questList = ref(DEFAULT_QUESTS)
const techList = ref(TECHS)
const upgradeList = ref(UPGRADES)

// 后台设计数据 → 客户端生效（空数组保持内置默认）
async function loadDesign() {
  try {
    const d = await (await fetch('/api/design')).json()
    if (d.quests?.length) questList.value = d.quests
    if (d.techs?.length) techList.value = d.techs
    if (d.upgrades?.length) upgradeList.value = d.upgrades
    if (d.buildings?.length) applyBuildingsDesign(d.buildings)
  } catch { /* 后端未就绪时用默认 */ }
}

// 任务进度：metric 决定统计口径（后台可设计）
function questCur(q) {
  switch (q.metric) {
    case 'collect': return Object.values(hud.inventory).reduce((a, b) => a + b, 0)
    case 'place': return factoryStats.value?.machines[q.item] || 0
    case 'produce': return factoryStats.value?.produced[q.item] || 0
    case 'store': return totalStored(+q.item) + (hud.inventory[q.item] || 0)
    case 'inventory': return hud.inventory[q.item] || 0
    case 'tech': return techState.unlocked[q.item] ? 1 : 0
    default: return 0
  }
}
function checkQuests() {
  const q = questList.value[questState.idx]
  if (!q) return
  let cur = 0
  try { cur = Math.min(q.target, questCur(q) || 0) } catch { return }
  if (cur >= q.target) {
    for (const [id, n] of Object.entries(q.reward || {})) hud.inventory[id] = (hud.inventory[id] || 0) + n
    refreshInv()
    questState.idx++
    questState.toast = `✔ 任务完成：${q.name}${Object.keys(q.reward || {}).length ? '（奖励已发放）' : ''}`
    setTimeout(() => { questState.toast = '' }, 5000)
  }
}
function questProgress() {
  const q = questList.value[questState.idx]
  if (!q) return null
  let cur = 0
  try { cur = Math.min(q.target, questCur(q) || 0) } catch { }
  return { q, cur }
}
function isLockedBuilding(t) {
  const tech = BUILD_INFO[t]?.tech
  return !!tech && !techState.unlocked[tech]
}

// ---------- 用户自定义建筑外观（贴图存本地，只影响自己的客户端） ----------
const bldTex = reactive({})
function applyTex(type, dataUrl) {
  bldTex[type] = dataUrl
  localStorage.setItem('dsp_bldtex_' + type, dataUrl)
  const img = new Image()
  img.onload = () => {
    const tex = new THREE.Texture(img)
    tex.needsUpdate = true
    tex.colorSpace = THREE.SRGBColorSpace
    if (factory) {
      factory.textures[type] = tex
      for (const b of factory.buildings) if (b.type === type) factory._applySkin(b.mesh, type)
    }
  }
  img.src = dataUrl
}
function loadTexLocal() {
  for (const t of Object.keys(BUILD_TYPES)) {
    const v = localStorage.getItem('dsp_bldtex_' + t)
    if (v) applyTex(t, v)
  }
}
function uploadTex(t, ev) {
  const f = ev.target.files[0]
  if (!f) return
  const rd = new FileReader()
  rd.onload = () => applyTex(t, rd.result)
  rd.readAsDataURL(f)
  ev.target.value = ''
}
function clearTex(t) {
  bldTex[t] = ''
  localStorage.removeItem('dsp_bldtex_' + t)
  delete factory?.textures[t]
  for (const b of factory?.buildings || []) if (b.type === t) b.mesh.traverse(o => { if (o.isMesh && o.material) { o.material.map = null; o.material.needsUpdate = true } })
}
function pickTex(t) { document.getElementById('tex_' + t)?.click() }

function syncRemotes(list) {
  remotes.value = list
  const ids = new Set(list.map(p => p.id))
  for (const [id, m] of remoteMeshes) if (!ids.has(id)) { scene.remove(m.group); remoteMeshes.delete(id) }
  for (const p of list) {
    let m = remoteMeshes.get(p.id)
    if (!m) {
      const group = makeRobot(p.color)
      const label = makeLabel(p.name)
      label.position.y = 2.6
      group.add(label)
      scene.add(group)
      m = { group }
      remoteMeshes.set(p.id, m)
    }
    const pos = new THREE.Vector3(...p.pos)
    const dir = pos.clone().normalize()
    m.group.position.copy(dir).multiplyScalar(surfaceAt(dir))
    m.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
    m.group.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.yaw))
  }
}

function applyColor(hex) {
  bodyMat = playerMesh?.getObjectByName('torso')?.material || null
  if (bodyMat) bodyMat.color.set(hex)
}

// ---------- 三维场景 ----------
let renderer, scene, camera, sun, raf
let planet, water
const ores = [] // { group, type, amount, dir:THREE.Vector3 }
const player = { pos: new THREE.Vector3(0, 0, R + 4), yaw: 0, pitch: -0.15, vel: new THREE.Vector3() }
const keys = {}
let miningTarget = null, miningT = 0
let playerMesh, oreMeshes, factory = null

function makePlanet() {
  const geo = new THREE.IcosahedronGeometry(R, 48)
  const pos = geo.attributes.position
  const colors = []
  const cGrass = new THREE.Color(0x3e7a3a), cSand = new THREE.Color(0xc9b87a),
    cRock = new THREE.Color(0x7a7f88), cSnow = new THREE.Color(0xe8eef2)
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const dir = v.clone().normalize()
    const h = terrainH(dir)
    v.copy(dir).multiplyScalar(R + h)
    pos.setXYZ(i, v.x, v.y, v.z)
    const t = (h + 2.5) / 5.5
    const c = t < 0.25 ? cSand : t < 0.55 ? cGrass : t < 0.8 ? cRock : cSnow
    colors.push(c.r, c.g, c.b)
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geo.computeVertexNormals()
  planet = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }))
  scene.add(planet)

  // 海洋
  water = new THREE.Mesh(
    new THREE.IcosahedronGeometry(R - 0.7, 4),
    new THREE.MeshLambertMaterial({ color: 0x2a6db5, transparent: true, opacity: 0.82 })
  )
  scene.add(water)
}

function makeStars() {
  const g = new THREE.BufferGeometry()
  const N = 1500, arr = new Float32Array(N * 3)
  for (let i = 0; i < N; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(600)
    arr.set([v.x, v.y, v.z], i * 3)
  }
  g.setAttribute('position', new THREE.BufferAttribute(arr, 3))
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.4, sizeAttenuation: false })))
}

function randomSurfaceDir(rng) {
  // 拒绝采样避开海沟（种子随机，同房间一致）
  for (let k = 0; k < 50; k++) {
    const d = rngDir(rng)
    if (terrainH(d) > -0.8) return d
  }
  return new THREE.Vector3(0, 0, 1)
}

function spawnOres() {
  oreMeshes = new THREE.Group()
  const rng = mulberry32((worldSeed ^ 0x9e3779b9) >>> 0) // 矿脉分布 = 房间种子决定
  const rockGeo = new THREE.DodecahedronGeometry(1.1, 0)
  const all = ORE_TYPES.flatMap(t => Array.from({ length: t.n }, () => ({ dir: randomSurfaceDir(rng), t })))
  // 出生点周围保证有一处铁矿
  all[0] = { dir: new THREE.Vector3(0.8, 0.05, 0.6).normalize(), t: ORE_TYPES[0] }
  for (const { dir, t } of all) {
    const g = new THREE.Group()
    g.position.copy(dir).multiplyScalar(surfaceAt(dir)) // 组坐标 = 地表点（判定/寻路用）
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir) // 局部 Y 轴 = 地表法线
    const mat = new THREE.MeshLambertMaterial({ color: t.color })
    const n = 3 + Math.floor(rng() * 4)
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(rockGeo, mat)
      // 子石块相对组中心随机散布（半埋进地表）
      m.position.set(
        (rng() - 0.5) * 3,
        -0.3 + rng() * 0.8,
        (rng() - 0.5) * 3
      )
      m.rotation.set(rng() * 7, rng() * 7, rng() * 7)
      m.scale.setScalar(0.7 + rng() * 0.7)
      g.add(m)
    }
    scene.add(g)
    ores.push({ group: g, type: t, amount: 5, dir })
  }
}

// 机甲机器人模型（DSP 风格：白色外壳 + 主题色装甲 + 蓝色驾驶舱）
function makeRobot(colorHex) {
  const g = new THREE.Group()
  const trim = new THREE.MeshLambertMaterial({ color: colorHex })
  const white = new THREE.MeshLambertMaterial({ color: 0xdfe4ea })
  const dark = new THREE.MeshLambertMaterial({ color: 0x33383f })

  // 躯干
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.0, 0.62), trim)
  torso.position.y = 1.15
  torso.name = 'torso'
  g.add(torso)
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.64), white)
  chest.position.y = 1.5
  g.add(chest)
  // 驾驶舱玻璃
  const cockpit = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.4, 0.5),
    new THREE.MeshLambertMaterial({ color: 0x66aaff, emissive: 0x2266cc })
  )
  cockpit.position.set(0, 1.85, 0.05)
  g.add(cockpit)
  // 手臂
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.9, 0.4), white)
    arm.position.set(s * 0.62, 1.2, 0)
    g.add(arm)
    const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.28, 0.5), dark)
    shoulder.position.set(s * 0.62, 1.66, 0)
    g.add(shoulder)
  }
  // 双腿
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 0.42), dark)
    leg.position.set(s * 0.26, 0.4, 0)
    g.add(leg)
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.62), trim)
    foot.position.set(s * 0.26, 0.08, 0.06)
    g.add(foot)
  }
  // 头顶天线
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4), dark)
  antenna.position.set(0.28, 2.2, 0)
  g.add(antenna)
  return g
}

function makeLabel(text) {
  const cv = document.createElement('canvas')
  cv.width = 256; cv.height = 64
  const c = cv.getContext('2d')
  c.beginPath()
  c.fillStyle = 'rgba(10,14,22,.7)'
  c.roundRect ? c.roundRect(0, 0, 256, 64, 12) : c.rect(0, 0, 256, 64)
  c.fill()
  c.fillStyle = '#fff'; c.font = '28px sans-serif'; c.textAlign = 'center'
  c.fillText(text, 128, 42)
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false }))
  sp.scale.set(2.2, 0.55, 1)
  return sp
}

function makePlayer() {
  playerMesh = makeRobot(auth.color)
  scene.add(playerMesh)
}

// ---------- 输入：鼠标移动转主角朝向，中键旋转相机，右键点击地面自动走过去，左键/E 采集 ----------
let camDist = 9, mmbDown = false, lmbDown = false
let camYaw = 0, camPitch = 0.35
let jumpVy = 0, jumpH = 0
let moveTargetDir = null, moveMarker = null, autoMine = null
const MINE_RANGE = 7
const raycaster = new THREE.Raycaster()

function onKeyDown(e) {
  // DSP 式 E 交互：靠近机器时打开配方面板；否则 E 作为采集键
  if (e.code === 'KeyE' && !e.repeat && nearMachine) {
    recipePanel.value = recipePanel.value === nearMachine ? null : nearMachine
    return
  }
  if (e.code === 'KeyC' && !e.repeat) { charPanel.value = !charPanel.value; return }
  if (e.code === 'Escape') { recipePanel.value = null; charPanel.value = false }
  keys[e.code] = true
  if (e.code === 'Space' && jumpH <= 0.01) { jumpVy = 8 } // 空格跳
  // DSP 同款快捷键：数字键 1~7 选建筑，R 旋转，Esc 取消
  const slots = Object.keys(BUILD_TYPES)
  if (/^Digit[0-9]$/.test(e.code)) {
    const d = e.code.slice(5)
    const t = slots[d === '0' ? 9 : +d - 1]
    if (!t) return
    if (isLockedBuilding(t)) { hud.hint = '🔒 该建筑需要先研究科技解锁（按 T 打开科技面板）'; return }
    buildMenu.value = true
    buildMode.value = buildMode.value === t ? null : t
    pathPending.value = false
    factory?.cancelPath()
  }
  if (e.code === 'KeyT') techMenu.value = !techMenu.value
  if (e.code === 'KeyR' && buildMode.value) factory?.rotateGhost()
  if (e.code === 'Escape') { exitBuild(); buildMenu.value = false; techMenu.value = false }
}

function setRecipe(machine, r) {
  machine.recipe = r
  machine.replicating = false
  machine.progress = 0
  machine.input = {}
  if (machine.type === 'Smelter') machine.manual = true // 手动选配方后不再自动切换
}

const inpStyle = 'width:100%;padding:9px;margin:6px 0;background:#1a1f2a;color:#fff;border:1px solid #334;border-radius:8px;box-sizing:border-box'
const tabStyle = (active) => ({ flex: 1, padding: '7px', background: active ? '#e06428' : '#1a1f2a', color: '#fff', border: '1px solid #334', borderRadius: 8, cursor: 'pointer' })
function onKeyUp(e) { keys[e.code] = false }
function onMouseDown(e) {
  if (e.target !== renderer?.domElement) return // 点击 HUD 不生效
  if (e.button === 1) { mmbDown = true; e.preventDefault() }
  if (e.button === 0) {
    if (buildMode.value) { handleBuildClick(e); return }
    if (tryOpenMachinePanel(e)) return
    lmbDown = true
  }
  if (e.button === 2) {
    if (buildMode.value) { exitBuild(); return }
    pickMoveTarget(e)
  }
}
function raycastDirAt(e) {
  const ndc = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1)
  raycaster.setFromCamera(ndc, camera)
  const hit = raycaster.intersectObject(planet, false)[0]
  return hit ? hit.point.clone().normalize() : null
}

// 左键点机器 → 打开配方面板
function tryOpenMachinePanel(e) {
  const ndc = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1)
  raycaster.setFromCamera(ndc, camera)
  const machines = (factory?.buildings || []).filter(b => b.type === 'Smelter' || b.type === 'Assembler')
  const hit = raycaster.intersectObjects(machines.map(m => m.mesh), true)[0]
  if (!hit) return false
  let g = hit.object
  const m = machines.find(mm => { let p = g; while (p) { if (p === mm.mesh) return true; p = p.parent } return false })
  if (m && m.center.distanceTo(playerMesh.position) < 8) {
    recipePanel.value = recipePanel.value === m ? null : m
    return true
  }
  return false
}
function handleBuildClick(e) {
  const dir = raycastDirAt(e)
  if (!dir) return
  const t = buildMode.value
  if (isLockedBuilding(t)) { hud.hint = '🔒 该建筑需要先研究科技解锁（按 T 打开科技面板）'; return }
  if (t === 'Belt') {
    if (!factory.pathStart) {
      if ((hud.inventory[BUILD_ITEM.Belt] || 0) < 1) { hud.hint = `背包里没有 ${ITEMS[BUILD_ITEM.Belt].name} — 按 C 打开人物面板制造`; return }
      factory.beginPath(dir); pathPending.value = true
    } else {
      const placed = factory.commitPath(dir); pathPending.value = false
      const pay = Math.min(placed, hud.inventory[BUILD_ITEM.Belt] || 0)
      hud.inventory[BUILD_ITEM.Belt] -= pay
      refreshInv()
    }
  } else {
    // 建筑靠搓出来：先扣背包里的对应建筑
    const id = BUILD_ITEM[t]
    if ((hud.inventory[id] || 0) < 1) { hud.hint = `背包里没有 ${ITEMS[id].name} — 按 C 打开人物面板制造`; return }
    hud.inventory[id] -= 1
    refreshInv()
    factory.place(t, dir, t === 'Assembler' ? assemblerRecipe.value : null)
  }
}
function pickMoveTarget(e) {
  const ndc = new THREE.Vector2(
    (e.clientX / innerWidth) * 2 - 1,
    -(e.clientY / innerHeight) * 2 + 1
  )
  raycaster.setFromCamera(ndc, camera)

  // 优先点选矿簇：右键点矿 = 走过去自动开采
  const oreObjs = ores.filter(o => o.amount > 0).map(o => o.group)
  const oreHit = raycaster.intersectObjects(oreObjs, true)[0]
  if (oreHit) {
    let g = oreHit.object
    while (g.parent && !ores.some(o => o.group === g)) g = g.parent
    const ore = ores.find(o => o.group === g)
    if (ore) {
      autoMine = ore
      moveTargetDir = ore.group.position.clone().normalize()
      moveMarker.material.color.set(ore.type.color)
      moveMarker.position.copy(moveTargetDir).multiplyScalar(surfaceAt(moveTargetDir) + 0.15)
      moveMarker.visible = true
      hud.hint = `前往 ${ore.type.name}（剩余 ${ore.amount}）…`
      return
    }
  }

  const hit = raycaster.intersectObject(planet, false)[0]
  if (hit) {
    autoMine = null
    moveTargetDir = hit.point.clone().normalize()
    moveMarker.material.color.set(0x7ee787)
    moveMarker.position.copy(moveTargetDir).multiplyScalar(surfaceAt(moveTargetDir) + 0.15)
    moveMarker.visible = true
  }
}
function onMouseUp(e) {
  if (e.button === 1) mmbDown = false
  if (e.button === 0) lmbDown = false
}
function onMouseMove(e) {
  if (mmbDown) {
    // 中键拖动：旋转相机
    camYaw -= e.movementX * 0.004
    camPitch = Math.max(0.1, Math.min(1.25, camPitch - e.movementY * 0.004)) // 下限 0.1：镜头不钻到地面以下
  } else if (buildMode.value) {
    // 建造模式：幽灵预览 / 铺带预览
    const dir = raycastDirAt(e)
    if (!dir) { factory?.hideGhost(); return }
    if (buildMode.value === 'Belt') {
      factory?.hideGhost()
      if (pathPending.value) factory?.previewPath(dir)
    } else {
      factory?.showGhost(buildMode.value, dir, assemblerRecipe.value)
    }
  } else if (!moveTargetDir) {
    // 自由鼠标移动：转动主角朝向（自动行走时朝向由寻路控制）
    player.yaw -= e.movementX * 0.004
  }
}
function onWheel(e) {
  camDist = Math.max(4, Math.min(30, camDist + Math.sign(e.deltaY) * 1.6))
}
function onContextMenu(e) { e.preventDefault() }
function onAuxClick(e) { if (e.button === 1) e.preventDefault() } // 阻止中键自动滚动

// ---------- 主循环 ----------
const clock = new THREE.Clock()
let statTimer = 0
function tick() {
  raf = requestAnimationFrame(tick)
  const dt = Math.min(clock.getDelta(), 0.05)
  const up = player.pos.clone().normalize()

  // 移动：WASD 按相机方向（会取消自动寻路）；有目标点则自动走过去
  // 前向与 up 平行时投影退化为零向量（出生点 0,0,60 恰好触发）→ 退化时换备选轴
  let camFwd = new THREE.Vector3(Math.sin(camYaw), 0, Math.cos(camYaw)).projectOnPlane(up)
  if (camFwd.lengthSq() < 1e-4) camFwd = new THREE.Vector3(1, 0, 0).projectOnPlane(up)
  if (camFwd.lengthSq() < 1e-4) camFwd = new THREE.Vector3(0, 1, 0).projectOnPlane(up)
  camFwd.normalize()
  const camRight = new THREE.Vector3().crossVectors(camFwd, up).normalize()
  const move = new THREE.Vector3()
  if (keys.KeyW) move.add(camFwd)
  if (keys.KeyS) move.sub(camFwd)
  if (keys.KeyA) move.sub(camRight)
  if (keys.KeyD) move.add(camRight)
  if (move.lengthSq() > 0) { moveTargetDir = null; autoMine = null; moveMarker.visible = false }

  let travelHeading = null
  if (moveTargetDir) {
    const dirNow = player.pos.clone().normalize()
    // 沿切面指向目标的路径方向
    const toT = moveTargetDir.clone().addScaledVector(dirNow, -moveTargetDir.dot(dirNow))
    if (toT.lengthSq() > 1e-8) {
      toT.normalize()
      const remain = Math.acos(Math.min(1, Math.max(-1, moveTargetDir.dot(dirNow))))
      if (remain < 0.03) { // 到达
        moveTargetDir = null; moveMarker.visible = false
      } else {
        move.add(toT)
        travelHeading = toT
        // 朝向平滑转向行进方向
        const targetYaw = Math.atan2(toT.x, toT.z)
        let d = targetYaw - player.yaw
        while (d > Math.PI) d -= Math.PI * 2
        while (d < -Math.PI) d += Math.PI * 2
        player.yaw += d * Math.min(1, dt * 10)
      }
    }
  }

  const speed = (keys.ShiftLeft ? 16 : 9) * (factory?.multipliers.mecha || 1)
  if (move.lengthSq() > 0) player.pos.addScaledVector(move.normalize(), speed * dt)

  // 贴地 + 跳跃（沿 up 方向的小跳）
  const dir = player.pos.clone().normalize()
  const ground = surfaceAt(dir)
  jumpVy -= 22 * dt
  jumpH = Math.max(0, jumpH + jumpVy * dt)
  if (jumpH <= 0) { jumpVy = 0; jumpH = 0 }
  player.pos.copy(dir).multiplyScalar(ground + jumpH)
  playerMesh.position.copy(dir).multiplyScalar(ground + jumpH)
  playerMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
  const face = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), player.yaw)
  playerMesh.quaternion.multiply(face)

  // 相机：第三人称轨道（中键拖动旋转 + 滚轮缩放），独立于主角朝向
  const camBack = camFwd.clone().multiplyScalar(-camDist).addScaledVector(up, camDist * Math.max(0.1, Math.min(1.0, camPitch)))
  camera.position.copy(playerMesh.position).add(camBack)
  camera.up.copy(up)
  camera.lookAt(playerMesh.position.clone().addScaledVector(up, 1.5))

  // 最近的可交互机器（E 键开配方面板）
  nearMachine = null
  let mBestD = 4.5
  for (const b of factory?.buildings || []) {
    if (b.type !== 'Smelter' && b.type !== 'Assembler') continue
    const d = b.center.distanceTo(playerMesh.position)
    if (d < mBestD) { mBestD = d; nearMachine = b }
  }

  // 采集判定：范围内最近的矿；右键点过的矿会自动走过去开采
  let best = null, bestD = MINE_RANGE
  for (const o of ores) {
    if (o.amount <= 0) continue
    const d = o.group.position.distanceTo(playerMesh.position)
    if (d < bestD) { bestD = d; best = o }
  }
  const holdMining = best && (keys.KeyE || lmbDown)              // 手动按住采集
  const autoMining = autoMine && autoMine.amount > 0 && !moveTargetDir
    && autoMine.group.position.distanceTo(playerMesh.position) < MINE_RANGE // 到达后的自动开采
  const target = autoMining ? autoMine : (holdMining ? best : null)

  if (target) {
    if (miningTarget !== target) { miningTarget = target; miningT = 0 }
    miningT += dt
    hud.mining = Math.min(1, miningT / MINE_TIME)
    hud.hint = `采集中… ${target.type.name} ${Math.round(hud.mining * 100)}%`
    if (miningT >= MINE_TIME) {
      addItem(target.type.id)
      miningT = 0
      // 无限矿脉：不消耗，产物进背包（流水线交给采矿机）
    }
  } else {
    miningTarget = null; miningT = 0; hud.mining = 0
    if (autoMine && autoMine.amount > 0) {
      const d = autoMine.group.position.distanceTo(playerMesh.position)
      hud.hint = `前往 ${autoMine.type.name} · 距离 ${d.toFixed(1)}`
    } else if (best) {
      hud.hint = `附近有 ${best.type.name}（无限矿脉）— 按住左键 / E 采集，或右键点矿自动开采`
    } else {
      hud.hint = ''
    }
  }
  // 靠近机器时提示可换配方（优先于矿石提示）
  if (nearMachine && !target) {
    hud.hint = `${nearMachine.type === 'Smelter' ? '🔥 冶炼炉' : '🔧 制造台'}（当前配方：${nearMachine.recipe.name}）— 按 E 或左键点机器换配方`
  }

  hud.pos = `高度 ${ground.toFixed(1)}  经纬 ${latLon(dir)}`
  // 流水线模拟 + 统计
  if (factory) {
    factory.update(dt)
    statTimer += dt
    if (statTimer >= 0.5) { statTimer = 0; factoryStats.value = factory.stats(); checkQuests() }
  }
  // 科技研究推进（仅本地发起的研究由本机推进；他人的研究仅显示进度）
  if (techState.active && !techState.active.remote && factory) {
    const a = techState.active
    a.acc += dt
    techState.paused = false
    const step = a.time / a.queue.length
    while (a.acc >= step && a.paid < a.queue.length) {
      a.acc -= step
      const nextId = a.queue[a.paid]
      if (takeStored(nextId, 1)) a.paid++
      else { techState.paused = true; break }
      if (a.paid >= a.queue.length) {
        const entry = a.entry
        if (a.kind === 'tech') {
          techState.unlocked[entry.id] = true
          if (entry.unlocks) techState.unlocked[entry.unlocks] = true
          questState.toast = `🔬 科技完成：${entry.name}`
        } else {
          techState.levels[entry.id] = (techState.levels[entry.id] || 0) + 1
          factory.multipliers[entry.multKey] *= entry.per
          questState.toast = `⬆ 升级完成：${entry.name} Lv.${techState.levels[entry.id]}`
        }
        techState.active = null
        setTimeout(() => { questState.toast = '' }, 5000)
        break
      }
    }
  }
  renderer.render(scene, camera)
}

function latLon(d) {
  const lat = Math.asin(d.y) * 180 / Math.PI
  const lon = Math.atan2(d.z, d.x) * 180 / Math.PI
  return `${Math.abs(lat).toFixed(0)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(0)}°${lon >= 0 ? 'E' : 'W'}`
}

// 随机传送（探索用）
function teleport() {
  const d = randomSurfaceDir(mulberry32((Math.random() * 1e9) | 0))
  player.pos.copy(d).multiplyScalar(surfaceAt(d))
}

onMounted(() => {
  const wrap = document.getElementById('scene')
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(innerWidth, innerHeight)
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  wrap.appendChild(renderer.domElement)

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x05070d)
  camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 2000)

  sun = new THREE.DirectionalLight(0xfff2dd, 2.2)
  sun.position.set(200, 120, 80)
  scene.add(sun, new THREE.AmbientLight(0x40506a, 1.4))

  // 世界（星球地形 + 矿脉）等拿到房间种子后再初始化：同房间所有玩家生成同一片星系
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(innerWidth, innerHeight)
  })
  addEventListener('keydown', onKeyDown)
  addEventListener('keyup', onKeyUp)
  addEventListener('mousemove', onMouseMove)
  addEventListener('mousedown', onMouseDown)
  addEventListener('mouseup', onMouseUp)
  addEventListener('wheel', onWheel, { passive: true })
  addEventListener('contextmenu', onContextMenu)
  addEventListener('auxclick', onAuxClick)

  // 已有令牌则自动恢复登录
  if (auth.token) { auth.loggedIn = true; startSync() }
  // 拉取后台设计数据（任务/科技/升级/建筑）
  loadDesign()
})

// 收到房间种子后构建世界（只在登录后调用一次）
function initWorld(seed) {
  if (worldReady.value) return
  worldReady.value = true
  setWorldSeed(seed)
  makePlanet()
  makeStars()
  spawnOres()
  makePlayer()
  factory = new Factory(scene, surfaceAt, ores)
  loadTexLocal() // 恢复用户自定义建筑贴图

  // 点击目标标记
  moveMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0x7ee787, transparent: true, opacity: 0.8 })
  )
  moveMarker.visible = false
  scene.add(moveMarker)

  tick()
}
onBeforeUnmount(() => { cancelAnimationFrame(raf) })
</script>

<template>
  <!-- 登录 / 注册 -->
  <div v-if="!auth.loggedIn" style="position:fixed;inset:0;background:rgba(5,7,13,.88);display:flex;align-items:center;justify-content:center;z-index:99">
    <div style="width:340px;background:#12161f;border:1px solid #334;border-radius:14px;padding:24px;color:#fff">
      <h2 style="margin:0 0 14px;text-align:center">🤖 星球矿工</h2>
      <div style="display:flex;gap:6px;margin-bottom:14px">
        <button @click="auth.mode='login'" :style="tabStyle(auth.mode==='login')">登录</button>
        <button @click="auth.mode='register'" :style="tabStyle(auth.mode==='register')">注册</button>
      </div>
      <input v-model="auth.user" placeholder="用户名" style="input" :style="inpStyle" />
      <input v-model="auth.passwd" type="password" placeholder="密码" :style="inpStyle" />
      <div style="display:flex;align-items:center;gap:10px;margin:10px 0">
        <span style="font-size:13px;color:#9aa4b5">机甲涂装</span>
        <input type="color" v-model="auth.color" style="width:44px;height:30px;border:none;background:none;cursor:pointer" />
        <span style="font-size:13px;color:#9aa4b5">房间</span>
        <input v-model="auth.room" :style="inpStyle" style="width:110px" />
      </div>
      <button @click="doAuth" style="width:100%;padding:10px;background:#e06428;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:15px">
        {{ auth.mode === 'login' ? '进入星球' : '注册并进入星球' }}
      </button>
      <div v-if="auth.msg" style="color:#ff7777;font-size:13px;padding-top:8px;text-align:center">{{ auth.msg }}</div>
      <div style="color:#667;font-size:12px;padding-top:10px;text-align:center">注册两个账号，登录后进入同一房间即可见面</div>
    </div>
  </div>

  <!-- 登录后：房间 + 染色 -->
  <div v-if="auth.loggedIn" style="position:fixed;top:14px;left:14px;color:#fff;text-shadow:0 1px 3px #000;pointer-events:none">
    <h2 style="margin:0 0 4px">🤖 星球矿工 · 3D</h2>
    <div style="font-size:13px;color:#cfd6e2">🖱 移动鼠标转主角朝向 · 中键拖动旋转相机 · <b style="color:#7ee787">右键点击地面 → 自动走过去</b> · WASD 手动移动 · 空格跳 · 按住左键 / E 采集 · <b style="color:#ffd54a">E 靠近机器选配方</b> · 数字键 1~0 建造 · <b style="color:#9ad0ff">C 打开人物面板搓建筑</b> · <b style="color:#9ad0ff">T 科技：风电站/感应塔/配电站/火电/光伏 接入电网</b></div>
    <div style="font-size:12px;color:#9aa4b5;margin-top:4px">{{ hud.pos }}</div>
    <div style="margin-top:6px;display:flex;align-items:center;gap:8px;pointer-events:auto">
      <span style="font-size:13px;color:#ffd54a">👤 {{ auth.user }}</span>
      <span style="font-size:12px;color:#9aa4b5">房间 {{ auth.room }}</span>
      <input type="color" :value="auth.color" @change="changeColor" style="width:30px;height:22px;border:none;background:none;cursor:pointer" />
      <span style="font-size:12px;color:#9aa4b5">染色（{{ remotes.length ? `房间内还有 ${remotes.length} 名玩家` : '房间里只有你' }}）</span>
    </div>
  </div>

  <!-- 配方面板 -->
  <div v-if="recipePanel" style="position:fixed;top:140px;right:14px;background:rgba(10,14,22,.9);border:1px solid #334;border-radius:10px;padding:12px 16px;color:#fff;z-index:10">
    <b>{{ recipePanel.type === 'Smelter' ? '🔥 冶炼炉配方' : '🔧 制造台配方' }}</b>
    <span style="color:#889;font-size:12px">（E 关闭）</span>
    <div v-for="r in (recipePanel.type === 'Smelter' ? RECIPES.smelt : RECIPES.assemble.filter(r => r.id !== 'a4' || techState.unlocked['recipe:a4']))" :key="r.id"
      @click="setRecipe(recipePanel, r)"
      :style="{ margin: '6px 0', padding: '6px 10px', borderRadius: 8, cursor: 'pointer', border: recipePanel.recipe.id === r.id ? '2px solid #7ee787' : '1px solid #334', background: '#1a1f2a' }">
      <b>{{ r.name }}</b>　<span style="color:#9aa4b5;font-size:12px">
        <span v-for="(n, iid) in r.in" :key="'i'+iid" style="margin-right:4px"><ItemIcon :id="+iid" :size="16"/>×{{ n }}</span>
        → <span v-for="(n, iid) in r.out" :key="'o'+iid" style="margin-right:4px"><ItemIcon :id="+iid" :size="16"/>×{{ n }}</span>
        · {{ r.time }}s</span>
    </div>
    <div v-if="recipePanel.type === 'Smelter'" @click="recipePanel.manual = false"
      style="margin-top:4px;padding:4px 10px;border:1px solid #334;border-radius:8px;cursor:pointer;color:#9aa4b5;font-size:12px;text-align:center">
      恢复自动（进什么矿炼什么）
    </div>
  </div>

  <div id="scene" style="position:fixed;inset:0"></div>

  <div style="position:fixed;bottom:18px;left:18px;background:rgba(10,14,22,.75);border:1px solid #334;border-radius:10px;padding:10px 14px;color:#fff;min-width:170px">
    <b style="color:#ffd54a">🎒 背包</b>
    <div v-if="!invList.length" style="color:#889;font-size:13px;padding-top:6px">空空如也，去找矿吧</div>
    <div v-for="o in invList" :key="o.id" style="display:flex;align-items:center;gap:8px;padding-top:6px;font-size:14px">
      <ItemIcon :id="o.id" :size="24"/> {{ o.name }} ×{{ o.n }}
    </div>
  </div>

  <div v-if="hud.hint" style="position:fixed;bottom:140px;left:50%;transform:translateX(-50%);color:#fff;background:rgba(10,14,22,.75);border:1px solid #334;border-radius:10px;padding:10px 18px;text-align:center">
    {{ hud.hint }}
    <div v-if="hud.mining > 0" style="width:220px;height:6px;background:#222;border-radius:3px;margin-top:6px">
      <div :style="{ width: (hud.mining * 100) + '%', height: '100%', background: '#7ee787', borderRadius: 3 }"></div>
    </div>
  </div>

  <button @click="teleport" style="position:fixed;top:14px;right:14px;padding:6px 14px;background:#2a2e38;color:#fff;border:1px solid #556;border-radius:8px;cursor:pointer">🌀 随机传送</button>
  <button @click="charPanel = !charPanel" style="position:fixed;top:14px;right:130px;padding:6px 14px;background:#2a2e38;color:#fff;border:1px solid #556;border-radius:8px;cursor:pointer">🧍 人物面板（C）</button>

  <!-- 人物面板：背包 + 手动制造（建筑靠搓出来） -->
  <div v-if="charPanel" style="position:fixed;top:60px;right:14px;width:300px;max-height:70vh;overflow-y:auto;background:rgba(10,14,22,.95);border:1px solid #334;border-radius:10px;padding:14px 16px;color:#fff;z-index:20">
    <b style="color:#9ad0ff">🧍 人物面板</b><span style="color:#889;font-size:12px">（C 关闭）</span>
    <div style="margin-top:10px;font-size:13px;color:#ffd54a"><b>🎒 背包</b></div>
    <div v-if="!invList.length" style="color:#889;font-size:13px;padding:4px 0">空空如也，去采点矿吧</div>
    <div v-for="o in invList" :key="o.id" style="display:flex;align-items:center;gap:8px;padding-top:4px;font-size:13px">
      <ItemIcon :id="o.id" :size="22"/> {{ o.name }} ×{{ o.n }}
    </div>
    <div style="margin-top:12px;font-size:13px;color:#7ee787"><b>🔨 可制造</b><span style="color:#889;font-size:12px">（点击制造）</span></div>
    <div v-if="craftMsg.text" :style="{ margin: '6px 0', padding: '4px 8px', borderRadius: 6, fontSize: 12, background: craftMsg.ok ? '#1a2a1a' : '#2a1a1a', color: craftMsg.ok ? '#7ee787' : '#ff7777' }">{{ craftMsg.text }}</div>
    <div v-for="r in RECIPES.craft" :key="r.id"
      @click="handCraft(r)"
      :style="{ margin: '6px 0', padding: '6px 10px', borderRadius: 8, cursor: 'pointer', border: Object.entries(r.in).every(([id, n]) => (hud.inventory[id] || 0) >= n) ? '1px solid #2a5a2a' : '1px solid #5a2a2a', background: '#1a1f2a' }">
      <b>{{ r.name }}</b>　<span style="color:#9aa4b5;font-size:12px"><span v-for="(n, iid) in r.in" :key="iid" style="margin-right:4px"><ItemIcon :id="+iid" :size="16"/>×{{ n }}</span></span>
    </div>
    <div style="color:#667;font-size:11px;padding-top:6px">提示：建筑都要先搓出来再放置，数字键 1~0 放置</div>
    <div style="margin-top:12px;font-size:13px;color:#9ad0ff"><b>🖼 自定义建筑外观</b><span style="color:#889;font-size:11px">（上传贴图只影响你的客户端，存本地）</span></div>
    <div v-for="(info, t) in BUILD_TYPES" :key="'tex' + t" style="display:flex;align-items:center;gap:6px;padding:3px 0;font-size:12px">
      <img v-if="bldTex[t]" :src="bldTex[t]" style="width:22px;height:22px;border-radius:3px">
      <BuildingIcon v-else :type="t" :size="20"/>
      <span style="flex:1">{{ info.name.replace(/^\S+\s/, '') }}</span>
      <input type="file" accept="image/*" style="display:none" :id="'tex_' + t" @change="uploadTex(t, $event)">
      <button @click="pickTex(t)" style="padding:2px 8px;background:#2a2e38;color:#9ad0ff;border:1px solid #556;border-radius:5px;cursor:pointer;font-size:11px">上传</button>
      <button v-if="bldTex[t]" @click="clearTex(t)" style="padding:2px 8px;background:#2a2e38;color:#ff9;border:1px solid #556;border-radius:5px;cursor:pointer;font-size:11px">还原</button>
    </div>
  </div>

  <!-- DSP 式底部建造栏：数字键 1~5 -->
  <div style="position:fixed;bottom:14px;left:50%;transform:translateX(-50%);display:flex;gap:6px;background:rgba(10,14,22,.75);border:1px solid #334;border-radius:10px;padding:8px">
    <div v-for="(info, t) in BUILD_TYPES" :key="t" @click="buildMode = buildMode === t ? null : t"
      :style="{ width: 92, padding: '6px 4px', textAlign: 'center', borderRadius: 8, cursor: 'pointer', border: buildMode === t ? '2px solid #ffd54a' : '1px solid #334', background: buildMode === t ? '#2c3444' : 'transparent' }">
      <div style="font-size:14px;display:flex;align-items:center;justify-content:center;gap:4px">
        <img v-if="bldTex[t]" :src="bldTex[t]" style="width:20px;height:20px;vertical-align:middle;border-radius:3px">
        <BuildingIcon v-else :type="t" :size="20"/>
        {{ info.name.replace(/^\S+\s/, '') }}
      </div>
      <div style="font-size:10px;color:#889">按 {{ Object.keys(BUILD_TYPES).indexOf(t) + 1 === 10 ? 0 : Object.keys(BUILD_TYPES).indexOf(t) + 1 }}</div>
      <div style="font-size:10px;color:#9aa4b5;padding-top:2px">{{ info.desc }}</div>
    </div>
  </div>

  <!-- 制造台配方选择 -->
  <div v-if="buildMode === 'Assembler'" style="position:fixed;bottom:210px;left:50%;transform:translateX(-50%);background:rgba(10,14,22,.85);border:1px solid #334;border-radius:10px;padding:8px 12px;color:#fff">
    制造台配方：
    <select v-model.number="assemblerRecipe" style="background:#2a2e38;color:#fff;border:1px solid #555;padding:4px;border-radius:4px">
      <option v-for="r in RECIPES.assemble.filter(r => r.id !== 'a4' || techState.unlocked['recipe:a4'])" :key="r.id" :value="r.id">{{ r.name }}（{{ Object.entries(r.in).map(([id, n]) => n + '×' + ITEMS[id].name).join(' + ') }} → {{ Object.entries(r.out).map(([id, n]) => n + '×' + ITEMS[id].name).join('') }}）</option>
    </select>
    <span style="color:#889;font-size:12px">（R 旋转建筑朝向 · Esc 取消）</span>
  </div>

  <!-- 生产统计 -->
  <div v-if="factoryStats" style="position:fixed;bottom:14px;right:14px;background:rgba(10,14,22,.75);border:1px solid #334;border-radius:10px;padding:10px 14px;color:#fff;min-width:200px;font-size:13px">
    <b style="color:#7ee787">🏭 产线</b>
    <div style="color:#889;padding-top:4px">
      采矿机 {{ factoryStats.machines.Miner }} · 冶炼炉 {{ factoryStats.machines.Smelter }} · 制造台 {{ factoryStats.machines.Assembler }} · 传送带 {{ factoryStats.machines.Belt }}（带上 {{ factoryStats.beltItems }} 件）· 仓库 {{ factoryStats.machines.Storage }} · 风电站 {{ factoryStats.machines.WindTurbine }} · 感应塔 {{ factoryStats.machines.PowerPylon }} · 配电站 {{ factoryStats.machines.Substation }} · 火电厂 {{ factoryStats.machines.ThermalPowerPlant }} · 光伏 {{ factoryStats.machines.SolarPanel }}
    </div>
    <div style="padding-top:4px" :style="{ color: factoryStats.power.ratio < 1 ? '#ff7777' : '#7ee787' }">
      ⚡ 电力：{{ factoryStats.power.supply }} / {{ factoryStats.power.demand }}<span v-if="factoryStats.power.ratio < 1">（供电不足，机器降速 {{ Math.round(factoryStats.power.ratio * 100) }}% — 多建 🌀 风力发电站）</span>
    </div>
    <div v-if="Object.keys(factoryStats.storages).length" style="padding-top:6px">
      📦 仓库：
      <span v-for="(n, id) in factoryStats.storages" :key="id" style="margin-right:8px">
        <ItemIcon :id="+id" :size="16"/>{{ ITEMS[id]?.name }}×{{ n }}
      </span>
    </div>
    <div v-if="Object.keys(factoryStats.produced).length" style="padding-top:4px;color:#889">
      累计产出：
      <span v-for="(n, id) in factoryStats.produced" :key="id" style="margin-right:8px"><ItemIcon :id="+id" :size="16"/>×{{ n }}</span>
    </div>
  </div>

  <!-- 科技面板（T） -->
  <div v-if="techMenu && auth.loggedIn" style="position:fixed;top:140px;right:14px;width:330px;max-height:70vh;overflow-y:auto;background:rgba(10,14,22,.95);border:1px solid #334;border-radius:10px;padding:14px 16px;color:#fff;z-index:20">
    <b style="color:#5aa8ff">🔬 科技 & 升级</b><span style="color:#889;font-size:12px">（T 关闭 · 房间共享）</span>
    <div style="display:flex;gap:8px;align-items:center;margin-top:8px;font-size:13px">
      <ItemIcon :id="16" :size="18"/>仓库蓝糖 {{ factoryStats ? (factoryStats.storages[16] || 0) : 0 }}
      <ItemIcon :id="17" :size="18"/>红糖 {{ factoryStats ? (factoryStats.storages[17] || 0) : 0 }}
    </div>
    <!-- 进行中的研究 -->
    <div v-if="techState.active" style="margin:10px 0;padding:8px 10px;background:#1a2434;border:1px solid #2a4a6a;border-radius:8px">
      <b style="color:#7ec8ff">研究进行中：{{ techState.active.entry.name }}</b>
      <div style="font-size:12px;color:#889">{{ Math.round(techState.active.paid / techState.active.queue.length * 100) }}%
        <span v-if="techState.paused" style="color:#ff7777">— 矩阵不足，已暂停</span>
        <span v-else-if="techState.active.remote" style="color:#ffd54a">— 由队友推进中</span>
      </div>
      <div style="width:100%;height:6px;background:#222;border-radius:3px;margin-top:5px">
        <div :style="{ width: (techState.active.paid / techState.active.queue.length * 100) + '%', height: '100%', background: '#5aa8ff', borderRadius: 3 }"></div>
      </div>
    </div>
    <div style="margin-top:10px;font-size:13px;color:#7ec8ff"><b>🔬 科技（一次性解锁）</b></div>
    <div v-for="t in techList" :key="t.id"
      @click="!techState.unlocked[t.id] && !techState.active && startResearch(t, 'tech')"
      :style="{ margin: '6px 0', padding: '6px 10px', borderRadius: 8, cursor: techState.unlocked[t.id] ? 'default' : (techState.active ? 'not-allowed' : 'pointer'), border: techState.unlocked[t.id] ? '1px solid #2a5a2a' : (t.requires && !techState.unlocked[t.requires] ? '1px solid #5a2a2a' : '1px solid #2a4a6a'), background: '#1a1f2a', opacity: techState.unlocked[t.id] ? .55 : (t.requires && !techState.unlocked[t.requires] ? .5 : 1) }">
      <b>{{ techState.unlocked[t.id] ? '✔ ' : '' }}{{ t.name }}</b>
      <span v-if="t.requires && !techState.unlocked[t.requires]" style="color:#ff7777;font-size:11px">（需先研究 {{ techList.find(x => x.id === t.requires)?.name }}）</span>
      <div style="color:#9aa4b5;font-size:12px">{{ t.desc }}</div>
      <div v-if="!techState.unlocked[t.id]" style="font-size:12px;color:#889">
        <ItemIcon v-for="(n, iid) in t.cost" :key="iid" :id="+iid" :size="14"/>×{{ n }} · {{ t.time }}s
      </div>
    </div>
    <div style="margin-top:10px;font-size:13px;color:#ffd54a"><b>⬆ 升级（可重复）</b></div>
    <div v-for="u in upgradeList" :key="u.id"
      @click="!techState.active && startResearch(u, 'upgrade')"
      :style="{ margin: '6px 0', padding: '6px 10px', borderRadius: 8, cursor: techState.active ? 'not-allowed' : 'pointer', border: '1px solid #4a4a2a', background: '#1a1f2a' }">
      <b>{{ u.name }} Lv.{{ techState.levels[u.id] || 0 }}/{{ u.max }}</b>
      <div style="color:#9aa4b5;font-size:12px">{{ u.desc }}</div>
      <div style="font-size:12px;color:#889">
        <template v-if="(techState.levels[u.id] || 0) < u.max">
          <ItemIcon v-for="(n, iid) in costFor(u, techState.levels[u.id] || 0)" :key="iid" :id="+iid" :size="14"/>×{{ n }}
        </template>
        <template v-else><span style="color:#7ee787">已满级</span></template>
      </div>
    </div>
  </div>

  <!-- 任务面板 -->
  <div v-if="auth.loggedIn && worldReady" style="position:fixed;bottom:230px;left:18px;width:250px;background:rgba(10,14,22,.8);border:1px solid #334;border-radius:10px;padding:10px 14px;color:#fff;font-size:13px">
    <b style="color:#ffd54a">📋 任务 {{ Math.min(questState.idx + 1, questList.length) }}/{{ questList.length }}</b>
    <template v-if="questProgress()">
      <div style="padding-top:4px"><b>{{ questProgress().q.name }}</b></div>
      <div style="color:#9aa4b5;font-size:12px">{{ questProgress().q.desc }}</div>
      <div style="width:100%;height:6px;background:#222;border-radius:3px;margin-top:5px">
        <div :style="{ width: (questProgress().cur / questProgress().q.target * 100) + '%', height: '100%', background: '#ffd54a', borderRadius: 3 }"></div>
      </div>
      <div style="color:#889;font-size:11px;margin-top:3px">{{ questProgress().cur }} / {{ questProgress().q.target }}</div>
    </template>
    <div v-else style="color:#7ee787;padding-top:6px">🎉 全部任务完成，自由建设吧！</div>
    <div style="color:#667;font-size:11px;padding-top:4px">房间种子：{{ worldSeed }}</div>
  </div>

  <div v-if="questState.toast" style="position:fixed;top:90px;left:50%;transform:translateX(-50%);color:#7ee787;background:rgba(10,14,22,.9);border:1px solid #2a5a2a;border-radius:10px;padding:10px 20px;font-size:15px;z-index:30">{{ questState.toast }}</div>
</template>
