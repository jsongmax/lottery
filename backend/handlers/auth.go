package handlers

import (
	"lottery-backend/database"
	"lottery-backend/models"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
)

// AdminAuthMiddleware 管理接口密码验证中间件
// 密码默认从环境变量 ADMIN_PASSWORD 读取（兜底），优先从数据库读取 admin_password
func AdminAuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 1. 获取默认兜底密码
		password := os.Getenv("ADMIN_PASSWORD")
		if password == "" {
			password = "admin123"
		}

		// 2. 尝试从数据库获取自定义密码
		var setting models.SystemSetting
		if err := database.DB.Where("key = ?", "admin_password").First(&setting).Error; err == nil && setting.Value != "" {
			password = setting.Value
		}

		// 支持 Header: Authorization: Bearer <password>
		// 或 Header: X-Admin-Password: <password>
		token := c.GetHeader("Authorization")
		if len(token) > 7 && token[:7] == "Bearer " {
			token = token[7:]
		}
		if token == "" {
			token = c.GetHeader("X-Admin-Password")
		}

		if token != password {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "密码错误，无权限访问"})
			return
		}
		c.Next()
	}
}

// VerifyPassword 专用密码验证接口（经过 AdminAuthMiddleware 保护）
func VerifyPassword(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "密码验证通过"})
}
