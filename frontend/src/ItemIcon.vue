<script setup>
// Q 版物品图标：纯手绘 SVG（原创），viewBox 64x64
const props = defineProps({ id: { type: Number, required: true }, size: { type: Number, default: 20 } })

const SPARK = '<circle cx="50" cy="14" r="3" fill="#fff" opacity=".9"/><circle cx="46" cy="20" r="1.6" fill="#fff" opacity=".6"/>'

const ICONS = {
  // 铁矿：棕色圆胖岩石 + 铁色斑点
  1: `<defs><radialGradient id="g1" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#a07a54"/><stop offset="1" stop-color="#63492f"/></radialGradient></defs>
      <path d="M14 44 Q10 26 22 18 Q34 10 46 20 Q56 28 52 42 Q48 54 32 54 Q18 54 14 44Z" fill="url(#g1)" stroke="#4a3826" stroke-width="2"/>
      <circle cx="28" cy="34" r="3.4" fill="#c8b08c"/><circle cx="40" cy="30" r="2.6" fill="#d8c4a0"/><circle cx="36" cy="44" r="2.8" fill="#b89870"/>${SPARK}`,
  // 铜矿：橙铜色矿石
  2: `<defs><radialGradient id="g2" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#e88a48"/><stop offset="1" stop-color="#8a4a22"/></radialGradient></defs>
      <path d="M15 43 Q12 26 24 18 Q36 10 47 20 Q56 29 51 43 Q46 54 31 54 Q18 54 15 43Z" fill="url(#g2)" stroke="#5c3418" stroke-width="2"/>
      <path d="M24 30 L36 26 M30 40 L42 36" stroke="#ffb878" stroke-width="3.4" stroke-linecap="round"/>${SPARK}`,
  // 石矿：灰色圆石
  3: `<defs><radialGradient id="g3" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#b8bcc4"/><stop offset="1" stop-color="#6e747c"/></radialGradient></defs>
      <path d="M13 42 Q11 27 23 19 Q35 11 46 20 Q55 28 51 41 Q47 53 32 54 Q16 54 13 42Z" fill="url(#g3)" stroke="#4c5258" stroke-width="2"/>
      <path d="M20 38 Q28 32 36 36" stroke="#8a9098" stroke-width="3" fill="none" stroke-linecap="round"/>${SPARK}`,
  // 硅矿：蓝色水晶簇
  4: `<g stroke="#2a5a74" stroke-width="2" stroke-linejoin="round">
      <path d="M20 52 L14 30 L22 16 L28 34 Z" fill="#9ad4ec"/>
      <path d="M32 54 L26 24 L36 10 L44 28 Z" fill="#c4ecf8"/>
      <path d="M46 52 L42 34 L52 24 L54 42 Z" fill="#7ab8d8"/></g>
      <path d="M36 14 L38 26" stroke="#fff" stroke-width="2.4" opacity=".8" stroke-linecap="round"/>${SPARK}`,
  // 钛矿：银白金属矿
  5: `<defs><radialGradient id="g5" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#dce4ec"/><stop offset="1" stop-color="#8a96a4"/></radialGradient></defs>
      <path d="M14 43 Q11 27 23 19 Q35 11 46 20 Q55 29 51 42 Q47 54 32 54 Q17 54 14 43Z" fill="url(#g5)" stroke="#5c646e" stroke-width="2"/>
      <path d="M22 34 L34 28 M30 44 L44 38" stroke="#f0f5fa" stroke-width="3" stroke-linecap="round"/>${SPARK}`,
  // 铁块：银色圆角锭
  11: `<defs><linearGradient id="g11" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d8dce2"/><stop offset="1" stop-color="#8a9098"/></linearGradient></defs>
      <path d="M12 44 L20 26 L48 26 L54 44 Z" fill="url(#g11)" stroke="#5c646e" stroke-width="2" stroke-linejoin="round"/>
      <path d="M20 26 L48 26" stroke="#f2f5f8" stroke-width="3" stroke-linecap="round"/><circle cx="52" cy="16" r="3" fill="#fff" opacity=".9"/>`,
  // 铜块：橙色圆角锭
  12: `<defs><linearGradient id="g12" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0a868"/><stop offset="1" stop-color="#b05a24"/></linearGradient></defs>
      <path d="M12 44 L20 26 L48 26 L54 44 Z" fill="url(#g12)" stroke="#703818" stroke-width="2" stroke-linejoin="round"/>
      <path d="M20 26 L48 26" stroke="#ffd0a0" stroke-width="3" stroke-linecap="round"/><circle cx="52" cy="16" r="3" fill="#fff" opacity=".9"/>`,
  // 齿轮
  13: `<g transform="translate(32 36)">
      <g fill="#e0a03a"><path d="M-6-22 L6-22 L8-14 L-8-14Z M-6 22 L6 22 L8 14 L-8 14Z M-22-6 L-14-8 L-14 8 L-22 6Z M22-6 L14-8 L14 8 L22 6Z
      M-17-17 L-11-11 L-17-5 L-23-11Z M17-17 L11-11 L17-5 L23-11Z M-17 17 L-11 11 L-17 5 L-23 11Z M17 17 L11 11 L17 5 L23 11Z"/></g>
      <circle r="17" fill="#e0a03a" stroke="#9a6a1a" stroke-width="2"/><circle r="15" fill="none" stroke="#f5c868" stroke-width="3"/>
      <circle r="7" fill="#12161f" stroke="#9a6a1a" stroke-width="2"/></g><circle cx="54" cy="12" r="3" fill="#fff" opacity=".9"/>`,
  // 电路板
  14: `<rect x="12" y="18" width="40" height="30" rx="5" fill="#3e8a56" stroke="#28603c" stroke-width="2"/>
      <rect x="24" y="26" width="14" height="12" rx="2" fill="#1c242c" stroke="#0e141a" stroke-width="1.5"/>
      <path d="M16 24 H22 M16 30 H20 M16 36 H22 M44 24 H38 M44 30 H40 M44 36 H38 M26 42 V46 M32 42 V46 M38 42 V46" stroke="#ffd54a" stroke-width="2"/>
      <circle cx="52" cy="14" r="3" fill="#fff" opacity=".9"/>`,
  // 石材
  15: `<defs><linearGradient id="g15" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c8ccd2"/><stop offset="1" stop-color="#848a92"/></linearGradient></defs>
      <rect x="14" y="22" width="36" height="24" rx="6" fill="url(#g15)" stroke="#5c646e" stroke-width="2"/>
      <path d="M20 32 H30 M34 38 H44" stroke="#a8aeb6" stroke-width="3" stroke-linecap="round"/><circle cx="52" cy="16" r="3" fill="#fff" opacity=".9"/>`,
  // 磁铁：蓝银马蹄形
  18: `<path d="M20 48 L20 30 Q20 16 32 16 Q44 16 44 30 L44 48" fill="none" stroke="#7fb2e0" stroke-width="11" stroke-linecap="butt"/>
      <path d="M20 48 L20 30 Q20 16 32 16 Q44 16 44 30 L44 48" fill="none" stroke="#b8dcf5" stroke-width="4" stroke-linecap="butt"/>
      <rect x="15" y="46" width="10" height="7" fill="#c85050"/><rect x="39" y="46" width="10" height="7" fill="#c85050"/>${SPARK}`,
  // 电磁矩阵：蓝色发光方糖
  16: `<defs><radialGradient id="g16" cx=".4" cy=".35" r=".9"><stop offset="0" stop-color="#bfe0ff"/><stop offset="1" stop-color="#3a72d8"/></radialGradient></defs>
      <rect x="16" y="16" width="32" height="32" rx="7" fill="url(#g16)" stroke="#2a4a9a" stroke-width="2" transform="rotate(8 32 32)"/>
      <path d="M24 28 L34 24 M24 36 L32 33" stroke="#eaf4ff" stroke-width="3" stroke-linecap="round"/>
      <circle cx="49" cy="15" r="3.4" fill="#cfe8ff"/>`,
  // 能量矩阵：红色发光方糖
  17: `<defs><radialGradient id="g17" cx=".4" cy=".35" r=".9"><stop offset="0" stop-color="#ffcaba"/><stop offset="1" stop-color="#d83a3a"/></radialGradient></defs>
      <rect x="16" y="16" width="32" height="32" rx="7" fill="url(#g17)" stroke="#9a2a2a" stroke-width="2" transform="rotate(-7 32 32)"/>
      <path d="M24 28 L34 24 M24 36 L32 33" stroke="#ffe8e0" stroke-width="3" stroke-linecap="round"/>
      <circle cx="49" cy="15" r="3.4" fill="#ffd8cf"/>`,
  // 煤：黑色圆石
  6: `<defs><radialGradient id="g6" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#5a5f66"/><stop offset="1" stop-color="#26292e"/></radialGradient></defs>
      <path d="M14 42 Q12 27 24 19 Q36 11 46 20 Q55 28 51 41 Q47 53 32 54 Q16 54 14 42Z" fill="url(#g6)" stroke="#141618" stroke-width="2"/>
      <circle cx="30" cy="34" r="3" fill="#767c84"/><circle cx="40" cy="42" r="2.4" fill="#767c84"/>${SPARK}`,
  // 电力配电站：黄顶双臂塔
  28: `<g stroke="#5c646e" stroke-width="2"><rect x="28" y="18" width="8" height="34" rx="2" fill="#8a8f98"/></g>
      <rect x="18" y="26" width="28" height="6" rx="2" fill="#ffd54a" stroke="#9a8a2a" stroke-width="1.5"/>
      <circle cx="32" cy="16" r="5" fill="#ffe066" stroke="#9a8a2a" stroke-width="1.5"/>
      <circle cx="52" cy="12" r="3" fill="#fff" opacity=".9"/>`,
  // 火力发电厂：厂房 + 烟囱
  29: `<rect x="10" y="30" width="34" height="22" rx="3" fill="#7a6a58" stroke="#4a3a2a" stroke-width="2"/>
      <rect x="42" y="12" width="10" height="40" rx="3" fill="#a05a2a" stroke="#5c3418" stroke-width="2"/>
      <path d="M48 20 Q52 16 48 12" stroke="#c8b8a8" stroke-width="3" fill="none" stroke-linecap="round"/>
      <rect x="15" y="36" width="10" height="8" rx="1.5" fill="#ff9848"/><rect x="29" y="36" width="10" height="8" rx="1.5" fill="#ffb878"/>`,
  // 太阳能板：斜置蓝色光伏
  30: `<g transform="rotate(-14 32 34)"><rect x="12" y="22" width="40" height="22" rx="3" fill="#2a5a9a" stroke="#1a3a6a" stroke-width="2"/>
      <path d="M22 22 V44 M32 22 V44 M42 22 V44 M12 33 H52" stroke="#6ab0e8" stroke-width="2"/></g>
      <rect x="28" y="50" width="8" height="8" fill="#8a8f98" stroke="#5c646e" stroke-width="1.5"/>${SPARK}`,
}
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 64 64" style="vertical-align:middle" v-html="ICONS[id] || ''"></svg>
</template>
