package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/skip2/go-qrcode"
)

// GenerateQRCode 生成注册页面二维码图片
func GenerateQRCode(c *gin.Context) {
	url := c.Query("url")
	if url == "" {
		url = "http://localhost:5173/register"
	}

	png, err := qrcode.Encode(url, qrcode.Medium, 256)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "生成二维码失败"})
		return
	}

	c.Data(http.StatusOK, "image/png", png)
}
