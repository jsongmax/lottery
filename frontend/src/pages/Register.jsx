import React, { useState, useEffect } from 'react';
import { Heart, CheckCircle, Sparkles, AlertCircle } from 'lucide-react';
import { registerParticipant, getIdentities, getEventPublic } from '../services/api';
import './Register.css';

const AVATARS = ['😊', '🥰', '🌹', '🥂', '💍', '✨', '🧸', '🐰', '🍰', '🎈', '😎', '🥳', '💐', '🎀', '🦋'];
const randomAvatar = () => AVATARS[Math.floor(Math.random() * AVATARS.length)];

export default function Register() {
    const [phone, setPhone] = useState('');
    const [avatar, setAvatar] = useState(randomAvatar());
    const [identity, setIdentity] = useState('其他来宾');
    const [identities, setIdentities] = useState([]);
    const [eventInfo, setEventInfo] = useState(null);
    const [eventError, setEventError] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [displayName, setDisplayName] = useState('');

    // 从 URL 读取 event_id
    const params = new URLSearchParams(window.location.search);
    const eventId = params.get('event_id');

    useEffect(() => {
        // 加载身份列表
        getIdentities().then(res => setIdentities(res.data)).catch(() => { });

        // 加载活动公开信息
        if (eventId) {
            getEventPublic(eventId)
                .then(res => {
                    if (res.data.status === 'completed') {
                        setEventError('该抽奖活动已结束，不再接受报名');
                    } else {
                        setEventInfo(res.data);
                    }
                })
                .catch(() => setEventError('找不到该抽奖活动，请确认链接是否正确'));
        } else {
            setEventError('链接无效：缺少活动ID，请通过活动二维码扫码访问');
        }
    }, [eventId]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!phone) {
            setError('请输入手机号');
            return;
        }
        if (!/^1[3-9]\d{9}$/.test(phone)) {
            setError('请输入正确的手机号');
            return;
        }

        // 未选头像则随机兜底
        const finalAvatar = avatar || randomAvatar();
        // 未选身份则默认其他来宾
        const finalIdentity = identity || '其他来宾';

        setLoading(true);
        try {
            const res = await registerParticipant({
                event_id: parseInt(eventId),
                phone,
                avatar: finalAvatar,
                identity: finalIdentity,
            });
            setDisplayName(res.data.participant.display_name);
            setSubmitted(true);
        } catch (err) {
            const msg = err.response?.data?.error || '注册失败，请重试';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    // 活动链接无效
    if (eventError) {
        return (
            <div className="register-page">
                <div className="register-card">
                    <div className="error-icon"><AlertCircle size={56} /></div>
                    <h2 className="error-title">无法报名</h2>
                    <p className="error-msg">{eventError}</p>
                </div>
            </div>
        );
    }

    // 等待活动信息加载
    if (!eventInfo) {
        return (
            <div className="register-page">
                <div className="register-card">
                    <p style={{ textAlign: 'center', color: '#C4956A' }}>加载中...</p>
                </div>
            </div>
        );
    }

    // 报名成功
    if (submitted) {
        return (
            <div className="register-page">
                <div className="register-card success-card">
                    <div className="success-icon"><CheckCircle size={64} /></div>
                    <h2>报名成功！</h2>
                    <div className="success-info">
                        <span className="success-avatar">{avatar}</span>
                        <span className="success-name">{displayName}</span>
                    </div>
                    <div className="success-event">
                        <p>已报名：{eventInfo.name}</p>
                        <p className="success-prize">🎁 {eventInfo.prize_name}</p>
                    </div>
                    <p className="success-hint">请耐心等待抽奖环节，祝您好运！</p>
                    <a
                        href={`/lottery/${eventId}`}
                        style={{ display: 'inline-block', marginTop: '12px', padding: '10px 24px', background: 'linear-gradient(135deg, #e2c88a, #c9a84c)', color: '#1a1229', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', fontSize: '14px' }}
                    >
                        🖥 前往抽奖大屏
                    </a>
                    <div className="success-hearts">
                        {[...Array(6)].map((_, i) => (
                            <Heart key={i} className="floating-heart" style={{
                                left: `${15 + i * 14}%`,
                                animationDelay: `${i * 0.5}s`,
                                color: i % 2 === 0 ? '#FDA4AF' : '#FCD34D'
                            }} size={16} fill="currentColor" />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="register-page">
            <div className="register-card">
                <div className="register-header">
                    <Sparkles className="header-icon" size={20} />
                    <h1>婚礼幸运抽奖</h1>
                    <Sparkles className="header-icon" size={20} />
                </div>
                <p className="register-subtitle">WEDDING LUCKY DRAW</p>

                {/* 活动信息展示 */}
                <div className="event-info-banner">
                    <span className="event-info-name">📋 {eventInfo.name}</span>
                    <span className="event-info-prize">🎁 {eventInfo.prize_name}</span>
                </div>

                <form onSubmit={handleSubmit} className="register-form">
                    {/* 手机号 */}
                    <div className="form-group">
                        <label>手机号</label>
                        <input
                            type="tel"
                            placeholder="请输入您的手机号"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            maxLength={11}
                        />
                    </div>

                    {/* 身份选择 */}
                    <div className="form-group">
                        <label>您的身份</label>
                        <div className="identity-grid">
                            {identities.map((id) => (
                                <button
                                    key={id}
                                    type="button"
                                    className={`identity-btn ${identity === id ? 'active' : ''}`}
                                    onClick={() => setIdentity(id)}
                                >
                                    {id}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 头像选择 */}
                    <div className="form-group">
                        <label>选择头像</label>
                        <div className="avatar-grid">
                            {AVATARS.map((a) => (
                                <button
                                    key={a}
                                    type="button"
                                    className={`avatar-btn ${avatar === a ? 'active' : ''}`}
                                    onClick={() => setAvatar(a)}
                                >
                                    {a}
                                </button>
                            ))}
                        </div>
                    </div>

                    {error && <div className="form-error">{error}</div>}

                    <button type="submit" className="submit-btn" disabled={loading}>
                        <Heart size={18} fill="currentColor" />
                        {loading ? '提交中...' : '参与抽奖'}
                    </button>
                </form>
            </div>
        </div>
    );
}
