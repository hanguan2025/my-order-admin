import React, { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import { 
  collection, onSnapshot, query, orderBy, 
  updateDoc, doc, deleteDoc, addDoc, serverTimestamp,
  writeBatch 
} from 'firebase/firestore';

// --- 拖拽功能引用 ---
import { 
  DndContext, closestCenter, PointerSensor, useSensor, useSensors 
} from '@dnd-kit/core';
import { 
  SortableContext, rectSortingStrategy, arrayMove, useSortable 
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// --- CSS 樣式注入 ---
const injectStyles = `
  :root { --primary: #1890ff; --success: #52c41a; --warning: #faad14; --danger: #ff4d4f; --dark: #001529; --bg: #f4f7fe; --brand-orange: #f27a45; }
  body { background-color: var(--bg); margin: 0; font-family: "PingFang TC", sans-serif; }
  .glass-card { 
    background: rgba(255, 255, 255, 0.95); border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.3);
    box-shadow: 0 8px 32px rgba(31, 38, 135, 0.07); transition: transform 0.2s;
    touch-action: none; /* 重要：防止手機拖動時網頁捲動 */
  }
  .admin-section-title { font-size: 1.4rem; font-weight: 800; color: var(--dark); margin: 20px 0; display: flex; align-items: center; justify-content: space-between; }
  .menu-edit-input { border: 1px solid transparent; border-bottom: 2px solid #eee; transition: 0.3s; padding: 8px 4px; background: transparent; width: 100%; font-size: 1rem; }
  .btn-gradient { color: white; border: none; padding: 10px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; background: var(--primary); }
  .status-toggle { padding: 6px 14px; border-radius: 50px; font-size: 11px; font-weight: 800; cursor: pointer; border: 1px solid #ddd; background: #f0f0f0; color: #999; }
  .status-toggle.active { background: var(--primary) !important; color: white !important; }
  .analytics-tabs { display: flex; background: #e9ecef; padding: 5px; border-radius: 12px; }
  .view-tab { padding: 8px 20px; border-radius: 8px; cursor: pointer; border: none; color: #7a7a7a; background: transparent; }
  .view-tab.active { background: #fff; color: var(--brand-orange); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
  .chart-bar-container { width: 100%; height: 14px; background: #f0f0f0; border-radius: 20px; overflow: hidden; margin-top: 10px; }
  .chart-bar-fill { height: 100%; background: linear-gradient(90deg, #f27a45, #ffbb96); border-radius: 20px; }
`;

const styles = {
  layout: { minHeight: '100vh' },
  main: { padding: '100px 24px 60px', maxWidth: '1240px', margin: '0 auto' },
  topNav: { position: 'fixed', top: 0, left: 0, right: 0, height: '70px', backgroundColor: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 30px', zIndex: 1000, borderBottom: '1px solid #eee' },
  hamburgerBtn: { width: '45px', height: '45px', backgroundColor: '#001529', color: '#fff', borderRadius: '10px', border: 'none', cursor: 'pointer', fontSize: '20px' },
  dropdownMenu: (isOpen) => ({ position: 'fixed', top: isOpen ? '80px' : '-500px', right: '30px', width: '240px', backgroundColor: '#001529', color: '#fff', zIndex: 1000, transition: '0.4s', borderRadius: '16px', overflow: 'hidden' }),
  menuItem: (active) => ({ padding: '18px 24px', cursor: 'pointer', backgroundColor: active ? '#1890ff' : 'transparent', display: 'flex', alignItems: 'center', gap: '12px' }),
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '24px' },
  statusTab: (active, color) => ({ flex: 1, padding: '16px', borderRadius: '14px', cursor: 'pointer', textAlign: 'center', backgroundColor: active ? color : '#fff', color: active ? '#fff' : '#555', fontWeight: '700' })
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
        <div className="glass-card" style={{ padding: '40px', textAlign: 'center', width: '320px' }}>
          <h2 style={{ color: '#001529' }}>🥘 韓館管理系統</h2>
          <input type="password" placeholder="管理員密碼" className="menu-edit-input" style={{ marginBottom: '30px', textAlign: 'center' }} value={password} onChange={(e) => setPassword(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleLogin()} />
          <button className="btn-gradient" style={{ width: '100%' }} onClick={handleLogin}>立即登入</button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.layout}>
      <header style={styles.topNav}>
        <div style={{ fontSize: '1.4rem', fontWeight: '900' }}>{tabNames[activeTab]}</div>
        <button style={styles.hamburgerBtn} onClick={() => setIsMenuOpen(!isMenuOpen)}>☰</button>
      </header>
      <div style={styles.dropdownMenu(isMenuOpen)}>
        {['orders', 'history', 'menu_all', 'analytics'].map(tab => (
          <div key={tab} style={styles.menuItem(activeTab === tab)} onClick={() => {setActiveTab(tab); setIsMenuOpen(false);}}>{tabNames[tab]}</div>
        ))}
        <div style={{ ...styles.menuItem(false), color: '#ff4d4f' }} onClick={() => setIsLoggedIn(false)}>🚪 登出</div>
      </div>
      <main style={styles.main}>
        {activeTab === 'orders' && <OrdersView orders={orders} />}
        {activeTab === 'history' && <HistoryView orders={orders} />}
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

// --- 訂單卡片組件 ---
function OrderCard({ order, filter, isReadOnly = false }) {
  const updateOrder = async (id, status) => await updateDoc(doc(db, "orders", id), { status });
  const removeOrder = async (id) => window.confirm("確定永久刪除此訂單？此動作無法復原。") && await deleteDoc(doc(db, "orders", id));

  return (
    <div className={`glass-card ${filter === '待處理' ? 'order-pending' : filter === '處理中' ? 'order-processing' : filter === '已完成' ? 'order-completed' : 'order-archived'}`} 
      style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '320px' }}>
      
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: '800' }}>🪑 桌號：{order.tableNum}</div>
            <div style={{ fontSize: '0.85rem', color: '#666' }}>
              <span className="customer-badge">{order.customerName}</span>
              {order.phone}
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '11px', color: '#999' }}>
              <div>訂單: {order.createdAt?.toDate().toLocaleDateString()}</div>
              <div>{order.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        </div>

        <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '10px', fontSize: '0.9rem' }}>
          <div style={{ marginBottom: '8px', color: '#888', fontSize: '0.8rem', borderBottom: '1px solid #ddd', paddingBottom: '4px' }}>
            💳 {order.paymentMethod || '現金支付'}
          </div>
          {order.items?.map((it, i) => (
            <div key={i} style={{ borderBottom: i === order.items.length - 1 ? 'none' : '1px dashed #eee', padding: '6px 0' }}>
              <strong>{it.emoji || '🍲'} {it.name} x1</strong> 
              <span style={{ float: 'right', color: '#f27a45', fontWeight: 'bold' }}>${it.finalPrice}</span>
              <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                🍜 {it.main || '無'} | ➕ {it.extras?.map(e => e.name).join(', ') || '無'}
              </div>
            </div>
          ))}
          {order.note && <div style={{ marginTop: '10px', color: '#d48806', fontSize: '12px', borderTop: '1px solid #ddd', paddingTop: '5px' }}>📝 備註：{order.note}</div>}
        </div>
      </div>

      <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '15px' }}>
        <div style={{ fontWeight: '900', fontSize: '1.4rem', color: '#001529' }}>總額 ${order.totalAmount}</div>
        {!isReadOnly && (
          <div style={{ display: 'flex', gap: '8px' }}>
            {filter === '待處理' && (
              <>
                <button className="btn-gradient" style={{ background: '#faad14', minWidth: '80px' }} onClick={() => updateOrder(order.id, '處理中')}>接單</button>
                <button className="btn-gradient" style={{ background: '#ff4d4f', minWidth: '80px' }} onClick={() => removeOrder(order.id)}>刪除</button>
              </>
            )}
            {filter === '處理中' && (
              <>
                <button className="btn-gradient" style={{ background: '#52c41a', minWidth: '80px' }} onClick={() => updateOrder(order.id, '已完成')}>完成</button>
                <button className="btn-gradient" style={{ background: '#8c8c8c', minWidth: '80px' }} onClick={() => updateOrder(order.id, '待處理')}>回退</button>
              </>
            )}
            {filter === '已完成' && (
              <>
                <button className="btn-gradient" style={{ background: '#1890ff', minWidth: '80px' }} onClick={() => updateOrder(order.id, '歸檔')}>歸檔</button>
                <button className="btn-gradient" style={{ background: '#8c8c8c', minWidth: '80px' }} onClick={() => updateOrder(order.id, '處理中')}>退回</button>
              </>
            )}
            {filter === '歸檔' && (
              <>
                <button className="btn-gradient" style={{ background: '#52c41a', minWidth: '80px' }} onClick={() => updateOrder(order.id, '已完成')}>退回</button>
                <button className="btn-gradient" style={{ background: '#ff4d4f', minWidth: '80px' }} onClick={() => removeOrder(order.id)}>刪除</button>
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
      <div style={{ display: 'flex', gap: '10px', marginBottom: '30px' }}>
        {['待處理', '處理中', '已完成'].map(s => (
          <div key={s} style={styles.statusTab(filter === s, s === '待處理' ? '#ff4d4f' : s === '處理中' ? '#faad14' : '#52c41a')} onClick={() => setFilter(s)}>
            {s} ({orders.filter(o => o.status === s).length})
          </div>
        ))}
      </div>
      <div style={styles.grid}>
        {orders.filter(o => o.status === filter).map(order => (
          <OrderCard key={order.id} order={order} filter={filter} />
        ))}
      </div>
    </div>
  );
}

function HistoryView({ orders }) {
  const [searchPhone, setSearchPhone] = useState("");
  const archivedOrders = orders.filter(o => o.status === '歸檔');
  const filtered = archivedOrders.filter(o => o.phone?.includes(searchPhone));

  return (
    <div style={{ animation: 'fadeIn 0.5s' }}>
      <div className="admin-section-title">
        {/* 移除原本的標題文字，只留下搜尋框並靠右對齊 */}
        <div style={{ flex: 1 }}></div> 
        <input 
          placeholder="🔍 輸入電話查詢歷史..." 
          className="menu-edit-input" 
          style={{ width: '250px', background: '#fff', borderRadius: '8px', padding: '10px' }}
          value={searchPhone}
          onChange={(e) => setSearchPhone(e.target.value)}
        />
      </div>
      <div style={styles.grid}>
        {filtered.map(order => (
          <OrderCard key={order.id} order={order} filter="歸檔" isReadOnly={false} />
        ))}
        {filtered.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '100px', color: '#999' }}>查無歸檔數據</div>}
      </div>
    </div>
  );
}

