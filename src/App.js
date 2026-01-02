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
    useSensor(TouchSensor, { activationConstraint: { delay: 0, tolerance: 5 } })
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
// --- 1. 訂單監控 (還原完整退回按鈕邏輯) ---
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
        alert('刪除失敗，請檢查網路或權限');
      }
    }
  };
  const statusClass = filter === '待處理' ? 'order-pending' : filter === '處理中' ? 'order-processing' : filter === '已完成' ? 'order-completed' : 'order-archived';
  return (
    <div className={`glass-card ${statusClass} fade-in`} style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '360px' }}>
      <div>
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
        <div style={{ background: '#f8f9fa', padding: '16px', borderRadius: '12px', fontSize: '0.95rem' }}>
          <div style={{ marginBottom: '10px', color: '#888', fontSize: '0.8rem', borderBottom: '1px solid #ddd', paddingBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
            <span>💳 {order.paymentMethod || '現金支付'}</span>
            <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>#{order.id.slice(-4)}</span>
          </div>
          {order.items?.map((it, i) => (
            <div key={i} style={{ borderBottom: i === order.items.length - 1 ? 'none' : '1px dashed #eee', padding: '8px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong style={{ fontSize: '1.05rem' }}>{it.emoji || '🥘'} {it.name} <span style={{ color: 'var(--primary)' }}>x1</span></strong>
                <span style={{ color: '#f27a45', fontWeight: '900' }}>${it.finalPrice}</span>
              </div>
              <div style={{ fontSize: '12px', color: '#777', marginTop: '4px', lineHeight: '1.5' }}>
                🍚 {it.main || '無主食'} | 🥩 {it.extras?.map(e => e.name).join(', ') || '無加料'}
              </div>
            </div>
          ))}
          {order.note && <div style={{ marginTop: '12px', color: '#d48806', fontSize: '13px', borderTop: '1px solid #eee', paddingTop: '8px', fontStyle: 'italic' }}>📝 備註：{order.note}</div>}
        </div>
      </div>
      <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: '900', fontSize: '1.6rem', color: 'var(--dark)' }}>${order.totalAmount}</div>
        {!isReadOnly && (
          <div style={{ display: 'flex', gap: '8px' }}>
            {filter === '待處理' && (
              <>
                <button className="btn-gradient" style={{ background: 'var(--warning)', minWidth: '85px' }} onClick={() => updateOrder(order.id, '處理中')}>接單</button>
                <button className="btn-gradient" style={{ background: 'var(--danger)' }} onClick={() => removeOrder(order.id)}>刪除</button>
              </>
            )}
            {filter === '處理中' && (
              <>
                <button className="btn-gradient" style={{ background: 'var(--success)', minWidth: '85px' }} onClick={() => updateOrder(order.id, '已完成')}>完成</button>
                <button className="btn-gradient" style={{ background: '#8c8c8c' }} onClick={() => updateOrder(order.id, '待處理')}>退回</button>
              </>
            )}
            {filter === '已完成' && (
              <>
                <button className="btn-gradient" style={{ background: 'var(--primary)', minWidth: '85px' }} onClick={() => updateOrder(order.id, '歸檔')}>歸檔</button>
                <button className="btn-gradient" style={{ background: '#8c8c8c' }} onClick={() => updateOrder(order.id, '處理中')}>退回</button>
              </>
            )}
            {filter === '歸檔' && (
              <>
                <button className="btn-gradient" style={{ background: 'var(--success)', minWidth: '85px' }} onClick={() => updateOrder(order.id, '已完成')}>退回</button>
                <button className="btn-gradient" style={{ background: 'var(--danger)' }} onClick={() => removeOrder(order.id)}>刪除</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
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
// --- 2. 菜單管理 (還原完整新增分類與細節勾選邏輯) ---
function MenuView({ menuItems, sensors }) {
  const [isAdding, setIsAdding] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newItem, setNewItem] = useState({ name: '', price: '', emoji: '🍲', category: '經典鍋物', description: '', allowMain: true, allowExtras: true, allowNote: true });
  const categories = Array.from(new Set(menuItems.map(it => it.category || "未分類"))).sort();
  const add = async () => {
    if (!newItem.name || !newItem.price) return alert("品名與價格為必填項目！");
    try {
      await addDoc(collection(db, "menu"), { ...newItem, price: Number(newItem.price), sortOrder: menuItems.length, createdAt: serverTimestamp() });
      setIsAdding(false);
      setNewItem({ ...newItem, name: '', price: '' });
      setNewCatName("");
    } catch (error) {
      console.error('Add failed:', error);
      alert('新增失敗，請檢查網路或權限');
    }
  };
  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = menuItems.findIndex(i => i.id === active.id);
    const newIndex = menuItems.findIndex(i => i.id === over.id);
    const newList = arrayMove(menuItems, oldIndex, newIndex);
    const batch = writeBatch(db);
    newList.forEach((item, idx) => batch.update(doc(db, "menu", item.id), { sortOrder: idx }));
    try {
      await batch.commit();
    } catch (error) {
      console.error('Batch commit failed:', error);
      alert('排序更新失敗，請檢查網路或權限');
    }
  };
  const grouped = menuItems.reduce((acc, it) => {
    const c = it.category || "未分類";
    if (!acc[c]) acc[c] = [];
    acc[c].push(it);
    return acc;
  }, {});
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="admin-section-title">
        <span>菜單品項管理</span>
        <button className="btn-gradient" style={{ background: isAdding ? 'var(--dark)' : 'var(--primary)' }} onClick={() => setIsAdding(!isAdding)}>{isAdding ? '✕ 關閉視窗' : '＋ 新增餐點/分類'}</button>
      </div>
      {isAdding && (
        <div className="glass-card fade-in" style={{ padding: '28px', marginBottom: '35px', border: '2px dashed var(--primary)', backgroundColor: '#fcfdff' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '20px' }}>
            <div>
              <label style={{ fontSize: '13px', color: '#888', fontWeight: 'bold' }}>1. 選擇或建立分類</label>
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <select className="menu-edit-input" style={{ flex: 1, background: '#fff' }} value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})}>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  {newCatName && <option value={newCatName}>{newCatName}</option>}
                </select>
                <input placeholder="輸入新分類名稱" className="menu-edit-input" style={{ flex: 1 }} value={newCatName} onChange={e => setNewCatName(e.target.value)} />
                <button className="btn-gradient" style={{ background: 'var(--dark)', padding: '8px 15px' }} onClick={() => { if(newCatName) {setNewItem({...newItem, category: newCatName}); alert(`分類已設定為: ${newCatName}`);} }}>套用</button>
              </div>
            </div>
            <div>
              <label style={{ fontSize: '13px', color: '#888', fontWeight: 'bold' }}>2. 餐點基本資訊</label>
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <input placeholder="圖示" style={{ width: '50px' }} className="menu-edit-input" value={newItem.emoji} onChange={e => setNewItem({...newItem, emoji: e.target.value})} />
                <input placeholder="餐點名稱" style={{ flex: 2 }} className="menu-edit-input" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} />
                <input placeholder="價格" type="number" style={{ flex: 1 }} className="menu-edit-input" value={newItem.price} onChange={e => setNewItem({...newItem, price: e.target.value})} />
              </div>
            </div>
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '13px', color: '#888', fontWeight: 'bold' }}>3. 開放客製化選項</label>
            <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
              <button className={`status-toggle ${newItem.allowMain ? 'active' : ''}`} onClick={() => setNewItem({...newItem, allowMain: !newItem.allowMain})}>{newItem.allowMain ? '🍚 開放主食' : '⚪ 關閉主食'}</button>
              <button className={`status-toggle ${newItem.allowExtras ? 'active' : ''}`} onClick={() => setNewItem({...newItem, allowExtras: !newItem.allowExtras})}>{newItem.allowExtras ? '🥩 開放加料' : '⚪ 關閉加料'}</button>
              <button className={`status-toggle ${newItem.allowNote ? 'active' : ''}`} onClick={() => setNewItem({...newItem, allowNote: !newItem.allowNote})}>{newItem.allowNote ? '📝 開放備註' : '⚪ 關閉備註'}</button>
            </div>
          </div>
          <button className="btn-gradient" style={{ width: '100%', background: 'var(--success)', fontSize: '1.1rem' }} onClick={add}>✨ 確認新增餐點到菜單</button>
        </div>
      )}
      {Object.keys(grouped).map(cat => (
        <div key={cat} style={{ marginBottom: '45px' }}>
          <div style={{ background: 'var(--dark)', color: '#fff', padding: '10px 22px', borderRadius: '10px', fontSize: '1.1rem', fontWeight: 'bold', display: 'inline-block', marginBottom: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>{cat}</div>
          <SortableContext items={grouped[cat].map(i => i.id)} strategy={rectSortingStrategy}>
            <div style={styles.grid}>
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
function MenuCard({ item, dragHandleProps }) {
  const update = async (id, field, val) => {
    try {
      await updateDoc(doc(db, "menu", id), { [field]: val });
    } catch (error) {
      console.error('Update failed:', error);
      alert('更新失敗，請檢查網路或權限');
    }
  };
  return (
    <div className="glass-card" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div className="drag-handle" {...dragHandleProps}>≡</div>
        <input className="menu-edit-input" style={{ width: '40px', textAlign: 'center' }} value={item.emoji} onChange={e => update(item.id, 'emoji', e.target.value)} />
        <input className="menu-edit-input" style={{ flex: 1, fontWeight: 'bold' }} value={item.name} onChange={e => update(item.id, 'name', e.target.value)} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', borderBottom: '2px solid #eee' }}>
          <span style={{ color: '#f27a45', fontWeight: 'bold' }}>$</span>
          <input className="menu-edit-input" style={{ width: '65px', borderBottom: 'none' }} type="number" value={item.price} onChange={e => update(item.id, 'price', Number(e.target.value))} />
        </div>
        <button onClick={() => window.confirm('下架此品項？') && deleteDoc(doc(db, "menu", item.id)).catch(error => { console.error(error); alert('刪除失敗'); })} style={{ color: 'var(--danger)', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.4rem', marginLeft: '10px' }}>×</button>
      </div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '5px' }}>
        <button className={`status-toggle ${item.allowMain ? 'active' : ''}`} onClick={() => update(item.id, 'allowMain', !item.allowMain)}>🍚 主食</button>
        <button className={`status-toggle ${item.allowExtras ? 'active' : ''}`} onClick={() => update(item.id, 'allowExtras', !item.allowExtras)}>🥩 加料</button>
        <button className={`status-toggle ${item.allowNote ? 'active' : ''}`} onClick={() => update(item.id, 'allowNote', !item.allowNote)} style={{ background: item.allowNote ? '#722ed1' : '#f0f0f0', borderColor: item.allowNote ? '#722ed1' : '#ddd' }}>📝 備註</button>
      </div>
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
// --- 4. 銷售統計 (還原完整報表、進度條、明細邏輯) ---
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
  const totalAmount = filteredOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
  const dishStats = {};
  let totalDishesCount = 0;
  filteredOrders.forEach(o => {
    o.items?.forEach(it => {
      if(!dishStats[it.name]) dishStats[it.name] = { count: 0, emoji: it.emoji || '🍲' };
      dishStats[it.name].count += 1;
      totalDishesCount += 1;
    });
  });
  const getTimeLabel = () => {
    const d = new Date(selectedDate);
    if (viewType === 'daily') return d.toLocaleDateString();
    if (viewType === 'monthly') return `${d.getFullYear()}年 ${d.getMonth() + 1}月`;
    return `${d.getFullYear()}年度`;
  };
  return (
    <div className="fade-in">
      <div className="admin-section-title">
        <div style={{ flex: 1 }}></div>
        <div className="analytics-tabs">
          <button className={`view-tab ${viewType === 'daily' ? 'active' : ''}`} onClick={() => setViewType('daily')}>按日</button>
          <button className={`view-tab ${viewType === 'monthly' ? 'active' : ''}`} onClick={() => setViewType('monthly')}>按月</button>
          <button className={`view-tab ${viewType === 'yearly' ? 'active' : ''}`} onClick={() => setViewType('yearly')}>按年</button>
        </div>
      </div>
      <div style={{ marginBottom: '35px', textAlign: 'right' }}>
        <input
          type={viewType === 'daily' ? 'date' : viewType === 'monthly' ? 'month' : 'number'}
          className="date-picker-input"
          value={viewType === 'yearly' ? new Date(selectedDate).getFullYear() : selectedDate.slice(0, viewType === 'monthly' ? 7 : 10)}
          onChange={(e) => {
            let val = e.target.value;
            if(viewType === 'yearly') val = `${val}-01-01`;
            if(viewType === 'monthly') val = `${val}-01`;
            setSelectedDate(val);
          }}
        />
      </div>
      <div className="glass-card" style={{ padding: '50px 20px', textAlign: 'center', marginBottom: '40px', borderBottom: '8px solid var(--brand-orange)' }}>
        <div style={{ color: '#888', marginBottom: '15px', fontWeight: 'bold', letterSpacing: '1px' }}>{getTimeLabel()} 營收總計</div>
        <div style={{ fontSize: '4.2rem', fontWeight: '900', color: 'var(--brand-orange)', margin: '10px 0', textShadow: '0 4px 10px rgba(242,122,69,0.1)' }}>NT$ {totalAmount.toLocaleString()}</div>
        <div style={{ color: '#555', fontSize: '1.1rem' }}>成功交付 <span style={{ color: 'var(--dark)', fontWeight: 'bold' }}>{filteredOrders.length}</span> 筆訂單</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '35px' }}>
        <div className="glass-card" style={{ padding: '30px' }}>
          <h3 style={{ marginTop: 0, marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '10px' }}>📊 品項銷量佔比</h3>
          {Object.entries(dishStats).sort((a,b) => b[1].count - a[1].count).map(([name, data]) => {
            const percentage = totalDishesCount > 0 ? (data.count / totalDishesCount) * 100 : 0;
            return (
              <div key={name} style={{ marginBottom: '22px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: '600' }}>
                  <span>{data.emoji} {name}</span>
                  <span style={{ color: 'var(--brand-orange)' }}>{data.count} 份</span>
                </div>
                <div className="chart-bar-container">
                  <div className="chart-bar-fill" style={{ width: `${percentage}%` }}></div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="glass-card" style={{ padding: '30px' }}>
          <h3 style={{ marginTop: 0, marginBottom: '25px' }}>📋 成交訂單流水</h3>
          <div style={{ maxHeight: '500px', overflowY: 'auto', paddingRight: '10px' }}>
            {filteredOrders.map((o, idx) => (
              <div key={o.id} style={{ padding: '15px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 'bold' }}>{o.customerName || '顧客'} ({o.tableNum}桌)</div>
                  <div style={{ fontSize: '12px', color: '#999' }}>{o.createdAt?.toDate().toLocaleTimeString()}</div>
                </div>
                <div style={{ fontWeight: '900', color: 'var(--dark)' }}>${o.totalAmount}</div>
              </div>
            ))}
            {filteredOrders.length === 0 && <div style={{ textAlign: 'center', color: '#ccc', marginTop: '50px' }}>當日尚無成交</div>}
          </div>
        </div>
      </div>
    </div>
  );
}