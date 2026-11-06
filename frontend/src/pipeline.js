import * as THREE from 'three'

// ---------- 物品 / 配方（与 2D 版一致，60 tick 制换算为秒） ----------
export const ITEMS = {
  1: { name: '铁矿', color: 0x8a6a4a },
  2: { name: '铜矿', color: 0xd06a30 },
  3: { name: '石矿', color: 0x9aa0a8 },
  4: { name: '硅矿', color: 0x7ab8d8 },
  5: { name: '钛矿', color: 0xb8c8d8 },
  6: { name: '煤', color: 0x4a4f58 },
  11: { name: '铁块', color: 0xb8bcc2 },
  12: { name: '铜块', color: 0xd98e4a },
  13: { name: '齿轮', color: 0xe0a03a },
  14: { name: '电路板', color: 0x4fae6b },
  15: { name: '石材', color: 0xd8d2c0 },
  16: { name: '电磁矩阵', color: 0x5aa8ff },
  17: { name: '能量矩阵', color: 0xff6a6a },
  18: { name: '磁铁', color: 0x7fb2e0 },
  21: { name: '⛏ 采矿机', color: 0xc8a24a },
  22: { name: '🔥 冶炼炉', color: 0xe05656 },
  23: { name: '🔧 制造台', color: 0x5680e0 },
  24: { name: '➡ 传送带', color: 0x8a8f98 },
  25: { name: '📦 仓库', color: 0x8a6ac0 },
  26: { name: '🌀 风力发电站', color: 0x9ad0ff },
  27: { name: '⚡ 电力感应塔', color: 0xffe066 },
}

// 配方：in→out，秒
export const RECIPES = {
  smelt: [
    { id: 's1', name: '铁块', time: 1, in: { 1: 1 }, out: { 11: 1 } },
    { id: 's2', name: '铜块', time: 1, in: { 2: 1 }, out: { 12: 1 } },
    { id: 's3', name: '石材', time: 1.5, in: { 3: 1 }, out: { 15: 1 } },
    { id: 's4', name: '磁铁', time: 1, in: { 11: 1 }, out: { 18: 1 } },
  ],
  assemble: [
    { id: 'a1', name: '齿轮', time: 1.34, in: { 11: 2 }, out: { 13: 1 } }, // 1s / 0.75
    { id: 'a2', name: '电路板', time: 1.34, in: { 11: 1, 12: 1 }, out: { 14: 1 } },
    { id: 'a3', name: '电磁矩阵', time: 2.7, in: { 18: 1, 14: 1 }, out: { 16: 1 } }, // 蓝糖（2s / 0.75）
    { id: 'a4', name: '能量矩阵', time: 4, in: { 16: 1, 12: 2 }, out: { 17: 1 } },   // 红糖（3s / 0.75）
  ],
  // 手动制造（人物面板，C 键打开）：材料 + 建筑，建筑靠搓出来
  craft: [
    { id: 'cs11', name: '铁块（手搓）', in: { 1: 2 }, out: { 11: 1 } },
    { id: 'cs12', name: '铜块（手搓）', in: { 2: 2 }, out: { 12: 1 } },
    { id: 'cs15', name: '石材（手搓）', in: { 3: 2 }, out: { 15: 1 } },
    { id: 'c13', name: '齿轮', in: { 11: 2 }, out: { 13: 1 } },
    { id: 'c14', name: '电路板', in: { 11: 1, 12: 1 }, out: { 14: 1 } },
    { id: 'cb21', name: '⛏ 采矿机', in: { 11: 3, 13: 1 }, out: { 21: 1 } },
    { id: 'cb22', name: '🔥 冶炼炉', in: { 11: 2, 15: 1 }, out: { 22: 1 } },
    { id: 'cb23', name: '🔧 制造台', in: { 11: 2, 13: 1 }, out: { 23: 1 } },
    { id: 'cb24', name: '➡ 传送带', in: { 11: 1 }, out: { 24: 1 } },
    { id: 'cb25', name: '📦 仓库', in: { 11: 3, 15: 2 }, out: { 25: 1 } },
    { id: 'cb26', name: '🌀 风力发电站', in: { 11: 2, 13: 2 }, out: { 26: 1 } },
    { id: 'cb27', name: '⚡ 电力感应塔', in: { 11: 1, 14: 1 }, out: { 27: 1 } },
  ],
}

