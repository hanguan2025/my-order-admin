import React, { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import { 
  collection, onSnapshot, query, orderBy, 
  updateDoc, doc, deleteDoc, addDoc, serverTimestamp 
} from 'firebase/firestore';

// --- 進階 CSS 動效與美化樣式 ---
const injectStyles = `
  :root {
    --primary: #1890ff;
    --success: #52c41a;
    --warning: #faad14;
    --danger: #ff4d4f;
    --dark: #001529;
    --bg: #f4f7fe;
  }

  @keyframes pulseRed {
    0% { box-shadow: 0 0 0 0 rgba(255, 77, 79, 0.4); }
    70% { box-shadow: 0 0 0 10px rgba(255, 77, 79, 0); }
    100% { box-shadow: 0 0 0 0 rgba(255, 77, 79, 0); }
  }

  body { background-color: var(--bg); margin: 0; font-family: "PingFang TC", "Microsoft JhengHei", sans-serif; }
  
  .glass-card {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    box-shadow: 0 8px 32px rgba(31, 38, 135, 0.07);
    transition: transform 0.2s, box-shadow 0.2s;
  }
  
  .glass-card:hover { transform: translateY(-4px); box-shadow: 0 12px 40px rgba(31, 38, 135, 0.12); }

  .order-pending { border-left: 6px solid var(--danger) !important; animation: pulseRed 2s infinite; }
  .order-processing { border-left: 6px solid var(--warning) !important; }
  .order-completed { border-left: 6px solid var(--success) !important; opacity: 0.8; }

  .admin-section-title { 
    font-size: 1.4rem; font-weight: 800; color: var(--dark);
    margin: 40px 0 20px; display: flex; align-items: center; justify-content: space-between;
  }

  .menu-edit-input { 
    border: 1px solid transparent; border-bottom: 2px solid #eee; 
    transition: 0.3s; padding: 8px 4px; background: transparent; width: 100%; font-size: 1rem;
  }
  .menu-edit-input:focus { border-bottom: 2px solid var(--primary); outline: none; background: #f0f7ff; }

  .toggle-pill {
    display: flex; align-items: center; gap: 6px; padding: 6px 12px;
    border-radius: 20px; font-size: 12px; font-weight: 600; cursor: pointer;
    transition: 0.3s; border: 1.5px solid #eee; background: #fff; color: #888;
  }
  .toggle-pill.active { background: #e6f7ff; color: var(--primary); border-color: var(--primary); }

  .category-header {
    background: linear-gradient(135deg, var(--dark) 0%, #2b4162 100%);
    color: white; padding: 12px 24px; border-radius: 12px; margin-bottom: 20px;
    display: inline-flex; align-items: center; gap: 10px; font-weight: 600;
  }

  .btn-gradient {
    background: linear-gradient(135deg, #1890ff 0%, #096dd9 100%);
    color: white; border: none; padding: 10px 24px; border-radius: 8px;
    font-weight: 600; cursor: pointer; box-shadow: 0 4px 14px rgba(24, 144, 255, 0.3);
    transition: 0.3s; display: inline-block; text-align: center;
  }
  .btn-gradient:active { transform: scale(0.95); }
`;

const styles = {
  layout: { minHeight: '100vh' },
  main: { padding: '100px 24px 60px', maxWidth: '1240px', margin: '0 auto' },
  topNav: { 
    position: 'fixed', top: 0, left: 0, right: 0, height: '70px', 
    backgroundColor: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 30px', zIndex: 1000, borderBottom: '1px solid #eee' 
  },
  hamburgerBtn: { width: '45px', height: '45px', backgroundColor: '#001529', color: '#fff', borderRadius: '10px', border: 'none', cursor: 'pointer', fontSize: '20px' },
  dropdownMenu: (isOpen) => ({ 
    position: 'fixed', top: isOpen ? '80px' : '-500px', right: '30px', width: '240px', 
    backgroundColor: '#001529', color: '#fff', zIndex: 1000, transition: '0.4s cubic-bezier(0.4, 0, 0.2, 1)', 
    borderRadius: '16px', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' 
  }),
  menuItem: (active) => ({ padding: '18px 24px', cursor: 'pointer', backgroundColor: active ? '#1890ff' : 'transparent', display: 'flex', alignItems: 'center', gap: '12px', transition: '0.2s' }),
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '24px' },
  statusTab: (active, color) => ({ 
    flex: 1, padding: '16px', borderRadius: '14px', cursor: 'pointer', textAlign: 'center', 
    backgroundColor: active ? color : '#fff', color: active ? '#fff' : '#555', 
    fontWeight: '700', transition: '0.3s', boxShadow: active ? '0 8px 20px rgba(0,0,0,0.1)' : 'none' 
  })
};

