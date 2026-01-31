import React, { useState, useRef, useEffect } from 'react';
import { Account, AccountType, Currency } from '../types';
import { GAS_URL } from '../services/storageService';
import { 
  Plus, Loader2, TrendingUp, Building2, 
  Minus, ScanLine, CloudUpload, Sparkles, X, Trash2, CheckCircle2,
  Search, ArrowRight, TrendingDown, RefreshCw, Coins, Receipt, Calculator, DollarSign, Check
} from 'lucide-react';
import { parseFinancialStatement, ScannedAsset } from '../services/geminiService';
import Confetti from './Confetti';

interface UpdatePageProps {
  accounts: Account[];
  onSave: (updatedAccounts: Account[]) => void;
  userPwd: string;
}

// 同步成功彈窗
const SyncSuccessModal = ({ isOpen, onClose, data }: { isOpen: boolean, onClose: () => void, data: any }) => {
  if (!isOpen) return null;
  const isPositive = data.netChange >= 0;
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-6 z-[9999] backdrop-blur-xl">
      <div className="bg-white w-full max-w-sm rounded-[2.5rem] overflow-hidden shadow-2xl relative animate-in zoom-in-95">
        <div className={`p-8 pb-10 text-white text-center ${isPositive ? 'bg-[#0052CC]' : 'bg-gray-800'}`}>
          <div className="bg-white/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 border border-white/30 shadow-lg">
            <CheckCircle2 size={32} />
          </div>
          <h3 className="text-xl font-black tracking-tight">✅ 同步成功！</h3>
        </div>
        <div className="px-6 py-6 -mt-6 bg-white rounded-t-[2.5rem] relative z-10 space-y-5">
          <div className="grid grid-cols-2 gap-3 text-center">
             <div className="bg-blue-50/50 p-3 rounded-2xl border border-blue-100">
                <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">銀行總額</div>
                <div className="text-sm font-black text-gray-800">HK${Math.round(data.bankTotal).toLocaleString()}</div>
             </div>
             <div className="bg-purple-50/50 p-3 rounded-2xl border border-purple-100">
                <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">股票總額</div>
                <div className="text-sm font-black text-gray-800">HK${Math.round(data.stockTotal).toLocaleString()}</div>
             </div>
          </div>
          <div className="text-center bg-gray-50 rounded-2xl p-4 border border-gray-100">
             <p className="text-xs font-black text-gray-400 uppercase mb-1">💎 總淨資產</p>
             <div className="text-3xl font-black text-gray-800 tracking-tighter">HK${Math.round(data.totalNetWorth).toLocaleString()}</div>
             <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold mt-2 ${isPositive ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>
                {isPositive ? <TrendingUp size={12}/> : <TrendingDown size={12}/>}
                {isPositive ? '+' : ''}HK${Math.round(data.netChange).toLocaleString()}
             </div>
          </div>
          <button onClick={onClose} className="w-full py-4 bg-gray-900 text-white rounded-[1.5rem] font-black flex items-center justify-center gap-2">確定 <ArrowRight size={20} /></button>
        </div>
      </div>
    </div>
  );
};