// 建筑类型 → 需消耗的背包物品 id（建筑靠搓出来）
export const BUILD_ITEM = { Miner: 21, Smelter: 22, Assembler: 23, Belt: 24, Storage: 25, WindTurbine: 26, PowerPylon: 27 }

// 电力：每台风力发电站供电 WIND_POWER；Smelter/Assembler/Miner 耗电
export const WIND_POWER = 2, PYLON_RANGE = 6, PYLON_BOOST = 1.5
export const POWER_DEMAND = { Miner: 0.5, Smelter: 1, Assembler: 1 }

export const BUILD_TYPES = {
  Miner: { name: '⛏ 采矿机', color: 0xc8a24a, desc: '放在矿簇旁，0.5 件/秒 · 耗电 0.5' },
  Smelter: { name: '🔥 冶炼炉', color: 0xe05656, desc: '烧煤冶炼 · 需进煤作燃料' },
  Assembler: { name: '🔧 制造台', color: 0x5680e0, desc: '选择配方' },
  Belt: { name: '➡ 传送带', color: 0x3a3f48, desc: '点击两点自动铺带（6 件/秒）' },
  Storage: { name: '📦 仓库', color: 0x8a6ac0, desc: '接收一切产物' },
  WindTurbine: { name: '🌀 风力发电站', color: 0x9ad0ff, desc: '供电 2 单位，无需燃料' },
  PowerPylon: { name: '⚡ 电力感应塔', color: 0xffe066, desc: `半径 6 内机器工作速度 ×1.5` },
}

const BELT_LEN = 2.4, BELT_SPEED = 6, MINER_RATE = 0.5, BUF_CAP = 20

// 切面工具
function tangentBasis(d) {
  const ref = Math.abs(d.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)
  const t1 = new THREE.Vector3().crossVectors(d, ref).normalize()
  const t2 = new THREE.Vector3().crossVectors(d, t1).normalize()
  return [t1, t2]
}

export class Factory {
  constructor(scene, surfaceAt, veins) {
    this.scene = scene
    this.surfaceAt = surfaceAt // (dir) => 半径
    this.veins = veins         // [{dir, type:{id,name,color}}]
    this.buildings = []        // {type, dir, center, facing, mesh, ...}
    this.belts = []            // buildings 里 type==='Belt' 的引用集合
    this.produced = {}         // 产出统计
    this.ghost = null
    this.ghostType = null
    this.ghostRecipe = null
    this.ghostFacingIdx = 0
    this.pathStart = null      // 铺带起点
    this.pathPreviewMeshes = []
    // 科技升级全局倍率（采矿/传送带/冶炼/制造/机甲移速）
    this.multipliers = { mine: 1, belt: 1, smelt: 1, assemble: 1, mecha: 1 }
  }

