package handlers

import (
	"net/http"

	"lottery-backend/database"
	"lottery-backend/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// DeleteAllParticipants 清空所有参与者
func DeleteAllParticipants(c *gin.Context) {
	if err := database.DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&models.Participant{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "清空失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "参与者已清空"})
}

// DeleteAllEvents 清空所有抽奖活动
func DeleteAllEvents(c *gin.Context) {
	// 先清空所有中奖记录（外键关联）
	database.DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&models.LotteryResult{})

	if err := database.DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&models.LotteryEvent{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "清空失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "抽奖活动已清空"})
}

// DeleteAllResults 清空所有中奖记录
func DeleteAllResults(c *gin.Context) {
	if err := database.DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&models.LotteryResult{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "清空失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "中奖记录已清空"})
}
