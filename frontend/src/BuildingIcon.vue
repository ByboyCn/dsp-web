<script setup>
// Q 版 3D 等距建筑图标（原创手绘）：三面着色 + 地面阴影，viewBox 64x64
const props = defineProps({ type: { type: String, required: true }, size: { type: Number, default: 22 } })

const SHADOW = '<ellipse cx="32" cy="56" rx="20" ry="6" fill="#000" opacity=".28"/>'

// 等距立方体：以 (cx, cy) 为顶面中心，w=半宽 h=高
function iso(cx, cy, w, top, left, right, h) {
  return `<g stroke="#1c2026" stroke-width="1.2" stroke-linejoin="round">
    <path d="M${cx} ${cy} L${cx + w} ${cy + w * 0.5} L${cx} ${cy + w} L${cx - w} ${cy + w * 0.5} Z" fill="${top}"/>
    <path d="M${cx - w} ${cy + w * 0.5} L${cx} ${cy + w} L${cx} ${cy + w + h} L${cx - w} ${cy + w * 0.5 + h} Z" fill="${left}"/>
    <path d="M${cx + w} ${cy + w * 0.5} L${cx} ${cy + w} L${cx} ${cy + w + h} L${cx + w} ${cy + w * 0.5 + h} Z" fill="${right}"/></g>`
}