function MenuView({ menuItems }) {
  const [isAdding, setIsAdding] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newItem, setNewItem] = useState({ 
    name: '', price: '', emoji: '🍲', category: '經典鍋物', 
    description: '', allowMain: true, allowExtras: true, allowNote: true 
  });

  // 設定感應器：支援滑鼠與手機觸控
  const sensors = useSensors(useSensor(PointerSensor));

  // 取得現有分類清單
  const categories = Array.from(new Set(menuItems.map(it => it.category || "未分類"))).sort();

  // 新增品項邏輯
  const add = async () => {
    if (!newItem.name || !newItem.price) return alert("品名與價格為必填");
    await addDoc(collection(db, "menu"), { 
      ...newItem, 
      price: Number(newItem.price), 
      sortOrder: menuItems.length, // 預設排在最後
      createdAt: serverTimestamp() 
    });
    setIsAdding(false);
    setNewItem({ ...newItem, name: '', price: '', description: '', allowMain: true, allowExtras: true, allowNote: true });
  };

  // 更新欄位邏輯
  const update = async (id, field, val) => await updateDoc(doc(db, "menu", id), { [field]: val });

  // 拖拽結束儲存邏輯
  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = menuItems.findIndex((i) => i.id === active.id);
    const newIndex = menuItems.findIndex((i) => i.id === over.id);
    const newList = arrayMove(menuItems, oldIndex, newIndex);

    const batch = writeBatch(db);
    newList.forEach((item, idx) => {
      batch.update(doc(db, "menu", item.id), { sortOrder: idx });
    });
    await batch.commit();
  };

  // 按分類分組資料
  const grouped = menuItems.reduce((acc, it) => {
    const c = it.category || "未分類";
    if (!acc[c]) acc[c] = [];
    acc[c].push(it);
    return acc;
  }, {});

  return (
    <div>
      <div className="admin-section-title">
        <div style={{ flex: 1 }}></div>
        <button className="btn-gradient" style={{ background: '#1890ff' }} onClick={() => setIsAdding(!isAdding)}>
          {isAdding ? '關閉' : '＋ 新增品項/分類'}
        </button>
      </div>

      {/* 新增面板 */}
      {isAdding && (
        <div className="glass-card" style={{ padding: '24px', marginBottom: '24px', border: '2px dashed #1890ff' }}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ fontSize: '12px', color: '#888' }}>1. 選擇現有大項 或 輸入新分類名稱</label>
            <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
              <select className="menu-edit-input" style={{ flex: 1, background: '#fff' }} value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})}>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                {newCatName && <option value={newCatName}>{newCatName}</option>}
              </select>
              <input placeholder="輸入新分類" className="menu-edit-input" style={{ flex: 1 }} value={newCatName} onChange={e => setNewCatName(e.target.value)} />
              <button className="btn-gradient" style={{ background: '#001529' }} onClick={() => { if(newCatName) {setNewItem({...newItem, category: newCatName}); alert(`已將分類設為: ${newCatName}`);} }}>套用新分類</button>
            </div>
          </div>
          <button className="btn-gradient" style={{ width: '100%', background: '#52c41a', marginTop: '10px' }} onClick={add}>確認新增到菜單</button>
        </div>
      )}

      {/* 列表渲染區塊 */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        {Object.keys(grouped).map(cat => (
          <div key={cat} style={{ marginBottom: '40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
              <div style={{ background: '#001529', color: '#fff', padding: '8px 20px', borderRadius: '8px', fontSize: '1rem', fontWeight: 'bold' }}>{cat}</div>
            </div>
            
            <SortableContext items={grouped[cat].map(i => i.id)} strategy={rectSortingStrategy}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                {grouped[cat].map(item => (
                  <SortableItem key={item.id} id={item.id}>
                    <div className="glass-card" style={{ 
                      padding: '15px', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '10px', 
                      cursor: 'grab',
                      touchAction: 'none' // 重要：防止手機拖動時網頁捲動
                    }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <span style={{ color: '#ccc' }}>⠿</span>
                        <input className="menu-edit-input" style={{ width: '35px' }} value={item.emoji} onChange={e => update(item.id, 'emoji', e.target.value)} />
                        <input className="menu-edit-input" style={{ flex: 1 }} value={item.name} onChange={e => update(item.id, 'name', e.target.value)} />
                        <input className="menu-edit-input" style={{ width: '60px' }} type="number" value={item.price} onChange={e => update(item.id, 'price', Number(e.target.value))} />
                        <button onClick={(e) => { e.stopPropagation(); window.confirm('確定下架？') && deleteDoc(doc(db, "menu", item.id)); }} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer' }}>×</button>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button className={`status-toggle ${item.allowMain ? 'active' : ''}`} onClick={() => update(item.id, 'allowMain', !item.allowMain)}>
                          {item.allowMain ? '🍚 主食' : '⚪ 關閉'}
                        </button>
                        <button className={`status-toggle ${item.allowExtras ? 'active' : ''}`} onClick={() => update(item.id, 'allowExtras', !item.allowExtras)}>
                          {item.allowExtras ? '🥩 加料' : '⚪ 關閉'}
                        </button>
                        <button className={`status-toggle ${item.allowNote ? 'active' : ''}`} onClick={() => update(item.id, 'allowNote', !item.allowNote)} style={{ background: item.allowNote ? '#722ed1' : '#f0f0f0' }}>
                          {item.allowNote ? '📝 備註' : '⚪ 關閉'}
                        </button>
                      </div>
                    </div>
                  </SortableItem>
                ))}
              </div>
            </SortableContext>
          </div>
        ))}
      </DndContext>
    </div>
  );
}

// 需確保檔案上方有 import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
// 需確保檔案上方有 import { SortableContext, rectSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
// 需確保檔案上方有 import { CSS } from '@dnd-kit/utilities';

function DynamicConfigView({ title, collectionName, data, hasPrice = false, placeholder }) {
  const [isAdding, setIsAdding] = useState(false);
  // 加入 type 欄位，方便加料區分類
  const [newItem, setNewItem] = useState({ name: '', price: 0, icon: '✨', type: '預設' });
  
  const sensors = useSensors(useSensor(PointerSensor));

  const add = async () => {
    if (!newItem.name) return;
    // 新增時自動帶入 sortOrder (排在最後面)
    await addDoc(collection(db, collectionName), { 
      ...newItem, 
      sortOrder: data.length,
      createdAt: serverTimestamp() 
    });
    setNewItem({ name: '', price: 0, icon: '✨', type: newItem.type });
    setIsAdding(false);
  };

  const updatePrice = async (id, newPrice) => {
    await updateDoc(doc(db, collectionName, id), { price: Number(newPrice) });
  };

const handleDragEnd = async (event) => {
  const { active, over } = event;
  
  // 如果位置沒變，就不做事
  if (!over || active.id === over.id) return;

  // 1. 算出新舊位置的順序
  const oldIndex = data.findIndex((i) => i.id === active.id);
  const newIndex = data.findIndex((i) => i.id === over.id);
  
  // 2. 重新排列記憶體中的陣列
  const newList = arrayMove(data, oldIndex, newIndex);
  
  // 3. 【關鍵：同步到資料庫】
  // 使用 writeBatch 一次性更新所有品項的 sortOrder
  const batch = writeBatch(db); 
  newList.forEach((item, idx) => {
    const itemRef = doc(db, collectionName, item.id);
    batch.update(itemRef, { sortOrder: idx });
  });

  try {
    await batch.commit(); // 正式送出更新到 Firebase
    console.log("排序儲存成功！");
  } catch (error) {
    console.error("排序儲存失敗：", error);
  }
};

  // 根據分類(type)將資料分組 (如果是主食區沒設 type，會自動歸類在「預設」)
  const groupedData = data.reduce((acc, item) => {
    const t = item.type || '預設';
    if (!acc[t]) acc[t] = [];
    acc[t].push(item);
    return acc;
  }, {});

  return (
    <div style={{ marginTop: '40px' }}>
      <div className="admin-section-title">
        <span>{title}</span>
        <button className="btn-gradient" style={{ background: '#52c41a' }} onClick={() => setIsAdding(!isAdding)}>+</button>
      </div>

      {isAdding && (
        <div className="glass-card" style={{ padding: '15px', marginBottom: '15px' }}>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {/* 加料區需要填寫分類 */}
            {hasPrice && (
              <input placeholder="分類(如:肉類)" className="menu-edit-input" style={{ width: '100px' }} value={newItem.type} onChange={e => setNewItem({...newItem, type: e.target.value})} />
            )}
            <input placeholder="圖" className="menu-edit-input" style={{ width: '45px' }} value={newItem.icon} onChange={e => setNewItem({...newItem, icon: e.target.value})} />
            <input placeholder={placeholder} className="menu-edit-input" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} />
            {hasPrice && <input placeholder="價格" type="number" className="menu-edit-input" style={{ width: '70px' }} value={newItem.price} onChange={e => setNewItem({...newItem, price: Number(e.target.value)})} />}
            <button className="btn-gradient" style={{ background: '#52c41a' }} onClick={add}>確認新增</button>
          </div>
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={data.map(i => i.id)} strategy={rectSortingStrategy}>
          {Object.keys(groupedData).map(type => (
            <div key={type} style={{ marginBottom: '20px' }}>
              {/* 如果是加料區才顯示分類小標題 */}
              {hasPrice && <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px', fontWeight: 'bold' }}>📂 {type}</div>}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                {groupedData[type].map(item => (
                  <SortableItem key={item.id} id={item.id}>
                    <div className="glass-card" style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'grab' }}>
                      <span style={{ color: '#ccc' }}>⠿</span>
                      <span style={{ fontSize: '1.1rem' }}>{item.icon} {item.name}</span>
                      {hasPrice && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ color: '#f27a45', fontWeight: 'bold' }}>$</span>
                          <input type="number" style={{ border: 'none', borderBottom: '1px solid orange', width: '50px', fontWeight: 'bold', background: 'transparent' }} defaultValue={item.price} onBlur={(e) => updatePrice(item.id, e.target.value)} />
                        </div>
                      )}
                      <span onClick={(e) => { e.stopPropagation(); window.confirm('刪除？') && deleteDoc(doc(db, collectionName, item.id)); }} style={{ color: '#ff4d4f', cursor: 'pointer', marginLeft: '5px' }}>×</span>
                    </div>
                  </SortableItem>
                ))}
              </div>
            </div>
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}

