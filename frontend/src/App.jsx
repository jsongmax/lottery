import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Lottery from './pages/Lottery';
import Register from './pages/Register';
import Admin from './pages/Admin';
import { getEvents } from './services/api';

// 默认首页：自动跳转到第一个抽奖活动的大屏；若无活动则引导去管理后台
function DefaultPage() {
  const [status, setStatus] = useState('loading');
  const navigate = useNavigate();

  useEffect(() => {
    getEvents()
      .then(res => {
        const data = res.data;
        if (Array.isArray(data) && data.length > 0) {
          navigate(`/lottery/${data[0].id}`, { replace: true });
        } else {
          setStatus('empty');
        }
      })
      .catch(() => setStatus('empty'));
  }, []);

  if (status === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0f0a1a', color: '#ccc', fontSize: '18px' }}>
        加载中...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0f0a1a', color: '#e2c88a', gap: '20px', fontFamily: 'sans-serif' }}>
      <div style={{ fontSize: '56px' }}>🎊</div>
      <h2 style={{ margin: 0, fontSize: '22px', color: '#fff' }}>暂无抽奖活动</h2>
      <p style={{ margin: 0, color: '#888', fontSize: '14px' }}>请先在管理后台创建活动</p>
      <a
        href="/admin"
        style={{ padding: '10px 28px', background: 'linear-gradient(135deg, #e2c88a, #c9a84c)', color: '#1a1229', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', fontSize: '15px' }}
      >
        → 前往管理后台
      </a>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 根路径：自动跳转到大屏（有活动），否则显示引导页 */}
        <Route path="/" element={<DefaultPage />} />

        {/* 抽奖大屏（带ID） */}
        <Route path="/lottery/:eventId" element={<Lottery />} />

        {/* 宾客扫码或直接访问的注册参与页（不带权限校验） */}
        <Route path="/register" element={<Register />} />

        {/* 后台管理系统（前端组件内会自动判断登录缓存） */}
        <Route path="/admin" element={<Admin />} />

        {/* 未匹配的路由容错处理：跳回首页走 DefaultPage 逻辑 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
