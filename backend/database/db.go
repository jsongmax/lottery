package database

import (
	"lottery-backend/models"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

// DB 全局数据库实例
var DB *gorm.DB

// Init 初始化数据库连接并自动迁移表结构
func Init() error {
	var err error
	DB, err = gorm.Open(sqlite.Open("lottery.db"), &gorm.Config{})
	if err != nil {
		return err
	}

	// 兼容旧版：删除旧的 phone 全局唯一索引（旧版设计，现已改为 event_id+phone 联合唯一）
	// AutoMigrate 不会自动删除旧索引，需手动处理
	DB.Exec("DROP INDEX IF EXISTS idx_participants_phone")

	// 自动迁移表结构
	return DB.AutoMigrate(
		&models.Participant{},
		&models.LotteryEvent{},
		&models.LotteryResult{},
		&models.SystemSetting{},
	)
}
