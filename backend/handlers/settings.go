package handlers

import (
	"net/http"

	"lottery-backend/database"
	"lottery-backend/models"

	"github.com/gin-gonic/gin"
)

// GetSettings 获取所有系统设置（公开）
func GetSettings(c *gin.Context) {
	var settings []models.SystemSetting
	database.DB.Find(&settings)

	data := make(map[string]string)
	for _, s := range settings {
		// 公开接口隐藏敏感设置
		if s.Key == "admin_password" {
			continue
		}
		data[s.Key] = s.Value
	}

	c.JSON(http.StatusOK, data)
}

// UpdateSettings 更新系统设置（仅限管理员）
func UpdateSettings(c *gin.Context) {
	var req map[string]string
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误: " + err.Error()})
		return
	}

	for k, v := range req {
		setting := models.SystemSetting{Key: k, Value: v}
		database.DB.Save(&setting)
	}

	c.JSON(http.StatusOK, gin.H{"message": "保存成功"})
}
