import React, { useState, useEffect, useContext, useCallback, createContext } from 'react';
import { AppState, ViewState, Account, FixedDeposit } from './types';
import { getStoredData, saveStoredData, calculateTotalWealthHKD, GAS_URL } from './services/storageService';
import Layout from './components/Layout';
import Overview from './components/Overview';
import UpdatePage from './components/UpdatePage';
import Insights from './components/Insights';
import FDManager from './components/FDManager';
import Whitepaper from './components/Whitepaper';
import { 
  RefreshCw, CloudCheck, CloudOff, ShieldCheck, 
  Lock, ChevronRight
} from 'lucide-react';

// --- Context 定義 ---
export interface SyncContextType {
  data: AppState | null;
  userPwd: string;
  setPwd: (pwd: string) => void;
}

export const SyncContext = createContext<SyncContextType>({
  data: null,
  userPwd: '',
  setPwd: () => {},
});

const App: React.FC = () => {
  const { userPwd, setPwd } = useContext(SyncContext);
  const [data, setData] = useState<AppState | null>(() => {
    try { return getStoredData(); } catch (e) { return null; }
  });
  const [currentView, setCurrentView] = useState<ViewState>('overview');
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'offline'>('synced');
  const [inputPwd, setInputPwd] = useState('');
  const [cloudSummary, setCloudSummary] = useState<{total: number, dividend: number} | null>(null);

  // --- 1. 計算總資產邏輯 ---
  const calculateCorrectedTotalWealth = useCallback((accounts: Account[], fds: FixedDeposit[]) => {
    // 過濾掉非定存類型的項目（如有需要）
    const effectiveFDs = fds.filter(fd => fd.type !== 'Savings');
    return calculateTotalWealthHKD(accounts, effectiveFDs);
  }, []);

  // --- 2. 核心同步功能 (Write to Google Sheet & Firebase) ---
  const triggerCloudSync = async (newState: AppState) => {
    if (!userPwd || userPwd === '') return;
    setSyncStatus('syncing');

    // A. Firebase 同步
    const { firebaseDB, firebaseRef, firebaseSet } = window as any;
    if (firebaseDB && firebaseRef && firebaseSet) {
      try {
        const userRef = firebaseRef(firebaseDB, `users/${userPwd}/current_status`);
        await firebaseSet(userRef, newState);
      } catch (e) { console.error("Firebase error:", e); }
    }

    // B. Google Sheet 同步 (精準對位版)
    try {
      const totalWealth = calculateCorrectedTotalWealth(newState.accounts, newState.fixedDeposits);
      
      const allAssets = [
        // 股票與現金帳戶
        ...newState.accounts.map(acc => ({
          inst: acc.name,             // 填入 Stocks I 欄: Original_Input
          sym: (acc.symbol || "").trim().toUpperCase(), 
          qty: acc.type === 'Stock' ? Number(acc.quantity || 0) : 0, 
          prc: acc.type === 'Stock' ? Number(acc.lastPrice || 0) : 0, 
          bal: acc.type !== 'Stock' ? Number(acc.balance || 0) : 0, 
          cur: acc.currency || "HKD",
          type: acc.type === 'Stock' ? 'STOCK' : 'CASH',
          isFD: false,
          rate: "" 
        })),
        // 定期存款
        ...newState.fixedDeposits.map(fd => ({
          inst: fd.bankName,          // 對應 Original_Input
          sym: "-",
          qty: 0,
          prc: 0,
          bal: Number(fd.principal || 0),
          cur: fd.currency,
          type: 'CASH',
          isFD: true,
          maturityDate: fd.maturityDate,
          rate: fd.interestRate || "" // 傳給 GAS 生成 Reference (例如 3.5%)
        }))
      ];

      const response = await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          userId: userPwd,
          total: totalWealth, 
          assets: allAssets
        })
      });
      
      const resJson = await response.json();
      if (resJson.status === "success") {
        setSyncStatus('synced');
      } else {
        throw new Error(resJson.msg);
      }
    } catch (error) { 
      console.error("Sheet Sync Error:", error);
      setSyncStatus('offline'); 
    }
  };

  const updateStateAndSync = (newState: AppState) => {
    saveStoredData(newState);
    setData(newState);
    triggerCloudSync(newState);
  };

  // --- 3. 查股價功能 ---
  const fetchLivePrice = useCallback(async (symbol: string): Promise<number> => {
    if (!symbol || !userPwd) return 0;
    try {
      const response = await fetch(`${GAS_URL}?action=READ_STOCKS&userId=${userPwd}&symbol=${encodeURIComponent(symbol)}`);
      const result = await response.json();
      return result.price || 0;
    } catch (e) { return 0; }
  }, [userPwd]);

  // --- 4. UI 處理函數 ---
  const handleUpdateAccounts = (newAccounts: Account[]) => {
    if (!data) return;
    const totalWealth = calculateCorrectedTotalWealth(newAccounts, data.fixedDeposits);
    const todayStr = new Date().toISOString().slice(0, 7);
    const newHistory = [...(data.history || [])];
    const existingIndex = newHistory.findIndex(h => h.date === todayStr);
    
    if (existingIndex >= 0) newHistory[existingIndex] = { ...newHistory[existingIndex], totalValueHKD: totalWealth };
    else newHistory.push({ date: todayStr, totalValueHKD: totalWealth });
    
    const newState = { ...data, accounts: newAccounts, history: newHistory, lastUpdated: new Date().toISOString() };
    updateStateAndSync(newState);
    setCurrentView('overview');
  };

  const handleUpdateFDs = (newFDs: FixedDeposit[]) => {
    if (!data) return;
    const totalWealth = calculateCorrectedTotalWealth(data.accounts, newFDs);
    const todayStr = new Date().toISOString().slice(0, 7);
    const newHistory = [...(data.history || [])];
    const existingIndex = newHistory.findIndex(h => h.date === todayStr);
    
    if (existingIndex >= 0) newHistory[existingIndex] = { ...newHistory[existingIndex], totalValueHKD: totalWealth };
    else newHistory.push({ date: todayStr, totalValueHKD: totalWealth });
    
    const newState = { ...data, fixedDeposits: newFDs, history: newHistory, lastUpdated: new Date().toISOString() };
    updateStateAndSync(newState);
  };

  const handleSettleFD = (fdId: string, targetAccountId: string, finalAmount: number) => {
    if (!data) return;
    const newAccounts = data.accounts.map(acc => acc.id === targetAccountId ? { ...acc, balance: acc.balance + finalAmount } : acc);
    const newFDs = data.fixedDeposits.filter(fd => fd.id !== fdId);
    const newState = { ...data, accounts: newAccounts, fixedDeposits: newFDs, lastUpdated: new Date().toISOString() };
    updateStateAndSync(newState);
  };

  const handleUpdateGoal = (newGoal: number) => {
    if (!data) return;
    const newState = { ...data, wealthGoal: newGoal };
    updateStateAndSync(newState);
  };

  // --- 5. 登入界面 ---
  if (!userPwd) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-[#0052CC] rounded-[2rem] shadow-xl flex items-center justify-center mb-8 rotate-3">
          <Lock className="text-white w-10 h-10" />
        </div>
        <h1 className="text-3xl font-black text-gray-900 mb-2">WealthSnapshot</h1>
        <p className="text-gray-500 mb-8 font-medium">Your Personal Asset Tracker</p>
        <div className="w-full max-w-sm space-y-4">
          <input
            type="password"
            value={inputPwd}
            onChange={(e) => setInputPwd(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setPwd(inputPwd)}
            placeholder="Enter User ID"
            className="w-full bg-white border-2 border-gray-100 px-6 py-4 rounded-2xl text-center text-xl font-mono tracking-widest focus:border-[#0052CC] focus:outline-none transition-all shadow-sm"
          />
          <button 
            onClick={() => setPwd(inputPwd)} 
            className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-black transition-colors"
          >
            Login & Sync <ChevronRight size={20}/>
          </button>
        </div>
      </div>
    );
  }

  if (!data) return <div className="flex h-screen items-center justify-center"><RefreshCw className="animate-spin text-[#0052CC]" /></div>;

  // --- 6. 主 App 渲染 ---
  return (
    <Layout currentView={currentView} onNavigate={setCurrentView}>
      {/* 同步狀態欄 */}
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-1.5 bg-white/90 backdrop-blur-md border-b border-gray-100 text-[10px] uppercase font-black text-gray-400">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-3 w-3 text-green-500" />
          <span>UserID: {userPwd}</span>
        </div>
        <div className="flex items-center gap-2">
          {syncStatus === 'syncing' && <RefreshCw className="h-2.5 w-2.5 animate-spin" />}
          {syncStatus === 'synced' && <CloudCheck className="h-3 w-3 text-blue-500" />}
          {syncStatus === 'offline' && <CloudOff className="h-3 w-3 text-red-400" />}
          <span>{syncStatus}</span>
        </div>
      </div>

      <div className="pt-8">
        {currentView === 'overview' && (
          <Overview 
            accounts={data.accounts} 
            fixedDeposits={data.fixedDeposits} 
            lastUpdated={data.lastUpdated} 
            cloudSummary={cloudSummary} 
            onNavigateToFD={() => setCurrentView('fd-manager')} 
            onNavigateToUpdate={() => setCurrentView('update')} 
            onNavigateToWhitepaper={() => setCurrentView('whitepaper')} 
            onLogout={() => setPwd('')} 
          />
        )}
        
        {currentView === 'update' && (
          <UpdatePage 
            accounts={data.accounts} 
            onSave={handleUpdateAccounts} 
            fetchLivePrice={fetchLivePrice} 
          />
        )}

        {currentView === 'insights' && (
          <Insights 
            accounts={data.accounts} 
            fixedDeposits={data.fixedDeposits} 
            history={data.history} 
            wealthGoal={data.wealthGoal || 2000000} 
            onUpdateGoal={handleUpdateGoal} 
          />
        )}

        {currentView === 'fd-manager' && (
          <FDManager 
            fds={data.fixedDeposits} 
            accounts={data.accounts} 
            onUpdate={handleUpdateFDs} 
            onSettle={handleSettleFD} 
            onBack={() => setCurrentView('overview')} 
          />
        )}

        {currentView === 'whitepaper' && (
          <Whitepaper onBack={() => setCurrentView('overview')} />
        )}
      </div>
    </Layout>
  );
};

export default App;