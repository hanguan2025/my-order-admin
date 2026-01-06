import React, { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import {
  collection, onSnapshot, query, orderBy,
  updateDoc, doc, deleteDoc, addDoc, serverTimestamp,
  writeBatch
} from 'firebase/firestore';
// --- 拖拽核心組件 ---
import {
  DndContext, closestCenter, TouchSensor, MouseSensor, useSensor, useSensors
} from '@dnd-kit/core';
import {
  SortableContext, rectSortingStrategy, arrayMove, useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
// --- 完整 CSS 樣式還原 (包含動畫與配色) ---
const injectStyles = `
  :root { --primary: #1890ff; --success: #52c41a; --warning: #faad14; --danger: #ff4d4f; --dark: #001529; --bg: #f4f7fe; --brand-orange: #f27a45; }
  body { background-color: var(--bg); margin: 0; font-family: "PingFang TC", "Microsoft JhengHei", sans-serif; -webkit-tap-highlight-color: transparent; }
  .glass-card {
    background: rgba(255, 255, 255, 0.95); border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.3);
    box-shadow: 0 8px 32px rgba(31, 38, 135, 0.07); transition: transform 0.2s, box-shadow 0.2s;
  }
  /* 訂單卡片狀態顏色 */
  .order-pending { border-left: 8px solid var(--danger); }
  .order-processing { border-left: 8px solid var(--warning); }
  .order-completed { border-left: 8px solid var(--success); }
  .order-archived { border-left: 8px solid #8c8c8c; }
  /* 拖曳把手樣式 */
  .drag-handle {
    width: 42px; height: 42px; display: flex; align-items: center; justify-content: center;
    background: #f0f2f5; border-radius: 10px; color: #bfbfbf; margin-right: 12px;
    cursor: grab; font-size: 22px; touch-action: none !important; flex-shrink: 0;
  }
  .drag-handle:active { cursor: grabbing; background: #e6f7ff; color: var(--primary); }
  .admin-section-title { font-size: 1.4rem; font-weight: 800; color: var(--dark); margin: 25px 0; display: flex; align-items: center; justify-content: space-between; }
  .menu-edit-input { border: 1px solid transparent; border-bottom: 2px solid #eee; transition: 0.3s; padding: 10px 6px; background: transparent; width: 100%; font-size: 1rem; }
  .menu-edit-input:focus { border-bottom: 2px solid var(--primary); outline: none; background: rgba(24, 144, 255, 0.02); }
  .btn-gradient { color: white; border: none; padding: 12px 20px; border-radius: 10px; font-weight: 600; cursor: pointer; background: var(--primary); transition: 0.3s; }
  .btn-gradient:hover { opacity: 0.9; transform: translateY(-1px); }
  .status-toggle { padding: 8px 16px; border-radius: 50px; font-size: 12px; font-weight: 800; cursor: pointer; border: 1px solid #ddd; background: #f0f0f0; color: #999; transition: 0.3s; }
  .status-toggle.active { background: var(--primary) !important; color: white !important; border-color: var(--primary); }
  .analytics-tabs { display: flex; background: #e9ecef; padding: 5px; border-radius: 14px; }
  .view-tab { padding: 10px 24px; border-radius: 10px; cursor: pointer; border: none; color: #7a7a7a; background: transparent; font-weight: 600; }
  .view-tab.active { background: #fff; color: var(--brand-orange); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
  .chart-bar-container { width: 100%; height: 16px; background: #f0f0f0; border-radius: 20px; overflow: hidden; margin-top: 10px; }
  .chart-bar-fill { height: 100%; background: linear-gradient(90deg, #f27a45, #ffbb96); border-radius: 20px; transition: width 1s ease-in-out; }
  .customer-badge { background: #e6f7ff; color: #1890ff; padding: 3px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; margin-right: 8px; }
  .date-picker-input { padding: 12px; border-radius: 10px; border: 1px solid #ddd; outline: none; font-weight: 600; color: var(--dark); }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
  .fade-in { animation: fadeIn 0.4s ease-out forwards; }
`;
const styles = {
  layout: { minHeight: '100vh' },
  main: { padding: '100px 24px 60px', maxWidth: '1240px', margin: '0 auto' },
  topNav: { position: 'fixed', top: 0, left: 0, right: 0, height: '70px', backgroundColor: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 30px', zIndex: 1000, borderBottom: '1px solid #eee' },
  hamburgerBtn: { width: '48px', height: '48px', backgroundColor: '#001529', color: '#fff', borderRadius: '12px', border: 'none', cursor: 'pointer', fontSize: '24px' },
  dropdownMenu: (isOpen) => ({ position: 'fixed', top: isOpen ? '80px' : '-600px', right: '30px', width: '260px', backgroundColor: '#001529', color: '#fff', zIndex: 1000, transition: '0.4s cubic-bezier(0.4, 0, 0.2, 1)', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }),
  menuItem: (active) => ({ padding: '20px 28px', cursor: 'pointer', backgroundColor: active ? '#1890ff' : 'transparent', display: 'flex', alignItems: 'center', gap: '15px', fontSize: '1.05rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }),
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '28px' },
  statusTab: (active, color) => ({ flex: 1, padding: '18px', borderRadius: '16px', cursor: 'pointer', textAlign: 'center', backgroundColor: active ? color : '#fff', color: active ? '#fff' : '#555', fontWeight: '800', transition: '0.3s', boxShadow: active ? '0 8px 20px -5px '+color : 'none' })
};
// --- 排序元件包裝 ---
function SortableItemWrapper({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 999 : 1,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div ref={setNodeRef} style={style}>
      {React.Children.map(children, child =>
        React.cloneElement(child, { dragHandleProps: { ...attributes, ...listeners } })
      )}
    </div>
  );
}
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
  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 0, tolerance: 10 } })
  );
  const tabNames = { 'orders': '📋 訂單監控', 'history': '📜 歷史歸檔', 'menu_all': '🍴 菜單管理', 'analytics': '📊 銷售統計' };
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
        if (change.type === "added" && change.doc.data().status === "待處理") audioRef.current?.play().catch(() => {});
      });
      setOrders(s.docs.map(d => ({...d.data(), id: d.id})));
    });
    const unsubMenu = onSnapshot(query(collection(db, "menu"), orderBy("sortOrder", "asc")), (s) => setMenuItems(s.docs.map(d => ({...d.data(), id: d.id}))));
    const unsubMains = onSnapshot(query(collection(db, "mains"), orderBy("sortOrder", "asc")), (s) => setMains(s.docs.map(d => ({...d.data(), id: d.id}))));
    const unsubExtras = onSnapshot(query(collection(db, "extras"), orderBy("sortOrder", "asc")), (s) => setExtras(s.docs.map(d => ({...d.data(), id: d.id}))));
    return () => { unsubOrders(); unsubMenu(); unsubMains(); unsubExtras(); };
  }, [isLoggedIn]);
  const handleLogin = () => { if (password === "20250909") setIsLoggedIn(true); else alert("密碼錯誤"); };
  if (!isLoggedIn) {
    return (
      <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'linear-gradient(135deg, #001529 0%, #003a8c 100%)' }}>
        <div className="glass-card fade-in" style={{ padding: '45px', textAlign: 'center', width: '340px' }}>
          <h2 style={{ color: '#001529', marginBottom: '30px', fontSize: '1.6rem' }}>🥘 韓館管理系統</h2>
          <input type="password" placeholder="管理員密碼" className="menu-edit-input" style={{ marginBottom: '30px', textAlign: 'center' }} value={password} onChange={(e) => setPassword(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleLogin()} />
          <button className="btn-gradient" style={{ width: '100%', fontSize: '1.1rem' }} onClick={handleLogin}>立即登入</button>
        </div>
      </div>
    );
  }
  return (
    <div style={styles.layout}>
      <header style={styles.topNav}>
        <div style={{ fontSize: '1.4rem', fontWeight: '900', color: 'var(--dark)' }}>{tabNames[activeTab]}</div>
        <button style={styles.hamburgerBtn} onClick={() => setIsMenuOpen(!isMenuOpen)}>☰</button>
      </header>
      <div style={styles.dropdownMenu(isMenuOpen)}>
        {Object.entries(tabNames).map(([key, label]) => (
          <div key={key} style={styles.menuItem(activeTab === key)} onClick={() => {setActiveTab(key); setIsMenuOpen(false);}}>
            {label}
          </div>
        ))}
        <div style={{ ...styles.menuItem(false), color: '#ff4d4f', borderTop: '2px solid rgba(255,255,255,0.1)' }} onClick={() => setIsLoggedIn(false)}>🚪 退出登入</div>
      </div>
      <main style={styles.main}>
        {activeTab === 'orders' && <OrdersView orders={orders} />}
        {activeTab === 'history' && <HistoryView orders={orders} />}
        {activeTab === 'menu_all' && (
          <>
            <MenuView menuItems={menuItems} sensors={sensors} />
            <DynamicConfigView title="🍚 主食選項管理" collectionName="mains" data={mains} placeholder="名稱 (如: 白飯)" sensors={sensors} />
            <DynamicConfigView title="🥩 加料選項管理" collectionName="extras" data={extras} hasPrice={true} placeholder="名稱 (如: 牛肉)" sensors={sensors} />
          </>
        )}
        {activeTab === 'analytics' && <AnalyticsView orders={orders} />}
      </main>
    </div>
  );
}
// --- 1. 訂單卡片組件 ---
function OrderCard({ order, filter, isReadOnly = false }) {
  const updateOrder = async (id, status) => {
    try {
      await updateDoc(doc(db, "orders", id), { status });
    } catch (error) {
      console.error('Update failed:', error);
      alert('更新失敗，請檢查網路或權限');
    }
  };

  const removeOrder = async (id) => {
    if (window.confirm("⚠️ 確定要永久刪除這筆訂單嗎？")) {
      try {
        await deleteDoc(doc(db, "orders", id));
      } catch (error) {
        console.error('Delete failed:', error);
        alert('刪除失敗');
      }
    }
  };

  // 輔助函式：判斷備註是否有效 (過濾 00, 0 1 等佔位符)
  const isValidNote = (note) => {
    if (!note) return false;
    const trimmed = String(note).trim();
    return trimmed !== "" && trimmed !== "00" && trimmed !== "0 1" && trimmed !== "0 0";
  };

  const statusClass = filter === '待處理' ? 'order-pending' : filter === '處理中' ? 'order-processing' : filter === '已完成' ? 'order-completed' : 'order-archived';

  return (
    <div className={`glass-card ${statusClass} fade-in`} style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '360px', marginBottom: '20px' }}>
      <div>
        {/* 桌號與基本資訊 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
          <div>
            <div style={{ fontSize: '1.6rem', fontWeight: '900', color: 'var(--dark)' }}>🪑 桌號：{order.tableNum}</div>
            <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '5px' }}>
              <span className="customer-badge">{order.customerName || '顧客'}</span>{order.phone}
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '12px', color: '#999' }}>
            <div>{order.createdAt?.toDate().toLocaleDateString()}</div>
            <div style={{ fontWeight: 'bold', color: '#555' }}>{order.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        </div>

        {/* 訂單明細背景容器 */}
        <div style={{ background: '#f8f9fa', padding: '16px', borderRadius: '12px', fontSize: '0.95rem' }}>
          <div style={{ marginBottom: '10px', color: '#888', fontSize: '0.8rem', borderBottom: '1px solid #ddd', paddingBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
            <span>💳 {order.paymentMethod || '現金支付'}</span>
            <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>#{order.id.slice(-4)}</span>
          </div>

          {/* 1. 餐點列表循環 */}
          {order.items?.map((it, i) => {
            // 關鍵修正：精準讀取截圖中的「客製備註」
            const mealNote = it["客製備註"] || it.客製備註 || it.note || "";

            return (
              <div key={i} style={{ padding: '10px 0', borderBottom: '1px dashed #eee' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong style={{ fontSize: '1.05rem' }}>
                    {it.emoji || '🥘'} {it.name} <span style={{ color: '#ff4d4f' }}>x{it.quantity || 1}</span>
                  </strong>
                  <span style={{ color: '#f27a45', fontWeight: '900' }}>${it.finalPrice}</span>
                </div>
                
                <div style={{ fontSize: '12px', color: '#777', marginTop: '4px' }}>
                  🍚 {it.main || '無主食'} | 🥩 {it.extras?.map(e => e.name).join(', ') || '無加料'}
                </div>

                {/* --- 餐點客製備註 (對應截圖中的「要蔥」) --- */}
                {isValidNote(mealNote) && (
                  <div style={{ 
                    marginTop: '8px', 
                    backgroundColor: '#fff1eb', 
                    color: '#f27a45', 
                    padding: '8px 12px', 
                    borderRadius: '6px', 
                    fontSize: '13px', 
                    fontWeight: 'bold',
                    borderLeft: '4px solid #f27a45'
                  }}>
                  📝 客製備註：<span style={{ color: '#333' }}>{mealNote}</span>
                  </div>
                )}
              </div>
            );
          })}

          {/* 2. 整單備註 (這才是 order.note) */}
          {isValidNote(order.note) && (
            <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '2px solid #eee', color: '#d48806', fontSize: '13px', fontWeight: 'bold' }}>
              🚩 整單備註：<span style={{ color: '#333' }}>{order.note}</span>
            </div>
          )}
        </div>
      </div>

      {/* 底部總金額與操作按鈕 */}
      <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: '900', fontSize: '1.6rem', color: 'var(--dark)' }}>${order.totalAmount}</div>
        {!isReadOnly && (
          <div style={{ display: 'flex', gap: '8px' }}>
            {filter === '待處理' && (
              <>
                <button className="btn-gradient" style={{ background: 'var(--warning)', minWidth: '85px', border: 'none', padding: '10px', borderRadius: '8px', color: '#fff', cursor: 'pointer' }} onClick={() => updateOrder(order.id, '處理中')}>接單</button>
                <button className="btn-gradient" style={{ background: 'var(--danger)', border: 'none', padding: '10px', borderRadius: '8px', color: '#fff', cursor: 'pointer' }} onClick={() => removeOrder(order.id)}>刪除</button>
              </>
            )}
            {filter === '處理中' && (
              <button className="btn-gradient" style={{ background: 'var(--success)', minWidth: '85px', border: 'none', padding: '10px', borderRadius: '8px', color: '#fff', cursor: 'pointer' }} onClick={() => updateOrder(order.id, '已完成')}>完成</button>
            )}
            {filter === '已完成' && (
              <button className="btn-gradient" style={{ background: 'var(--primary)', minWidth: '85px', border: 'none', padding: '10px', borderRadius: '8px', color: '#fff', cursor: 'pointer' }} onClick={() => updateOrder(order.id, '歸檔')}>歸檔</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
// --- 2. 訂單監控主頁面 ---
function OrdersView({ orders }) {
  const [filter, setFilter] = useState('待處理');
  return (
    <div>
      <div style={{ display: 'flex', gap: '15px', marginBottom: '35px' }}>
        {['待處理', '處理中', '已完成'].map(s => (
          <div key={s} style={styles.statusTab(filter === s, s === '待處理' ? 'var(--danger)' : s === '處理中' ? 'var(--warning)' : 'var(--success)')} onClick={() => setFilter(s)}>
            {s} ({orders.filter(o => o.status === s).length})
          </div>
        ))}
      </div>
      <div style={styles.grid}>
        {orders.filter(o => o.status === filter).map(order => <OrderCard key={order.id} order={order} filter={filter} />)}
      </div>
    </div>
  );
}

// --- 3. 歷史歸檔頁面 ---
function HistoryView({ orders }) {
  const [searchPhone, setSearchPhone] = useState("");
  const archivedOrders = orders.filter(o => o.status === '歸檔');
  const filtered = archivedOrders.filter(o => o.phone?.includes(searchPhone));
  return (
    <div className="fade-in">
      <div className="admin-section-title">
        <div style={{ flex: 1 }}></div>
        <input placeholder="🔍 輸入顧客電話查詢..." className="menu-edit-input" style={{ width: '280px', background: '#fff', borderRadius: '12px', padding: '12px 20px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }} value={searchPhone} onChange={(e) => setSearchPhone(e.target.value)} />
      </div>
      <div style={styles.grid}>
        {filtered.map(order => <OrderCard key={order.id} order={order} filter="歸檔" isReadOnly={false} />)}
        {filtered.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '120px', color: '#bbb', fontSize: '1.2rem' }}>無相關歸檔記錄</div>}
      </div>
    </div>
  );
}
// --- 2. 菜單管理 (整合 GitHub 修正邏輯與加料即時調整) ---
function MenuView({ menuItems, sensors }) {
  const [isAdding, setIsAdding] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newItem, setNewItem] = useState({ 
    name: '', price: '', emoji: '🍲', category: '經典鍋物', 
    description: '', allowMain: true, allowExtras: true, allowNote: true 
  });
  
  const categories = Array.from(new Set(menuItems.map(it => it.category || "未分類"))).sort();

  const add = async () => {
    if (!newItem.name || !newItem.price) return alert("品名與價格為必填項目！");
    await addDoc(collection(db, "menu"), { 
      ...newItem, 
      price: Number(newItem.price), 
      sortOrder: menuItems.length, 
      createdAt: serverTimestamp(),
      extras: [
        { name: "牛肉/份", price: 50 },
        { name: "豬肉/份", price: 30 },
        { name: "起司/片", price: 10 }
      ]
    });
    setIsAdding(false);
    setNewItem({ ...newItem, name: '', price: '' });
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = menuItems.findIndex(i => i.id === active.id);
    const newIndex = menuItems.findIndex(i => i.id === over.id);
    const newList = arrayMove(menuItems, oldIndex, newIndex);
    const batch = writeBatch(db);
    newList.forEach((item, idx) => batch.update(doc(db, "menu", item.id), { sortOrder: idx }));
    await batch.commit();
  };

  const grouped = menuItems.reduce((acc, it) => {
    const c = it.category || "未分類";
    if (!acc[c]) acc[c] = [];
    acc[c].push(it);
    return acc;
  }, {});

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="admin-section-title" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
        <button className="btn-gradient" onClick={() => setIsAdding(!isAdding)}>
          {isAdding ? '✕ 關閉視窗' : '＋ 新增餐點/分類'}
        </button>
      </div>

      {isAdding && (
        <div className="glass-card" style={{ padding: '28px', marginBottom: '35px', border: '2px dashed var(--primary)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '20px' }}>
            <div>
              <label className="config-label">1. 選擇或建立分類</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <select className="menu-edit-input" style={{ flex: 1 }} value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})}>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input placeholder="新分類名稱" className="menu-edit-input" style={{ flex: 1 }} value={newCatName} onChange={e => setNewCatName(e.target.value)} />
                <button className="btn-gradient" style={{background:'var(--dark)'}} onClick={() => { if(newCatName) {setNewItem({...newItem, category: newCatName}); alert('分類已設定');} }}>套用</button>
              </div>
            </div>
            <div>
              <label className="config-label">2. 基本資訊</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input placeholder="圖示" style={{ width: '45px' }} className="menu-edit-input" value={newItem.emoji} onChange={e => setNewItem({...newItem, emoji: e.target.value})} />
                <input placeholder="品名" style={{ flex: 2 }} className="menu-edit-input" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} />
                <input placeholder="價格" type="number" style={{ flex: 1 }} className="menu-edit-input" value={newItem.price} onChange={e => setNewItem({...newItem, price: e.target.value})} />
              </div>
            </div>
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label className="config-label">3. 開放客製化選項</label>
            <div className="toggle-group">
              <button className={`status-toggle ${newItem.allowMain ? 'active' : ''}`} onClick={() => setNewItem({...newItem, allowMain: !newItem.allowMain})}>🍚 主食</button>
              <button className={`status-toggle ${newItem.allowExtras ? 'active' : ''}`} onClick={() => setNewItem({...newItem, allowExtras: !newItem.allowExtras})}>🥩 加料</button>
              <button className={`status-toggle ${newItem.allowNote ? 'active' : ''}`} onClick={() => setNewItem({...newItem, allowNote: !newItem.allowNote})}>📝 備註</button>
            </div>
          </div>
          <button className="btn-gradient" style={{ width: '100%', background: 'var(--success)' }} onClick={add}>✨ 確認新增餐點</button>
        </div>
      )}

      {Object.keys(grouped).map(cat => (
        <div key={cat} style={{ marginBottom: '40px' }}>
          <div style={{ background: 'var(--dark)', color: '#fff', padding: '8px 20px', borderRadius: '10px', display: 'inline-block', marginBottom: '15px' }}>{cat}</div>
          <SortableContext items={grouped[cat].map(i => i.id)} strategy={rectSortingStrategy}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '15px' }}>
              {grouped[cat].map(item => (
                <SortableItemWrapper key={item.id} id={item.id}>
                  <MenuCard item={item} />
                </SortableItemWrapper>
              ))}
            </div>
          </SortableContext>
        </div>
      ))}
    </DndContext>
  );
}

