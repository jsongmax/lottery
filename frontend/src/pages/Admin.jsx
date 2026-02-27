import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Play, Square, Trophy, Users, RefreshCw, Lock, LogOut, QrCode, Search, Check, Settings } from 'lucide-react';
import {
    getEvents, createEvent, updateEvent, updateEventStatus, deleteEvent, deleteAllEvents,
    getParticipants, deleteParticipant, deleteAllParticipants,
    getAllResults, deleteAllResults,
    verifyAdminPassword, getQRCodeUrl, getSettings, updateSettings
} from '../services/api';
import './Admin.css';

// ====== 登录页组件 ======
function LoginPage({ onLogin }) {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await verifyAdminPassword(password);
            localStorage.setItem('admin_password', password);
            onLogin();
        } catch {
            setError('密码错误，请重试');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-card">
                <div className="login-icon"><Lock size={40} /></div>
                <h1>抽奖管理后台</h1>
                <form onSubmit={handleLogin} className="login-form">
                    <input
                        type="password"
                        placeholder="请输入管理密码"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoFocus
                    />
                    {error && <div className="login-error">{error}</div>}
                    <button type="submit" disabled={loading}>
                        {loading ? '验证中...' : '进入管理后台'}
                    </button>
                </form>
                <p className="login-hint">默认密码：admin123（登录后可在「系统设置」中修改密码）</p>
            </div>
        </div>
    );
}

// ====== QR码弹窗 ======
function QRModal({ event, onClose, systemDomain }) {
    const baseDomain = systemDomain || window.location.origin;
    const registerUrl = `${baseDomain}/register?event_id=${event.id}`;
    const qrUrl = getQRCodeUrl(registerUrl);
    return (
        <div className="qr-overlay" onClick={onClose}>
            <div className="qr-card" onClick={e => e.stopPropagation()}>
                <h3>📱 {event.name} — 扫码报名</h3>
                <img src={qrUrl} alt="QR Code" className="qr-image" />
                <p className="qr-url">{registerUrl}</p>
                <button className="qr-close-btn" onClick={onClose}>关闭</button>
            </div>
        </div>
    );
}

