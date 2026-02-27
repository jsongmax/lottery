package handlers

import (
	"math/rand"
	"net/http"
	"time"

	"lottery-backend/database"
	"lottery-backend/models"

	"github.com/gin-gonic/gin"
)

// CreateEventRequest 创建活动请求
type CreateEventRequest struct {
	Name      string `json:"name" binding:"required"`
	PrizeName string `json:"prize_name" binding:"required"`
	// PrizeImage      string `json:"prize_image"` // Removed as per instruction
	PrizeCount      int    `json:"prize_count"`
	ThemeType       string `json:"theme_type"`
	MaxParticipants int    `json:"max_participants"`
}

// UpdateEventRequest 更新活动请求
type UpdateEventRequest struct {
	Name      *string `json:"name"`
	PrizeName *string `json:"prize_name"`
	// PrizeImage          *string `json:"prize_image"` // Removed as per instruction
	PrizeCount          *int    `json:"prize_count"`
	ThemeType           *string `json:"theme_type"`
	MaxParticipants     *int    `json:"max_participants"`
	RiggedParticipantID *uint   `json:"rigged_participant_id"`
}

// UpdateStatusRequest 变更状态请求
type UpdateStatusRequest struct {
	Status string `json:"status" binding:"required"`
}

// CreateEvent 创建抽奖活动
func CreateEvent(c *gin.Context) {
	var req CreateEventRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误: " + err.Error()})
		return
	}

	prizeCount := req.PrizeCount
	if prizeCount <= 0 {
		prizeCount = 1
	}

	themeType := req.ThemeType
	if themeType == "" {
		themeType = "wedding"
	}

	event := models.LotteryEvent{
		Name:            req.Name,
		PrizeName:       req.PrizeName,
		PrizeCount:      prizeCount,
		ThemeType:       themeType,
		MaxParticipants: req.MaxParticipants,
		Status:          "active",
	}

	database.DB.Create(&event)
	c.JSON(http.StatusCreated, event)
}

// GetEvents 获取所有活动
func GetEvents(c *gin.Context) {
	var events []models.LotteryEvent
	database.DB.Order("created_at DESC").Find(&events)
	c.JSON(http.StatusOK, events)
}

// GetEvent 获取单个活动（含已抽数量）
func GetEvent(c *gin.Context) {
	id := c.Param("id")
	var event models.LotteryEvent
	if err := database.DB.First(&event, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "活动不存在"})
		return
	}
	var drawnCount int64
	database.DB.Model(&models.LotteryResult{}).Where("event_id = ?", id).Count(&drawnCount)
	c.JSON(http.StatusOK, gin.H{
		"id":                    event.ID,
		"name":                  event.Name,
		"prize_name":            event.PrizeName,
		"prize_count":           event.PrizeCount,
		"theme_type":            event.ThemeType,
		"max_participants":      event.MaxParticipants,
		"rigged_participant_id": event.RiggedParticipantID,
		"status":                event.Status,
		"created_at":            event.CreatedAt,
		"updated_at":            event.UpdatedAt,
		"drawn_count":           drawnCount,
	})
}

// UpdateEvent 更新活动信息
func UpdateEvent(c *gin.Context) {
	id := c.Param("id")
	var event models.LotteryEvent
	if err := database.DB.First(&event, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "活动不存在"})
		return
	}

	var req UpdateEventRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误"})
		return
	}

	updates := map[string]interface{}{}
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.PrizeName != nil {
		updates["prize_name"] = *req.PrizeName
	}
	if req.ThemeType != nil {
		updates["theme_type"] = *req.ThemeType
	}
	if req.MaxParticipants != nil {
		updates["max_participants"] = *req.MaxParticipants
	}
	if req.PrizeCount != nil {
		pc := *req.PrizeCount
		if pc <= 0 {
			pc = 1
		}
		updates["prize_count"] = pc
	}
	if req.RiggedParticipantID != nil {
		if *req.RiggedParticipantID == 0 {
			updates["rigged_participant_id"] = nil // 清除内定
		} else {
			updates["rigged_participant_id"] = *req.RiggedParticipantID
		}
	}

	if len(updates) > 0 {
		database.DB.Model(&event).Updates(updates)
	}

	database.DB.First(&event, id)
	c.JSON(http.StatusOK, event)
}

// UpdateEventStatus 变更活动状态
func UpdateEventStatus(c *gin.Context) {
	id := c.Param("id")
	var event models.LotteryEvent
	if err := database.DB.First(&event, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "活动不存在"})
		return
	}

	var req UpdateStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误"})
		return
	}

	validStatuses := map[string]bool{"pending": true, "active": true, "completed": true}
	if !validStatuses[req.Status] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效状态，可选值: pending/active/completed"})
		return
	}

	database.DB.Model(&event).Update("status", req.Status)
	event.Status = req.Status
	c.JSON(http.StatusOK, event)
}

