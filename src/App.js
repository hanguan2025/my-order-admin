import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { 
  collection, onSnapshot, query, orderBy, 
  updateDoc, doc, deleteDoc, addDoc, serverTimestamp 
} from 'firebase/firestore';

// --- CSS 動效注入 ---
const injectStyles = `
  @keyframes alertBlink {
    0% { border-color: #ff4d4f; box-shadow: 0 0 15px rgba(255, 77, 79, 0.4); }
    50% { border-color: transparent; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    100% { border-color: #ff4d4f; box-shadow: 0 0 15px rgba(255, 77, 79, 0.4); }
  }
  .order-overtime { animation: alertBlink 1.5s infinite ease-in-out !important; border: 2px solid #ff4d4f !important; }
  .admin-section-title { border-left: 5px solid #1890ff; padding-left: 10px; margin: 30px 0 15px; font-size: 1.2rem; display: flex; justify-content: space-between; align-items: center; font-weight: bold; }
  .menu-edit-input { border: 1px solid transparent; border-bottom: 1px solid #eee; transition: 0.3s; padding: 5px 0; background: transparent; width: 100%; }
  .menu-edit-input:focus { border-bottom: 1px solid #1890ff; outline: none; background-color: #f9f9f9; }
  .order-card-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 10px; }
  .item-row { padding: 6px 0; border-bottom: 1px dashed #eee; font-size: 15px; }
  .item-row:last-child { border-bottom: none; }
`;