const ICONS = {
  // 采矿机：黄色机身 + 前伸钻头 + 顶部探灯
  Miner: SHADOW + iso(32, 22, 15, '#e8c568', '#c8a24a', '#96762e', 16)
    + `<path d="M47 40 L58 46 L47 52 Z" fill="#9aa4ae" stroke="#1c2026" stroke-width="1.2"/>
       <circle cx="32" cy="34" r="3" fill="#fff"/><circle cx="33" cy="34" r="1.6" fill="#222"/>
       <rect x="26" y="30" width="12" height="3" rx="1.5" fill="#8a6a2a"/>
       <circle cx="32" cy="22" r="3.4" fill="#ffe066" stroke="#96762e"/>`,
  // 冶炼炉：红色炉体 + 左面炉口火光 + 顶部烟囱
  Smelter: SHADOW + iso(32, 18, 15, '#f07070', '#d84848', '#a83030', 20)
    + `<path d="M32 40 L32 54 L22 49 L22 43 Z" fill="#ff7830"/>
       <path d="M32 40 L32 54 L42 49 L42 43 Z" fill="#c84a10"/>
       <rect x="40" y="8" width="7" height="10" rx="1.5" fill="#8a4b28" stroke="#1c2026" stroke-width="1.2"/>
       <circle cx="43.5" cy="8" r="3.4" fill="#c8b8a8" opacity=".85"/>`,
  // 制造台：蓝色机身 + 顶部白色操作台 + 黄色齿轮
  Assembler: SHADOW + iso(32, 24, 15, '#6a94e8', '#5680e0', '#3a5ab0', 12)
    + iso(32, 16, 8, '#eef2f6', '#c8ccd4', '#98a0aa', 6)
    + `<circle cx="46" cy="24" r="5" fill="#e0a03a" stroke="#9a6a1a" stroke-width="1.5"/><circle cx="46" cy="24" r="2" fill="#9a6a1a"/>`,
  // 传送带：两条立体带段 + 黄色箭头
  Belt: SHADOW
    + `<g stroke="#1c2026" stroke-width="1.2">
       <path d="M10 34 L26 26 L42 34 L26 42 Z" fill="#4a505a"/>
       <path d="M10 34 L26 42 L26 48 L10 40 Z" fill="#2c3138"/>
       <path d="M26 42 L42 34 L42 40 L26 48 Z" fill="#22262c"/>
       <path d="M30 40 L46 32 L62 40 L46 48 Z" fill="#4a505a"/>
       <path d="M30 40 L46 48 L46 54 L30 46 Z" fill="#2c3138"/>
       <path d="M46 48 L62 40 L62 46 L46 54 Z" fill="#22262c"/></g>
       <path d="M34 30 L40 27 L46 30 L40 33 Z" fill="#ffd54a"/>`,
  // 仓库：紫色高桶 + 浅色盖
  Storage: SHADOW + iso(32, 14, 16, '#b49ae0', '#8a6ac0', '#5e4890', 26)
    + `<path d="M32 30 L44 36 L32 42 L20 36 Z" fill="#c8b0e8" stroke="#1c2026" stroke-width="1"/>
       <rect x="42" y="10" width="4" height="2" fill="none"/><circle cx="32" cy="14" r="2.6" fill="#e8dcff"/>`,
  // 风力发电站：底座 + 白杆 + 三叶风轮
  WindTurbine: SHADOW + iso(32, 42, 10, '#eef2f6', '#c8ccd4', '#98a0aa', 6)
    + `<rect x="30" y="24" width="4" height="20" rx="1.5" fill="#d8e4ee" stroke="#8a96a4" stroke-width="1"/>
       <g stroke="#e8f4ff" stroke-width="3.4" stroke-linecap="round">
       <path d="M32 22 L32 8"/><path d="M32 22 L44 29"/><path d="M32 22 L20 29"/></g>
       <circle cx="32" cy="22" r="3" fill="#9ad0ff" stroke="#5a8ab0" stroke-width="1.4"/>`,
  // 电力感应塔：灰杆 + 黄色发光球
  PowerPylon: SHADOW + iso(32, 46, 9, '#c8ccd4', '#8a8f98', '#5c646e', 5)
    + `<rect x="30" y="26" width="4" height="22" rx="1.5" fill="#8a8f98" stroke="#5c646e" stroke-width="1"/>
       <circle cx="32" cy="20" r="7" fill="#ffe066" stroke="#9a8a2a" stroke-width="1.6"/>
       <circle cx="29.6" cy="17.6" r="2.2" fill="#fffbe0"/>`,
  // 电力配电站：灰色高塔 + 黄色横臂 + 顶灯
  Substation: SHADOW + iso(32, 48, 9, '#c8ccd4', '#8a8f98', '#5c646e', 5)
    + `<rect x="29.5" y="18" width="5" height="30" rx="1.5" fill="#8a8f98" stroke="#5c646e" stroke-width="1"/>
       <rect x="18" y="26" width="28" height="4.4" rx="2" fill="#ffd54a" stroke="#9a8a2a" stroke-width="1.2"/>
       <circle cx="32" cy="14" r="5.6" fill="#ffd54a" stroke="#9a8a2a" stroke-width="1.6"/>
       <circle cx="30" cy="12" r="1.8" fill="#fffbe0"/>`,
  // 火力发电厂：深色厂房 + 烟囱冒烟 + 橙色窗
  Thermal: SHADOW + iso(32, 16, 17, '#8a7a68', '#7a6a58', '#54463a', 20)
    + `<rect x="46" y="10" width="8" height="26" rx="2" fill="#a05a2a" stroke="#1c2026" stroke-width="1.2"/>
       <circle cx="50" cy="9" r="4.4" fill="#c8b8a8" opacity=".8"/><circle cx="55" cy="5" r="3.2" fill="#d8ccc0" opacity=".6"/>
       <path d="M20 40 L28 36 L28 42 L20 46 Z" fill="#ff9848"/>
       <path d="M34 38 L42 34 L42 40 L34 44 Z" fill="#ffb878"/>`,
  // 太阳能板：蓝色斜板 + 支架底座
  Solar: SHADOW + iso(32, 46, 12, '#c8ccd4', '#98a0aa', '#6e747c', 4)
    + `<g transform="rotate(-16 32 30)" stroke="#1a3a6a" stroke-width="1.4">
       <rect x="13" y="20" width="38" height="19" rx="3" fill="#2a5a9a"/>
       <path d="M23 20 V39 M33 20 V39 M43 20 V39 M13 29.5 H51" stroke="#6ab0e8" stroke-width="2"/></g>
       <rect x="29" y="46" width="6" height="6" fill="#8a8f98" stroke="#5c646e" stroke-width="1"/>`,
}
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 64 64" style="vertical-align:middle" v-html="ICONS[type] || ''"></svg>
</template>
