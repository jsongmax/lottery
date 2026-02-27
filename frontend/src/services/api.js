import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080/api';

// 从 localStorage 读取管理密码
const getAdminPassword = () => localStorage.getItem('admin_password') || '';

const api = axios.create({
    baseURL: API_BASE,
    timeout: 10000,
    headers: { 'Content-Type': 'application/json' },
});

// 管理接口专用实例（自动带密码头）
const adminApi = axios.create({
    baseURL: API_BASE,
    timeout: 10000,
    headers: { 'Content-Type': 'application/json' },
});

// 请求拦截器：自动注入管理密码
adminApi.interceptors.request.use((config) => {
    const pwd = getAdminPassword();
    if (pwd) config.headers['Authorization'] = `Bearer ${pwd}`;
    return config;
});

// ========== 公开接口（无需密码）==========

/** 宾客注册 — 必须传 event_id */
export const registerParticipant = (data) => api.post('/participants', data);

/** 获取活动公开信息（注册页使用） */
export const getEventPublic = (id) => api.get(`/events/${id}/public`);

/** 获取活动的公开参与者供大屏使用 */
export const getEventParticipantsPublic = (id) => api.get(`/events/${id}/participants`);

/** 获取身份列表 */
export const getIdentities = () => api.get('/identities');

// ========== 管理接口（需要密码）==========

/** 获取参与者列表，可根据活动ID过滤 */
export const getParticipants = (eventId) =>
    adminApi.get('/participants', { params: eventId ? { event_id: eventId } : {} });

/** 删除参与者 */
export const deleteParticipant = (id) => adminApi.delete(`/participants/${id}`);

/** 清空所有参与者 */
export const deleteAllParticipants = () => adminApi.delete('/participants/all');

/** 创建活动 */
export const createEvent = (data) => adminApi.post('/events', data);

/** 获取所有活动 */
export const getEvents = () => adminApi.get('/events');

/** 获取单个活动 */
export const getEvent = (id) => adminApi.get(`/events/${id}`);

/** 更新活动 */
export const updateEvent = (id, data) => adminApi.put(`/events/${id}`, data);

/** 更新活动状态 */
export const updateEventStatus = (id, status) => adminApi.put(`/events/${id}/status`, { status });

/** 执行抽奖 */
export const drawLottery = (id) => adminApi.post(`/events/${id}/draw`);

/** 删除活动 */
export const deleteEvent = (id) => adminApi.delete(`/events/${id}`);

/** 清空所有抽奖活动 */
export const deleteAllEvents = () => adminApi.delete('/events/all');

/** 获取某活动的中奖记录 */
export const getEventResults = (id) => adminApi.get(`/events/${id}/results`);

/** 获取所有中奖记录 */
export const getAllResults = () => adminApi.get('/results');

/** 清空所有中奖记录 */
export const deleteAllResults = () => adminApi.delete('/results/all');

// ====== QR码生成 ======
export const getQRCodeUrl = (url) => {
    return `${API_BASE}/qrcode?url=${encodeURIComponent(url)}`;
};

// ====== 系统设置 ======
export const getSettings = () => api.get('/settings');
export const updateSettings = (data) => adminApi.put('/settings', data);

/** 验证管理密码是否正确 */
export const verifyAdminPassword = (password) =>
    axios.post(`${API_BASE}/verify-password`, {}, {
        headers: { Authorization: `Bearer ${password}` },
    });

export default api;