const styles = {
  layout: { minHeight: '100vh', backgroundColor: '#f0f2f5', fontFamily: '"PingFang TC", sans-serif', position: 'relative' },
  main: { padding: '80px 20px 30px 20px', maxWidth: '1200px', margin: '0 auto' },
  hamburgerBtn: { position: 'fixed', top: '20px', right: '20px', zIndex: 1001, width: '45px', height: '45px', backgroundColor: '#001529', color: '#fff', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center' },
  dropdownMenu: (isOpen) => ({ position: 'fixed', top: isOpen ? '75px' : '-500px', right: '20px', width: '220px', backgroundColor: '#001529', color: '#fff', zIndex: 1000, transition: '0.4s cubic-bezier(0.4, 0, 0.2, 1)', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' }),
  overlay: (isOpen) => ({ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 999, display: isOpen ? 'block' : 'none' }),
  menuItem: (active) => ({ padding: '16px 20px', cursor: 'pointer', backgroundColor: active ? '#1890ff' : 'transparent', transition: '0.2s', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '15px' }),
  card: { backgroundColor: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', marginBottom: '20px', border: '2px solid transparent' },
  input: { padding: '10px', borderRadius: '6px', border: '1px solid #d9d9d9', width: '100%', marginBottom: '10px', boxSizing: 'border-box' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' },
  btnPrimary: { backgroundColor: '#1890ff', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  btnDanger: { backgroundColor: '#ff4d4f', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer' },
  statusTab: (active, color) => ({ flex: 1, padding: '15px 10px', borderRadius: '10px', cursor: 'pointer', textAlign: 'center', backgroundColor: active ? color : '#fff', color: active ? '#fff' : '#555', fontWeight: 'bold', transition: '0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' })
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

  useEffect(() => {
    const styleTag = document.createElement("style");
    styleTag.innerHTML = injectStyles;
    document.head.appendChild(styleTag);
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    const unsubOrders = onSnapshot(query(collection(db, "orders"), orderBy("createdAt", "desc")), (s) => setOrders(s.docs.map(d => ({...d.data(), id: d.id}))));
    const unsubMenu = onSnapshot(query(collection(db, "menu"), orderBy("category", "asc")), (s) => setMenuItems(s.docs.map(d => ({...d.data(), id: d.id}))));
    const unsubMains = onSnapshot(collection(db, "mains"), (s) => setMains(s.docs.map(d => ({...d.data(), id: d.id}))));
    const unsubExtras = onSnapshot(collection(db, "extras"), (s) => setExtras(s.docs.map(d => ({...d.data(), id: d.id}))));
    
    return () => { unsubOrders(); unsubMenu(); unsubMains(); unsubExtras(); };
  }, [isLoggedIn]);

  const handleLogin = () => {
    if (password === "20250909") setIsLoggedIn(true);
    else alert("密碼錯誤！");
  };

  if (!isLoggedIn) {
    return (
      <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#001529' }}>
        <div style={{ backgroundColor: '#fff', padding: '40px', borderRadius: '12px', textAlign: 'center', width: '300px' }}>
          <h2 style={{marginBottom: '20px'}}>🥘 韓館管理登入</h2>
          <input type="password" placeholder="管理員密碼" style={styles.input} value={password} onChange={(e) => setPassword(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleLogin()} />
          <button onClick={handleLogin} style={{...styles.btnPrimary, width: '100%'}}>登入</button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.layout}>
      <button style={styles.hamburgerBtn} onClick={() => setIsMenuOpen(!isMenuOpen)}>☰</button>
      <div style={styles.overlay(isMenuOpen)} onClick={() => setIsMenuOpen(false)}></div>
      <div style={styles.dropdownMenu(isMenuOpen)}>
        <div style={styles.menuItem(activeTab === 'orders')} onClick={() => {setActiveTab('orders'); setIsMenuOpen(false);}}>📋 即時訂單</div>
        <div style={styles.menuItem(activeTab === 'menu_all')} onClick={() => {setActiveTab('menu_all'); setIsMenuOpen(false);}}>🍴 菜單/分類管理</div>
        <div style={styles.menuItem(activeTab === 'analytics')} onClick={() => {setActiveTab('analytics'); setIsMenuOpen(false);}}>📊 營業統計</div>
        <div style={{ padding: '20px', color: '#ff4d4f', cursor: 'pointer', borderTop: '1px solid rgba(255,255,255,0.1)' }} onClick={() => setIsLoggedIn(false)}>🚪 登出系統</div>
      </div>

      <div style={styles.main}>
        {activeTab === 'orders' && <OrdersView orders={orders} />}
        {activeTab === 'menu_all' && (
          <>
            <MenuView menuItems={menuItems} />
            <DynamicConfigView title="🍚 主食選項管理" collectionName="mains" data={mains} placeholder="例如：冬粉、泡麵" />
            <DynamicConfigView title="🥩 加料選項管理" collectionName="extras" data={extras} hasPrice={true} placeholder="例如：起司、豬肉" />
          </>
        )}
        {activeTab === 'analytics' && <AnalyticsView orders={orders} />}
      </div>
    </div>
  );
}

// --- 訂單視圖：復原原本的閃爍與詳細清單 ---
function OrdersView({ orders }) {
  const [filterStatus, setFilterStatus] = useState('待處理');
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const updateStatus = async (id, status) => await updateDoc(doc(db, "orders", id), { status });

  return (
    <div>
      <div style={{display:'flex', gap:'10px', marginBottom:'20px'}}>
        <div style={styles.statusTab(filterStatus === '待處理', '#ff4d4f')} onClick={() => setFilterStatus('待處理')}>待處理 ({orders.filter(o => o.status === '待處理').length})</div>
        <div style={styles.statusTab(filterStatus === '處理中', '#faad14')} onClick={() => setFilterStatus('處理中')}>處理中 ({orders.filter(o => o.status === '處理中').length})</div>
        <div style={styles.statusTab(filterStatus === '已完成', '#52c41a')} onClick={() => setFilterStatus('已完成')}>已完成 ({orders.filter(o => o.status === '已完成').length})</div>
      </div>

      <div style={styles.grid}>
        {orders.filter(o => o.status === filterStatus).map(order => {
          const orderTime = order.createdAt?.toDate ? order.createdAt.toDate() : null;
          const isOvertime = filterStatus === '待處理' && orderTime && (now - orderTime > 300000); // 5分鐘未接單閃爍

          return (
            <div key={order.id} style={styles.card} className={isOvertime ? 'order-overtime' : ''}>
              <div className="order-card-header">
                <span style={{ fontSize: '1.4rem', fontWeight: '900' }}>🪑 桌號：{order.tableNum}</span>
                <span style={{ color: '#888', fontSize: '13px' }}>{orderTime ? orderTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '剛剛'}</span>
              </div>
              
              <div style={{ marginBottom: '10px', fontSize: '14px', color: '#555' }}>
                👤 {order.customerName} | 📞 {order.phone}
              </div>

              <div style={{ background: '#f9f9f9', padding: '12px', borderRadius: '8px', marginBottom: '12px' }}>
                {order.items?.map((it, i) => (
                  <div key={i} className="item-row">
                    <div style={{ fontWeight: 'bold' }}>{it.emoji} {it.name} <span style={{color:'#1890ff'}}>x1</span></div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      🍜 主食：{it.main} 
                      {it.extras?.length > 0 && ` | ➕ 加料：${it.extras.map(e => e.name).join(', ')}`}
                    </div>
                  </div>
                ))}
                {order.note && (
                  <div style={{ marginTop: '10px', padding: '8px', background: '#fffbe6', borderRadius: '4px', border: '1px solid #ffe58f', fontSize: '13px', color: '#d46b08' }}>
                    📝 備註：{order.note}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold', color: '#f27a45', fontSize: '1.2rem' }}>NT$ {order.totalAmount}</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {filterStatus === '待處理' && <button onClick={() => updateStatus(order.id, '處理中')} style={styles.btnPrimary}>接單製作</button>}
                  {filterStatus === '處理中' && (
                    <>
                      <button onClick={() => updateStatus(order.id, '待處理')} style={{...styles.btnPrimary, backgroundColor:'#888'}}>退回</button>
                      <button onClick={() => updateStatus(order.id, '已完成')} style={{...styles.btnPrimary, backgroundColor:'#52c41a'}}>完成出餐</button>
                    </>
                  )}
                  {filterStatus === '已完成' && <button onClick={() => updateStatus(order.id, '處理中')} style={{...styles.btnPrimary, backgroundColor:'#faad14'}}>重啟訂單</button>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- 菜單管理 ---
function MenuView({ menuItems }) {
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', price: '', emoji: '🍲', category: '經典鍋物', desc: '' });

  const add = async () => {
    if (!newItem.name || !newItem.price) return alert("請填寫名稱與價格");
    await addDoc(collection(db, "menu"), { ...newItem, price: Number(newItem.price), createdAt: serverTimestamp() });
    setIsAdding(false);
    setNewItem({ name: '', price: '', emoji: '🍲', category: '經典鍋物', desc: '' });
  };

  const update = async (id, field, val) => await updateDoc(doc(db, "menu", id), { [field]: field === 'price' ? Number(val) : val });

  return (
    <div>
      <div className="admin-section-title">
        <span>🥘 餐點管理 (雲端同步)</span>
        <button onClick={() => setIsAdding(!isAdding)} style={styles.btnPrimary}>{isAdding ? '取消' : '＋ 新增餐點'}</button>
      </div>

      {isAdding && (
        <div style={{...styles.card, border:'2px dashed #1890ff', background: '#f0faff'}}>
          <input placeholder="分類 (如：經典鍋物、飲品)" style={styles.input} value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})} />
          <div style={{display:'flex', gap:'10px'}}>
            <input placeholder="圖示" style={{...styles.input, width:'60px'}} value={newItem.emoji} onChange={e => setNewItem({...newItem, emoji: e.target.value})} />
            <input placeholder="餐點名稱" style={styles.input} value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} />
            <input placeholder="價格" type="number" style={styles.input} value={newItem.price} onChange={e => setNewItem({...newItem, price: e.target.value})} />
          </div>
          <input placeholder="簡短描述" style={styles.input} value={newItem.desc} onChange={e => setNewItem({...newItem, desc: e.target.value})} />
          <button onClick={add} style={{...styles.btnPrimary, width:'100%'}}>儲存餐點</button>
        </div>
      )}

      <div style={styles.grid}>
        {menuItems.map(item => (
          <div key={item.id} style={styles.card}>
            <div style={{fontSize:'12px', color:'#1890ff', marginBottom:'5px'}}>分類：<input className="menu-edit-input" style={{width:'100px'}} value={item.category} onChange={e => update(item.id, 'category', e.target.value)} /></div>
            <div style={{display:'flex', gap:'10px', margin:'10px 0'}}>
              <input className="menu-edit-input" style={{width:'30px', fontSize: '1.2rem'}} value={item.emoji} onChange={e => update(item.id, 'emoji', e.target.value)} />
              <input className="menu-edit-input" style={{fontWeight:'bold', fontSize: '1.1rem'}} value={item.name} onChange={e => update(item.id, 'name', e.target.value)} />
            </div>
            <div style={{display:'flex', alignItems:'center', gap: '5px'}}>
              <span style={{fontSize:'14px', color:'#888'}}>價格:</span>
              <input className="menu-edit-input" style={{color:'#f27a45', fontWeight:'bold'}} type="number" value={item.price} onChange={e => update(item.id, 'price', e.target.value)} />
            </div>
            <button onClick={async () => window.confirm(`確定刪除 ${item.name}？`) && await deleteDoc(doc(db, "menu", item.id))} style={{...styles.btnDanger, width:'100%', marginTop:'15px', padding:'6px', fontSize:'13px'}}>刪除項目</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- 通用動態配置 (主食/加料) ---
function DynamicConfigView({ title, collectionName, data, hasPrice = false, placeholder }) {
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', price: 0, icon: '✨' });

  const add = async () => {
    if (!newItem.name) return;
    await addDoc(collection(db, collectionName), newItem);
    setNewItem({ name: '', price: 0, icon: '✨' });
    setIsAdding(false);
  };

  const update = async (id, field, val) => await updateDoc(doc(db, collectionName, id), { [field]: field === 'price' ? Number(val) : val });

  return (
    <div style={{marginTop:'40px'}}>
      <div className="admin-section-title">
        <span>{title}</span>
        <button onClick={() => setIsAdding(!isAdding)} style={{...styles.btnPrimary, backgroundColor:'#52c41a'}}>{isAdding ? '取消' : '＋ 新增'}</button>
      </div>

      {isAdding && (
        <div style={{...styles.card, border:'2px dashed #52c41a', background: '#f6ffed'}}>
          <div style={{display:'flex', gap:'10px'}}>
            <input placeholder="圖示" style={{...styles.input, width:'60px'}} value={newItem.icon} onChange={e => setNewItem({...newItem, icon: e.target.value})} />
            <input placeholder={placeholder} style={styles.input} value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} />
            {hasPrice && <input placeholder="價格" type="number" style={styles.input} value={newItem.price} onChange={e => setNewItem({...newItem, price: e.target.value})} />}
          </div>
          <button onClick={add} style={{...styles.btnPrimary, backgroundColor:'#52c41a', width:'100%'}}>確認新增</button>
        </div>
      )}

      <div style={{display:'flex', flexWrap:'wrap', gap:'10px'}}>
        {data.map(item => (
          <div key={item.id} style={{...styles.card, padding:'10px 15px', marginBottom:'0', display:'flex', alignItems:'center', gap:'10px', width:'auto'}}>
            <span>{item.icon}</span>
            <input className="menu-edit-input" style={{width:'80px'}} value={item.name} onChange={e => update(item.id, 'name', e.target.value)} />
            {hasPrice && <input className="menu-edit-input" style={{width:'50px', color:'#f27a45'}} type="number" value={item.price} onChange={e => update(item.id, 'price', e.target.value)} />}
            <span onClick={async () => await deleteDoc(doc(db, collectionName, item.id))} style={{color:'#ff4d4f', cursor:'pointer', fontWeight:'bold'}}>✕</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- 營業統計 ---
function AnalyticsView({ orders }) {
  const today = new Date().toLocaleDateString();
  const todayOrders = orders.filter(o => o.status === '已完成' && (o.createdAt?.toDate ? o.createdAt.toDate().toLocaleDateString() : "") === today);
  const totalRevenue = todayOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ ...styles.card, borderTop: '6px solid #52c41a', padding: '40px' }}>
        <h3 style={{color: '#888'}}>今日已完成營業額 ({today})</h3>
        <h1 style={{ fontSize: '48px', color: '#52c41a', margin: '20px 0' }}>NT$ {totalRevenue.toLocaleString()}</h1>
        <p>今日完成訂單數：{todayOrders.length} 筆</p>
      </div>
    </div>
  );
}