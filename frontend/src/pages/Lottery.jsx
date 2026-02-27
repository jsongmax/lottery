import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Trophy, Play, Pause, Heart, Sparkles, QrCode, AlertCircle } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { getEventParticipantsPublic, getEvent, drawLottery, getQRCodeUrl, getSettings } from '../services/api';
import './Lottery.css';

// --- 常量配置 ---
const STAGE_MIN_X = 10;
const STAGE_MAX_X = 90;
const STAGE_MIN_Y = 25;
const STAGE_MAX_Y = 92;
const MOVE_SPEED = 0.04;

const THEME_CONFIG = {
    wedding: {
        title: '遇见幸福 · 幸运时刻',
        subtitle: 'WEDDING CELEBRATION',
        footer: '一生一世 · 喜乐共享',
        winnerSubtitle: 'WINNER CELEBRATION',
        winnerMessage: '喜气盈门 · 幸运常伴',
    },
    annual: {
        title: '星辰大海 · 扬帆远航',
        subtitle: 'ANNUAL PARTY',
        footer: '凝心聚力 · 共创未来',
        winnerSubtitle: 'LUCKY WINNER',
        winnerMessage: '星光璀璨 · 鸿运当头',
    },
    newyear: {
        title: '辞旧迎新 · 好运连连',
        subtitle: 'HAPPY NEW YEAR',
        footer: '红红火火 · 财源广进',
        winnerSubtitle: 'NEW YEAR WINNER',
        winnerMessage: '福气满满 · 万事大吉',
    },
    default: {
        title: '幸运抽奖 · 惊喜不断',
        subtitle: 'LUCKY DRAW',
        footer: '好运降临 · 祝贺中奖',
        winnerSubtitle: 'CONGRATULATIONS',
        winnerMessage: '好运连连 · 心想事成',
    }
};

