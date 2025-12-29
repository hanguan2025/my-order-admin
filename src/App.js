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

  .price-edit-mini {
    border: none; border-bottom: 1px solid #f27a45; color: #f27a45;
    width: 45px; font-weight: bold; text-align: center; background: transparent;
  }

  .btn-gradient {
    color: white; border: none; padding: 10px 16px; border-radius: 8px;
    font-weight: 600; cursor: pointer; transition: 0.3s; 
    font-size: 0.9rem; text-align: center;
  }
  .btn-gradient:active { transform: scale(0.95); }

  /* --- 強制顏色修正的開關按鈕 --- */
  .config-toggle-group { display: flex; gap: 8px; margin: 5px 0; }
  
  .status-toggle {
    padding: 6px 14px;
    border-radius: 50px;
    font-size: 11px;
    font-weight: 800;
    cursor: pointer;
    border: 1px solid #ddd;
    display: flex;
    align-items: center;
    gap: 4px;
    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    background: #f0f0f0 !important;
    color: #999 !important;
  }

  /* 主食開啟樣式 - 強制藍色 */
  .status-toggle.toggle-main.active {
    background: linear-gradient(135deg, #007aff 0%, #005bb5 100%) !important;
    color: white !important;
    border-color: #007aff !important;
    box-shadow: 0 4px 12px rgba(0, 122, 255, 0.35);
  }

  /* 加料開啟樣式 - 強制綠色 */
  .status-toggle.toggle-extra.active {
    background: linear-gradient(135deg, #34c759 0%, #248a3d 100%) !important;
    color: white !important;
    border-color: #34c759 !important;
    box-shadow: 0 4px 12px rgba(52, 199, 89, 0.35);
  }

  .status-toggle:active { transform: scale(0.9); }

  .order-btn-group { display: flex; gap: 8px; }
  .order-btn-group button { min-width: 80px; }

  .customer-badge {
    background: #e6f7ff; color: #1890ff; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin-right: 5px;
  }

  @media (max-width: 600px) {
    .order-btn-group button { font-size: 12px; padding: 8px 10px; }
  }
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
    fontWeight: '700', transition: '0.3s', boxShadow: active ? '0 8px 20px rgba(0,0,0,0.1)' : 'none',
    fontSize: '0.9rem'
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
          audioRef.current?.play().catch(() => {});
        }
      });
      setOrders(s.docs.map(d => ({...d.data(), id: d.id})));
    });
    const unsubMenu = onSnapshot(query(collection(db, "menu"), orderBy("category", "asc")), (s) => setMenuItems(s.docs.map(d => ({...d.data(), id: d.id}))));
    const unsubMains = onSnapshot(collection(db, "mains"), (s) => setMains(s.docs.map(d => ({...d.data(), id: d.id}))));
    const unsubExtras = onSnapshot(collection(db, "extras"), (s) => setExtras(s.docs.map(d => ({...d.data(), id: d.id}))));
    return () => { unsubOrders(); unsubMenu(); unsubMains(); unsubExtras(); };
  }, [isLoggedIn]);

  const handleLogin = () => { if (password === "20250909") setIsLoggedIn(true); else alert("密碼錯誤"); };

  if (!isLoggedIn) {
    return (
      <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'linear-gradient(135deg, #001529 0%, #003a8c 100%)' }}>
        <div className="glass-card" style={{ padding: '40px', textAlign: 'center', width: '320px' }}>
          <h2 style={{ margin: '0 0 30px', color: '#001529' }}>🥘 韓館管理系統</h2>
          <input type="password" placeholder="管理員密碼" className="menu-edit-input" style={{ marginBottom: '30px', textAlign: 'center' }} value={password} onChange={(e) => setPassword(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleLogin()} />
          <button className="btn-gradient" style={{ width: '100%', background: '#1890ff' }} onClick={handleLogin}>立即登入</button>
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
            <DynamicConfigView title="🍚 主食選項管理" collectionName="mains" data={mains} placeholder="名稱" />
            <DynamicConfigView title="🥩 加料選項管理" collectionName="extras" data={extras} hasPrice={true} placeholder="名稱" />
          </>
        )}
        {activeTab === 'analytics' && <AnalyticsView orders={orders} />}
      </main>
    </div>
  );
}

