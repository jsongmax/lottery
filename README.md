# 婚礼与活动幸运抽奖系统 (Interactive Event Lottery)

🎉 一款基于 React 和 Go 编写的现场互动抽奖全栈应用程序。
它专为婚礼、年会和各种线下活动所设计，提供精美的角色飞舞大屏动画、手机扫码秒级参与、防作弊内定系统以及通过 WebSocket 保证的抽奖结果跨端实时毫秒级同步。

## ✨ 特性 (Features)

- **大屏实时互动动画**：极具动感的聚光灯与随机弹跳头像动画。
- **无需登录的快捷参与**：通过扫描独属二维码或者访问特定公开链接填写基本信息和自定义头像一秒上墙。
- **WebSocket 实时广播推流**：后台点击开奖后，结果全站多大屏同步，不产生延迟偏差。
- **完备的后台控制台**：
  - 可同时管理多个独立的抽奖活动节点。
  - 活动内随时启停、编辑奖项、查看实时统计。
  - 单独在每个活动中控制、删除不慎报名的乱入人员，查看详细的中奖名单。
  - 提供隐藏的管理员强制内定功能。
- **免数据库运维**：使用极其轻量的嵌入式 SQLite 引擎，部署无需复杂的中间件环境。

---

## 🛠️ 技术栈 (Tech Stack)

### 前端 (Frontend)
- **核心框架**：React 18 (基于 Vite 构建)
- **路由控制**：React Router DOM
- **网络请求**：Axios
- **样式方案**：原生精调的沉浸式层叠 CSS (Glassmorphism & Micro-animations)
- **图标系统**：Lucide React

### 后端 (Backend)
- **核心语言**：Go (Golang)
- **Web 引擎**：Gin Framework
- **ORM & 存储**：GORM + SQLite
- **全双工通讯**：Gorilla WebSocket

---

## 📂 代码结构 (Code Structure)

本项目由前后端分离架构组成，但在部署时，后端程序可以直接作为一个独立的 Web Server 来一并托盘承载和提供前端打好包的生产级静态页面，真正做到极简部署。

```text
lottery/
├── backend/                # Go 语言后端服务目录
│   ├── database/           # SQLite 初始化和持久化连接逻辑
│   ├── handlers/           # HTTP API 控制层与 WebSocket 广播逻辑
│   ├── models/             # GORM 数据库结构定义与数据模型
│   ├── go.mod / go.sum     # Go 依赖列表缓存
│   └── main.go             # 程序主要入口点，挂载路由和前端静态文件服务
├── frontend/               # React 交互性前端源目录
│   ├── public/             
│   ├── src/
│   │   ├── assets/         
│   │   ├── pages/          # 视图组件 (Admin大盘, Lottery大屏, Register移动端)
│   │   ├── services/       # axios 统一封装与 API 声明
│   │   ├── App.jsx         # 前端全局路由分配
│   │   └── main.jsx        # React DOM 绑定层
│   ├── package.json        
│   └── vite.config.js      # Vite 构建处理参数
└── README.md               # 项目说明
```

---

## 🚀 安装与开发 (Development)

### 后端环境 (Go 1.20+)
```bash
cd backend
# 下载依赖包
go mod tidy
# 运行后端 API 服务器（默认端口为 8080）
go run main.go
```

### 前端环境 (Node.js 18+)
```bash
cd frontend
# 下载 NPM 依赖
npm install
# 在本地启动前端热更新服务器进行联调
npm run dev
```

---

## 📦 生产部署教程 (Deployment Guide)

想要将项目上云只需把其编译为二进制文件运行，无需额外安装庞大的 MySQL 或宝塔镜像环境。

### 第一步：构建生产级前端静态文件
进入 `frontend` 目录：
```bash
npm run build
```
执行完毕后，前端的所有文件将被打包并存放于 `frontend/dist/` 文件夹下。

### 第二步：编译后端程序为可执行文件
如果你正在 Windows 电脑上开发，但需要部署到 Linux ARM 服务器（比如某些轻量应用云服务器），由于 Go 的特性，你可以一键为其跨平台编译：
```bash
cd backend
# Windows 下设置环境变量并编译
$env:GOOS="linux"
$env:GOARCH="arm64" 
go build -o lottery-backend-arm64
```
（如果目标服务器是 x86 的 CentOS/Ubuntu，将 `arm64` 切换为 `amd64` 即可）。

### 第三步：正式上载发布
1. 将刚才生成的 `lottery-backend-arm64` 上传至你 Linux 服务器的任意目录（例如 `/opt/lottery/`）。
2. 在**该后端可执行程序的同一级目录**，将第一步的前端静态产物 `dist` 文件夹完整拷贝过去。
3. 赋予执行权限并后台守护运行：
```bash
chmod +x lottery-backend-arm64
./lottery-backend-arm64
# （推荐使用 systemd, nohup, 或 PM2 让其保活常驻）
```

> **✨小贴士**：得益于 `main.go` 中的设定，只要启动时能嗅探到身边的 `dist` 目录，我们的后端程序就会同时作为静态资源服，把 API 接口与 Web 界面通过单一端口 8080 一齐向外暴露！

### 第四步：Nginx 反向代理与 WebSocket 放行支持 (极度重要❗)
如果在前端外层挂了 Cloudflare 或为了加装 SSL 给 8080 包了一层 Nginx，那你必须显式地让 Nginx 放行 WebSocket 协议，因为本系统的大屏幕动画重度依赖长链接通讯。

请确认你的 Nginx 虚拟主机的配置文件包含如下类似片段：

```nginx
server {
    listen 443 ssl;
    server_name www.your-wedding-domain.com;
    
    # ...[你的各项 SSL 和 Root 证书配置略]...

    # 将 /api/ 请求透明转发给运行在 8080 的 Go 服务
    location /api/ {
        proxy_pass http://127.0.0.1:8080/api/;
        
        # ⚠️关键部分：必须增加这些 Header 开启 WebSocket 透传支持
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    
    # 让根目录 / 被后端的 8080 捕获（也可以在这里直接用 root 代理 dist）
    location / {
        proxy_pass http://127.0.0.1:8080/;
    }
}
```
配置重载之后（`systemctl restart nginx`），你的线上幸运抽奖系统就正式落成啦！祝活动圆满成功！🥂
