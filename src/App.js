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
  const [isLoggedIn, setIsLoggedIn] = useState(false); // 登入狀態
  const [password, setPassword] = useState(""); // 密碼輸入值
  const [activeTab, setActiveTab] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [prevOrderCount, setPrevOrderCount] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === "20250909") {
      setIsLoggedIn(true);
    } else {
      alert("密碼錯誤，請重新輸入！");
      setPassword("");
    }
  };

  // 如果尚未登入，顯示登入畫面
  if (!isLoggedIn) {
    return (
      <div style={{ 
        height: '100vh', display: 'flex', justifyContent: 'center', 
        alignItems: 'center', backgroundColor: '#001529' 
      }}>
        <div style={{ 
          backgroundColor: '#fff', padding: '40px', borderRadius: '12px', 
          width: '320px', textAlign: 'center', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' 
        }}>
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
            <button type="submit" style={{ ...styles.btnPrimary, width: '100%', marginTop: '10px' }}>
              登入後台
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- 如果已登入，顯示原本的 return 內容 ---
  return (
    <div style={styles.layout}>
      {/* ... 原本的側邊欄與內容 ... */}
    </div>
  );
}
  // 🔊 播放音效函式
  const playNotification = () => {
    if (isMuted) return;
    const audio = new Audio('/notification.mp3');
    audio.play().catch(err => console.log("音效播放受阻，請點擊頁面任意處以啟用音效:", err));
  };

  // 1. 即時監聽訂單 + 音效偵測
  useEffect(() => {
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const newOrders = snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      
      // 偵測是否有新訂單進來
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

        {/* 音效控制開關 */}
        <div style={styles.footer}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={!isMuted} 
              onChange={() => setIsMuted(!isMuted)} 
            />
            {isMuted ? '🔇 靜音模式' : '🔊 新訂單提示音'}
          </label>
        </div>
      </div>

      {/* 主內容區域 */}
      <div style={styles.main}>
        {activeTab === 'orders' && <OrdersView orders={orders} />}
        {activeTab === 'menu' && <MenuView menuItems={menuItems} />}
        {activeTab === 'analytics' && <AnalyticsView orders={orders} />}
        {activeTab === 'tables' && <TableManager />}
        {activeTab === 'history' && <HistoryView orders={orders} />}
      <div 
  style={{ ...styles.menuItem(false), color: '#ff4d4f', borderTop: '1px solid #333' }} 
  onClick={() => setIsLoggedIn(false)}
>
  🚪 安全登出
</div>
      </div>
    </div>
  );


// --- 分頁元件 1：訂單管理 ---
function OrdersView({ orders }) {
  const updateStatus = async (id, status) => {
    await updateDoc(doc(db, "orders", id), { status });
  };

  return (
    <div>
      <h2 style={{ marginBottom: '20px' }}>現有訂單監控</h2>
      <div style={styles.grid}>
        {orders.map(order => (
          <div key={order.id} style={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
              <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>🪑 桌號：{order.tableNum}</span>
              <span style={styles.tag(order.status === '待處理' ? '#ff4d4f' : order.status === '處理中' ? '#faad14' : '#52c41a')}>
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

// --- 分頁元件 2：菜單管理 ---
function MenuView({ menuItems }) {
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', price: '', emoji: '🍲', description: '', category: '鍋物' });

  const handleAddItem = async () => {
    if (!newItem.name || !newItem.price) return alert("請填寫名稱與價格");
    await addDoc(collection(db, "menu"), { ...newItem, price: Number(newItem.price), createdAt: serverTimestamp() });
    setNewItem({ name: '', price: '', emoji: '🍲', description: '', category: '鍋物' });
    setIsAdding(false);
  };

  const handleUpdate = async (id, field, value) => {
    await updateDoc(doc(db, "menu", id), { [field]: value });
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`確定要下架「${name}」嗎？`)) await deleteDoc(doc(db, "menu", id));
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h2>菜單內容管理</h2>
        <button onClick={() => setIsAdding(!isAdding)} style={styles.btnPrimary}>
          {isAdding ? '取消新增' : '＋ 新增餐點項目'}
        </button>
      </div>

      {isAdding && (
        <div style={{ ...styles.card, border: '2px dashed #1890ff' }}>
          <h3>🆕 新增項目</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <input placeholder="餐點名稱" style={styles.input} value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} />
            <input placeholder="價格" type="number" style={styles.input} value={newItem.price} onChange={e => setNewItem({...newItem, price: e.target.value})} />
          </div>
          <button onClick={handleAddItem} style={{ ...styles.btnPrimary, width: '100%' }}>存入資料庫</button>
        </div>
      )}

      <div style={styles.grid}>
        {menuItems.map(item => (
          <div key={item.id} style={styles.card}>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              <input style={{ width: '40px', fontSize: '20px', border: 'none' }} value={item.emoji} onChange={e => handleUpdate(item.id, 'emoji', e.target.value)} />
              <input style={{ flex: 1, fontWeight: 'bold', fontSize: '1.1rem', border: 'none', borderBottom: '1px solid #eee' }} value={item.name} onChange={e => handleUpdate(item.id, 'name', e.target.value)} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
              <span style={{ color: '#888' }}>價格: NT$</span>
              <input type="number" style={{ color: '#f27a45', fontWeight: 'bold', border: 'none', width: '80px' }} value={item.price} onChange={e => handleUpdate(item.id, 'price', Number(e.target.value))} />
            </div>
            <button onClick={() => handleDelete(item.id, item.name)} style={{ ...styles.btnDanger, width: '100%', padding: '8px' }}>🗑️ 刪除項目</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- 分頁元件 3：營業數據報表 ---
function AnalyticsView({ orders }) {
  const today = new Date().toLocaleDateString();
  const todayOrders = orders.filter(order => {
    const orderDate = order.createdAt?.toDate 
      ? order.createdAt.toDate().toLocaleDateString() 
      : new Date(order.createdAt).toLocaleDateString();
    return orderDate === today;
  });

  const totalRevenue = todayOrders
    .filter(o => o.status === '已完成')
    .reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);

  const itemStats = {};
  todayOrders.forEach(order => {
    order.items?.forEach(item => {
      itemStats[item.name] = (itemStats[item.name] || 0) + 1;
    });
  });

  const sortedItems = Object.entries(itemStats).sort((a, b) => b[1] - a[1]);

  return (
    <div>
      <h2 style={{ marginBottom: '25px' }}>📊 營業數據概況 (今日: {today})</h2>
      <div style={styles.grid}>
        <div style={{ ...styles.card, borderTop: '6px solid #52c41a', textAlign: 'center' }}>
          <h3 style={{ color: '#888', margin: '0 0 10px 0' }}>今日已完成業績</h3>
          <h1 style={{ fontSize: '42px', color: '#52c41a', margin: 0 }}>NT$ {totalRevenue.toLocaleString()}</h1>
          <p style={{ color: '#888', marginTop: '10px' }}>共 {todayOrders.filter(o => o.status === '已完成').length} 筆成交訂單</p>
        </div>
        <div style={styles.card}>
          <h3 style={{ marginBottom: '15px' }}>訂單即時狀態</h3>
          <div style={{ display: 'flex', justifyContent: 'space-around' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#ff4d4f', fontSize: '24px', fontWeight: 'bold' }}>{todayOrders.filter(o => o.status === '待處理').length}</div>
              <div style={{ color: '#888' }}>待處理</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#faad14', fontSize: '24px', fontWeight: 'bold' }}>{todayOrders.filter(o => o.status === '處理中').length}</div>
              <div style={{ color: '#888' }}>製作中</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#52c41a', fontSize: '24px', fontWeight: 'bold' }}>{todayOrders.filter(o => o.status === '已完成').length}</div>
              <div style={{ color: '#888' }}>已送達</div>
            </div>
          </div>
        </div>
      </div>
      <div style={styles.card}>
        <h3 style={{ marginBottom: '20px' }}>🔥 今日餐點銷量排行</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #f0f2f5' }}>
              <th style={{ padding: '12px' }}>排名</th>
              <th style={{ padding: '12px' }}>餐點名稱</th>
              <th style={{ padding: '12px' }}>銷量 (份)</th>
            </tr>
          </thead>
          <tbody>
            {sortedItems.map(([name, count], index) => (
              <tr key={name} style={{ borderBottom: '1px solid #f0f2f5' }}>
                <td style={{ padding: '12px' }}>{index + 1}</td>
                <td style={{ padding: '12px', fontWeight: 'bold' }}>{name}</td>
                <td style={{ padding: '12px', color: '#1890ff' }}>{count} 份</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- 分頁元件 4：桌位 QR Code 管理 ---
function TableManager() {
  const [tableCount, setTableCount] = useState(12);
  const FRONTEND_URL = "https://hanguan-hotpot.vercel.app"; // 你的點餐網址

  const copyToClipboard = (url) => {
    navigator.clipboard.writeText(url);
    alert("連結已複製！您可以將此連結貼到 QR Code 產生網站。");
  };

  return (
    <div>
      <h2 style={{ marginBottom: '20px' }}>🪑 桌位掃碼管理</h2>
      <div style={styles.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <span>店內桌數設定：</span>
          <input 
            type="number" 
            style={{ ...styles.input, width: '80px', marginBottom: 0 }} 
            value={tableCount} 
            onChange={(e) => setTableCount(Number(e.target.value))} 
          />
        </div>
      </div>
      <div style={styles.grid}>
        {Array.from({ length: tableCount }, (_, i) => i + 1).map(num => {
          const tableUrl = `${FRONTEND_URL}?table=${num}`;
          return (
            <div key={num} style={styles.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                <h3 style={{ margin: 0 }}>第 {num} 桌</h3>
                <a href={tableUrl} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#1890ff' }}>測試預覽</a>
              </div>
              <p style={{ fontSize: '11px', color: '#888', wordBreak: 'break-all', margin: '15px 0', background: '#f9f9f9', padding: '8px' }}>{tableUrl}</p>
              <button 
                onClick={() => copyToClipboard(tableUrl)}
                style={{ ...styles.btnPrimary, width: '100%', backgroundColor: '#13c2c2' }}
              >
                複製此桌連結
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
// --- 分頁元件 5：歷史訂單查詢 ---
function HistoryView({ orders }) {
  const [filterDate, setFilterDate] = useState(""); // 格式為 YYYY-MM-DD

  // 篩選出「已完成」或「已取消」的訂單
  const historyOrders = orders.filter(order => {
    // 1. 基本條件：狀態必須是已完成
    if (order.status !== '已完成') return false;

    // 2. 日期篩選
    if (filterDate) {
      const orderDate = order.createdAt?.toDate 
        ? order.createdAt.toDate().toISOString().split('T')[0] 
        : new Date(order.createdAt).toISOString().split('T')[0];
      return orderDate === filterDate;
    }
    return true;
  });

  const handleDeleteRecord = async (id) => {
    if (window.confirm("確定要永久刪除此筆歷史紀錄嗎？（這將無法恢復）")) {
      await deleteDoc(doc(db, "orders", id));
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>📜 歷史訂單紀錄</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>按日期篩選：</span>
          <input 
            type="date" 
            style={{ ...styles.input, marginBottom: 0, width: '200px' }} 
            value={filterDate} 
            onChange={(e) => setFilterDate(e.target.value)} 
          />
          {filterDate && <button onClick={() => setFilterDate("")} style={{ ...styles.btnPrimary, backgroundColor: '#888' }}>清除</button>}
        </div>
      </div>

      <div style={styles.card}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #f0f2f5', color: '#888' }}>
              <th style={{ padding: '12px' }}>時間</th>
              <th style={{ padding: '12px' }}>桌號</th>
              <th style={{ padding: '12px' }}>餐點內容</th>
              <th style={{ padding: '12px' }}>金額</th>
              <th style={{ padding: '12px' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {historyOrders.map(order => {
              const timeStr = order.createdAt?.toDate 
                ? order.createdAt.toDate().toLocaleString('zh-TW', { hour12: false })
                : new Date(order.createdAt).toLocaleString();
                
              return (
                <tr key={order.id} style={{ borderBottom: '1px solid #f0f2f5' }}>
                  <td style={{ padding: '12px', fontSize: '14px' }}>{timeStr}</td>
                  <td style={{ padding: '12px', fontWeight: 'bold' }}>{order.tableNum} 號桌</td>
                  <td style={{ padding: '12px' }}>
                    {order.items?.map(it => `${it.name}x1`).join(', ')}
                  </td>
                  <td style={{ padding: '12px', color: '#f27a45', fontWeight: 'bold' }}>${order.totalAmount}</td>
                  <td style={{ padding: '12px' }}>
                    <button 
                      onClick={() => handleDeleteRecord(order.id)}
                      style={{ border: 'none', background: 'none', color: '#ff4d4f', cursor: 'pointer' }}
                    >
                      永久刪除
                    </button>
                  </td>
                </tr>
              );
            })}
            {historyOrders.length === 0 && (
              <tr>
                <td colSpan="5" style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
                  沒有找到相關歷史紀錄
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}