function OrdersView({ orders }) {
  const [filter, setFilter] = useState('待處理');
  const updateStatus = async (id, status) => await updateDoc(doc(db, "orders", id), { status });
  const deleteOrder = async (id) => window.confirm("確定永久刪除此訂單？") && await deleteDoc(doc(db, "orders", id));

  return (
    <div>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '30px' }}>
        {['待處理', '處理中', '已完成'].map(s => (
          <div key={s} style={styles.statusTab(filter === s, s === '待處理' ? '#ff4d4f' : s === '處理中' ? '#faad14' : '#52c41a')} onClick={() => setFilter(s)}>
            {s} ({orders.filter(o => o.status === s).length})
          </div>
        ))}
      </div>
      <div style={{ ...styles.grid, alignItems: 'stretch', gridAutoRows: '1fr' }}>
        {orders.filter(o => o.status === filter).map(order => (
          <div key={order.id} className={`glass-card ${filter === '待處理' ? 'order-pending' : filter === '處理中' ? 'order-processing' : 'order-completed'}`} style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '300px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div>
                  <div style={{ fontSize: '1.4rem', fontWeight: '800' }}>🪑 桌號：{order.tableNum}</div>
                  <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '4px' }}><span className="customer-badge">{order.customerName}</span> {order.phone}</div>
                </div>
                <span style={{ fontSize: '12px', color: '#999' }}>{order.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || '--:--'}</span>
              </div>
              <div style={{ background: '#f0f2f5', padding: '12px', borderRadius: '10px', fontSize: '0.95rem', marginBottom: '10px' }}>
                <div style={{ marginBottom: '8px', color: '#888', fontSize: '0.8rem', borderBottom: '1px solid #ddd', paddingBottom: '4px' }}>💳 {order.paymentMethod || '未指定'}</div>
                {order.items?.map((it, i) => (
                  <div key={i} style={{ padding: '6px 0', borderBottom: i === order.items.length - 1 ? 'none' : '1px dashed #ccc' }}>
                    <div style={{ fontWeight: '700' }}>{it.emoji} {it.name} <span style={{ float: 'right', color: '#f27a45' }}>${it.finalPrice}</span></div>
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '3px' }}>🍜 {it.main || '無'} | ➕ {it.extras?.map(e => e.name).join(', ') || '無'}</div>
                  </div>
                ))}
                {order.note && <div style={{ marginTop: '10px', color: '#d48806', fontSize: '13px', borderTop: '1px solid #ddd', paddingTop: '5px' }}>📝 備註：{order.note}</div>}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '15px', paddingTop: '10px', borderTop: '1px solid #eee' }}>
              <span style={{ color: '#001529', fontWeight: '900', fontSize: '1.25rem' }}>總額 ${order.totalAmount}</span>
              <div className="order-btn-group">
                {filter === '待處理' && ( <> <button className="btn-gradient" style={{ background: '#faad14' }} onClick={() => updateStatus(order.id, '處理中')}>接單</button> <button className="btn-gradient" style={{ background: '#ff4d4f' }} onClick={() => deleteOrder(order.id)}>刪除</button> </> )}
                {filter === '處理中' && ( <> <button className="btn-gradient" style={{ background: '#52c41a' }} onClick={() => updateStatus(order.id, '已完成')}>完成</button> <button className="btn-gradient" style={{ background: '#8c8c8c' }} onClick={() => updateStatus(order.id, '待處理')}>回退</button> </> )}
                {filter === '已完成' && ( <> <button className="btn-gradient" style={{ background: '#1890ff' }} onClick={() => updateStatus(order.id, '歸檔')}>歸檔</button> <button className="btn-gradient" style={{ background: '#8c8c8c' }} onClick={() => updateStatus(order.id, '處理中')}>重做</button> </> )}
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
  const categories = Array.from(new Set(menuItems.map(it => it.category || "未分類"))).sort();
  const [newCatName, setNewCatName] = useState("");
  const [newItem, setNewItem] = useState({ 
    name: '', price: '', emoji: '🍲', category: '經典鍋物', 
    description: '', allowMain: true, allowExtras: true 
  });

  const add = async () => {
    if (!newItem.name || !newItem.price) return alert("品名與價格為必填");
    await addDoc(collection(db, "menu"), { ...newItem, price: Number(newItem.price), createdAt: serverTimestamp() });
    setIsAdding(false);
    setNewItem({ ...newItem, name: '', price: '', description: '', allowMain: true, allowExtras: true });
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
        <span>🍴 菜單管理</span>
        <button className="btn-gradient" style={{ background: '#1890ff' }} onClick={() => setIsAdding(!isAdding)}>
          {isAdding ? '關閉' : '＋ 新增品項/分類'}
        </button>
      </div>

      {isAdding && (
        <div className="glass-card" style={{ padding: '24px', marginBottom: '24px', border: '2px dashed #1890ff' }}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ fontSize: '12px', color: '#888' }}>1. 選擇現有大項 或 輸入新分類名稱</label>
            <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
              <select className="menu-edit-input" style={{ flex: 1, background: '#fff' }} value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})}>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                {newCatName && <option value={newCatName}>{newCatName}</option>}
              </select>
              <input placeholder="輸入新分類 (如: 經典鍋物)" className="menu-edit-input" style={{ flex: 1 }} value={newCatName} onChange={e => setNewCatName(e.target.value)} />
              <button className="btn-gradient" style={{ background: '#001529' }} onClick={() => { if(newCatName) {setNewItem({...newItem, category: newCatName}); alert(`已將分類設為: ${newCatName}`);} }}>套用新分類</button>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
            <input placeholder="圖" className="menu-edit-input" style={{ width: '50px' }} value={newItem.emoji} onChange={e => setNewItem({...newItem, emoji: e.target.value})} />
            <input placeholder="品名" className="menu-edit-input" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} />
            <input placeholder="價格" type="number" className="menu-edit-input" style={{ width: '80px' }} value={newItem.price} onChange={e => setNewItem({...newItem, price: e.target.value})} />
          </div>

          <div style={{ display: 'flex', gap: '15px', marginBottom: '15px', alignItems: 'center' }}>
            <label style={{ fontSize: '13px', color: '#666', fontWeight: '700' }}>功能開放：</label>
            <div className="config-toggle-group">
              <button className={`status-toggle toggle-main ${newItem.allowMain ? 'active' : ''}`} onClick={() => setNewItem({...newItem, allowMain: !newItem.allowMain})}>
                {newItem.allowMain ? '🍚 主食已開' : '⚪ 主食已關'}
              </button>
              <button className={`status-toggle toggle-extra ${newItem.allowExtras ? 'active' : ''}`} onClick={() => setNewItem({...newItem, allowExtras: !newItem.allowExtras})}>
                {newItem.allowExtras ? '🥩 加料已開' : '⚪ 加料已關'}
              </button>
            </div>
          </div>

          <input placeholder="品項描述 (例如: 湯頭濃郁、不辣...)" className="menu-edit-input" style={{ marginBottom: '20px' }} value={newItem.description} onChange={e => setNewItem({...newItem, description: e.target.value})} />
          <button className="btn-gradient" style={{ width: '100%', background: '#52c41a' }} onClick={add}>確認新增到菜單</button>
        </div>
      )}

      {Object.keys(grouped).map(cat => (
        <div key={cat} style={{ marginBottom: '40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
             <div style={{ background: '#001529', color: '#fff', padding: '8px 20px', borderRadius: '8px', fontSize: '1rem', fontWeight: 'bold' }}>{cat}</div>
             <span style={{ fontSize: '12px', color: '#999' }}>({grouped[cat].length} 個品項)</span>
          </div>

          <div style={styles.grid}>
            {grouped[cat].map(item => (
              <div key={item.id} className="glass-card" style={{ padding: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input className="menu-edit-input" style={{ width: '35px' }} value={item.emoji} onChange={e => update(item.id, 'emoji', e.target.value)} />
                  <input className="menu-edit-input" value={item.name} onChange={e => update(item.id, 'name', e.target.value)} />
                  <input className="menu-edit-input" style={{ width: '60px' }} type="number" value={item.price} onChange={e => update(item.id, 'price', Number(e.target.value))} />
                  <button onClick={() => window.confirm('確定下架？') && deleteDoc(doc(db, "menu", item.id))} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer' }}>×</button>
                </div>
                
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button className={`status-toggle toggle-main ${item.allowMain ? 'active' : ''}`} onClick={() => update(item.id, 'allowMain', !item.allowMain)}>
                    {item.allowMain ? '🍚 主食' : '⚪ 關閉'}
                  </button>
                  <button className={`status-toggle toggle-extra ${item.allowExtras ? 'active' : ''}`} onClick={() => update(item.id, 'allowExtras', !item.allowExtras)}>
                    {item.allowExtras ? '🥩 加料' : '⚪ 關閉'}
                  </button>
                  <input 
                    placeholder="點擊編輯描述..." 
                    className="menu-edit-input" 
                    style={{ fontSize: '0.8rem', color: '#666', flex: 1 }} 
                    value={item.description || ''} 
                    onChange={e => update(item.id, 'description', e.target.value)} 
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function DynamicConfigView({ title, collectionName, data, hasPrice = false, placeholder }) {
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', price: 0, icon: '✨' });
  const add = async () => {
    if (!newItem.name) return;
    await addDoc(collection(db, collectionName), newItem);
    setNewItem({ name: '', price: 0, icon: '✨' });
    setIsAdding(false);
  };
  const updatePrice = async (id, newPrice) => {
    await updateDoc(doc(db, collectionName, id), { price: Number(newPrice) });
  };
  return (
    <div style={{ marginTop: '40px' }}>
      <div className="admin-section-title"><span>{title}</span><button className="btn-gradient" style={{ background: '#52c41a' }} onClick={() => setIsAdding(!isAdding)}>+</button></div>
      {isAdding && (
        <div className="glass-card" style={{ padding: '15px', marginBottom: '15px' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input placeholder="圖" className="menu-edit-input" style={{ width: '45px' }} value={newItem.icon} onChange={e => setNewItem({...newItem, icon: e.target.value})} />
            <input placeholder={placeholder} className="menu-edit-input" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} />
            {hasPrice && <input placeholder="價格" type="number" className="menu-edit-input" style={{ width: '70px' }} onChange={e => setNewItem({...newItem, price: Number(e.target.value)})} />}
            <button className="btn-gradient" style={{ background: '#52c41a' }} onClick={add}>確認</button>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
        {data.map(item => (
          <div key={item.id} className="glass-card" style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.1rem' }}>{item.icon} {item.name}</span>
            {hasPrice && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: '#f27a45', fontWeight: 'bold' }}>$</span>
                <input type="number" className="price-edit-mini" defaultValue={item.price} onBlur={(e) => updatePrice(item.id, e.target.value)} onKeyPress={(e) => e.key === 'Enter' && updatePrice(item.id, e.target.value)} />
              </div>
            )}
            <span onClick={() => window.confirm('刪除？') && deleteDoc(doc(db, collectionName, item.id))} style={{ color: '#ff4d4f', cursor: 'pointer', marginLeft: '5px' }}>×</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalyticsView({ orders }) {
  const total = orders.filter(o => o.status === '已完成' || o.status === '歸檔').reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
  return (
    <div style={{ textAlign: 'center', padding: '60px 0' }}>
      <div className="glass-card" style={{ padding: '40px', display: 'inline-block', minWidth: '320px' }}>
        <h3 style={{ color: '#888', marginBottom: '10px' }}>總累計營業額</h3>
        <h1 style={{ fontSize: '3.5rem', color: '#001529', margin: 0 }}>${total.toLocaleString()}</h1>
      </div>
    </div>
  );
}