  // ---------- 放置 ----------
  static makeLabel(text, scale = 1) {
    const cv = document.createElement('canvas')
    cv.width = 256; cv.height = 64
    const c = cv.getContext('2d')
    c.beginPath()
    c.fillStyle = 'rgba(10,14,22,.72)'
    c.roundRect ? c.roundRect(0, 0, 256, 64, 14) : c.rect(0, 0, 256, 64)
    c.fill()
    c.fillStyle = '#fff'; c.font = '30px sans-serif'; c.textAlign = 'center'
    c.fillText(text, 128, 44)
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false }))
    sp.scale.set(2.6 * scale, 0.65 * scale, 1)
    return sp
  }

  // 更新机器头顶标签
  static labelText(b) {
    if (b.type === 'Smelter') return `🔥 冶炼炉 ${b.recipe.name} · 煤×${b.input[6] || 0}`
    if (b.type === 'Assembler') return `${BUILD_TYPES[b.type].name.slice(2)} ${b.recipe.name}`
    if (b.type === 'Miner') return `采矿·${b.veinName}`
    return ''
  }
  static setLabel(b, text) {
    if (!b.label) {
      b.label = this.makeLabel('')
      b.label.position.y = 2.6
      b.mesh.add(b.label)
      b._lastLabel = null
    }
    if (b._lastLabel !== text) {
      b._lastLabel = text
      b.label.material.map.dispose()
      b.label.material.map = new THREE.CanvasTexture(this._drawLabel(text))
    }
  }
  static _drawLabel(text) {
    const cv = document.createElement('canvas')
    cv.width = 256; cv.height = 64
    const c = cv.getContext('2d')
    c.beginPath()
    c.fillStyle = 'rgba(10,14,22,.72)'
    c.roundRect ? c.roundRect(0, 0, 256, 64, 14) : c.rect(0, 0, 256, 64)
    c.fill()
    c.fillStyle = '#fff'; c.font = '30px sans-serif'; c.textAlign = 'center'
    c.fillText(text, 128, 44)
    return cv
  }

  canPlace(type, dir) {
    if (type === 'Miner') {
      return this.veins.some(v => v.dir.angleTo(dir) < 4.5 / this.surfaceAt(dir))
    }
    return !this.buildings.some(b => b.dir.angleTo(dir) < 2.4 / this.surfaceAt(dir))
  }

  place(type, dir, recipeId) {
    if (!this.canPlace(type, dir)) return null
    const [t1] = tangentBasis(dir)
    const facing = t1.clone().applyAxisAngle(dir, this.ghostFacingIdx * Math.PI / 3)
    const center = dir.clone().multiplyScalar(this.surfaceAt(dir))
    let mesh, extra = {}
    if (type === 'Belt') {
      mesh = this._beltMesh(dir, center, facing)
    } else if (type === 'Miner') {
      const vein = this.veins.find(v => v.dir.angleTo(dir) < 4.5 / this.surfaceAt(dir))
      mesh = this._boxMesh(0xc8a24a, [1.8, 1.2, 1.8])
      extra = { veinItem: vein.type.id, veinName: vein.type.name, timer: 0 }
      extra.arrow = this._arrow(center, facing, 0xffd54a)
    } else if (type === 'Smelter') {
      mesh = this._boxMesh(0xe05656, [2.0, 1.6, 2.0])
      extra = { recipe: RECIPES.smelt[0], input: {}, outItem: null, outCount: 0, progress: 0, timer: 0, auto: true }
      extra.arrow = this._arrow(center, facing, 0xff8866)
    } else if (type === 'Assembler') {
      mesh = this._boxMesh(0x5680e0, [2.0, 1.5, 2.0])
      const r = RECIPES.assemble.find(r => r.id === recipeId) || RECIPES.assemble[0]
      extra = { recipe: r, input: {}, outItem: null, outCount: 0, progress: 0, timer: 0 }
      extra.arrow = this._arrow(center, facing, 0x88aaff)
    } else if (type === 'Storage') {
      mesh = this._boxMesh(0x8a6ac0, [2.2, 1.4, 2.2])
      extra = { store: {} }
    } else if (type === 'WindTurbine') {
      // 塔杆 + 风叶转子（每帧旋转）
      mesh = new THREE.Group()
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.8, 0.5), new THREE.MeshLambertMaterial({ color: 0xd8e4ee }))
      pole.position.y = 1.4
      const nacelle = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.6), new THREE.MeshLambertMaterial({ color: 0x9ad0ff }))
      nacelle.position.y = 2.9
      const rotor = new THREE.Group()
      for (let i = 0; i < 3; i++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.4, 0.08), new THREE.MeshLambertMaterial({ color: 0xe8f4ff }))
        blade.position.y = 0.7
        const arm = new THREE.Group()
        arm.add(blade)
        arm.rotation.z = i * Math.PI * 2 / 3
        rotor.add(arm)
      }
      rotor.position.set(0.45, 2.9, 0)
      mesh.add(pole, nacelle, rotor)
      extra = { rotor }
    } else if (type === 'PowerPylon') {
      mesh = new THREE.Group()
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.35, 3.2, 0.35), new THREE.MeshLambertMaterial({ color: 0x8a8f98 }))
      pole.position.y = 1.6
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffe066 }))
      tip.position.y = 3.4
      mesh.add(pole, tip)
      extra = { tip }
    }
    mesh.position.copy(center)
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
    this.scene.add(mesh)
    const b = { type, dir, center, facing, mesh, ...extra }
    this.buildings.push(b)
    return b
  }

  _boxMesh(color, [x, y, z]) {
    const g = new THREE.Group()
    const body = new THREE.Mesh(new THREE.BoxGeometry(x, y, z), new THREE.MeshLambertMaterial({ color }))
    body.position.y = y / 2
    g.add(body)
    return g
  }

  _beltMesh(dir, center, facing) {
    const g = new THREE.Group()
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.18, BELT_LEN),
      new THREE.MeshLambertMaterial({ color: 0x3a3f48 })
    )
    plate.position.y = 0.28
    g.add(plate)
    // 方向箭头（局部 -Z 指向 facing）
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.7, 4), new THREE.MeshBasicMaterial({ color: 0xffd54a }))
    tip.rotation.x = -Math.PI / 2
    tip.position.set(0, 0.45, -BELT_LEN / 2 + 0.5)
    g.add(tip)
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
    g.rotateY(Math.atan2(facing.x, facing.z) - Math.atan2(dir.x, dir.z))
    return g
  }

  _arrow(center, facing, color) {
    const a = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 6), new THREE.MeshBasicMaterial({ color }))
    a.position.copy(center).addScaledVector(facing, 1.6).addScaledVector(center.clone().normalize(), 0.6)
    a.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), facing)
    this.scene.add(a)
    return a
  }

  // ---------- 幽灵预览 ----------
  showGhost(type, dir, recipeId) {
    this.ghostFacingIdx = this.ghostType === type ? this.ghostFacingIdx : 0
    this.ghostType = type
    this.ghostRecipe = recipeId
    if (!this.ghost || this.ghost._for !== type) {
      if (this.ghost) this.scene.remove(this.ghost)
      this.ghost = type === 'Belt'
        ? this._beltMesh(dir, new THREE.Vector3(), new THREE.Vector3(1, 0, 0))
        : this._boxMesh(BUILD_TYPES[type].color, type === 'Storage' ? [2.2, 1.4, 2.2] : type === 'Miner' ? [1.8, 1.2, 1.8] : [2, 1.6, 2])
      this.ghost._for = type
      this.ghost.traverse(o => { if (o.material) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.5 } })
      this.scene.add(this.ghost)
    }
    const ok = this.canPlace(type, dir)
    this.ghost.visible = true
    this.ghost.position.copy(dir).multiplyScalar(this.surfaceAt(dir))
    this.ghost.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
    let tint = ok ? 0x7ee787 : 0xff5555
    this.ghost.traverse(o => { if (o.material && o.material.color && !o._keepColor) o.material.color.setHex(tint) })
    if (type === 'Belt') this._orientGhostBelt(dir)
    return ok
  }

  _orientGhostBelt(dir) { /* 方向由铺带流程决定，幽灵仅示意位置 */ }
  rotateGhost() { this.ghostFacingIdx = (this.ghostFacingIdx + 1) % 6 }
  hideGhost() { if (this.ghost) this.ghost.visible = false }

  // ---------- 铺带路径 ----------
  beginPath(dir) {
    this.pathStart = { dir, facing: this._pathFacing(dir) }
    return true
  }

  _pathFacing(dir) {
    const [t1] = tangentBasis(dir)
    return t1.clone().applyAxisAngle(dir, this.ghostFacingIdx * Math.PI / 3)
  }

  previewPath(endDir) {
    this._clearPreview()
    if (!this.pathStart) return
    for (const p of this._pathPoints(this.pathStart.dir, endDir)) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), new THREE.MeshBasicMaterial({ color: 0x7ee787 }))
      m.position.copy(p).multiplyScalar(this.surfaceAt(p))
      this.scene.add(m)
      this.pathPreviewMeshes.push(m)
    }
  }

  commitPath(endDir) {
    if (!this.pathStart) return 0
    const pts = this._pathPoints(this.pathStart.dir, endDir)
    let placed = 0, prev = null
    for (const p of pts) {
      // 传送带方向 = 路径前进方向
      const nextDir = p.clone()
      const b = this.place('Belt', p, null)
      if (b) {
        // 方向：指向路径下一点
        placed++
        prev = b
      }
      prev = b || prev
    }
    // 第二遍：沿路径顺序设定每段方向
    for (let i = 0; i < pts.length - 1; i++) {
      const b = this.buildings.find(bb => bb.type === 'Belt' && bb.dir.angleTo(pts[i]) < 0.01)
      const nx = pts[i + 1]
      if (b) {
        const [t1] = tangentBasis(b.dir)
        const f = nx.clone().addScaledVector(b.dir, -nx.dot(b.dir)).normalize()
        b.facing = f
        this._reorientBelt(b)
      }
    }
    if (pts.length) {
      const last = this.buildings.find(bb => bb.type === 'Belt' && bb.dir.angleTo(pts[pts.length - 1]) < 0.01)
      if (last) {
        last.facing = this.pathStart.facing
        this._reorientBelt(last)
      }
    }
    this._clearPreview()
    this.pathStart = null
    return placed
  }

  _reorientBelt(b) {
    b.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.dir)
    b.mesh.rotateY(Math.atan2(b.facing.x, b.facing.z) - Math.atan2(b.dir.x, b.dir.z))
    if (b.arrow) b.arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.facing)
  }

  _pathPoints(startDir, endDir) {
    const pts = []
    const R = this.surfaceAt(startDir)
    const total = startDir.angleTo(endDir)
    const n = Math.max(1, Math.min(40, Math.round(total * R / BELT_LEN)))
    for (let i = 0; i <= n - 1; i++) {
      const t = i / Math.max(1, n - 1) * (n > 1 ? (total - BELT_LEN / R) / total : 0) || 0
      const d = startDir.clone().multiplyScalar(Math.sin((1 - i / n) * total)).addScaledVector(endDir, Math.sin((i / n) * total)).normalize()
      pts.push(d)
    }
    return pts
  }

  _clearPreview() {
    for (const m of this.pathPreviewMeshes) this.scene.remove(m)
    this.pathPreviewMeshes = []
  }

  cancelPath() { this._clearPreview(); this.pathStart = null }

  // ---------- 模拟 ----------
  update(dt) {
    // 0. 电力：风力发电站供电，Smelter/Assembler/Miner 耗电；不足时机器降速
    let supply = 0, demand = 0
    for (const b of this.buildings) {
      if (b.type === 'WindTurbine') supply += WIND_POWER
      demand += POWER_DEMAND[b.type] || 0
    }
    this.power = { supply, demand, ratio: demand > 0 ? Math.min(1, supply / demand) : 1 }
    const pw = this.power.ratio
    // 1. 机器
    for (const b of this.buildings) {
      if (b.rotor) b.rotor.rotation.z += dt * (1.5 + pw) // 风叶旋转（电力充足转更快）
      if (b.tip) b.tip.material.opacity = 0.7 + 0.3 * Math.sin(performance.now() / 300) // 感应塔呼吸灯
      if (b.type !== 'Belt') Factory.setLabel(b, Factory.labelText(b))
      // 电力感应塔半径内机器工作加速
      const boost = b.type === 'Smelter' || b.type === 'Assembler' || b.type === 'Miner'
        ? (this.buildings.some(p => p.type === 'PowerPylon' && p.center.distanceTo(b.center) < PYLON_RANGE) ? PYLON_BOOST : 1) : 1
      if (b.type === 'Miner') {
        b.timer += dt * MINER_RATE * pw * boost * this.multipliers.mine
        if (b.timer >= 1) { b.timer -= 1; this._push(b, b.veinItem) }
      } else if (b.type === 'Smelter') {
        this.autoRecipe(b) // 进什么矿自动冶炼什么
        this._tickMachine(b, dt * pw * boost * this.multipliers.smelt)
      } else if (b.type === 'Assembler') {
        this._tickMachine(b, dt * pw * boost * this.multipliers.assemble)
      }
    }
    // 2. 传送带
    for (const b of this.buildings) if (b.type === 'Belt') this._tickBelt(b, dt * this.multipliers.belt)
  }

  _tickMachine(b, dt) {
    const r = b.recipe
    // 产出推送
    if (b.outCount > 0) {
      for (const item in b.outCount > 0 ? { [b.outItem]: 1 } : {}) {
        if (this._push(b, +item)) { b.outCount--; if (b.outCount <= 0) b.outItem = null }
        break
      }
    }
    // 开始（冶炼炉需消耗 1 煤作燃料）
    if (!b.replicating) {
      if (b.type === 'Smelter' && (b.input[6] || 0) < 1) return // 无燃料（煤）停机
      const need = Object.entries(r.in)
      if (need.every(([id, n]) => (b.input[id] || 0) >= n)) {
        for (const [id, n] of need) b.input[id] -= n
        if (b.type === 'Smelter') b.input[6] -= 1 // 烧掉 1 煤
        b.progress = 0
        b.replicating = true
      } else return
    }
    b.progress += dt
    const T = r.time
    if (b.progress >= T) {
      b.progress = 0
      b.replicating = false
      for (const [id, n] of Object.entries(r.out)) {
        b.outItem = +id
        b.outCount = (b.outCount || 0) + n
      }
      const first = Object.keys(r.out)[0]
      this.produced[first] = (this.produced[first] || 0) + r.out[first]
    }
  }

  // 机器出料：沿 facing 找相邻的带/仓库/机器
  _push(b, itemId) {
    const outPoint = b.center.clone().addScaledVector(b.facing, 2.0)
    // 传送带：入口端靠近
    for (const t of this.buildings) {
      if (t.type !== 'Belt') continue
      const entry = t.center.clone().addScaledVector(t.facing, -BELT_LEN / 2)
      if (entry.distanceTo(outPoint) < 1.6) {
        const tail = t.items.length ? t.items[t.items.length - 1] : null
        if (!tail || tail.pos < 1 - 0.34) {
          t.items.push({ itemId, pos: 0, mesh: this._itemMesh(itemId, t, 0) })
          return true
        }
        return false
      }
    }
    // 仓库
    for (const t of this.buildings) {
      if (t.type !== 'Storage') continue
      if (t.center.distanceTo(outPoint) < 2.6) {
        t.store[itemId] = (t.store[itemId] || 0) + 1
        return true
      }
    }
    // 机器直连
    for (const t of this.buildings) {
      if ((t.type === 'Smelter' || t.type === 'Assembler') && t !== b) {
        if (t.center.distanceTo(outPoint) < 2.6) {
          const need = Object.keys(t.recipe.in).map(Number)
          const isFuel = t.type === 'Smelter' && itemId === 6 // 煤 = 冶炼炉燃料
          const cur = t.input[itemId] || 0
          if ((need.includes(itemId) || isFuel) && cur < BUF_CAP) { t.input[itemId] = cur + 1; return true }
          return false
        }
      }
    }
    return false
  }

  _tickBelt(b, dt) {
    if (!b.items) b.items = []
    const adv = BELT_SPEED * dt / BELT_LEN
    for (let i = 0; i < b.items.length; i++) {
      const it = b.items[i]
      it.pos += adv
      if (i > 0 && it.pos > b.items[i - 1].pos - 0.34) it.pos = b.items[i - 1].pos - 0.34
      if (it.pos >= 1) {
        const exit = b.center.clone().addScaledVector(b.facing, BELT_LEN / 2)
        if (this._transfer(b, it, exit)) { this.scene.remove(it.mesh); b.items.splice(i, 1); i-- }
        else it.pos = 1
      } else {
        it.mesh.position.copy(this._beltPoint(b, it.pos))
      }
    }
    for (const it of b.items) if (it.pos < 1) it.mesh.position.copy(this._beltPoint(b, it.pos))
  }

  _beltPoint(b, pos) {
    return b.center.clone().addScaledVector(b.facing, (pos - 0.5) * BELT_LEN)
      .addScaledVector(b.center.clone().normalize(), 0.55)
  }

  _itemMesh(itemId, b, pos) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 10, 8),
      new THREE.MeshLambertMaterial({ color: ITEMS[itemId]?.color || 0xffffff })
    )
    m.position.copy(this._beltPoint(b, pos))
    this.scene.add(m)
    return m
  }

  _transfer(from, it, exit) {
    // 下一段带：入口靠近本段出口
    for (const t of this.buildings) {
      if (t.type !== 'Belt' || t === from) continue
      const entry = t.center.clone().addScaledVector(t.facing, -BELT_LEN / 2)
      if (entry.distanceTo(exit) < 1.2) {
        const tail = t.items.length ? t.items[t.items.length - 1] : null
        if (!tail || tail.pos < 1 - 0.34) {
          t.items.push({ itemId: it.itemId, pos: it.pos - 1, mesh: it.mesh })
          return true
        }
        return false
      }
    }
    // 仓库
    for (const t of this.buildings) {
      if (t.type !== 'Storage') continue
      if (t.center.distanceTo(exit) < 2.2) { t.store[it.itemId] = (t.store[it.itemId] || 0) + 1; return true }
    }
    // 机器
    for (const t of this.buildings) {
      if (t.type === 'Smelter' || t.type === 'Assembler') {
        if (t.center.distanceTo(exit) < 2.2) {
          const need = Object.keys(t.recipe.in).map(Number)
          const isFuel = t.type === 'Smelter' && it.itemId === 6 // 煤 = 冶炼炉燃料
          if ((need.includes(it.itemId) || isFuel) && (t.input[it.itemId] || 0) < BUF_CAP) {
            t.input[it.itemId] = (t.input[it.itemId] || 0) + 1
            return true
          }
          return false
        }
      }
    }
    return false
  }

  // 冶炼炉自动换配方：进什么矿冶炼什么（手动选过配方的不覆盖）
  autoRecipe(b) {
    if (b.type !== 'Smelter' || b.manual) return
    for (const r of RECIPES.smelt) {
      if (Object.keys(r.in).every(id => (b.input[id] || 0) > 0) || Object.keys(r.in).map(Number).some(id => (b.input[id] || 0) > 0)) {
        if (b.recipe.id !== r.id && !b.replicating) b.recipe = r
        return
      }
    }
  }

  stats() {
    const storages = {}
    let beltItems = 0
    const machines = { Miner: 0, Smelter: 0, Assembler: 0, Storage: 0, Belt: 0, WindTurbine: 0, PowerPylon: 0 }
    for (const b of this.buildings) {
      machines[b.type]++
      if (b.type === 'Storage') for (const [id, n] of Object.entries(b.store)) storages[id] = (storages[id] || 0) + n
      if (b.type === 'Belt') beltItems += b.items?.length || 0
    }
    return { storages, beltItems, machines, produced: this.produced, power: this.power || { supply: 0, demand: 0, ratio: 1 } }
  }
}