// --- 3. 單一餐點卡片組件 (強硬隔離版：解決所有調整失效問題) ---
function MenuCard({ item, dragHandleProps }) {
  // 建立一個完全獨立於 Firebase 的本地緩衝區
  const [localExtras, setLocalExtras] = useState(item.extras || []);
  const [hasChanged, setHasChanged] = useState(false);

  // 更新通用欄位 (主品名、主價格、開關)
  const updateField = async (field, val) => { 
    await updateDoc(doc(db, "menu", item.id), { [field]: val }); 
  };

  // 處理加料區文字或價格變動 (僅修改本地，不碰 Firebase)
  const onLocalChange = (idx, field, val) => {
    const next = [...localExtras];
    next[idx] = { ...next[idx], [field]: field === 'price' ? (val === '' ? 0 : Number(val)) : val };
    setLocalExtras(next);
    setHasChanged(true); // 標記為已修改
  };

  // 手動存檔：只有按下去才會更新到 Firebase
  const saveExtras = async () => {
    try {
      await updateDoc(doc(db, "menu", item.id), { extras: localExtras });
      setHasChanged(false);
      alert('✅ 加料設定已更新');
    } catch (e) {
      alert('❌ 更新失敗');
    }
  };

  return (
    <div className="glass-card" style={{ padding: '15px', border: hasChanged ? '1px solid var(--primary)' : '1px solid transparent' }}>
      {/* 頂部：主餐點編輯區 (這部分通常不會衝突，維持原狀) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div className="drag-handle" {...dragHandleProps}>≡</div>
        <input className="menu-edit-input" style={{ width: '40px', textAlign: 'center' }} value={item.emoji} onChange={e => updateField('emoji', e.target.value)} />
        <input className="menu-edit-input" style={{ flex: 1, fontWeight: 'bold' }} value={item.name} onChange={e => updateField('name', e.target.value)} />
        <input className="menu-edit-input" style={{ width: '70px', fontWeight: 'bold' }} type="number" value={item.price} onChange={e => updateField('price', Number(e.target.value))} />
        <button onClick={() => window.confirm('確定要下架嗎？') && deleteDoc(doc(db, "menu", item.id))} style={{ color: 'var(--danger)', border: 'none', background: 'none', cursor: 'pointer' }}>×</button>
      </div>

      {/* 中間：功能開關 (根據 GitHub Commit 修正) */}
      <div className="toggle-group" style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
        <button className={`status-toggle ${item.allowMain ? 'active' : ''}`} onClick={() => updateField('allowMain', !item.allowMain)}>🍚 主食</button>
        <button className={`status-toggle ${item.allowExtras ? 'active' : ''}`} onClick={() => updateField('allowExtras', !item.allowExtras)}>🥩 加料</button>
        <button className={`status-toggle ${item.allowNote !== false ? 'active' : ''}`} onClick={() => updateField('allowNote', item.allowNote === false)}>📝 備註</button>
      </div>

      {/* 底部：加料區 (完全本地化編輯) */}
      {item.allowExtras && localExtras.length > 0 && (
        <div style={{ marginTop: '15px', padding: '12px', background: '#f8fafc', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '800' }}>🥩 加料項目與價格調整</span>
            {hasChanged && (
              <button 
                onClick={saveExtras}
                style={{ background: 'var(--primary)', color: '#fff', border: 'none', padding: '2px 8px', borderRadius: '5px', fontSize: '0.75rem', cursor: 'pointer', animation: 'pulse 1.5s infinite' }}
              >
                💾 點我儲存修改
              </button>
            )}
          </div>
          
          {localExtras.map((ex, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <input 
                className="menu-edit-input" 
                style={{ flex: 1, fontSize: '0.9rem', background: '#fff' }} 
                value={ex.name} 
                onChange={(e) => onLocalChange(idx, 'name', e.target.value)}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '2px', background: '#fff', padding: '2px 8px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.75rem', color: '#f27a45', fontWeight: 'bold' }}>$</span>
                <input 
                  type="number"
                  className="menu-edit-input" 
                  style={{ width: '55px', color: '#f27a45', fontWeight: '800', textAlign: 'center', border: 'none' }} 
                  value={ex.price} 
                  onChange={(e) => onLocalChange(idx, 'price', e.target.value)}
                  onFocus={(e) => e.target.select()}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
// --- 3. 動態選項管理 (主食、加料) ---
function DynamicCard({ item, dragHandleProps, collectionName, hasPrice }) {
  const removeItem = async () => {
    if (window.confirm('確定移除？')) {
      try {
        await deleteDoc(doc(db, collectionName, item.id));
      } catch (error) {
        console.error('Delete failed:', error);
        alert('刪除失敗，請檢查網路或權限');
      }
    }
  };
  return (
    <div className="glass-card" style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
      <div className="drag-handle" style={{ width: '28px', height: '28px', fontSize: '16px' }} {...dragHandleProps}>≡</div>
      <span style={{ fontSize: '1.1rem' }}>{item.icon} {item.name}</span>
      {hasPrice && <span style={{ color: 'var(--brand-orange)', fontWeight: 'bold' }}>+${item.price}</span>}
      <span onClick={removeItem} style={{ color: 'var(--danger)', cursor: 'pointer', marginLeft: '5px', fontWeight: 'bold' }}>×</span>
    </div>
  );
}
function DynamicConfigView({ title, collectionName, data, hasPrice = false, placeholder, sensors }) {
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', price: 0, icon: '✨', type: '預設' });
  const add = async () => {
    if (!newItem.name) return alert('名稱為必填項目！');
    try {
      await addDoc(collection(db, collectionName), { ...newItem, sortOrder: data.length, createdAt: serverTimestamp() });
      setNewItem({ ...newItem, name: '', price: 0 });
      setIsAdding(false);
    } catch (error) {
      console.error('Add failed:', error);
      alert('新增失敗，請檢查網路或權限');
    }
  };
  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = data.findIndex(i => i.id === active.id);
    const newIndex = data.findIndex(i => i.id === over.id);
    const newList = arrayMove(data, oldIndex, newIndex);
    const batch = writeBatch(db);
    newList.forEach((item, idx) => batch.update(doc(db, collectionName, item.id), { sortOrder: idx }));
    try {
      await batch.commit();
    } catch (error) {
      console.error('Batch commit failed:', error);
      alert('排序更新失敗，請檢查網路或權限');
    }
  };
  return (
    <div style={{ marginTop: '50px' }}>
      <div className="admin-section-title">
        <span>{title}</span>
        <button className="btn-gradient" style={{ background: 'var(--success)' }} onClick={() => setIsAdding(!isAdding)}>{isAdding ? '✕' : '＋'}</button>
      </div>
      {isAdding && (
        <div className="glass-card fade-in" style={{ padding: '18px', marginBottom: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          {hasPrice && <input placeholder="分類" className="menu-edit-input" style={{ width: '90px' }} value={newItem.type} onChange={e => setNewItem({...newItem, type: e.target.value})} />}
          <input placeholder="圖示" className="menu-edit-input" style={{ width: '50px' }} value={newItem.icon} onChange={e => setNewItem({...newItem, icon: e.target.value})} />
          <input placeholder={placeholder} className="menu-edit-input" style={{ flex: 1 }} value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} />
          {hasPrice && <input placeholder="加價" type="number" className="menu-edit-input" style={{ width: '80px' }} value={newItem.price} onChange={e => setNewItem({...newItem, price: Number(e.target.value)})} />}
          <button className="btn-gradient" style={{ background: 'var(--success)' }} onClick={add}>新增</button>
        </div>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={data.map(i => i.id)} strategy={rectSortingStrategy}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px' }}>
            {data.map(item => (
              <SortableItemWrapper key={item.id} id={item.id}>
                <DynamicCard item={item} collectionName={collectionName} hasPrice={hasPrice} />
              </SortableItemWrapper>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
// --- 4. 銷售統計 (包含：置中年份選擇器、熱銷排行與金額長條圖) ---
function AnalyticsView({ orders }) {
  const [viewType, setViewType] = useState('daily');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const validOrders = orders.filter(o => (o.status === '已完成' || o.status === '歸檔') && o.createdAt);
  
  const filteredOrders = validOrders.filter(o => {
    const orderDate = o.createdAt.toDate();
    const sel = new Date(selectedDate);
    if (viewType === 'daily') return orderDate.toLocaleDateString() === sel.toLocaleDateString();
    if (viewType === 'monthly') return orderDate.getFullYear() === sel.getFullYear() && orderDate.getMonth() === sel.getMonth();
    return orderDate.getFullYear() === sel.getFullYear();
  });

  const totalRevenue = filteredOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);

  // 計算品項銷量與總額統計
  const itemStats = filteredOrders.reduce((acc, order) => {
    if (order.items) {
      order.items.forEach(item => {
        const itemName = item.name;
        if (!acc[itemName]) {
          acc[itemName] = { count: 0, revenue: 0, emoji: item.emoji || '🥘' };
        }
        acc[itemName].count += 1;
        acc[itemName].revenue += Number(item.finalPrice || 0);
      });
    }
    return acc;
  }, {});

  const sortedStats = Object.entries(itemStats)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.revenue - a.revenue);

  return (
    <div className="analytics-container fade-in" style={{ paddingBottom: '40px' }}>
      {/* 頂部切換與日期選擇區 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', gap: '10px' }}>
        <div style={{ textAlign: 'left' }}>
          <input
            type={viewType === 'daily' ? 'date' : viewType === 'monthly' ? 'month' : 'number'}
            className="date-picker-input"
            style={{ 
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              // 修正重點：確保 padding 左右相等 (8px 8px)，並強制 text-align 置中
              padding: viewType === 'yearly' ? '10px 8px' : '10px 12px',
              fontSize: '1rem',
              fontWeight: '700',
              outline: 'none',
              boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
              cursor: 'pointer',
              // 寬度稍微加寬一點點 (從 85px 改為 90px) 配合左右內距會更漂亮
              width: viewType === 'yearly' ? '90px' : viewType === 'monthly' ? '140px' : 'auto',
              textAlign: 'center', // 強制文字居中
              color: '#1e293b',
              appearance: 'none', // 移除瀏覽器預設樣式影響
              WebkitAppearance: 'none'
            }} 
            value={viewType === 'yearly' ? new Date(selectedDate).getFullYear() : selectedDate.slice(0, viewType === 'monthly' ? 7 : 10)}
            onChange={(e) => {
              let val = e.target.value;
              if(viewType === 'yearly') val = `${val}-01-01`;
              if(viewType === 'monthly') val = `${val}-01`;
              setSelectedDate(val);
            }}
          />
        </div>

        <div className="analytics-tabs" style={{ background: '#f1f5f9', padding: '5px', borderRadius: '14px', display: 'inline-flex' }}>
          {['daily', 'monthly', 'yearly'].map((type) => (
            <button key={type} onClick={() => setViewType(type)} style={{
              padding: '8px 12px', borderRadius: '10px', border: 'none', fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer',
              background: viewType === type ? '#fff' : 'transparent', color: viewType === type ? '#f27a45' : '#64748b',
              boxShadow: viewType === type ? '0 4px 6px -1px rgba(0,0,0,0.1)' : 'none'
            }}>
              {type === 'daily' ? '按日' : type === 'monthly' ? '按月' : '按年'}
            </button>
          ))}
        </div>
      </div>

      {/* 營收總計卡片 */}
      <div className="revenue-summary-card" style={{ 
        background: 'linear-gradient(135deg, #fff 0%, #fffbf2 100%)', borderRadius: '24px', padding: '30px', marginBottom: '35px',
        boxShadow: '0 10px 25px -5px rgba(242, 122, 69, 0.1)', border: '1px solid rgba(242, 122, 69, 0.15)', textAlign: 'center'
      }}>
        <div style={{ color: '#94a3b8', fontSize: '0.95rem', fontWeight: '500', marginBottom: '8px' }}>{selectedDate.replace(/-/g, '/')} 營收總計</div>
        <div style={{ fontSize: '3.2rem', fontWeight: '800', color: '#f27a45', margin: '10px 0' }}>
          <span style={{ fontSize: '1.5rem', marginRight: '5px' }}>NT$</span>{totalRevenue.toLocaleString()}
        </div>
        <div style={{ background: '#f27a4515', color: '#f27a45', padding: '6px 16px', borderRadius: '50px', fontSize: '0.9rem', fontWeight: '600' }}>
          已交付 {filteredOrders.length} 筆訂單
        </div>
      </div>

      {/* 📊 長條圖統計區 */}
      <div style={{ marginBottom: '40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px', gap: '10px' }}>
          <span style={{ fontSize: '1.4rem' }}>📊</span>
          <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#1e293b', fontWeight: '700' }}>品項營收佔比分析</h3>
        </div>

        {sortedStats.length === 0 ? (
          <div style={{ color: '#94a3b8', textAlign: 'center', padding: '30px', background: '#f8fafc', borderRadius: '20px' }}>暫無銷售數據</div>
        ) : (
          <div style={{ background: '#fff', padding: '25px', borderRadius: '24px', border: '1px solid #f1f5f9' }}>
            {sortedStats.map((stat, idx) => {
              const percentage = totalRevenue > 0 ? (stat.revenue / totalRevenue * 100).toFixed(1) : 0;
              return (
                <div key={idx} style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1.2rem' }}>{stat.emoji}</span>
                      <span style={{ fontWeight: '700', color: '#334155' }}>{stat.name}</span>
                      <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>({stat.count} 份)</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: '800', color: '#f27a45', fontSize: '1rem' }}>NT$ {stat.revenue.toLocaleString()}</div>
                      <div style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>佔比 {percentage}%</div>
                    </div>
                  </div>
                  <div style={{ height: '12px', background: '#f1f5f9', borderRadius: '10px', overflow: 'hidden' }}>
                    <div style={{ 
                      width: `${percentage}%`, 
                      background: 'linear-gradient(90deg, #f27a45, #ff9a6a)', 
                      height: '100%',
                      borderRadius: '10px',
                      transition: 'width 0.8s ease-out'
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 成交明細清單 */}
      <div className="order-history-section">
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px', gap: '10px' }}>
          <span style={{ fontSize: '1.4rem' }}>📋</span>
          <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#1e293b', fontWeight: '700' }}>成交訂單明細</h3>
        </div>
        {filteredOrders.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: '20px', padding: '60px 20px', textAlign: 'center', border: '2px dashed #e2e8f0' }}>
            <div style={{ fontSize: '3rem' }}>🍃</div>
            <div style={{ color: '#94a3b8' }}>此時段尚無紀錄</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {filteredOrders.map((order) => {
              const dateObj = order.createdAt?.toDate();
              const dateString = dateObj ? `${dateObj.getFullYear()}/${dateObj.getMonth()+1}/${dateObj.getDate()} ${dateObj.getHours().toString().padStart(2,'0')}:${dateObj.getMinutes().toString().padStart(2,'0')}` : '未知時間';
              return (
                <div key={order.id} className="history-order-card" style={{ 
                  background: '#fff', borderRadius: '20px', padding: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ background: '#f27a45', color: '#fff', width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>{order.tableNum}</div>
                      <div>
                        <div style={{ fontWeight: '700', color: '#334155' }}>桌號 {order.tableNum}</div>
                        <div style={{ fontSize: '0.85rem', color: '#475569' }}>👤 {order.customerName} | 📞 {order.customerPhone}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                      <span style={{ display: 'inline-block', background: '#f8fafc', padding: '4px 10px', borderRadius: '8px', fontSize: '0.75rem', color: '#64748b', border: '1px solid #e2e8f0', fontWeight: '600' }}>{order.paymentMethod}</span>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>📅 {dateString}</div>
                    </div>
                  </div>
                  {/* 品項區域 */}
                  <div style={{ background: '#fcfcfc', borderRadius: '12px', padding: '12px', marginBottom: '12px' }}>
                    {order.items?.map((item, idx) => (
                      <div key={idx} style={{ padding: '8px 0', borderBottom: idx === order.items.length - 1 ? 'none' : '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontWeight: '600', color: '#1e293b' }}>{item.emoji} {item.name}</div>
                          <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{item.main} {item.extras?.map(e => e.name).join(', ')}</div>
                        </div>
                        <div style={{ fontWeight: '600' }}>${item.finalPrice}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'baseline', gap: '8px' }}>
                    <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>單筆結算</span>
                    <span style={{ fontSize: '1.2rem', fontWeight: '800', color: '#f27a45' }}>NT$ {order.totalAmount}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}