// ====== 内定设置弹窗 ======
function RiggedModal({ events, onClose }) {
    const [selectedEventId, setSelectedEventId] = useState('');
    const [participants, setParticipants] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredParticipants, setFilteredParticipants] = useState([]);
    const [selectedParticipant, setSelectedParticipant] = useState(null);
    const [currentRigged, setCurrentRigged] = useState(null);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);

    // 加载选中活动的参与者
    useEffect(() => {
        if (!selectedEventId) {
            setParticipants([]);
            setFilteredParticipants([]);
            setSelectedParticipant(null);
            setCurrentRigged(null);
            return;
        }
        getParticipants(selectedEventId).then(res => {
            const ps = res.data || [];
            setParticipants(ps);
            setFilteredParticipants(ps);
            // 找出当前内定
            const ev = events.find(e => String(e.id) === String(selectedEventId));
            if (ev && ev.rigged_participant_id) {
                const rigged = ps.find(p => p.id === ev.rigged_participant_id);
                setCurrentRigged(rigged || null);
            } else {
                setCurrentRigged(null);
            }
        }).catch(() => { });
    }, [selectedEventId]);

    // 搜索过滤（ID 或手机号）
    useEffect(() => {
        if (!searchQuery.trim()) {
            setFilteredParticipants(participants);
            return;
        }
        const q = searchQuery.trim().toLowerCase();
        setFilteredParticipants(participants.filter(p =>
            String(p.id) === q ||
            p.phone.includes(q) ||
            p.phone.slice(-4).includes(q)
        ));
    }, [searchQuery, participants]);

    const handleSave = async () => {
        if (!selectedEventId || !selectedParticipant) return;
        setSaving(true);
        try {
            await updateEvent(selectedEventId, { rigged_participant_id: selectedParticipant.id });
            setCurrentRigged(selectedParticipant);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 2000);
        } catch (err) {
            alert(err.response?.data?.error || '设置失败');
        } finally {
            setSaving(false);
        }
    };

    const handleClear = async () => {
        if (!selectedEventId) return;
        await updateEvent(selectedEventId, { rigged_participant_id: 0 });
        setCurrentRigged(null);
        setSelectedParticipant(null);
    };

    return (
        <div className="rigged-overlay" onClick={onClose}>
            <div className="rigged-modal" onClick={e => e.stopPropagation()}>
                <div className="rigged-header">
                    <h3>🤫 内定设置</h3>
                    <button className="rigged-close" onClick={onClose}>✕</button>
                </div>

                {/* 选择活动 */}
                <div className="rigged-section">
                    <label>选择抽奖活动</label>
                    <select value={selectedEventId} onChange={e => { setSelectedEventId(e.target.value); setSelectedParticipant(null); setSearchQuery(''); }}>
                        <option value="">-- 请选择 --</option>
                        {events.map(ev => {
                            const statusText = { pending: '待开始', active: '进行中', completed: '已完成' }[ev.status] || ev.status;
                            return (
                                <option key={ev.id} value={ev.id}>
                                    [{statusText}] {ev.name} - {ev.prize_name}
                                </option>
                            );
                        })}
                    </select>
                </div>

                {selectedEventId && (
                    <>
                        {/* 当前内定状态 */}
                        <div className="rigged-current">
                            {currentRigged ? (
                                <div className="rigged-current-info">
                                    <span>当前内定：</span>
                                    <span className="rigged-name">{currentRigged.avatar} {currentRigged.display_name}</span>
                                    <button className="rigged-clear-btn" onClick={handleClear}>清除</button>
                                </div>
                            ) : (
                                <span className="rigged-none">当前：随机抽取（未内定）</span>
                            )}
                        </div>

                        {/* 搜索参与者 */}
                        <div className="rigged-section">
                            <label>搜索参与者（手机号 / ID / 手机尾号）</label>
                            <div className="rigged-search">
                                <Search size={15} className="rigged-search-icon" />
                                <input
                                    placeholder="输入手机号、ID 或手机尾号..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* 参与者列表 */}
                        <div className="rigged-list">
                            {filteredParticipants.length === 0 && (
                                <div className="rigged-empty">
                                    {participants.length === 0 ? '该活动暂无报名参与者' : '未找到匹配的参与者'}
                                </div>
                            )}
                            {filteredParticipants.map(p => (
                                <div
                                    key={p.id}
                                    className={`rigged-item ${selectedParticipant?.id === p.id ? 'selected' : ''}`}
                                    onClick={() => setSelectedParticipant(p)}
                                >
                                    <span className="rigged-item-avatar">{p.avatar}</span>
                                    <div className="rigged-item-info">
                                        <span className="rigged-item-name">{p.display_name}</span>
                                        <span className="rigged-item-meta">ID: {p.id} · {p.identity}</span>
                                    </div>
                                    {selectedParticipant?.id === p.id && <Check size={16} className="rigged-check" />}
                                </div>
                            ))}
                        </div>

                        {/* 保存按钮 */}
                        <button
                            className={`rigged-save-btn ${success ? 'success' : ''}`}
                            onClick={handleSave}
                            disabled={!selectedParticipant || saving}
                        >
                            {success ? '✓ 设置成功！' : saving ? '保存中...' : `确认内定：${selectedParticipant ? selectedParticipant.display_name : '请先选择'}`}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

// ====== 活动参与者与中奖记录管理弹窗 ======
function EventDetailsModal({ event, onClose }) {
    const [subTab, setSubTab] = useState('participants'); // 'participants' | 'results'
    const [participants, setParticipants] = useState([]);
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);

    const loadData = useCallback(async () => {
        if (!event) return;
        setLoading(true);
        try {
            if (subTab === 'participants') {
                const res = await getParticipants(event.id);
                setParticipants(res.data || []);
            } else {
                const res = await getAllResults();
                const filtered = (res.data || []).filter(r => String(r.event_id) === String(event.id));
                setResults(filtered);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [event, subTab]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleDeleteParticipant = async (id) => {
        if (!window.confirm('确定删除此参与者？')) return;
        try {
            await deleteParticipant(id);
            loadData();
        } catch (e) {
            alert('删除失败');
        }
    };

    return (
        <div className="rigged-overlay" onClick={onClose}>
            <div className="rigged-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', width: '90%' }}>
                <div className="rigged-header">
                    <h3>【{event.name}】 详细数据</h3>
                    <button className="rigged-close" onClick={onClose}>✕</button>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '16px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
                    <button
                        style={{ padding: '8px 16px', background: subTab === 'participants' ? '#E2C88A' : 'transparent', color: subTab === 'participants' ? '#1A1229' : '#e2c88a', border: '1px solid #e2c88a', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                        onClick={() => setSubTab('participants')}
                    >
                        👥 参与者 ({subTab === 'participants' ? participants.length : '...'})
                    </button>
                    <button
                        style={{ padding: '8px 16px', background: subTab === 'results' ? '#E2C88A' : 'transparent', color: subTab === 'results' ? '#1A1229' : '#e2c88a', border: '1px solid #e2c88a', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                        onClick={() => setSubTab('results')}
                    >
                        🏆 中奖记录 ({subTab === 'results' ? results.length : '...'})
                    </button>
                </div>

                <div className="table-wrapper" style={{ maxHeight: '60vh', overflowY: 'auto', marginTop: '16px' }}>
                    {loading ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>加载中...</div>
                    ) : (
                        subTab === 'participants' ? (
                            <table>
                                <thead>
                                    <tr><th>ID</th><th>头像</th><th>显示名称</th><th>身份</th><th>手机号</th><th>注册时间</th><th>操作</th></tr>
                                </thead>
                                <tbody>
                                    {participants.length === 0 && <tr><td colSpan={7} className="empty">暂无参与者</td></tr>}
                                    {participants.map(p => (
                                        <tr key={p.id}>
                                            <td>{p.id}</td>
                                            <td className="avatar-cell">{p.avatar}</td>
                                            <td>{p.display_name}</td>
                                            <td>{p.identity}</td>
                                            <td>{p.phone}</td>
                                            <td>{new Date(p.created_at).toLocaleString('zh-CN')}</td>
                                            <td><button className="action-btn danger small" onClick={() => handleDeleteParticipant(p.id)}><Trash2 size={12} /></button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <table>
                                <thead>
                                    <tr><th>ID</th><th>头像</th><th>中奖者</th><th>身份</th><th>手机号</th><th>中奖时间</th></tr>
                                </thead>
                                <tbody>
                                    {results.length === 0 && <tr><td colSpan={6} className="empty">暂无中奖记录</td></tr>}
                                    {results.map(r => (
                                        <tr key={r.id}>
                                            <td>{r.id}</td>
                                            <td className="avatar-cell">{r.avatar}</td>
                                            <td>{r.display_name}</td>
                                            <td>{r.identity}</td>
                                            <td>{r.phone}</td>
                                            <td>{new Date(r.created_at).toLocaleString('zh-CN')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}
// ====== 主管理页面 ======
export default function Admin() {
    const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('admin_password'));
    const [tab, setTab] = useState('events');
    const [events, setEvents] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editingEvent, setEditingEvent] = useState(null);
    const [form, setForm] = useState({ name: '', prize_name: '', prize_count: 1, theme_type: 'wedding', max_participants: 0 });
    const [loading, setLoading] = useState(false);
    const [qrEvent, setQrEvent] = useState(null);
    const [selectedEventId, setSelectedEventId] = useState('');
    const [showRigged, setShowRigged] = useState(false);
    const [titleClickCount, setTitleClickCount] = useState(0);
    const [systemDomain, setSystemDomain] = useState('');
    const [domainSaving, setDomainSaving] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [showDetailsEvent, setShowDetailsEvent] = useState(null);

    const loadEvents = useCallback(async () => {
        try { const res = await getEvents(); setEvents(res.data || []); } catch (e) { }
    }, []);

    const loadSettings = useCallback(async () => {
        try { const res = await getSettings(); setSystemDomain(res.data.system_domain || ''); } catch (e) { }
    }, []);

    useEffect(() => {
        if (!isLoggedIn) return;
        loadEvents();
        loadSettings();
    }, [isLoggedIn]);

    // 标题连点3次触发内定面板
    const handleTitleClick = () => {
        const next = titleClickCount + 1;
        setTitleClickCount(next);
        if (next >= 3) {
            setShowRigged(true);
            setTitleClickCount(0);
        }
        setTimeout(() => setTitleClickCount(0), 2000);
    };

    const handleSaveSettings = async () => {
        setDomainSaving(true);
        try {
            const settingsData = { system_domain: systemDomain };
            if (newPassword.trim() !== '') {
                settingsData.admin_password = newPassword.trim();
            }

            await updateSettings(settingsData);

            // 下次继续请求若密码改了，更新本地缓存并清空输入框
            if (newPassword.trim() !== '') {
                localStorage.setItem('admin_password', newPassword.trim());
                setNewPassword('');
            }

            alert('系统设置保存成功！新的系统域名已应用到二维码链接');
        } catch (err) {
            alert('保存失败：' + (err.response?.data?.error || err.message));
        } finally {
            setDomainSaving(false);
        }
    };

    const handleClearEvents = async () => {
        if (window.confirm('警告：这会清空所有抽奖活动及其包含的参与者、中奖记录！确定要清空吗？')) {
            try {
                await deleteAllEvents();
                alert('所有抽奖活动已清空');
                loadEvents();
            } catch (err) {
                alert('清空失败');
            }
        }
    };



    const handleSubmitEvent = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const data = {
                ...form,
                prize_count: parseInt(form.prize_count) || 1,
                max_participants: parseInt(form.max_participants) || 0,
            };
            if (editingEvent) {
                await updateEvent(editingEvent.id, data);
            } else {
                await createEvent(data);
            }
            setShowForm(false);
            setEditingEvent(null);
            setForm({ name: '', prize_name: '', prize_count: 1, theme_type: 'wedding', max_participants: 0 });
            loadEvents();
        } catch (err) {
            alert(err.response?.data?.error || '操作失败');
        } finally {
            setLoading(false);
        }
    };

    const handleStatusChange = async (id, status) => {
        try { await updateEventStatus(id, status); loadEvents(); } catch (err) { alert(err.response?.data?.error || '操作失败'); }
    };

    const handleDeleteEvent = async (id) => {
        if (!window.confirm('确定删除此活动？关联的抽奖结果也会被删除。')) return;
        try { await deleteEvent(id); loadEvents(); } catch (e) { }
    };

    const openEditForm = (event) => {
        setEditingEvent(event);
        setForm({ name: event.name, prize_name: event.prize_name, prize_count: event.prize_count || 1, theme_type: event.theme_type || 'wedding', max_participants: event.max_participants || 0 });
        setShowForm(true);
    };

    const handleLogout = () => {
        localStorage.removeItem('admin_password');
        setIsLoggedIn(false);
    };

    const statusLabel = (s) => ({ pending: '待开始', active: '进行中', completed: '已完成' }[s] || s);
    const statusColor = (s) => ({ pending: '#999', active: '#E8786E', completed: '#7CB342' }[s] || '#999');

    if (!isLoggedIn) return <LoginPage onLogin={() => setIsLoggedIn(true)} />;

    return (
        <div className="admin-page">
            <div className="admin-header">
                {/* 标题连点3次触发内定面板（隐形入口） */}
                <h1 onClick={handleTitleClick} style={{ cursor: 'default', userSelect: 'none' }}>
                    🎊 抽奖管理后台
                </h1>
                <button className="logout-btn" onClick={handleLogout}><LogOut size={16} /> 退出</button>
            </div>

            <div className="admin-tabs">
                <button className={`tab-btn ${tab === 'events' ? 'active' : ''}`} onClick={() => { setTab('events'); loadEvents(); }}>
                    <Trophy size={16} /> 抽奖活动
                </button>
                <button className={`tab-btn ${tab === 'settings' ? 'active' : ''}`} onClick={() => { setTab('settings'); loadSettings(); }}>
                    <Settings size={16} /> 系统设置
                </button>
            </div>

            <div className="admin-content">

                {/* ===== 抽奖活动 ===== */}
                {tab === 'events' && (
                    <div className="admin-events">
                        <div className="section-header">
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button className="primary-btn" onClick={() => { setEditingEvent(null); setForm({ name: '', prize_name: '', prize_count: 1, max_participants: 0 }); setShowForm(true); }}>
                                    <Plus size={16} /> 创建抽奖活动
                                </button>
                                <button className="danger-btn" onClick={handleClearEvents}>
                                    <Trash2 size={16} /> 一键清空所有活动
                                </button>
                            </div>
                            <button className="icon-btn" onClick={loadEvents} title="刷新列表"><RefreshCw size={20} /></button>
                        </div>

                        {showForm && (
                            <form onSubmit={handleSubmitEvent} className="event-form">
                                <h3>{editingEvent ? '编辑活动' : '新建活动'}</h3>
                                <div className="form-row">
                                    <label>活动名称 *</label>
                                    <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="如：一等奖" />
                                </div>
                                <div className="form-row">
                                    <label>奖品名称 *</label>
                                    <input value={form.prize_name} onChange={e => setForm({ ...form, prize_name: e.target.value })} required placeholder="如：iPhone 16" />
                                </div>
                                <div className="form-row">
                                    <label>奖品数量（几个人中奖）</label>
                                    <input type="number" min="1" value={form.prize_count} onChange={e => setForm({ ...form, prize_count: e.target.value })} />
                                </div>
                                <div className="form-row">
                                    <label>活动主题</label>
                                    <select value={form.theme_type} onChange={e => setForm({ ...form, theme_type: e.target.value })}>
                                        <option value="wedding">粉金浪漫（婚礼）</option>
                                        <option value="annual">星辰大海（年会）</option>
                                        <option value="newyear">辞旧迎新（元旦新春）</option>
                                        <option value="default">简约高级（通用）</option>
                                    </select>
                                </div>

                                <div className="form-row">
                                    <label>最大参与人数（0=不限）</label>
                                    <input type="number" min="0" value={form.max_participants} onChange={e => setForm({ ...form, max_participants: e.target.value })} />
                                </div>
                                <div className="form-actions">
                                    <button type="button" className="cancel-btn" onClick={() => setShowForm(false)}>取消</button>
                                    <button type="submit" className="primary-btn" disabled={loading}>{loading ? '提交中...' : '保存'}</button>
                                </div>
                            </form>
                        )}

                        <div className="events-list">
                            {events.length === 0 && <div className="empty">暂无活动，点击"新建活动"创建</div>}
                            {events.map(event => (
                                <div key={event.id} className="event-card">
                                    <div className="event-info">
                                        <div className="event-title">
                                            <span className="event-name">{event.name}</span>
                                            <span className="status-badge" style={{ color: statusColor(event.status), borderColor: statusColor(event.status) }}>
                                                {statusLabel(event.status)}
                                            </span>
                                        </div>
                                        <div className="event-meta">
                                            🎁 {event.prize_name}
                                            {event.theme_type === 'annual' && <span> · 年会主题</span>}
                                            {event.theme_type === 'newyear' && <span> · 新春主题</span>}
                                            {event.theme_type === 'default' && <span> · 通用主题</span>}
                                            {event.theme_type === 'wedding' && <span> · 婚礼主题</span>}
                                            {event.prize_count > 1 && <span> · 共 {event.prize_count} 份</span>}
                                            {event.max_participants > 0 && <span> · 限 {event.max_participants} 人</span>}
                                            {event.rigged_participant_id > 0 && <span className="rigged-tag"> · 🤫</span>}
                                        </div>
                                    </div>
                                    <div className="event-actions">
                                        <button
                                            className="action-btn screen"
                                            onClick={() => window.open(`/lottery/${event.id}`, '_blank')}
                                            title="在新标签页打开大屏"
                                        >
                                            🖥 大屏
                                        </button>
                                        <button className="action-btn qr" onClick={() => setQrEvent(event)} title="生成报名二维码">
                                            <QrCode size={14} /> 二维码
                                        </button>
                                        <button className="action-btn" onClick={() => setShowDetailsEvent(event)} title="查看详情名单">
                                            <Users size={14} /> 数据详情
                                        </button>
                                        {event.status === 'pending' && (
                                            <button className="action-btn start" onClick={() => handleStatusChange(event.id, 'active')}><Play size={14} fill="currentColor" /> 开启</button>
                                        )}
                                        {event.status === 'active' && (
                                            <button className="action-btn stop" onClick={() => handleStatusChange(event.id, 'completed')}><Square size={14} fill="currentColor" /> 完成</button>
                                        )}
                                        {event.status === 'completed' && (
                                            <button className="action-btn start" onClick={() => handleStatusChange(event.id, 'active')}><Play size={14} fill="currentColor" /> 重启</button>
                                        )}
                                        <button className="action-btn edit" onClick={() => openEditForm(event)}>编辑</button>
                                        <button className="action-btn danger" onClick={() => handleDeleteEvent(event.id)}><Trash2 size={14} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}


                {/* ===== 系统设置 ===== */}
                {tab === 'settings' && (
                    <div className="settings-panel">
                        <div className="section-header">
                            <h2>系统设置</h2>
                        </div>
                        <div className="settings-card">
                            <div className="form-row">
                                <label>系统公共域名 (System Domain)</label>
                                <p className="setting-desc">部署到服务器时，请填写外网访问的公共域名，确保二维码能够正确指向手机报名页。若不填写，默认使用当前浏览器地址 (<span style={{ color: '#D4A574' }}>{window.location.origin}</span>)。</p>
                                <input
                                    type="text"
                                    value={systemDomain}
                                    onChange={e => setSystemDomain(e.target.value)}
                                    placeholder="如：http://www.mywedding.com"
                                />
                            </div>
                            <div className="form-row" style={{ marginTop: '20px' }}>
                                <label>管理员密码</label>
                                <p className="setting-desc">修改用于登录和管理该后台的密码，如果留空则表示不不修改。遗忘密码需重新删除数据库重建。</p>
                                <input
                                    type="text"
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    placeholder="输入新密码以便下次使用"
                                />
                            </div>
                            <button className="primary-btn" onClick={handleSaveSettings} disabled={domainSaving}>
                                {domainSaving ? '保存中...' : '保存修改'}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* QR码弹窗 */}
            {/* 各类弹窗 */}
            {qrEvent && <QRModal event={qrEvent} onClose={() => setQrEvent(null)} systemDomain={systemDomain} />}
            {showRigged && <RiggedModal events={events} onClose={() => { setShowRigged(false); loadEvents(); }} />}
            {showDetailsEvent && <EventDetailsModal event={showDetailsEvent} onClose={() => setShowDetailsEvent(null)} />}
        </div>
    );
}