// ---------- 科技 & 升级（DSP 式：矩阵作研究材料，重复升级加全局倍率） ----------
// cost: 研究总消耗（随时间从仓库逐步扣除）；time: 研究秒数
export const TECHS = [
  { id: 't_power', name: '风力发电', desc: '解锁 🌀 风力发电站（供电 2 单位）', cost: { 16: 10 }, time: 30, unlocks: 'WindTurbine' },
  { id: 't_pylon', name: '电力感应塔', desc: '解锁 ⚡ 感应塔（半径 6 内机器 ×1.5）', cost: { 16: 20 }, time: 45, requires: 't_power', unlocks: 'PowerPylon' },
  { id: 't_redmatrix', name: '能量矩阵', desc: '解锁 🔴 红糖配方（制造台）', cost: { 16: 30 }, time: 60, unlocks: 'recipe:a4' },
]

// 每级 cost = base × 2^level；effect = 全局倍率每级增量（乘法）
export const UPGRADES = [
  { id: 'u_mine', name: '采矿效率', desc: '采矿机速度 +30%/级', max: 6, base: { 16: 20 }, multKey: 'mine', per: 1.3 },
  { id: 'u_belt', name: '高速物流', desc: '传送带速度 +30%/级', max: 6, base: { 16: 15 }, multKey: 'belt', per: 1.3 },
  { id: 'u_smelt', name: '高速冶炼', desc: '冶炼炉速度 +25%/级', max: 6, base: { 17: 10 }, multKey: 'smelt', per: 1.25 },
  { id: 'u_assemble', name: '高速制造', desc: '制造台速度 +25%/级', max: 6, base: { 17: 15 }, multKey: 'assemble', per: 1.25 },
  { id: 'u_mecha', name: '机甲引擎', desc: '移动速度 +15%/级', max: 6, base: { 16: 10 }, multKey: 'mecha', per: 1.15 },
]

// 科技/升级的成本随等级缩放
export function costFor(entry, level = 0) {
  const f = entry.base && UPGRADES.includes(entry) ? Math.pow(2, level) : 1
  const out = {}
  for (const [id, n] of Object.entries(entry.cost || entry.base)) out[id] = Math.ceil(n * f)
  return out
}