export default function AdminApp() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [password, setPassword] = useState("");
  const [activeTab, setActiveTab] = useState('orders');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [orders, setOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [mains, setMains] = useState([]);
  const [extras, setExtras] = useState([]);
  
  // 修正音效引用與靜音策略
  const audioRef = useRef(null);

  useEffect(() => {
    const styleTag = document.createElement("style");
    styleTag.innerHTML = injectStyles;
    document.head.appendChild(styleTag);
    audioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    
    const unsubOrders = onSnapshot(query(collection(db, "orders"), orderBy("createdAt", "desc")), (s) => {
      s.docChanges().forEach(change => {
        if (change.type === "added" && change.doc.data().status === "待處理") {
          audioRef.current?.play().catch(() => console.log("等待使用者互動以播放音效"));
        }
      });
      setOrders(s.docs.map(d => ({...d.data(), id: d.id})));
    });

    const unsubMenu = onSnapshot(query(collection(db, "menu"), orderBy("category", "asc")), (s) => setMenuItems(s.docs.map(d => ({...d.data(), id: d.id}))));
    const unsubMains = onSnapshot(collection(db, "mains"), (s) => setMains(s.docs.map(d => ({...d.data(), id: d.id}))));
    const unsubExtras = onSnapshot(collection(db, "extras"), (s) => setExtras(s.docs.map(d => ({...d.data(), id: d.id}))));
    
    return () => { unsubOrders(); unsubMenu(); unsubMains(); unsubExtras(); };
  }, [isLoggedIn]);

  const handleLogin = () => {
    if (password === "20250909") setIsLoggedIn(true);
    else alert("密碼錯誤");
  };

  if (!isLoggedIn) {
    return (
      <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'linear-gradient(135deg, #001529 0%, #003a8c 100%)' }}>
        <div className="glass-card" style={{ padding: '50px', textAlign: 'center', width: '320px' }}>
          <h2 style={{ margin: '0 0 30px', color: '#001529' }}>🥘 韓館管理系統</h2>
          <input 
            type="password" 
            placeholder="管理員密碼" 
            className="menu-edit-input" 
            style={{ marginBottom: '30px', textAlign: 'center' }} 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            onKeyPress={(e) => e.key === 'Enter' && handleLogin()} 
          />
          <button className="btn-gradient" style={{ width: '100%' }} onClick={handleLogin}>立即登入</button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.layout}>
      <header style={styles.topNav}>
        <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#001529' }}>K-FOOD <span style={{ color: '#1890ff' }}>ADMIN</span></div>
        <button style={styles.hamburgerBtn} onClick={() => setIsMenuOpen(!isMenuOpen)}>☰</button>
      </header>

      {isMenuOpen && <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 999 }} onClick={() => setIsMenuOpen(false)}></div>}
      
      <div style={styles.dropdownMenu(isMenuOpen)}>
        <div style={styles.menuItem(activeTab === 'orders')} onClick={() => {setActiveTab('orders'); setIsMenuOpen(false);}}>📋 訂單監控</div>
        <div style={styles.menuItem(activeTab === 'menu_all')} onClick={() => {setActiveTab('menu_all'); setIsMenuOpen(false);}}>🍴 菜單管理</div>
        <div style={styles.menuItem(activeTab === 'analytics')} onClick={() => {setActiveTab('analytics'); setIsMenuOpen(false);}}>📊 銷售統計</div>
        <div style={{ ...styles.menuItem(false), color: '#ff4d4f', borderTop: '1px solid #333' }} onClick={() => setIsLoggedIn(false)}>🚪 登出系統</div>
      </div>

      <main style={styles.main}>
        {activeTab === 'orders' && <OrdersView orders={orders} />}
        {activeTab === 'menu_all' && (
          <>
            <MenuView menuItems={menuItems} />
            <DynamicConfigView title="🍚 主食庫存選項" collectionName="mains" data={mains} placeholder="名稱" />
            <DynamicConfigView title="🥩 加料庫存選項" collectionName="extras" data={extras} hasPrice={true} placeholder="名稱" />
          </>
        )}
        {activeTab === 'analytics' && <AnalyticsView orders={orders} />}
      </main>
    </div>
  );
}