const UpdatePage: React.FC<UpdatePageProps> = ({ accounts, onSave, userPwd }) => {
  const [activeTab, setActiveTab] = useState<'MANUAL' | 'AI_SCANNER'>('MANUAL');
  const [showConfetti, setShowConfetti] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [localAccounts, setLocalAccounts] = useState<Account[]>([...accounts]);
  
  useEffect(() => { setLocalAccounts([...accounts]); }, [accounts]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [syncSummary, setSyncSummary] = useState({ totalNetWorth: 0, bankTotal: 0, stockTotal: 0, netChange: 0 });
  
  // New Asset State
  const [newAssetType, setNewAssetType] = useState<AccountType | null>(null);
  const [newItemData, setNewItemData] = useState({ name: '', symbol: '', amount: '', currency: 'HKD' as Currency });
  const [addedCount, setAddedCount] = useState(0); // Track items added in current modal session
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scannedItems, setScannedItems] = useState<ScannedAsset[]>([]);
  const aiInputRef = useRef<HTMLInputElement>(null);
  const [isFetchingPreview, setIsFetchingPreview] = useState(false);
  const [previewPrice, setPreviewPrice] = useState<number | string>("");
  const [previewYield, setPreviewYield] = useState<number | string>("");

  const calculateValueHKD = (acc: Account) => {
    const q = Number(acc.quantity) || 0, p = Number(acc.lastPrice) || 0, b = Number(acc.balance) || 0;
    let val = acc.type === AccountType.STOCK ? (q * p) : b;
    if(acc.currency === 'USD') val *= 7.82;
    if(acc.currency === 'AUD') val *= 5.15;
    return isNaN(val) ? 0 : val;
  };

  const fetchSinglePrice = async (sym: string) => {
    if (!sym) return { price: 0, dividendYield: 0 };
    // FIX: Use prop userPwd instead of unreliable localStorage
    const pwd = userPwd || "8888"; 
    try {
      const url = `${GAS_URL}?action=READ_STOCKS&userId=${encodeURIComponent(pwd)}&symbol=${encodeURIComponent(sym.toUpperCase().trim())}`;
      const res = await fetch(url);
      const d = await res.json();
      return { price: Number(d.price) || 0, dividendYield: Number(d.yield) || 0 };
    } catch (e) { 
        console.error("Price fetch error:", e);
        return { price: 0, dividendYield: 0 }; 
    }
  };

  const formatStockSymbol = (input: string) => {
    let s = input.trim().toUpperCase();
    if (!s) return "";
    if (s.includes('.')) return s;
    if (/^\d+$/.test(s)) return s.padStart(4, '0') + ".HK";
    const commonAuStocks = ['ANZ', 'CBA', 'NAB', 'WBC', 'MQG', 'BHP', 'RIO', 'FMG', 'NST', 'PLS'];
    if (commonAuStocks.includes(s)) return s + ".AX";
    return s;
  };

  const handleFinalSave = async (updatedLocalAccounts: Account[]) => {
    setIsSaving(true);
    // FIX: Use prop userPwd
    const pwd = userPwd || "8888";
    try {
        const storedData = JSON.parse(localStorage.getItem('wealth_snapshot_v1') || '{}');
        const currentFDs = storedData.fixedDeposits || [];
        const accountTotal = updatedLocalAccounts.reduce((sum, a) => sum + calculateValueHKD(a), 0);
        const fdTotal = currentFDs.reduce((sum: number, f: any) => sum + Number(f.principal || 0), 0);
        const currentTotal = accountTotal + fdTotal;
        // Old total calc might be slightly inaccurate if LS is stale, but acceptable for summary
        const oldTotal = accounts.reduce((sum, acc) => sum + calculateValueHKD(acc), 0) + fdTotal;

        const payload = {
            userId: pwd,
            total: currentTotal,
            assets: [
              ...updatedLocalAccounts.map(acc => ({
                inst: acc.name, 
                sym: (acc.symbol || "").trim().toUpperCase(),
                qty: acc.type === AccountType.STOCK ? Number(acc.quantity || 0) : 0,
                prc: acc.type === AccountType.STOCK ? Number(acc.lastPrice || 0) : 0,
                bal: acc.type === AccountType.CASH ? Number(acc.balance || 0) : 0,
                cur: acc.currency || "HKD",
                type: acc.type === AccountType.STOCK ? 'STOCK' : 'CASH',
                isFD: false,
                yield: acc.dividendYield || 0 
              })),
              ...currentFDs.map((fd: any) => ({
                inst: fd.bankName, sym: "-", qty: 0, prc: 0, bal: Number(fd.principal || 0), cur: fd.currency, type: 'CASH', isFD: true, maturityDate: fd.maturityDate
              }))
            ]
        };

        const response = await fetch(GAS_URL, { 
            method: 'POST', 
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload) 
        });

        if (!response.ok) throw new Error("Network Error");
        let bnk = 0, stk = 0;
        updatedLocalAccounts.forEach(a => { 
            const v = calculateValueHKD(a); 
            if(a.type === AccountType.STOCK) stk += v; else bnk += v; 
        });

        setSyncSummary({ totalNetWorth: currentTotal, bankTotal: bnk + fdTotal, stockTotal: stk, netChange: currentTotal - oldTotal });
        setLocalAccounts(updatedLocalAccounts);
        setShowConfetti(true);
        setIsSuccessModalOpen(true);
    } catch (e) { alert("同步失敗: " + e); } finally { setIsSaving(false); }
  };

  /**
   * REFRESH ALL: 只更新股價 (Price Only)
   * 不覆蓋手動輸入的 Yield
   */
  const handleUpdateAllPrices = async () => {
    setIsFetchingPreview(true);
    const updated = await Promise.all(localAccounts.map(async (acc) => {
      if (acc.type === AccountType.STOCK && acc.symbol) {
        const { price } = await fetchSinglePrice(acc.symbol); // Only take price
        if (price > 0) {
            return { 
                ...acc, 
                lastPrice: price, 
                // dividendYield: dividendYield,  // Keep existing yield
                balance: Math.round((acc.quantity || 0) * price) 
            };
        }
      }
      return acc;
    }));
    setLocalAccounts(updated);
    setIsFetchingPreview(false);
  };

  /**
   * 單一更新：只更新股價 (Price Only)
   */
  const handleManualSinglePriceUpdate = async (id: string, symbol?: string) => {
    if (!symbol) return;
    // Add visual feedback for single item loading if needed, or rely on UI to update
    const { price } = await fetchSinglePrice(symbol); // Only take price
    if (price > 0) {
      setLocalAccounts(prev => prev.map(item => 
        item.id === id ? {
            ...item, 
            lastPrice: price, 
            // Keep existing yield
            balance: Math.round((item.quantity || 0) * price)
        } : item
      ));
    } else {
        alert("Unable to fetch price for " + symbol + ". Please check symbol or try again.");
    }
  };

  // --- AI Scanner Handlers ---

  const handleAIFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsAnalyzing(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64 = (reader.result as string).split(',')[1];
        const results = await parseFinancialStatement(base64);
        if (results) {
           // Initial fetch for convenience
           const processed = await Promise.all(results.map(async (item) => {
             const finalName = (item.institution && item.institution !== 'Unknown') ? item.institution : (item.category === 'STOCK' ? 'Stocks' : 'Deposit');
             let livePrice = 0;
             let liveYield = 0;
             if(item.category === 'STOCK' && item.symbol) {
                 const d = await fetchSinglePrice(item.symbol);
                 livePrice = d.price;
                 liveYield = d.dividendYield;
             }
             return { 
                 ...item, 
                 institution: finalName, 
                 price: livePrice || item.price || 0, // Use AI price if live price fails or not found
                 dividendYield: liveYield
             };
           }));
           setScannedItems(processed);
        }
      } catch(e) { alert("AI 分析失敗"); } finally { setIsAnalyzing(false); if(aiInputRef.current) aiInputRef.current.value = ""; }
    };
    reader.readAsDataURL(file);
  };

  const updateScannedItem = (index: number, field: keyof ScannedAsset, value: any) => {
      const newItems = [...scannedItems];
      newItems[index] = { ...newItems[index], [field]: value };
      setScannedItems(newItems);
  };

  const handleBulkSetCurrency = (cur: string) => {
      setScannedItems(prev => prev.map(item => ({ ...item, currency: cur })));
  };

  const handleBulkRefreshPrices = async () => {
      setIsFetchingPreview(true);
      const updated = await Promise.all(scannedItems.map(async item => {
          if (item.category === 'STOCK' && item.symbol) {
              const { price, dividendYield } = await fetchSinglePrice(item.symbol);
              if (price > 0) {
                  return { ...item, price, dividendYield };
              }
          }
          return item;
      }));
      setScannedItems(updated);
      setIsFetchingPreview(false);
  };

  const handleSingleScannedRefresh = async (index: number) => {
      const item = scannedItems[index];
      if (!item.symbol) return;
      const { price, dividendYield } = await fetchSinglePrice(item.symbol);
      if (price > 0) {
          updateScannedItem(index, 'price', price);
          updateScannedItem(index, 'dividendYield', dividendYield);
      }
  };

  // --- Add Asset Logic (Local Only) ---
  const handleAddToLocalList = async () => {
      const sym = formatStockSymbol(newItemData.symbol);
      const currentPrice = Number(previewPrice) || 0;
      
      let finalCurrency: Currency = newItemData.currency;
      if (newAssetType === AccountType.STOCK) {
          if (sym.endsWith('.HK')) {
              finalCurrency = 'HKD';
          } else if (sym.endsWith('.AX')) {
              finalCurrency = 'AUD';
          } else {
              finalCurrency = 'USD';
          }
      }

      const newAcc: Account = { 
          id: Date.now().toString(), 
          name: newItemData.name || (newAssetType === AccountType.STOCK ? sym : 'Deposit'), 
          type: newAssetType!, 
          currency: finalCurrency, 
          symbol: sym, 
          quantity: newAssetType === AccountType.STOCK ? Number(newItemData.amount) : undefined, 
          balance: newAssetType === AccountType.CASH ? Number(newItemData.amount) : Math.round(Number(newItemData.amount) * currentPrice), 
          lastPrice: currentPrice,
          dividendYield: newAssetType === AccountType.STOCK ? (Number(previewYield) || 0) : undefined
      };
      
      // Update local state ONLY
      setLocalAccounts(prev => [...prev, newAcc]);
      
      // Reset fields for next entry
      setNewItemData({ name: '', symbol: '', amount: '', currency: 'HKD' });
      setPreviewPrice("");
      setPreviewYield("");
      setAddedCount(prev => prev + 1);
  };

  return (
    <div className="p-6 pb-32 space-y-6 bg-gray-50 min-h-screen">
      <Confetti active={showConfetti} onComplete={() => setShowConfetti(false)} />
      <SyncSuccessModal isOpen={isSuccessModalOpen} onClose={() => { setIsSuccessModalOpen(false); onSave(localAccounts); }} data={syncSummary} />

      {/* Tab 切換 */}
      <div className="bg-gray-200 p-1 rounded-2xl flex">
        {['MANUAL', 'AI_SCANNER'].map(t => (
          <button key={t} onClick={() => setActiveTab(t as any)} className={`flex-1 py-3 rounded-xl text-xs font-black ${activeTab === t ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>{t === 'MANUAL' ? '手動更新' : 'AI 掃描'}</button>
        ))}
      </div>

      {activeTab === 'MANUAL' ? (
        <div className="space-y-8 animate-in fade-in">
          {/* Bank 區塊 */}
          <section>
            <div className="flex justify-between items-center mb-4 px-2">
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center"><Building2 size={14} className="mr-2" /> Bank</h2>
              <button onClick={() => { setNewAssetType(AccountType.CASH); setAddedCount(0); setIsModalOpen(true); }} className="text-blue-600 font-black text-xs">+ ADD</button>
            </div>
            {localAccounts.filter(a => a.type === AccountType.CASH).map(acc => (
              <div key={acc.id} className="bg-white p-5 rounded-3xl mb-3 flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-3">
                  <button onClick={() => setLocalAccounts(prev => prev.filter(p => p.id !== acc.id))} className="text-gray-200 hover:text-red-400"><Trash2 size={16}/></button>
                  <div className="flex flex-col">
                    <span className="font-bold text-gray-700">{acc.name}</span>
                    <span className="text-[9px] font-black text-gray-400 uppercase">{acc.currency}</span>
                  </div>
                </div>
                <input type="number" value={acc.balance} onChange={e => setLocalAccounts(prev => prev.map(p => p.id === acc.id ? {...p, balance: Number(e.target.value)} : p))} className="w-24 text-right font-black text-blue-600 bg-transparent outline-none" />
              </div>
            ))}
          </section>

          {/* Stocks 區塊 */}
          <section>
            <div className="flex justify-between items-center mb-4 px-2">
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center"><TrendingUp size={14} className="mr-2" /> Stocks</h2>
              <div className="flex gap-4">
                <button onClick={handleUpdateAllPrices} className="text-green-600 font-black text-xs flex items-center gap-1">
                  <RefreshCw size={12} className={isFetchingPreview ? 'animate-spin' : ''} /> REFRESH PRICES
                </button>
                <button onClick={() => { setNewAssetType(AccountType.STOCK); setAddedCount(0); setIsModalOpen(true); }} className="text-blue-600 font-black text-xs">+ ADD</button>
              </div>
            </div>
            {localAccounts.filter(a => a.type === AccountType.STOCK).map(acc => {
              const nativeValue = (Number(acc.quantity) || 0) * (Number(acc.lastPrice) || 0);
              return (
                <div key={acc.id} className="bg-white p-5 rounded-[2rem] mb-4 shadow-sm border border-gray-100">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <button onClick={() => setLocalAccounts(prev => prev.filter(p => p.id !== acc.id))} className="text-gray-200 hover:text-red-400"><Trash2 size={16}/></button>
                      <div>
                        <div className="font-black text-gray-800 text-lg uppercase">{acc.symbol}</div>
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] font-bold text-blue-400 uppercase italic">Price:</span>
                          <div className="flex items-center bg-blue-50 rounded px-1">
                              <input type="number" value={acc.lastPrice} onChange={e => {
                                const p = Number(e.target.value);
                                setLocalAccounts(prev => prev.map(item => item.id === acc.id ? {...item, lastPrice: p, balance: Math.round((item.quantity || 0) * p)} : item));
                              }} className="w-16 bg-transparent text-blue-600 font-black text-[10px] outline-none" />
                              <span className="text-[9px] font-black text-blue-300 ml-1">{acc.currency}</span>
                          </div>
                          {/* Price Only Refresh Button */}
                          <button onClick={() => handleManualSinglePriceUpdate(acc.id, acc.symbol)} className="text-blue-600 p-1 hover:bg-blue-50 rounded-full" title="Update Price Only"><RefreshCw size={12}/></button>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      {/* 總值顯示：當地貨幣為主 */}
                      <div className="font-black text-blue-600 text-base">
                          {acc.currency} {nativeValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      
                      {/* Dividend Yield Edit Section - Vertically Stacked for cleaner UI */}
                      <div className="flex flex-col items-end gap-1 mt-1.5">
                          <div className="flex items-center bg-green-50 rounded-lg px-2 py-1 border border-green-100 transition-colors hover:border-green-300">
                              <Receipt size={12} className="mr-1.5 text-green-600"/>
                              <span className="text-[10px] font-extrabold text-green-700 mr-1">Yield</span>
                              <input 
                                  type="number" 
                                  step="0.01"
                                  value={acc.dividendYield ?? ''} 
                                  onChange={e => {
                                      const val = e.target.value;
                                      setLocalAccounts(prev => prev.map(p => p.id === acc.id ? {...p, dividendYield: val === '' ? 0 : Number(val)} : p));
                                  }}
                                  className="w-12 bg-transparent text-green-700 font-black text-xs outline-none text-right placeholder-green-300" 
                                  placeholder="0"
                              />
                              <span className="text-[10px] font-extrabold text-green-700 ml-0.5">%</span>
                          </div>
                          <div className="text-[10px] font-bold text-gray-400 uppercase italic">
                            ≈ HK${Math.round(calculateValueHKD(acc)).toLocaleString()}
                          </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-2xl">
                    <button onClick={() => setLocalAccounts(prev => prev.map(p => p.id === acc.id ? {...p, quantity: Math.max(0, (Number(p.quantity)||0)-1), balance: Math.round(Math.max(0, (Number(p.quantity)||0)-1) * (p.lastPrice||0))} : p))} className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-gray-400"><Minus size={16}/></button>
                    <input type="number" value={acc.quantity} onChange={e => {
                      const q = Number(e.target.value);
                      setLocalAccounts(prev => prev.map(p => p.id === acc.id ? {...p, quantity: q, balance: Math.round(q * (p.lastPrice||0))} : p));
                    }} className="flex-1 text-center font-black bg-transparent outline-none text-gray-700" />
                    <button onClick={() => setLocalAccounts(prev => prev.map(p => p.id === acc.id ? {...p, quantity: (Number(p.quantity)||0)+1, balance: Math.round(((Number(p.quantity)||0)+1) * (p.lastPrice||0))} : p))} className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-gray-400"><Plus size={16}/></button>
                  </div>
                </div>
              );
            })}
          </section>

          {/* 固定同步按鈕 (Main Save Button) */}
          <button onClick={() => handleFinalSave(localAccounts)} disabled={isSaving} className="fixed bottom-28 left-6 right-6 bg-blue-600 text-white py-5 rounded-full font-black shadow-2xl flex justify-center items-center gap-3 active:scale-95 disabled:bg-gray-300 z-50">
            {isSaving ? <Loader2 className="animate-spin" /> : <CloudUpload size={20} />} 
            {isSaving ? '同步中...' : '儲存並同步至雲端'}
          </button>
        </div>
      ) : (
        /* AI 掃描區塊 (功能全開 - 編輯模式) */
        <div className="space-y-6 animate-in fade-in">
          {scannedItems.length === 0 && (
             <div onClick={() => !isAnalyzing && aiInputRef.current?.click()} className={`border-2 border-dashed rounded-[2.5rem] p-16 text-center transition-all ${isAnalyzing ? 'border-blue-300 bg-blue-50' : 'border-gray-300 bg-white cursor-pointer'}`}>
               <input type="file" ref={aiInputRef} className="hidden" accept="image/*" onChange={handleAIFileUpload} />
               {isAnalyzing ? (
                 <div className="flex flex-col items-center"><Loader2 className="w-12 h-12 text-blue-600 animate-spin" /><p className="mt-4 font-black text-blue-600 text-xs uppercase">正在分析報表...</p></div>
               ) : (
                 <div className="flex flex-col items-center"><ScanLine className="w-12 h-12 text-gray-300 mb-4" /><p className="font-black text-gray-400 text-xs tracking-widest uppercase">上傳報表圖片</p></div>
               )}
             </div>
          )}

          {scannedItems.length > 0 && (
            <div className="mb-24">
              {/* Header */}
              <div className="flex justify-between items-center mb-4">
                 <div className="flex items-center gap-2 font-black italic text-blue-600"><Sparkles size={18}/> 掃描結果 ({scannedItems.length})</div>
                 <button onClick={() => setScannedItems([])} className="text-gray-400 p-2"><X size={20}/></button>
              </div>

              {/* Bulk Actions Toolbar */}
              <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 mb-4 flex gap-2 overflow-x-auto no-scrollbar">
                  <div className="flex gap-1 items-center px-2 border-r border-gray-100">
                      <span className="text-[9px] font-black text-gray-400 uppercase whitespace-nowrap">SET CURRENCY:</span>
                      {['HKD', 'AUD', 'USD'].map(c => (
                          <button key={c} onClick={() => handleBulkSetCurrency(c)} className="px-2 py-1 bg-gray-50 hover:bg-gray-200 rounded text-[10px] font-bold text-gray-600 transition-colors">{c}</button>
                      ))}
                  </div>
                  <button onClick={handleBulkRefreshPrices} className="flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black whitespace-nowrap active:scale-95 transition-transform">
                      <RefreshCw size={12} className={isFetchingPreview ? 'animate-spin' : ''} /> REFRESH PRICES
                  </button>
              </div>

              {/* Editable List */}
              <div className="space-y-4">
                {scannedItems.map((item, idx) => {
                  const estValue = item.category === 'STOCK' ? (item.amount * (item.price || 0)) : item.amount;
                  return (
                    <div key={idx} className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 relative">
                      <button onClick={() => setScannedItems(prev => prev.filter((_, i) => i !== idx))} className="absolute top-4 right-4 text-gray-300 hover:text-red-400"><X size={16}/></button>
                      
                      {/* Top Row: Type & Name */}
                      <div className="flex gap-3 mb-3 pr-8">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${item.category === 'STOCK' ? 'bg-purple-50 text-purple-600' : 'bg-green-50 text-green-600'}`}>
                              {item.category === 'STOCK' ? <TrendingUp size={18}/> : <Building2 size={18}/>}
                          </div>
                          <div className="flex-1">
                              <input 
                                value={item.institution} 
                                onChange={(e) => updateScannedItem(idx, 'institution', e.target.value)} 
                                className="w-full font-bold text-gray-800 bg-transparent outline-none placeholder-gray-300"
                                placeholder="Asset Name"
                              />
                              <div className="flex items-center gap-2 mt-1">
                                  {item.category === 'STOCK' && (
                                    <div className="relative flex items-center">
                                        <input 
                                            value={item.symbol || ''} 
                                            onChange={(e) => updateScannedItem(idx, 'symbol', e.target.value.toUpperCase())}
                                            className="w-20 bg-gray-50 rounded px-2 py-0.5 text-[10px] font-black text-gray-600 uppercase outline-none" 
                                            placeholder="SYMBOL"
                                        />
                                        <button onClick={() => handleSingleScannedRefresh(idx)} className="ml-1 text-blue-500 hover:scale-110 transition-transform"><RefreshCw size={12}/></button>
                                    </div>
                                  )}
                                  <select 
                                      value={item.currency} 
                                      onChange={(e) => updateScannedItem(idx, 'currency', e.target.value)}
                                      className="bg-gray-50 rounded px-2 py-0.5 text-[10px] font-black text-gray-500 outline-none"
                                  >
                                      <option value="HKD">HKD</option>
                                      <option value="AUD">AUD</option>
                                      <option value="USD">USD</option>
                                  </select>
                              </div>
                          </div>
                      </div>

                      {/* Middle Row: Quantity & Price (Swapped Positions: Quantity Left, Price Right) */}
                      <div className="grid grid-cols-2 gap-3 mb-3">
                          {/* Quantity Input (Now Left) */}
                          {item.category === 'STOCK' ? (
                            <div className="bg-gray-50 rounded-xl p-2">
                                <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Quantity</label>
                                <input 
                                    type="number" 
                                    value={item.amount} 
                                    onChange={(e) => updateScannedItem(idx, 'amount', Number(e.target.value))}
                                    className="w-full bg-transparent font-black text-gray-700 outline-none"
                                />
                            </div>
                          ) : (
                            // Cash Balance on Left
                            <div className="bg-gray-50 rounded-xl p-2">
                                <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Balance</label>
                                <input 
                                    type="number" 
                                    value={item.amount} 
                                    onChange={(e) => updateScannedItem(idx, 'amount', Number(e.target.value))}
                                    className="w-full bg-transparent font-black text-gray-700 outline-none"
                                />
                            </div>
                          )}

                          {/* Price Input (Now Right) */}
                          {item.category === 'STOCK' && (
                              <div className="bg-blue-50 rounded-xl p-2">
                                  <label className="text-[9px] font-black text-blue-400 uppercase block mb-1">Price ({item.currency})</label>
                                  <input 
                                      type="number" 
                                      value={item.price || ''} 
                                      onChange={(e) => updateScannedItem(idx, 'price', Number(e.target.value))}
                                      className="w-full bg-transparent font-black text-blue-600 outline-none"
                                      placeholder="0.00"
                                  />
                              </div>
                          )}
                      </div>

                      {/* Bottom Row: Total Estimate */}
                      <div className="flex justify-between items-center pt-2 border-t border-gray-50">
                          <div className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                             <Calculator size={12}/> Est. Value
                          </div>
                          <div className="font-black text-gray-800">
                             {item.currency} {estValue.toLocaleString(undefined, {maximumFractionDigits: 0})}
                          </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Import Button */}
              <div className="fixed bottom-28 left-6 right-6 z-40">
                <button onClick={async () => {
                   const enriched = scannedItems.map(item => ({
                     id: Date.now().toString() + Math.random(),
                     name: item.institution || (item.category === 'STOCK' ? 'Stocks' : 'Deposit'),
                     type: item.category === 'STOCK' ? AccountType.STOCK : AccountType.CASH,
                     currency: item.currency as Currency,
                     balance: item.category === 'CASH' ? item.amount : Math.round(item.amount * (item.price || 0)),
                     symbol: item.symbol || '',
                     quantity: item.amount,
                     lastPrice: item.price || 0,
                     dividendYield: item.dividendYield || 0
                   }));
                   await handleFinalSave([...localAccounts, ...enriched]);
                   setScannedItems([]);
                }} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg hover:bg-blue-700 transition-colors">
                    確認匯入 ({scannedItems.length} 筆)
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 新增資產彈窗 (Batch Entry) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-[9999] backdrop-blur-md">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 space-y-6 relative animate-in zoom-in-95">
            {/* Added Counter */}
            {addedCount > 0 && (
                <div className="absolute top-4 left-0 right-0 flex justify-center pointer-events-none">
                    <div className="bg-green-100 text-green-700 text-[10px] font-black px-3 py-1 rounded-full shadow-sm animate-in slide-in-from-top-2 flex items-center gap-1">
                        <Check size={10} /> {addedCount} Added
                    </div>
                </div>
            )}

            <div className="flex justify-between items-center">
              <h3 className="font-black text-xl italic uppercase tracking-tighter">新增 {newAssetType === AccountType.STOCK ? '股票' : '銀行'}</h3>
              {/* Close Button behaves as 'Done' */}
              <button onClick={() => { setIsModalOpen(false); setPreviewPrice(""); setPreviewYield(""); }} className="text-gray-300 hover:text-gray-600"><X size={24}/></button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase">{newAssetType === AccountType.STOCK ? '股票代號' : '名稱'}</label>
                <div className="relative">
                  <input autoFocus placeholder={newAssetType === AccountType.STOCK ? "例如: 700 或 ANZ" : "例如: HSBC"} value={newAssetType === AccountType.STOCK ? newItemData.symbol : newItemData.name} onChange={e => setNewItemData({...newItemData, [newAssetType === AccountType.STOCK ? 'symbol' : 'name']: e.target.value})} onBlur={() => { if (newAssetType === AccountType.STOCK) setNewItemData(prev => ({...prev, symbol: formatStockSymbol(newItemData.symbol)})); }} className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold text-blue-600 uppercase" />
                  {newAssetType === AccountType.STOCK && (
                    <button onClick={async () => {
                       const fmt = formatStockSymbol(newItemData.symbol);
                       setIsFetchingPreview(true);
                       const { price, dividendYield } = await fetchSinglePrice(fmt);
                       setIsFetchingPreview(false);
                       setNewItemData(prev => ({...prev, symbol: fmt}));
                       setPreviewPrice(price);
                       setPreviewYield(dividendYield);
                    }} className="absolute right-2 top-2 p-2 bg-blue-600 text-white rounded-xl active:scale-95">
                       {isFetchingPreview ? <Loader2 className="animate-spin" size={16}/> : <Search size={16} />}
                    </button>
                  )}
                </div>
              </div>
              
              {newAssetType === AccountType.CASH && (
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase">貨幣</label>
                    <select value={newItemData.currency} onChange={e => setNewItemData({...newItemData, currency: e.target.value as Currency})} className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold text-gray-700">
                        <option value="HKD">HKD</option>
                        <option value="AUD">AUD</option>
                        <option value="USD">USD</option>
                    </select>
                </div>
              )}

              {newAssetType === AccountType.STOCK && (
                 <div className="grid grid-cols-2 gap-3">
                     <div className="space-y-1">
                        <label className="text-[10px] font-black text-green-600 uppercase">預計股價</label>
                        <input type="number" value={previewPrice} onChange={e => setPreviewPrice(Number(e.target.value))} className="w-full p-4 bg-green-50 rounded-2xl outline-none font-black text-green-700" placeholder="0.00" />
                     </div>
                     <div className="space-y-1">
                        <label className="text-[10px] font-black text-green-600 uppercase">預計股息率 (%)</label>
                        <input type="number" value={previewYield} onChange={e => setPreviewYield(Number(e.target.value))} className="w-full p-4 bg-green-50 rounded-2xl outline-none font-black text-green-700" placeholder="0.00" />
                     </div>
                 </div>
              )}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase">{newAssetType === AccountType.STOCK ? '持股數量' : '帳戶餘額'}</label>
                <input type="number" value={newItemData.amount} onChange={e => setNewItemData({...newItemData, amount: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold" placeholder="0.00" />
              </div>
              
              {/* Batch Action Buttons */}
              <div className="flex gap-3 pt-2">
                 <button onClick={() => { setIsModalOpen(false); setPreviewPrice(""); setPreviewYield(""); }} className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-2xl font-bold">
                     Done
                 </button>
                 <button onClick={handleAddToLocalList} className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2">
                     Add to List <Plus size={18} />
                 </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UpdatePage;