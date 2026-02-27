package handlers

import (
	"fmt"
	"net/http"
	"regexp"
	"strconv"

	"lottery-backend/database"
	"lottery-backend/models"

	"github.com/gin-gonic/gin"
)

// RegisterRequest 宾客注册请求
type RegisterRequest struct {
	EventID  uint   `json:"event_id" binding:"required"`
	Phone    string `json:"phone" binding:"required"`
	Avatar   string `json:"avatar" binding:"required"`
	Identity string `json:"identity" binding:"required"`
}

// RegisterParticipant 宾客扫码注册（绑定到指定活动）
func RegisterParticipant(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误: " + err.Error()})
		return
	}

	// 验证活动是否存在且为 active 或 pending
	var event models.LotteryEvent
	if err := database.DB.First(&event, req.EventID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "抽奖活动不存在"})
		return
	}
	if event.Status == "completed" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "该抽奖活动已结束，不再接受报名"})
		return
	}

	// 验证手机号格式
	phoneRegex := regexp.MustCompile(`^1[3-9]\d{9}$`)
	if !phoneRegex.MatchString(req.Phone) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "手机号格式不正确"})
		return
	}

	// 验证身份是否合法
	valid := false
	for _, id := range models.ValidIdentities {
		if id == req.Identity {
			valid = true
			break
		}
	}
	if !valid {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的身份选择"})
		return
	}

	// 检查同一活动内是否已经报名
	var existing models.Participant
	if err := database.DB.Where("event_id = ? AND phone = ?", req.EventID, req.Phone).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "您已报名过该活动"})
		return
	}

	// 生成显示名称: 身份 *尾号四位
	tail := req.Phone
	if len(tail) >= 4 {
		tail = tail[len(tail)-4:]
	}
	displayName := fmt.Sprintf("%s *%s", req.Identity, tail)

	participant := models.Participant{
		EventID:     req.EventID,
		Phone:       req.Phone,
		Avatar:      req.Avatar,
		Identity:    req.Identity,
		DisplayName: displayName,
	}

	if err := database.DB.Create(&participant).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "注册失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"participant": participant,
		"event":       event,
	})
}

// GetParticipants 获取参与者列表（可按 event_id 过滤）
func GetParticipants(c *gin.Context) {
	var participants []models.Participant
	query := database.DB.Order("created_at DESC")

	if eventIDStr := c.Query("event_id"); eventIDStr != "" {
		if eventID, err := strconv.Atoi(eventIDStr); err == nil {
			query = query.Where("event_id = ?", eventID)
		}
	}

	query.Find(&participants)
	c.JSON(http.StatusOK, participants)
}

// GetEventParticipantsPublic 获取活动下公开的参与者列表供大屏显示（隐藏了手机号以防泄露）
func GetEventParticipantsPublic(c *gin.Context) {
	id := c.Param("id")
	var participants []models.Participant
	database.DB.Where("event_id = ?", id).Order("created_at DESC").Find(&participants)

	// 清空敏感数据
	for i := range participants {
		participants[i].Phone = ""
	}

	c.JSON(http.StatusOK, participants)
}

// GetParticipant 获取单个参与者
func GetParticipant(c *gin.Context) {
	id := c.Param("id")
	var participant models.Participant
	if err := database.DB.First(&participant, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "参与者不存在"})
		return
	}
	c.JSON(http.StatusOK, participant)
}

// DeleteParticipant 删除参与者
func DeleteParticipant(c *gin.Context) {
	id := c.Param("id")
	if err := database.DB.Delete(&models.Participant{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "删除失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "删除成功"})
}

// GetIdentities 获取可用身份列表
func GetIdentities(c *gin.Context) {
	c.JSON(http.StatusOK, models.ValidIdentities)
}