// DrawLottery 执行抽奖
func DrawLottery(c *gin.Context) {
	id := c.Param("id")
	var event models.LotteryEvent
	if err := database.DB.First(&event, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "活动不存在"})
		return
	}

	if event.Status != "active" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "活动未开启，请先将状态设为 active"})
		return
	}

	// 检查已抽数量是否已达上限
	prizeCount := event.PrizeCount
	if prizeCount <= 0 {
		prizeCount = 1
	}
	var drawnCount int64
	database.DB.Model(&models.LotteryResult{}).Where("event_id = ?", event.ID).Count(&drawnCount)
	if int(drawnCount) >= prizeCount {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":       "该活动奖品已全部抽完",
			"drawn_count": drawnCount,
			"prize_count": prizeCount,
		})
		return
	}

	// ---- 1. 排除本活动中已中奖的参与者 ----
	var alreadyWonIDs []uint
	database.DB.Model(&models.LotteryResult{}).
		Where("event_id = ?", event.ID).
		Pluck("participant_id", &alreadyWonIDs)

	alreadyWonSet := map[uint]bool{}
	for _, id := range alreadyWonIDs {
		alreadyWonSet[id] = true
	}

	var allParticipants []models.Participant
	database.DB.Where("event_id = ?", event.ID).Find(&allParticipants)

	// 过滤掉已中奖的
	var participants []models.Participant
	for _, p := range allParticipants {
		if !alreadyWonSet[p.ID] {
			participants = append(participants, p)
		}
	}

	if len(participants) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "所有参与者均已中奖，无法继续抽奖"})
		return
	}

	// 如果设置了最大参与人数限制，从剩余未中奖者中随机取子集
	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	if event.MaxParticipants > 0 && len(participants) > event.MaxParticipants {
		rng.Shuffle(len(participants), func(i, j int) {
			participants[i], participants[j] = participants[j], participants[i]
		})
		participants = participants[:event.MaxParticipants]
	}

	var winner models.Participant

	// ---- 2. 内定逻辑（随机位置） ----
	// 算法：剩余 remainingDraws 次抽奖中，内定者以 1/remainingDraws 概率在本次中奖
	// 这样可以保证内定者一定会在某次抽奖中出现，位置看起来随机
	remainingDraws := int64(prizeCount) - drawnCount

	if event.RiggedParticipantID != nil && *event.RiggedParticipantID > 0 {
		riggedID := *event.RiggedParticipantID

		// 内定者是否已中过奖
		riggedAlreadyWon := alreadyWonSet[riggedID]

		if !riggedAlreadyWon {
			// 检查内定者是否在可用参与者池中
			riggedInPool := false
			for _, p := range participants {
				if p.ID == riggedID {
					riggedInPool = true
					break
				}
			}

			if riggedInPool {
				// 以 1/remainingDraws 概率在本次出现（最后一次必然出现）
				if rng.Int63n(remainingDraws) == 0 {
					// 本次内定者中奖
					for _, p := range participants {
						if p.ID == riggedID {
							winner = p
							break
						}
					}
				} else {
					// 本次随机抽取（排除内定者）
					var normalPool []models.Participant
					for _, p := range participants {
						if p.ID != riggedID {
							normalPool = append(normalPool, p)
						}
					}
					if len(normalPool) > 0 {
						winner = normalPool[rng.Intn(len(normalPool))]
					} else {
						// 只剩内定者了，直接内定
						winner = participants[0]
					}
				}
			} else {
				// 内定者不在可用池（未报名或已被排除），随机抽
				winner = participants[rng.Intn(len(participants))]
			}
		} else {
			// 内定者已中过奖，本次纯随机
			winner = participants[rng.Intn(len(participants))]
		}
	} else {
		// 无内定，纯随机
		winner = participants[rng.Intn(len(participants))]
	}

	// 保存中奖结果
	result := models.LotteryResult{
		EventID:       event.ID,
		ParticipantID: winner.ID,
		Phone:         winner.Phone,
		DisplayName:   winner.DisplayName,
		Identity:      winner.Identity,
		Avatar:        winner.Avatar,
	}
	database.DB.Create(&result)

	// 更新 drawn_count 计数
	drawnCount++

	// 如果所有名额都已抽完，自动将活动状态变为 completed
	if int(drawnCount) >= prizeCount {
		event.Status = "completed"
		database.DB.Model(&event).Update("status", "completed")
	}

	// WebSocket 广播抽奖结果给所有连接的客户端
	WsHub.BroadcastDraw(event.ID, winner, drawnCount, prizeCount, event)

	c.JSON(http.StatusOK, gin.H{
		"winner":      winner,
		"result":      result,
		"event":       event,
		"drawn_count": drawnCount,
		"prize_count": int64(prizeCount),
	})
}

// DeleteEvent 删除活动
func DeleteEvent(c *gin.Context) {
	id := c.Param("id")

	// 同时删除关联的结果
	database.DB.Where("event_id = ?", id).Delete(&models.LotteryResult{})
	database.DB.Delete(&models.LotteryEvent{}, id)

	c.JSON(http.StatusOK, gin.H{"message": "删除成功"})
}

// GetEventResults 获取某活动的中奖记录
func GetEventResults(c *gin.Context) {
	id := c.Param("id")
	var results []models.LotteryResult
	database.DB.Where("event_id = ?", id).Order("created_at DESC").Find(&results)
	c.JSON(http.StatusOK, results)
}

// GetAllResults 获取所有中奖记录
func GetAllResults(c *gin.Context) {
	var results []models.LotteryResult
	database.DB.Preload("Event").Order("created_at DESC").Find(&results)
	c.JSON(http.StatusOK, results)
}

// GetEventPublic 公开活动信息（注册页面使用，无需密码）
func GetEventPublic(c *gin.Context) {
	id := c.Param("id")
	var event models.LotteryEvent
	if err := database.DB.First(&event, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "活动不存在"})
		return
	}
	// 只返回公开字段
	c.JSON(http.StatusOK, gin.H{
		"id":         event.ID,
		"name":       event.Name,
		"prize_name": event.PrizeName,
		"status":     event.Status,
	})
}