// --- 訂單監控視圖 ---
function OrdersView({ orders }) {
  const [filter, setFilter] = useState('待處理');
  const updateStatus = async (id, status) => await updateDoc(doc(db, "orders", id), { status });

  return (
    <div>
      <div style={{ display: 'flex', gap: '15px', marginBottom: '30px' }}>
        {['待處理', '處理中', '已完成'].map(s => (
          <div key={s} style={styles.statusTab(filter === s, s === '待處理' ? '#ff4d4f' : s === '處理中' ? '#faad14' : '#52c41a')} onClick={() => setFilter(s)}>
            {s} · {orders.filter(o => o.status === s).length}
          </div>
        ))}
      </div>
      <div style={styles.grid}>
        {orders.filter(o => o.status === filter).map(order => (
          <div key={order.id} className={`glass-card ${filter === '待處理' ? 'order-pending' : filter === '處理中' ? 'order-processing' : 'order-completed'}`} style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
              <span style={{ fontSize: '1.4rem', fontWeight: '800' }}>🪑 桌號：{order.tableNum}</span>
              <span style={{ fontSize: '13px', color: '#999' }}>
                {order.createdAt ? order.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "讀取中..."}
              </span>
            </div>
            <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '12px', marginBottom: '20px' }}>
              {order.items?.map((it, i) => (
                <div key={i} style={{ padding: '8px 0', borderBottom: i === order.items.length - 1 ? 'none' : '1px dashed #ddd' }}>
                  <div style={{ fontWeight: '700' }}>{it.emoji} {it.name}</div>
                  <div style={{ fontSize: '12px', color: '#777', marginTop: '4px' }}>
                    🍜 {it.main || '無'} | ➕ {it.extras?.map(e => e.name).join(', ') || '無'}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#f27a45', fontWeight: '900', fontSize: '1.4rem' }}>NT$ {order.totalAmount}</span>
              <button className="btn-gradient" 
                style={{ background: filter === '待處理' ? '#ff4d4f' : filter === '處理中' ? '#52c41a' : '#1890ff' }}
                onClick={() => updateStatus(order.id, filter === '待處理' ? '處理中' : '已完成')}>
                {filter === '待處理' ? '接單製作' : filter === '處理中' ? '出餐完成' : '歸檔'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- 菜單管理 ---
function MenuView({ menuItems }) {
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', price: '', emoji: '🍲', category: '經典鍋物', allowMain: true, allowExtras: true });

  const add = async () => {
    if (!newItem.name || !newItem.price) return alert("資訊不完整");
    await addDoc(collection(db, "menu"), { ...newItem, price: Number(newItem.price), createdAt: serverTimestamp() });
    setIsAdding(false);
    setNewItem({ name: '', price: '', emoji: '🍲', category: '經典鍋物', allowMain: true, allowExtras: true });
  };

  const update = async (id, field, val) => await updateDoc(doc(db, "menu", id), { [field]: val });

  const grouped = menuItems.reduce((acc, it) => {
    const c = it.category || "未分類";
    if (!acc[c]) acc[c] = [];
    acc[c].push(it);
    return acc;
  }, {});

  return (
    <div>
      <div className="admin-section-title">
        <span>🥘 菜單與分類配置</span>
        <button className="btn-gradient" onClick={() => setIsAdding(!isAdding)}>{isAdding ? '關閉' : '＋ 新增餐點'}</button>
      </div>

      {isAdding && (
        <div className="glass-card" style={{ padding: '30px', marginBottom: '30px', border: '2px dashed #1890ff' }}>
          <input placeholder="分類名稱" className="menu-edit-input" style={{ marginBottom: '20px' }} value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})} />
          <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
            <input placeholder="圖示" className="menu-edit-input" style={{ width: '80px' }} value={newItem.emoji} onChange={e => setNewItem({...newItem, emoji: e.target.value})} />
            <input placeholder="餐點名稱" className="menu-edit-input" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} />
            <input placeholder="價格" type="number" className="menu-edit-input" style={{ width: '120px' }} value={newItem.price} onChange={e => setNewItem({...newItem, price: e.target.value})} />
          </div>
          <div style={{ display: 'flex', gap: '20px', marginBottom: '25px' }}>
            <div className={`toggle-pill ${newItem.allowMain ? 'active' : ''}`} onClick={() => setNewItem({...newItem, allowMain: !newItem.allowMain})}>主食選擇 {newItem.allowMain ? 'ON' : 'OFF'}</div>
            <div className={`toggle-pill ${newItem.allowExtras ? 'active' : ''}`} onClick={() => setNewItem({...newItem, allowExtras: !newItem.allowExtras})}>加料選項 {newItem.allowExtras ? 'ON' : 'OFF'}</div>
          </div>
          <button className="btn-gradient" style={{ width: '100%' }} onClick={add}>確認新增餐點</button>
        </div>
      )}

      {Object.keys(grouped).map(cat => (
        <div key={cat} style={{ marginBottom: '50px' }}>
          <div className="category-header">📂 {cat}</div>
          <div style={styles.grid}>
            {grouped[cat].map(item => (
              <div key={item.id} className="glass-card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '15px' }}>
                  <input className="menu-edit-input" style={{ width: '40px', textAlign: 'center' }} value={item.emoji} onChange={e => update(item.id, 'emoji', e.target.value)} />
                  <input className="menu-edit-input" style={{ fontWeight: '700' }} value={item.name} onChange={e => update(item.id, 'name', e.target.value)} />
                </div>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                  <div className={`toggle-pill ${item.allowMain ? 'active' : ''}`} onClick={() => update(item.id, 'allowMain', !item.allowMain)}>主食</div>
                  <div className={`toggle-pill ${item.allowExtras ? 'active' : ''}`} onClick={() => update(item.id, 'allowExtras', !item.allowExtras)}>加料</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: '700', color: '#f27a45' }}>$ <input className="menu-edit-input" style={{ width: '60px', borderBottom: 'none' }} type="number" value={item.price} onChange={e => update(item.id, 'price', Number(e.target.value))} /></span>
                  <button onClick={() => window.confirm('確定下架？') && deleteDoc(doc(db, "menu", item.id))} style={{ color: '#ff4d4f', border: 'none', background: 'none', cursor: 'pointer', fontWeight: '600' }}>下架</button>
                </div>
                <input className="menu-edit-input" style={{ fontSize: '11px', color: '#aaa', marginTop: '10px' }} value={item.category} onChange={e => update(item.id, 'category', e.target.value)} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// --- 通用配置 (主食/加料) ---
function DynamicConfigView({ title, collectionName, data, hasPrice = false, placeholder }) {
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', price: 0, icon: '✨' });
  
  const add = async () => {
    if (!newItem.name) return;
    await addDoc(collection(db, collectionName), newItem);
    setNewItem({ name: '', price: 0, icon: '✨' });
    setIsAdding(false);
  };

  return (
    <div style={{ marginTop: '50px' }}>
      <div className="admin-section-title">
        <span>{title}</span>
        <button className="btn-gradient" style={{ background: '#52c41a' }} onClick={() => setIsAdding(!isAdding)}>{isAdding ? '取消' : '＋ 新增'}</button>
      </div>
      {isAdding && (
        <div className="glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', gap: '15px' }}>
            <input placeholder="圖" className="menu-edit-input" style={{ width: '60px' }} value={newItem.icon} onChange={e => setNewItem({...newItem, icon: e.target.value})} />
            <input placeholder={placeholder} className="menu-edit-input" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} />
            {hasPrice && <input placeholder="價格" type="number" className="menu-edit-input" style={{ width: '100px' }} onChange={e => setNewItem({...newItem, price: Number(e.target.value)})} />}
          </div>
          <button className="btn-gradient" style={{ background: '#52c41a', width: '100%', marginTop: '20px' }} onClick={add}>確認新增</button>
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
        {data.map(item => (
          <div key={item.id} className="glass-card" style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0' }}>
            <span style={{ fontSize: '1.1rem' }}>{item.icon} {item.name}</span>
            {hasPrice && <span style={{ color: '#f27a45', fontWeight: '700' }}>${item.price}</span>}
            <span onClick={() => deleteDoc(doc(db, collectionName, item.id))} style={{ color: '#ff4d4f', cursor: 'pointer', fontWeight: '900', marginLeft: '10px' }}>×</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- 統計 ---
function AnalyticsView({ orders }) {
  const total = orders.filter(o => o.status === '已完成').reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
  return (
    <div style={{ textAlign: 'center', padding: '60px 0' }}>
      <div className="glass-card" style={{ padding: '60px', display: 'inline-block', minWidth: '400px', borderTop: '8px solid #52c41a' }}>
        <h3 style={{ color: '#888', margin: '0 0 20px' }}>本期累計實收金額</h3>
        <h1 style={{ fontSize: '4rem', color: '#001529', margin: '0 0 20px' }}>NT$ {total.toLocaleString()}</h1>
        <div style={{ color: '#52c41a', fontWeight: '700' }}>📈 營運狀況良好</div>
      </div>
    </div>
  );
}