// 拖拽需要的子元件
function SortableItem(props) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: props.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    touchAction: 'none' // 重要：讓手機知道這是拖拽區，不要捲動網頁
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {props.children}
    </div>
  );
}

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
  const orderCount = filteredOrders.length;

  const dishStats = {};
  let totalDishes = 0;
  filteredOrders.forEach(o => {
    o.items?.forEach(it => {
      const key = it.name;
      if(!dishStats[key]) dishStats[key] = { count: 0, total: 0, emoji: it.emoji || '🍲' };
      dishStats[key].count += 1;
      dishStats[key].total += Number(it.finalPrice || 0);
      totalDishes += 1;
    });
  });

  const getTimeLabel = () => {
    const d = new Date(selectedDate);
    if (viewType === 'daily') return d.toLocaleDateString();
    if (viewType === 'monthly') return `${d.getFullYear()}年 ${d.getMonth() + 1}月`;
    return `${d.getFullYear()}年度`;
  };

  return (
    <div style={{ animation: 'fadeIn 0.5s' }}>
      <div className="admin-section-title">
        {/* 移除原本標題文字，保留功能按鈕 */}
        <div style={{ flex: 1 }}></div> 
        <div className="analytics-tabs">
          <button className={`view-tab ${viewType === 'daily' ? 'active' : ''}`} onClick={() => setViewType('daily')}>每日</button>
          <button className={`view-tab ${viewType === 'monthly' ? 'active' : ''}`} onClick={() => setViewType('monthly')}>每月</button>
          <button className={`view-tab ${viewType === 'yearly' ? 'active' : ''}`} onClick={() => setViewType('yearly')}>每年</button>
        </div>
      </div>

      <div style={{ marginBottom: '30px', display: 'flex', justifyContent: 'flex-start' }}>
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

      <div className="glass-card" style={{ padding: '40px 20px', textAlign: 'center', marginBottom: '30px', borderBottom: '6px solid var(--brand-orange)' }}>
        <div style={{ color: '#888', marginBottom: '10px', fontWeight: 'bold', fontSize: '1.1rem' }}>{getTimeLabel()} 營收總額</div>
        <div style={{ fontSize: '3.8rem', fontWeight: '900', color: '#f27a45', margin: '10px 0' }}>NT$ {totalAmount.toLocaleString()}</div>
        <div style={{ color: '#666', fontSize: '1.1rem' }}>共完成 <span style={{ color: '#001529', fontWeight: 'bold' }}>{orderCount}</span> 筆訂單</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '30px', alignItems: 'start' }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>📝 成交訂單明細</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {filteredOrders.map((o, idx) => (
              <div key={o.id} className="glass-card" style={{ padding: '18px', borderLeft: '5px solid #f27a45' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontWeight: '800', color: '#001529' }}>#{String(idx + 1).padStart(4, '0')} 訂單</span>
                  <span style={{ color: '#f27a45', fontWeight: '900' }}>${o.totalAmount}</span>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '8px' }}>{o.createdAt?.toDate().toLocaleString()} · {o.tableNum}桌</div>
                <div style={{ fontSize: '0.9rem', color: '#555' }}>
                  {o.items?.map((it, i) => <span key={i}>🔥 {it.name}{i < o.items.length-1 ? '、' : ''}</span>)}
                </div>
              </div>
            ))}
            {orderCount === 0 && <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: '#999' }}>此時段尚無交易數據</div>}
          </div>
        </div>

        <div>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>📊 熱門品項銷售分佈</h3>
          <div className="glass-card" style={{ padding: '25px' }}>
            {Object.entries(dishStats).sort((a,b) => b[1].count - a[1].count).map(([name, data]) => {
              const percentage = totalDishes > 0 ? (data.count / totalDishes) * 100 : 0;
              return (
                <div key={name} style={{ marginBottom: '25px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: '700', fontSize: '1rem', color: '#001529' }}>{data.emoji} {name}</div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ color: '#f27a45', fontWeight: '900', fontSize: '1.1rem' }}>{data.count} 份</span>
                      <span style={{ color: '#999', fontSize: '0.8rem', marginLeft: '8px' }}>(${data.total.toLocaleString()})</span>
                    </div>
                  </div>
                  <div className="chart-bar-container">
                    <div className="chart-bar-fill" style={{ width: `${percentage}%` }}></div>
                  </div>
                </div>
              );
            })}
            {Object.keys(dishStats).length === 0 && <div style={{ textAlign: 'center', color: '#999' }}>暫無銷售數據</div>}
          </div>
        </div>
      </div>
    </div>
  );
}