<script setup>
// Q 版建筑图标：纯手绘 SVG（原创），viewBox 64x64
const props = defineProps({ type: { type: String, required: true }, size: { type: Number, default: 22 } })

const ICONS = {
  // 采矿机：黄色方身 + 钻头 + 眼睛
  Miner: `<rect x="10" y="22" width="36" height="26" rx="6" fill="#c8a24a" stroke="#8a6a2a" stroke-width="2"/>
      <path d="M46 30 L58 38 L46 46 Z" fill="#9aa4ae" stroke="#5c646e" stroke-width="2"/>
      <circle cx="22" cy="32" r="4" fill="#fff"/><circle cx="23" cy="32" r="2" fill="#222"/>
      <circle cx="34" cy="32" r="4" fill="#fff"/><circle cx="35" cy="32" r="2" fill="#222"/>
      <rect x="24" y="40" width="14" height="3" rx="1.5" fill="#8a6a2a"/>
      <circle cx="54" cy="14" r="3" fill="#fff" opacity=".9"/>`,
  // 冶炼炉：红色圆炉 + 炉口火光 + 烟囱
  Smelter: `<rect x="40" y="10" width="8" height="16" rx="2" fill="#8a4b28" stroke="#5c3418" stroke-width="1.5"/>
      <path d="M12 50 L12 26 Q12 16 30 16 Q48 16 48 26 L48 50 Z" fill="#e05656" stroke="#8a2a2a" stroke-width="2"/>
      <path d="M20 50 Q20 40 30 40 Q40 40 40 50 Z" fill="#ff7830" stroke="#c84a10" stroke-width="2"/>
      <path d="M24 44 Q30 40 36 44" stroke="#ffd54a" stroke-width="3" fill="none" stroke-linecap="round"/>
      <circle cx="30" cy="26" r="4" fill="#fff"/><circle cx="31" cy="26" r="2" fill="#222"/>`,
  // 制造台：蓝方身 + 机械臂
  Assembler: `<rect x="12" y="34" width="34" height="18" rx="5" fill="#5680e0" stroke="#2a4a9a" stroke-width="2"/>
      <rect x="16" y="28" width="26" height="8" rx="3" fill="#dfe4ea" stroke="#8a9098" stroke-width="1.5"/>
      <path d="M40 30 L50 20" stroke="#8a9098" stroke-width="5" stroke-linecap="round"/>
      <circle cx="52" cy="17" r="5" fill="#ffd54a" stroke="#9a8a2a" stroke-width="1.5"/>
      <circle cx="22" cy="43" r="3.4" fill="#fff"/><circle cx="23" cy="43" r="1.8" fill="#222"/>
      <circle cx="32" cy="43" r="3.4" fill="#fff"/><circle cx="33" cy="43" r="1.8" fill="#222"/>`,
  // 传送带：带面 + 黄色箭头
  Belt: `<rect x="8" y="26" width="48" height="14" rx="6" fill="#3a3f48" stroke="#22262c" stroke-width="2"/>
      <circle cx="14" cy="33" r="5" fill="#22262c"/><circle cx="32" cy="33" r="5" fill="#22262c"/><circle cx="50" cy="33" r="5" fill="#22262c"/>
      <path d="M26 20 L38 20 L38 15 L48 22 L38 29 L38 24 L26 24 Z" fill="#ffd54a" stroke="#9a8a2a" stroke-width="1.5"/>`,
  // 仓库：紫色圆桶 + 盖子
  Storage: `<rect x="14" y="24" width="36" height="28" rx="8" fill="#8a6ac0" stroke="#4a3a7a" stroke-width="2"/>
      <rect x="11" y="18" width="42" height="8" rx="4" fill="#a88ad8" stroke="#4a3a7a" stroke-width="2"/>
      <rect x="20" y="34" width="24" height="4" rx="2" fill="#c8b0e8"/>
      <circle cx="26" cy="44" r="2.4" fill="#e8dcff"/><circle cx="38" cy="44" r="2.4" fill="#e8dcff"/>`,
  // 风力发电站：杆 + 三叶风车
  WindTurbine: `<rect x="29" y="26" width="6" height="30" rx="2" fill="#d8e4ee" stroke="#8a96a4" stroke-width="1.5"/>
      <circle cx="32" cy="24" r="4" fill="#9ad0ff" stroke="#5a8ab0" stroke-width="1.5"/>
      <path d="M32 24 L32 6 M32 24 L47 32 M32 24 L17 32" stroke="#e8f4ff" stroke-width="4" stroke-linecap="round"/>
      <circle cx="32" cy="24" r="3" fill="#5a8ab0"/>`,
  // 电力感应塔：塔杆 + 黄色球
  PowerPylon: `<rect x="29" y="20" width="6" height="36" rx="2" fill="#8a8f98" stroke="#5c646e" stroke-width="1.5"/>
      <rect x="20" y="34" width="24" height="4" rx="2" fill="#6e747c"/>
      <circle cx="32" cy="16" r="7" fill="#ffe066" stroke="#9a8a2a" stroke-width="2"/>
      <circle cx="30" cy="14" r="2" fill="#fffbe0"/>`,
  // 电力配电站：高塔 + 横臂黄灯
  Substation: `<rect x="29" y="16" width="7" height="42" rx="2" fill="#8a8f98" stroke="#5c646e" stroke-width="1.5"/>
      <rect x="16" y="26" width="33" height="5" rx="2.5" fill="#ffd54a" stroke="#9a8a2a" stroke-width="1.5"/>
      <circle cx="32" cy="12" r="6" fill="#ffd54a" stroke="#9a8a2a" stroke-width="1.5"/>
      <circle cx="30" cy="10" r="1.8" fill="#fffbe0"/>`,
  // 火力发电厂：厂房 + 烟囱冒烟
  ThermalPowerPlant: `<rect x="10" y="32" width="34" height="22" rx="3" fill="#7a6a58" stroke="#4a3a2a" stroke-width="2"/>
      <rect x="42" y="14" width="10" height="40" rx="3" fill="#a05a2a" stroke="#5c3418" stroke-width="2"/>
      <circle cx="47" cy="12" r="4" fill="#c8b8a8" opacity=".8"/><circle cx="51" cy="6" r="3" fill="#d8ccc0" opacity=".6"/>
      <rect x="15" y="38" width="10" height="8" rx="1.5" fill="#ff9848"/><rect x="29" y="38" width="10" height="8" rx="1.5" fill="#ffb878"/>`,
  // 太阳能板：斜板 + 支架
  SolarPanel: `<g transform="rotate(-14 32 34)"><rect x="12" y="22" width="40" height="22" rx="3" fill="#2a5a9a" stroke="#1a3a6a" stroke-width="2"/>
      <path d="M22 22 V44 M32 22 V44 M42 22 V44 M12 33 H52" stroke="#6ab0e8" stroke-width="2"/></g>
      <rect x="28" y="50" width="8" height="8" fill="#8a8f98" stroke="#5c646e" stroke-width="1.5"/>
      <circle cx="52" cy="14" r="3" fill="#fff" opacity=".9"/>`,
}
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 64 64" style="vertical-align:middle" v-html="ICONS[type] || ''"></svg>
</template>