export default function Lottery() {
    const { eventId } = useParams();

    const [participants, setParticipants] = useState([]);
    const [currentEvent, setCurrentEvent] = useState(null);
    const [eventError, setEventError] = useState('');
    const [drawnCount, setDrawnCount] = useState(0);
    const [prizeCount, setPrizeCount] = useState(1);
    const [isDrawing, setIsDrawing] = useState(false);
    const [isStopping, setIsStopping] = useState(false);
    const [activeIndex, setActiveIndex] = useState(null);
    const [winner, setWinner] = useState(null);
    const [winnerData, setWinnerData] = useState(null);
    const [showQR, setShowQR] = useState(false);
    const [systemDomain, setSystemDomain] = useState('');
    const isAdmin = !!localStorage.getItem('admin_password');

    const requestRef = useRef();
    const spotlightTimerRef = useRef();
    const participantsRef = useRef([]);

    // 加载活动信息和该活动的参与者
    const loadData = useCallback(async () => {
        if (!eventId) {
            setEventError('缺少活动ID');
            return;
        }
        try {
            const [eRes, pRes, sRes] = await Promise.all([
                getEvent(eventId),
                getEventParticipantsPublic(eventId),
                getSettings().catch(() => ({ data: {} })), // 不阻塞主流程
            ]);

            const event = eRes.data;
            setCurrentEvent(event);
            setEventError('');
            // 同步已抽 / 总数
            setDrawnCount(event.drawn_count ?? 0);
            setPrizeCount(event.prize_count > 0 ? event.prize_count : 1);
            setSystemDomain(sRes.data.system_domain || '');

            const allParticipants = pRes.data || [];

            // 给每个参与者分配舞台坐标和速度
            setParticipants(prev => {
                const existingMap = {};
                prev.forEach(p => { existingMap[p.id] = p; });

                const staged = allParticipants.map(p => {
                    if (existingMap[p.id]) return existingMap[p.id]; // 保留已有的位置
                    return {
                        ...p,
                        x: STAGE_MIN_X + Math.random() * (STAGE_MAX_X - STAGE_MIN_X),
                        y: STAGE_MIN_Y + Math.random() * (STAGE_MAX_Y - STAGE_MIN_Y),
                        vx: (Math.random() - 0.5) * MOVE_SPEED * 2,
                        vy: (Math.random() - 0.5) * MOVE_SPEED * 2,
                    };
                });

                participantsRef.current = staged;
                return staged;
            });
        } catch (err) {
            setEventError('无法加载该抽奖活动，请确认链接是否正确');
        }
    }, [eventId]);

    useEffect(() => {
        loadData();
        const timer = setInterval(loadData, 3000); // 每3秒刷新一次，实时显示新参与者
        return () => clearInterval(timer);
    }, [loadData]);

    // --- WebSocket 实时抽奖同步 ---
    const wsRef = useRef(null);
    const reconnectTimer = useRef(null);
    const isDrawingRef = useRef(false);

    // 保持 isDrawing 状态同步到 ref
    useEffect(() => { isDrawingRef.current = isDrawing; }, [isDrawing]);

    useEffect(() => {
        const connectWs = () => {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/api/ws`;
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('WebSocket 已连接');
            };

            ws.onmessage = (evt) => {
                try {
                    const data = JSON.parse(evt.data);
                    if (data.type === 'draw' && String(data.event_id) === String(eventId)) {
                        // 如果本客户端已经在播放动画（admin 触发），跳过
                        if (isDrawingRef.current) return;

                        const winnerId = data.winner?.id || data.winner?.ID;
                        const winnerIdx = participantsRef.current.findIndex(p => p.id === winnerId);
                        const targetIdx = winnerIdx >= 0 ? winnerIdx : 0;

                        // 保存中奖数据
                        setWinnerData(data);
                        setDrawnCount(Number(data.drawn_count ?? 0));
                        setIsDrawing(true);
                        setWinner(null);

                        // 确保有参与者才跑动画，否则直接显示结果
                        if (participantsRef.current.length > 0) {
                            runSpotlightLoop(targetIdx);
                        } else {
                            setWinner(true);
                            setIsDrawing(false);
                            setIsStopping(false);
                        }
                    }
                } catch (e) {
                    // 忽略非 JSON 消息
                }
            };

            ws.onclose = () => {
                console.log('WebSocket 已断开，3秒后重连...');
                reconnectTimer.current = setTimeout(connectWs, 3000);
            };

            ws.onerror = () => {
                ws.close();
            };
        };

        connectWs();

        // 心跳：每 30 秒发送 ping
        const heartbeat = setInterval(() => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: 'ping' }));
            }
        }, 30000);

        return () => {
            clearInterval(heartbeat);
            clearTimeout(reconnectTimer.current);
            if (wsRef.current) {
                wsRef.current.onclose = null; // 防止触发重连
                wsRef.current.close();
            }
        };
    }, [eventId]);

    // --- 自由走动 ---
    const updatePositions = useCallback(() => {
        if (!isDrawing && !winner && !isStopping) {
            setParticipants(prev => prev.map(p => {
                let newX = p.x + p.vx;
                let newY = p.y + p.vy;
                let newVx = p.vx;
                let newVy = p.vy;
                if (newX < STAGE_MIN_X || newX > STAGE_MAX_X) newVx *= -1;
                if (newY < STAGE_MIN_Y || newY > STAGE_MAX_Y) newVy *= -1;
                if (Math.random() < 0.008) {
                    newVx = (Math.random() - 0.5) * MOVE_SPEED * 2;
                    newVy = (Math.random() - 0.5) * MOVE_SPEED * 2;
                }
                return {
                    ...p,
                    x: Math.max(STAGE_MIN_X, Math.min(STAGE_MAX_X, newX)),
                    y: Math.max(STAGE_MIN_Y, Math.min(STAGE_MAX_Y, newY)),
                    vx: newVx, vy: newVy,
                };
            }));
        }
        requestRef.current = requestAnimationFrame(updatePositions);
    }, [isDrawing, winner, isStopping]);

    useEffect(() => {
        requestRef.current = requestAnimationFrame(updatePositions);
        return () => cancelAnimationFrame(requestRef.current);
    }, [updatePositions]);

    // --- 抽奖逻辑 ---
    const startDraw = async () => {
        if (participants.length < 2) {
            alert('参与者不足，至少需要2人');
            return;
        }
        if (!currentEvent || currentEvent.status !== 'active') {
            alert('该活动未开启，请先在管理后台将活动状态设为"进行中"');
            return;
        }

        try {
            const res = await drawLottery(currentEvent.id);
            const winnerInfo = res.data.winner;
            setWinnerData(res.data);
            // 更新已抽数量
            const newDrawn = res.data.drawn_count ?? drawnCount + 1;
            setDrawnCount(Number(newDrawn));

            const winnerIndex = participantsRef.current.findIndex(p => p.id === winnerInfo.id);
            const targetIndex = winnerIndex >= 0 ? winnerIndex : 0;

            setIsDrawing(true);
            setWinner(null);

            if (participantsRef.current.length > 0) {
                runSpotlightLoop(targetIndex);
            } else {
                setWinner(true);
                setIsDrawing(false);
                setIsStopping(false);
            }
        } catch (err) {
            alert(err.response?.data?.error || '抽奖失败');
        }
    };

    // 抽奖动画核心（已通过 useCallback 包裹以避免依赖过期，但由于内部直接访问 refs，影响不大）
    const runSpotlightLoop = useCallback((targetIndex) => {
        let current = 0;
        let speed = 100;
        const total = participantsRef.current.length;

        const slowToTarget = (currentIdx, targetIdx, currentSpeed) => {
            let idx = currentIdx;
            let spd = currentSpeed;
            const slow = () => {
                setActiveIndex(idx % total);
                spd *= 1.25;
                if (idx % total === targetIdx && spd > 800) {
                    setTimeout(() => {
                        setWinner(true);
                        setIsDrawing(false);
                        setIsStopping(false);
                    }, 500);
                    return;
                }
                idx++;
                spotlightTimerRef.current = setTimeout(slow, Math.min(spd, 600));
            };
            slow();
        };

        const loop = () => {
            setActiveIndex(current % total);
            current++;
            speed *= 1.05;
            if (speed < 500) {
                spotlightTimerRef.current = setTimeout(loop, speed);
            } else {
                slowToTarget(current % total, targetIndex, speed);
            }
        };
        loop();
    }, []);

    const closeWinner = () => {
        setWinner(null);
        setActiveIndex(null);
        setWinnerData(null);
        loadData();
    };

    // 该活动的注册链接和 QR URL
    const baseDomain = systemDomain || window.location.origin;
    const registerUrl = `${baseDomain}/register?event_id=${eventId}`;

    // ===== 活动错误/不存在 =====
    if (eventError) {
        return (
            <div className="lottery-page" style={{ flexDirection: 'column', gap: 16 }}>
                <AlertCircle size={48} style={{ color: '#FDA4AF' }} />
                <p style={{ color: '#8B5E3C', fontSize: 20 }}>{eventError}</p>
                <p style={{ color: '#C4956A', fontSize: 14 }}>请从管理后台点击"打开大屏"按钮跳转</p>
            </div>
        );
    }

    const themeType = currentEvent?.theme_type || 'wedding';
    const tCfg = THEME_CONFIG[themeType] || THEME_CONFIG.wedding;

    return (
        <div className={`lottery-page theme-${themeType}`}>

            {/* 顶部标题 */}
            <div className="lottery-title">
                <div className="title-main">
                    <span className="title-flower">✿</span>
                    <h1>{tCfg.title}</h1>
                    <span className="title-flower">✿</span>
                </div>
                <div className="title-sub">
                    <div className="title-line"></div>
                    <p>{tCfg.subtitle}</p>
                    <div className="title-line"></div>
                </div>
                {currentEvent && (
                    <div className="event-badge">
                        <Trophy size={14} />
                        <span>{currentEvent.name} — 🎁 {currentEvent.prize_name}</span>
                    </div>
                )}
            </div>

            {/* 舞台 */}
            <div className="stage-container">
                <div className="stage-bg"></div>
                <div className="stage-floor">
                    <div className="floor-texture"></div>
                    <div className="floor-gradient"></div>
                </div>
                <div className="stage-decor left"></div>
                <div className="stage-decor right"></div>

                {/* 角色 */}
                {participants.map((p, index) => {
                    const scaleBase = 0.7 + ((p.y - STAGE_MIN_Y) / (STAGE_MAX_Y - STAGE_MIN_Y)) * 0.4;
                    return (
                        <div key={p.id} className="character"
                            style={{
                                left: `${p.x}%`, top: `${p.y}%`,
                                zIndex: Math.floor(p.y * 10) + (activeIndex === index ? 1000 : 0)
                            }}>
                            <div className="character-shadow"></div>
                            <div className={`character-body ${(!isDrawing && !winner && !isStopping) ? 'gentle-bounce' : ''}`}
                                style={{ transform: activeIndex === index ? 'scale(1.25)' : `scale(${scaleBase})` }}>
                                <div className={`character-avatar ${activeIndex === index ? 'highlighted' : ''}`}>{p.avatar}</div>
                                <div className={`character-name ${activeIndex === index ? 'highlighted' : ''}`}>{p.display_name}</div>
                            </div>
                        </div>
                    );
                })}

                {/* 聚光灯 */}
                {activeIndex !== null && participants[activeIndex] && (
                    <svg className="spotlight-svg">
                        <defs>
                            <radialGradient id="warmBeam" cx="50%" cy="50%" r="50%">
                                <stop offset="0%" stopColor="rgba(255, 243, 200, 0.6)" />
                                <stop offset="100%" stopColor="rgba(255, 243, 200, 0)" />
                            </radialGradient>
                        </defs>
                        <path
                            d={`M 50% -10 L ${participants[activeIndex].x - 8}% ${participants[activeIndex].y}% L ${participants[activeIndex].x + 8}% ${participants[activeIndex].y}% Z`}
                            fill="url(#warmBeam)" className="spotlight-beam"
                        />
                        <ellipse
                            cx={`${participants[activeIndex].x}%`} cy={`${participants[activeIndex].y}%`}
                            rx="60" ry="25" fill="rgba(255, 215, 0, 0.2)" className="spotlight-glow"
                        />
                    </svg>
                )}

                {/* 中奖弹窗 */}
                {winner && activeIndex !== null && participants[activeIndex] && (
                    <div className="winner-overlay">
                        <div className="winner-card">
                            <div className="winner-content">
                                <div className="winner-trophy"><Trophy size={48} /></div>
                                <h2>{tCfg.winnerMessage}</h2>
                                <p className="winner-subtitle">{tCfg.winnerSubtitle}</p>
                                <div className="winner-info">
                                    <div className="winner-avatar-big">{participants[activeIndex].avatar}</div>
                                    <div className="winner-name-big">{participants[activeIndex].display_name}</div>
                                    {winnerData && <div className="winner-prize">🎁 {winnerData.event.prize_name}</div>}
                                </div>
                                <button onClick={closeWinner} className="winner-close-btn">收下祝福</button>
                            </div>
                        </div>
                        <div className="hearts-container">
                            {[...Array(12)].map((_, i) => (
                                <Heart key={i} className="winner-heart"
                                    style={{
                                        left: `${Math.random() * 100}%`, top: '100%',
                                        color: i % 2 === 0 ? '#FDA4AF' : '#FCD34D',
                                        animationDelay: `${Math.random() * 3}s`,
                                        animationDuration: `${4 + Math.random() * 2}s`
                                    }}
                                    size={16 + Math.random() * 16} fill="currentColor"
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* 控制台 */}
            <div className="controls">
                <div className="controls-info">
                    <span className="participant-count">🎊 已报名 {participants.length} 人</span>
                    {prizeCount > 1 && (
                        <span className={`draw-progress ${drawnCount >= prizeCount ? 'done' : ''}`}>
                            {drawnCount >= prizeCount ? `🏆 全部抽完 ${prizeCount}/${prizeCount}` : `🎁 已抽 ${drawnCount} / 共 ${prizeCount} 个`}
                        </span>
                    )}
                </div>

                {!isAdmin ? (
                    <span style={{ color: '#C4956A', fontSize: '14px', opacity: 0.8 }}>
                        {isDrawing ? '🎁 正在抽奖中...' : '✨ 请等待主持人开始抽奖 ✨'}
                    </span>
                ) : !isDrawing && !isStopping ? (
                    drawnCount >= prizeCount ? (
                        <button className="btn-start btn-done" disabled>
                            <Trophy size={24} />
                            <span>已全部抽出 ({prizeCount}/{prizeCount})</span>
                        </button>
                    ) : (
                        <button onClick={startDraw} className="btn-start" disabled={participants.length < 2}>
                            <Play size={24} fill="currentColor" />
                            <span>{prizeCount > 1 ? `开启抽奖 (第${drawnCount + 1}个)` : '开启喜气'}</span>
                        </button>
                    )
                ) : (
                    <button className="btn-stop" disabled>
                        <Pause size={24} fill="currentColor" />
                        <span>{isStopping ? '定格中...' : '抽奖进行中...'}</span>
                    </button>
                )}

                <button onClick={() => setShowQR(!showQR)} className="btn-qr">
                    <QrCode size={24} />
                </button>
            </div>

            {/* QR 角落面板 — 固定在右上角，不虚化背景 */}
            {showQR && (
                <div className="qr-corner-panel">
                    <div className="qr-corner-header">
                        <span>扫码报名</span>
                        <button className="qr-corner-close" onClick={() => setShowQR(false)}>✕</button>
                    </div>
                    {currentEvent && <p className="qr-corner-event">{currentEvent.name} · {currentEvent.prize_name}</p>}
                    <img src={getQRCodeUrl(registerUrl)} alt="QR Code" className="qr-corner-img" />
                </div>
            )}

            {/* 底部 */}
            <div className="lottery-footer">
                <Sparkles size={14} /><span>✨{tCfg.footer}✨</span><Sparkles size={14} />
            </div>
        </div>
    );
}
