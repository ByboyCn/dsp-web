# DSP Web · 星球矿工

一个受《戴森球计划》启发的开源网页游戏原型：在一颗 3D 星球上开采无限矿脉、铺设传送带流水线、与好友在同一个房间联机。全部代码为本项目原创（TypeScript / Vue 3 / Three.js / C# / .NET），不包含任何原游戏资源。

> ⚠️ 本项目为同人学习性质的原型 Demo，与《戴森球计划》（Dyson Sphere Program / Youthcat Studio / Gamera Games）无关联；数值参数为社区公开的常见值，仅用于学习参考。

## 在线试玩

**https://dsp.game.byboy.vip**

## 功能

- 🪐 程序化 3D 星球（噪声地形 + 海洋 + 星空）
- 🤖 机甲机器人主角，多账号注册 / 登录 / 房间联机（150ms 状态同步）、自定义涂装染色
- 🏭 流水线：采矿机 → 传送带（点击两点自动铺带）→ 冶炼炉 / 制造台 → 仓库，物品可视化流动
- ⛏ 无限矿脉手动采集 + 配方系统（冶炼炉自动配方 / 手动锁定，制造台配方选择）
- DSP 式操作：数字键 1~5 建造、R 旋转、E 交互/采集、右键点击寻路、中键旋转相机

## 本地开发

```powershell
# 后端（.NET 10，端口 5099：2D 工厂 API + 多人账号/房间同步）
dotnet run --project backend

# 前端（Vite dev，代理 /api → 5099）
cd frontend
pnpm install
pnpm dev      # http://localhost:5173
```

> 后端同时托管 API 与多人同步；前端 `src/Planet3D.vue` 是 3D 游戏，`src/Factory.vue` 是早期的 2D 工厂原型（未挂路由，保留参考）。

## Docker 部署

```bash
docker compose up -d --build   # 后端 8080 托管 API + 前端静态文件，映射到宿主机 172.17.0.1:7790
```

生产环境由 Caddy 反向代理并自动签发 HTTPS 证书（通配域名 DNS-01）：

```caddyfile
# Caddyfile
dsp.game.byboy.vip {
    reverse_proxy 172.17.0.1:7790
}
```

## 项目结构

```
backend/    ASP.NET Core（.NET 10）：游戏 API + 多人账号/房间同步
frontend/   Vue 3 + Three.js + Vite：3D 星球、流水线建造、多人渲染
```

## License

MIT
