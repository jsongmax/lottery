package main

import (
	"log"
	"net/http"
	"os"
	"path/filepath"

	"lottery-backend/database"
	"lottery-backend/handlers"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	// 初始化数据库
	if err := database.Init(); err != nil {
		log.Fatal("数据库初始化失败: ", err)
	}

	r := gin.Default()

	// CORS 配置（允许前端跨域访问）
	r.Use(cors.New(cors.Config{
		AllowAllOrigins: true,
		AllowMethods:    []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:    []string{"Origin", "Content-Type", "Authorization", "X-Admin-Password"},
	}))

	api := r.Group("/api")
	{
		// ===== 公开接口（无需密码）=====
		// 系统设置
		api.GET("/settings", handlers.GetSettings)

		// 身份选项
		api.GET("/identities", handlers.GetIdentities)

		// 宾客注册（宾客扫码使用，无需密码）
		api.POST("/participants", handlers.RegisterParticipant)

		// 获取活动信息（用于注册页面展示活动名称）
		api.GET("/events/:id/public", handlers.GetEventPublic)

		// 获取活动公开的参与者头像和名称用来大屏渲染（无需密码）
		api.GET("/events/:id/participants", handlers.GetEventParticipantsPublic)

		// 二维码（img 标签直接请求，无法带 Authorization 头，放公开区）
		api.GET("/qrcode", handlers.GenerateQRCode)

		// 活动列表（只读，供大屏首页自动跳转使用，无需密码）
		api.GET("/events", handlers.GetEvents)
		// 单个活动信息（只读，供大屏页加载使用，无需密码）
		api.GET("/events/:id", handlers.GetEvent)

		// WebSocket（实时推送抽奖动画，无需密码）
		api.GET("/ws", handlers.HandleWebSocket)

		// ===== 管理接口（需要密码）=====
		admin := api.Group("/")
		admin.Use(handlers.AdminAuthMiddleware())
		{
			// 密码验证
			admin.POST("/verify-password", handlers.VerifyPassword)
			// 参与者管理
			admin.DELETE("/participants/all", handlers.DeleteAllParticipants)
			admin.GET("/participants", handlers.GetParticipants)
			admin.GET("/participants/:id", handlers.GetParticipant)
			admin.DELETE("/participants/:id", handlers.DeleteParticipant)

			// 抽奖活动
			admin.DELETE("/events/all", handlers.DeleteAllEvents)
			admin.POST("/events", handlers.CreateEvent)
			admin.PUT("/events/:id", handlers.UpdateEvent)
			admin.PUT("/events/:id/status", handlers.UpdateEventStatus)
			admin.POST("/events/:id/draw", handlers.DrawLottery)
			admin.DELETE("/events/:id", handlers.DeleteEvent)

			// 抽奖结果
			admin.DELETE("/results/all", handlers.DeleteAllResults)
			admin.GET("/events/:id/results", handlers.GetEventResults)
			admin.GET("/results", handlers.GetAllResults)

			// 系统设置
			admin.PUT("/settings", handlers.UpdateSettings)
		}
	}

	// ===== 前端静态文件服务 =====
	// dist 目录默认在可执行文件同级的 dist 文件夹下
	exePath, _ := os.Executable()
	distPath := filepath.Join(filepath.Dir(exePath), "dist")
	if _, err := os.Stat(distPath); err == nil {
		r.Static("/assets", filepath.Join(distPath, "assets"))
		r.StaticFile("/vite.svg", filepath.Join(distPath, "vite.svg"))

		// 所有未匹配路由返回 index.html（支持 SPA 前端路由）
		r.NoRoute(func(c *gin.Context) {
			c.File(filepath.Join(distPath, "index.html"))
		})
		log.Println("前端静态文件服务已启用，目录:", distPath)
	} else {
		log.Println("未找到前端 dist 目录:", distPath, "，仅启动 API 服务")
		r.NoRoute(func(c *gin.Context) {
			c.JSON(http.StatusNotFound, gin.H{"error": "页面未找到"})
		})
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Println("抽奖后端服务启动在 :" + port)
	r.Run(":" + port)
}
