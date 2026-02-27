package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

// Hub 管理所有 WebSocket 连接
type Hub struct {
	mu      sync.RWMutex
	clients map[*websocket.Conn]bool
}

// WsHub 全局 WebSocket 连接池
var WsHub = &Hub{
	clients: make(map[*websocket.Conn]bool),
}

func (h *Hub) register(conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.clients[conn] = true
	log.Printf("WebSocket 客户端已连接，当前连接数: %d", len(h.clients))
}

func (h *Hub) unregister(conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if _, ok := h.clients[conn]; ok {
		delete(h.clients, conn)
		conn.Close()
		log.Printf("WebSocket 客户端已断开，当前连接数: %d", len(h.clients))
	}
}

// Broadcast 向所有连接的客户端广播消息
func (h *Hub) Broadcast(msg []byte) {
	h.mu.Lock()
	defer h.mu.Unlock()
	for conn := range h.clients {
		if err := conn.WriteMessage(websocket.TextMessage, msg); err != nil {
			log.Println("WebSocket 发送失败，移除连接:", err)
			conn.Close()
			delete(h.clients, conn)
		}
	}
}

// BroadcastDraw 广播抽奖结果
func (h *Hub) BroadcastDraw(eventID uint, winner interface{}, drawnCount int64, prizeCount int, event interface{}) {
	msg, err := json.Marshal(map[string]interface{}{
		"type":        "draw",
		"event_id":    eventID,
		"winner":      winner,
		"drawn_count": drawnCount,
		"prize_count": prizeCount,
		"event":       event,
	})
	if err != nil {
		log.Println("WebSocket 序列化失败:", err)
		return
	}
	h.Broadcast(msg)
}

// HandleWebSocket 处理 WebSocket 连接
func HandleWebSocket(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Println("WebSocket 升级失败:", err)
		return
	}

	WsHub.register(conn)
	defer WsHub.unregister(conn)

	// 设置 pong 处理器，收到 pong 时刷新读取截止时间
	conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	conn.SetPongHandler(func(string) error {
		conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	// 读取客户端消息（主要为 ping 心跳）
	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			break
		}

		// 解析客户端 ping
		var data map[string]interface{}
		if json.Unmarshal(msg, &data) == nil {
			if data["type"] == "ping" {
				pong, _ := json.Marshal(map[string]string{"type": "pong"})
				if err := conn.WriteMessage(websocket.TextMessage, pong); err != nil {
					break
				}
				conn.SetReadDeadline(time.Now().Add(60 * time.Second))
			}
		}
	}
}
