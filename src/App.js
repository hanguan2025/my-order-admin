import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { 
  collection, onSnapshot, query, orderBy, 
  updateDoc, doc, deleteDoc, addDoc, serverTimestamp 
} from 'firebase/firestore';

// --- 介面樣式定義 ---
const styles = {
  layout: { display: 'flex', minHeight: '100vh', backgroundColor: '#f0f2f5', fontFamily: '"PingFang TC", sans-serif' },
  sidebar: { width: '240px', backgroundColor: '#001529', color: '#fff', position: 'fixed', height: '100%', boxShadow: '2px 0 8px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column' },
  main: { marginLeft: '240px', flex: 1, padding: '30px' },
  logo: { padding: '25px', textAlign: 'center', fontSize: '20px', fontWeight: 'bold', borderBottom: '1px solid #1f2d3d', color: '#f27a45' },
  menuItem: (active) => ({
    padding: '16px 25px', cursor: 'pointer', backgroundColor: active ? '#1890ff' : 'transparent',
    transition: '0.3s', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '16px'
  }),
  card: { backgroundColor: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', marginBottom: '20px' },
  input: { padding: '10px', borderRadius: '6px', border: '1px solid #d9d9d9', width: '100%', marginBottom: '10px', boxSizing: 'border-box' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' },
  btnPrimary: { backgroundColor: '#1890ff', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  btnDanger: { backgroundColor: '#ff4d4f', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer' },
  tag: (color) => ({ backgroundColor: color, color: '#fff', padding: '4px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }),
  footer: { marginTop: 'auto', padding: '20px', borderTop: '1px solid #1f2d3d', fontSize: '14px' }
};

export default function AdminApp() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [password, setPassword] = useState("");
  const [activeTab, setActiveTab] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [prevOrderCount, setPrevOrderCount] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  // 🔊 播放音效函式
  const playNotification = () => {
    if (isMuted) return;
    const audio = new Audio('/notification.mp3');
    audio.play().catch(err => console.log("音效播放受阻:", err));
  };

  // 1. 即時監聽訂單 + 音效偵測
  useEffect(() => {
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const newOrders = snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      if (prevOrderCount > 0 && newOrders.length > prevOrderCount) {
        playNotification();
      }
      setOrders(newOrders);
      setPrevOrderCount(newOrders.length);
    });
    return () => unsub();
  }, [prevOrderCount, isMuted]);

  // 2. 即時監聽菜單
  useEffect(() => {
    const q = query(collection(db, "menu"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setMenuItems(snap.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    });
    return () => unsub();
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === "20250909") {
      setIsLoggedIn(true);
    } else {
      alert("密碼錯誤，請重新輸入！");
      setPassword("");
    }
  };

  // --- 登入介面 ---
  if (!isLoggedIn) {
    return (
      <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#001529' }}>
        <div style={{ backgroundColor: '#fff', padding: '40px', borderRadius: '12px', width: '320px', textAlign: 'center', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
          <h2 style={{ color: '#001529', marginBottom: '20px' }}>🥘 韓館管理系統</h2>
          <form onSubmit={handleLogin}>
            <input 
              type="password" 
              placeholder="請輸入管理員密碼" 
              style={{ ...styles.input, textAlign: 'center', fontSize: '18px' }}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            <button type="submit" style={{ ...styles.btnPrimary, width: '100%', marginTop: '10px' }}>登入後台</button>
          </form>
        </div>
      </div>
    );
  }

  // --- 管理主介面 ---
  return (
    <div style={styles.layout}>
      {/* 固定側邊欄 */}
      <div style={styles.sidebar}>
        <div style={styles.logo}>🥘 韓館後台管理</div>
        <div style={styles.menuItem(activeTab === 'orders')} onClick={() => setActiveTab('orders')}>📋 訂單處理中心</div>
        <div style={styles.menuItem(activeTab === 'menu')} onClick={() => setActiveTab('menu')}>🍴 菜單內容編輯</div>
        <div style={styles.menuItem(activeTab === 'analytics')} onClick={() => setActiveTab('analytics')}>📊 營業數據概況</div>
        <div style={styles.menuItem(activeTab === 'tables')} onClick={() => setActiveTab('tables')}>🪑 桌位 QR Code</div>
        <div style={styles.menuItem(activeTab === 'history')} onClick={() => setActiveTab('history')}>📜 歷史訂單查詢</div>

        {/* 登出按鈕與音效控制 */}
        <div style={styles.footer}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '15px' }}>
            <input type="checkbox" checked={!isMuted} onChange={() => setIsMuted(!isMuted)} />
            {isMuted ? '🔇 靜音模式' : '🔊 提示音'}
          </label>
          <div 
            style={{ cursor: 'pointer', color: '#ff4d4f', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }} 
            onClick={() => setIsLoggedIn(false)}
          >
            🚪 安全登出系統
          </div>
        </div>
      </div>

      {/* 主內容區域 */}
      <div style={styles.main}>
        {activeTab === 'orders' && <OrdersView orders={orders} />}
        {activeTab === 'menu' && <MenuView menuItems={menuItems} />}
        {activeTab === 'analytics' && <AnalyticsView orders={orders} />}
        {activeTab === 'tables' && <TableManager />}
        {activeTab === 'history' && <HistoryView orders={orders} />}
      </div>
    </div>
  );
}

// --- 以下為分頁元件內容 (不變) ---

function OrdersView({ orders }) {
  const updateStatus = async (id, status) => {
    await updateDoc(doc(db, "orders", id), { status });
  };
  return (
    <div>
      <h2 style={{ marginBottom: '20px' }}>現有訂單監控</h2>
      <div style={styles.grid}>
        {orders.filter(o => o.status !== '已完成').map(order => (
          <div key={order.id} style={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
              <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>🪑 桌號：{order.tableNum}</span>
              <span style={styles.tag(order.status === '待處理' ? '#ff4d4f' : '#faad14')}>
                {order.status}
              </span>
            </div>
            <div style={{ padding: '12px', backgroundColor: '#f9f9f9', borderRadius: '8px', marginBottom: '15px' }}>
              {order.items?.map((it, idx) => (
                <div key={idx} style={{ padding: '5px 0', borderBottom: '1px solid #eee' }}>
                  <b>{it.name}</b> <small>({it.main})</small>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#f27a45', fontWeight: 'bold' }}>NT$ {order.totalAmount}</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => updateStatus(order.id, '處理中')} style={{ ...styles.btnPrimary, padding: '6px 12px' }}>接單</button>
                <button onClick={() => updateStatus(order.id, '已完成')} style={{ ...styles.btnPrimary, backgroundColor: '#52c41a', padding: '6px 12px' }}>完成</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MenuView({ menuItems }) {
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', price: '', emoji: '🍲', category: '鍋物' });

  const handleAddItem = async () => {
    if (!newItem.name || !newItem.price) return alert("請填寫名稱與價格");
    await addDoc(collection(db, "menu"), { ...newItem, price: Number(newItem.price), createdAt: serverTimestamp() });
    setNewItem({ name: '', price: '', emoji: '🍲', category: '鍋物' });
    setIsAdding(false);
  };

  const handleUpdate = async (id, field, value) => {
    await updateDoc(doc(db, "menu", id), { [field]: value });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h2>菜單內容管理</h2>
        <button onClick={() => setIsAdding(!isAdding)} style={styles.btnPrimary}>{isAdding ? '取消' : '＋ 新增項目'}</button>
      </div>
      {isAdding && (
        <div style={{ ...styles.card, border: '2px dashed #1890ff' }}>
          <input placeholder="名稱" style={styles.input} onChange={e => setNewItem({...newItem, name: e.target.value})} />
          <input placeholder="價格" type="number" style={styles.input} onChange={e => setNewItem({...newItem, price: e.target.value})} />
          <button onClick={handleAddItem} style={{ ...styles.btnPrimary, width: '100%' }}>存入資料庫</button>
        </div>
      )}
      <div style={styles.grid}>
        {menuItems.map(item => (
          <div key={item.id} style={styles.card}>
            <input style={{ fontWeight: 'bold', border: 'none', width: '100%' }} value={item.name} onChange={e => handleUpdate(item.id, 'name', e.target.value)} />
            <input type="number" style={{ color: '#f27a45', border: 'none' }} value={item.price} onChange={e => handleUpdate(item.id, 'price', Number(e.target.value))} />
            <button onClick={async () => { if(window.confirm('下架？')) await deleteDoc(doc(db, "menu", item.id)) }} style={{ ...styles.btnDanger, width: '100%', marginTop: '10px' }}>刪除</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalyticsView({ orders }) {
  const today = new Date().toLocaleDateString();
  const todayOrders = orders.filter(o => (o.createdAt?.toDate ? o.createdAt.toDate().toLocaleDateString() : "") === today);
  const totalRevenue = todayOrders.filter(o => o.status === '已完成').reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ ...styles.card, borderTop: '6px solid #52c41a' }}>
        <h3>今日已完成業績</h3>
        <h1 style={{ fontSize: '48px', color: '#52c41a' }}>NT$ {totalRevenue.toLocaleString()}</h1>
      </div>
    </div>
  );
}

function TableManager() {
  const [tableCount, setTableCount] = useState(12);
  const FRONTEND_URL = "https://hanguan-hotpot.vercel.app";
  return (
    <div>
      <h2>🪑 桌位管理</h2>
      <input type="number" style={styles.input} value={tableCount} onChange={e => setTableCount(e.target.value)} />
      <div style={styles.grid}>
        {Array.from({ length: tableCount }, (_, i) => i + 1).map(num => (
          <div key={num} style={styles.card}>
            <h3>第 {num} 桌</h3>
            <button onClick={() => { navigator.clipboard.writeText(`${FRONTEND_URL}?table=${num}`); alert('複製成功'); }} style={styles.btnPrimary}>複製連結</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function HistoryView({ orders }) {
  const [filterDate, setFilterDate] = useState("");
  const historyOrders = orders.filter(o => o.status === '已完成' && (!filterDate || (o.createdAt?.toDate ? o.createdAt.toDate().toISOString().split('T')[0] : "") === filterDate));
  return (
    <div>
      <h2>📜 歷史紀錄</h2>
      <input type="date" style={styles.input} onChange={e => setFilterDate(e.target.value)} />
      <div style={styles.card}>
        {historyOrders.map(o => (
          <div key={o.id} style={{ borderBottom: '1px solid #eee', padding: '10px' }}>
            <b>桌號 {o.tableNum}</b> - NT$ {o.totalAmount}
          </div>
        ))}
      </div>
    </div>
  );
}