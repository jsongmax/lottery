package models

import "time"

// Participant 参与者/宾客（绑定到具体抽奖活动）
type Participant struct {
	ID          uint      `json:"id" gorm:"primaryKey"`
	EventID     uint      `json:"event_id" gorm:"not null;index"`
	Phone       string    `json:"phone" gorm:"not null"`
	Avatar      string    `json:"avatar" gorm:"not null"`
	Identity    string    `json:"identity" gorm:"not null"`
	DisplayName string    `json:"display_name" gorm:"not null"` // 自动生成: 身份 *手机尾号
	CreatedAt   time.Time `json:"created_at"`
}

// LotteryEvent 抽奖活动
type LotteryEvent struct {
	ID                  uint      `json:"id" gorm:"primaryKey"`
	Name                string    `json:"name" gorm:"not null"`              // 活动名称
	PrizeName           string    `json:"prize_name"`                        // 奖品名称
	PrizeCount          int       `json:"prize_count" gorm:"default:1"`      // 奖品数量
	ThemeType           string    `json:"theme_type" gorm:"default:wedding"` // 主题类型 (wedding/annual/newyear/default)
	MaxParticipants     int       `json:"max_participants" gorm:"default:0"` // 最大参与人数限制（0表示不限）
	RiggedParticipantID *uint     `json:"rigged_participant_id"`             // 指定中奖参与者ID，可选
	Status              string    `json:"status" gorm:"default:active"`      // active/completed
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`
}

// LotteryResult 抽奖结果
type LotteryResult struct {
	ID            uint      `json:"id" gorm:"primaryKey"`
	EventID       uint      `json:"event_id" gorm:"not null"`
	ParticipantID uint      `json:"participant_id" gorm:"not null"`
	Phone         string    `json:"phone" gorm:"not null"`        // 冗余存储
	DisplayName   string    `json:"display_name" gorm:"not null"` // 冗余存储
	Identity      string    `json:"identity" gorm:"not null"`     // 冗余存储
	Avatar        string    `json:"avatar"`                       // 冗余存储
	CreatedAt     time.Time `json:"created_at"`

	Event       LotteryEvent `json:"event,omitempty" gorm:"foreignKey:EventID"`
	Participant Participant  `json:"participant,omitempty" gorm:"foreignKey:ParticipantID"`
}

// ValidIdentities 婚礼来宾身份选项
var ValidIdentities = []string{
	"新郎好友",
	"新娘好友",
	"伴郎",
	"伴娘",
	"新郎家属",
	"新娘家属",
	"新郎同事",
	"新娘同事",
	"新郎同学",
	"新娘同学",
	"领导",
	"其他来宾",
}

// SystemSetting 系统设置表
type SystemSetting struct {
	Key   string `json:"key" gorm:"primaryKey"`
	Value string `json:"value" gorm:"not null"`
}
