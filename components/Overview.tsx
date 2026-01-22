import React, { useState, useMemo, useRef } from 'react';
import { Account, FixedDeposit } from '../types';
import { THEME, MOCK_RATES } from '../constants';
import { calculateTotalWealthHKD } from '../services/storageService';
import { 
  CheckCircle, Clock, Settings, Database, Smartphone, Download, X, 
  Building2, TrendingUp, Globe, FileKey, ChevronRight, LogOut, Receipt, 
  FileJson, Upload, HardDrive, AlertTriangle
} from 'lucide-react';

interface OverviewProps {
  accounts: Account[];
  fixedDeposits: FixedDeposit[];
  lastUpdated: string;
  cloudSummary?: { total: number; dividend: number } | null;
  onNavigateToFD: () => void;
  onNavigateToUpdate: () => void;
  onNavigateToWhitepaper: () => void;
  onLogout: () => void;
}

const Overview: React.FC<OverviewProps> = ({ 
  accounts, 
  fixedDeposits, 
  lastUpdated, 
  cloudSummary,
  onNavigateToFD,
  onNavigateToUpdate,
  onNavigateToWhitepaper,
  onLogout
}) => {
  const [showInAUD, setShowInAUD] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedStockRegion, setSelectedStockRegion] = useState<'HK' | 'AU' | 'US' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Total Calculation ---
  const totalHKD = useMemo(() => {
    const filteredFDs = fixedDeposits.filter(fd => fd.type !== 'Savings');
    return calculateTotalWealthHKD(accounts, filteredFDs);
  }, [accounts, fixedDeposits]);

  const totalAUD = Math.round(totalHKD / MOCK_RATES.AUD);
  const daysSinceUpdate = Math.floor((new Date().getTime() - new Date(lastUpdated).getTime()) / (1000 * 3600 * 24));
  const isStale = daysSinceUpdate > 30;

  // --- Grouping Logic & Weighted Yield Calculation ---
  const assetGroups = useMemo(() => {
    const hkBankTotal = accounts.filter(a => a.type === 'Cash' && a.currency === 'HKD').reduce((sum, a) => sum + a.balance, 0);
    const auBankTotal = accounts.filter(a => a.type === 'Cash' && a.currency === 'AUD').reduce((sum, a) => sum + a.balance, 0);

    const calculateStats = (type: string, currency: string) => {
        const subset = accounts.filter(a => a.type === type && a.currency === currency);
        const total = subset.reduce((sum, a) => sum + a.balance, 0);
        let weightedYieldSum = 0;
        if (type === 'Stock') {
            weightedYieldSum = subset.reduce((sum, a) => sum + (a.balance * (a.dividendYield || 0)), 0);
        }
        return { total, avgYield: total > 0 ? weightedYieldSum / total : 0 };
    };

    const hkStocks = calculateStats('Stock', 'HKD');
    const auStocks = calculateStats('Stock', 'AUD');
    const usStocks = calculateStats('Stock', 'USD');

    return {
      banking: { hk: hkBankTotal, au: auBankTotal },
      stocks: { 
          hk: hkStocks.total, hkYield: hkStocks.avgYield,
          au: auStocks.total, auYield: auStocks.avgYield,
          us: usStocks.total, usYield: usStocks.avgYield
      }
    };
  }, [accounts]);

  const urgentFDs = fixedDeposits.filter(fd => {
    const daysLeft = Math.ceil((new Date(fd.maturityDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
    return daysLeft <= 30;
  }).sort((a, b) => new Date(a.maturityDate).getTime() - new Date(b.maturityDate).getTime());

  // --- Export / Import Logic ---
  const handleExportCSV = () => {
    const headers = ['Type', 'Name', 'Currency', 'Balance/Principal', 'Symbol/Bank', 'Maturity'];
    const accRows = accounts.map(a => [a.type, a.name, a.currency, a.balance, a.symbol || '', '']);
    const fdRows = fixedDeposits.map(f => ['FixedDeposit', f.bankName, f.currency, f.principal, '', f.maturityDate]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...accRows.map(e => e.join(',')), ...fdRows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `wealth_snapshot_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  const handleExportJSON = () => {
    // Read directly from localStorage to ensure we get the FULL state (including history, settings, etc.)
    const rawData = localStorage.getItem('wealth_snapshot_v1');
    if (!rawData) {
        alert("No data found to export.");
        return;
    }
    const blob = new Blob([rawData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `WealthSnapshot_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const content = e.target?.result as string;
            const parsed = JSON.parse(content);
            
            // Basic validation
            if (Array.isArray(parsed.accounts) && Array.isArray(parsed.fixedDeposits)) {
                if (window.confirm("Warning: This will OVERWRITE your current data with the backup file. Continue?")) {
                    localStorage.setItem('wealth_snapshot_v1', JSON.stringify(parsed));
                    alert("Import successful! The app will now reload.");
                    window.location.reload(); // Force reload to apply state
                }
            } else {
                alert("Invalid JSON file format. Missing accounts or fixedDeposits.");
            }
        } catch (error) {
            alert("Failed to parse JSON file.");
        }
    };
    reader.readAsText(file);
    // Reset input so same file can be selected again if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const getRegionStocks = (region: 'HK' | 'AU' | 'US') => {
      const cur = region === 'HK' ? 'HKD' : (region === 'AU' ? 'AUD' : 'USD');
      return accounts.filter(a => a.type === 'Stock' && a.currency === cur);
  };

  return (
    <div className="p-6 space-y-6 pb-24 relative">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
           <h1 className="text-2xl font-bold text-gray-800 tracking-tight">WealthSnapshot</h1>
           <div className={`text-xs font-medium ${isStale ? 'text-red-500' : 'text-gray-400'}`}>
             {isStale ? 'Update needed!' : `Updated ${daysSinceUpdate}d ago`}
           </div>
        </div>
        <button 
          onClick={() => setShowSettings(true)}
          className="p-2 bg-white rounded-full shadow-sm border border-gray-100 text-gray-400 hover:text-[#0052CC] active:scale-95 transition-all"
        >
            <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* Total Wealth Card */}
      <div 
        className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 active:scale-95 transition-transform cursor-pointer"
        onClick={() => setShowInAUD(!showInAUD)}
      >
        <p className="text-gray-500 text-sm font-medium mb-1">Total Net Worth</p>
        <div className="flex items-baseline space-x-2">
          <span className="text-4xl font-bold text-[#0052CC] font-roboto">
            {showInAUD ? '$' + totalAUD.toLocaleString() : '$' + totalHKD.toLocaleString()}
          </span>
          <span className="text-gray-400 font-medium">{showInAUD ? 'AUD' : 'HKD'}</span>
        </div>
        <div className="mt-4 flex items-center text-xs text-gray-400">
           Tap to switch currency
        </div>
      </div>

      {/* Urgent Tasks */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-bold text-gray-800">Urgent Tasks</h2>
          <button onClick={onNavigateToFD} className="text-sm text-[#0052CC] font-medium">Manage FDs</button>
        </div>

        {urgentFDs.length === 0 ? (
          <div className="bg-green-50 rounded-xl p-4 border border-green-100 flex items-center text-green-700">
            <CheckCircle className="w-5 h-5 mr-3" />
            <span className="text-sm font-medium">All fixed deposits are secure.</span>
          </div>
        ) : (
          <div className="space-y-3">
            {urgentFDs.map(fd => {
              const daysLeft = Math.ceil((new Date(fd.maturityDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
              const isCritical = daysLeft <= 7;
              
              return (
                <div key={fd.id} className={`relative rounded-xl p-4 border-l-4 shadow-sm flex justify-between items-center bg-white ${isCritical ? 'border-l-[#FF5252]' : 'border-l-[#FFC107]'}`}>
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                        <h3 className="font-bold text-gray-800">{fd.bankName}</h3>
                        {fd.type === 'Savings' && <span className="text-[9px] bg-amber-100 text-amber-600 px-1 rounded font-black">SAVINGS</span>}
                        {isCritical && <span className="bg-red-100 text-red-600 text-[10px] px-2 py-0.5 rounded-full font-bold">EXPIRING</span>}
                    </div>
                    <p className="text-gray-500 text-sm font-roboto">
                      {fd.currency} {fd.principal.toLocaleString()}
                    </p>
                    <div className="flex items-center mt-2 text-xs text-gray-400">
                        <Clock className="w-3 h-3 mr-1" />
                        Due in {daysLeft} days
                    </div>
                  </div>
                  <button onClick={onNavigateToFD} className={`px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors ${isCritical ? 'bg-[#FF5252] text-white' : 'bg-yellow-50 text-yellow-700'}`}>Action</button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* --- ACCOUNTS SUMMARY --- */}
      <div className="space-y-6">
        
        {/* Banking Section */}
        <div>
           <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center">
             <Building2 className="w-4 h-4 mr-2 text-gray-400" /> Banking
           </h2>
           <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
               {/* HK Banks */}
               <div className="p-4 flex justify-between items-center">
                   <div className="flex items-center">
                       <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-lg mr-3">🇭🇰</div>
                       <div>
                           <div className="font-bold text-gray-700">HK Banks</div>
                           <div className="text-xs text-gray-400">Total Liquid Cash</div>
                       </div>
                   </div>
                   <div className="text-right">
                       <div className="font-bold text-gray-800 font-roboto text-lg">${assetGroups.banking.hk.toLocaleString()}</div>
                       <div className="text-[10px] font-bold text-gray-400">HKD</div>
                   </div>
               </div>
               <div className="h-px bg-gray-50 mx-4" />
               {/* AU Banks */}
               <div className="p-4 flex justify-between items-center">
                   <div className="flex items-center">
                       <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-lg mr-3">🇦🇺</div>
                       <div>
                           <div className="font-bold text-gray-700">AU Banks</div>
                           <div className="text-xs text-gray-400">Total Liquid Cash</div>
                       </div>
                   </div>
                   <div className="text-right">
                       <div className="font-bold text-gray-800 font-roboto text-lg">A$ {assetGroups.banking.au.toLocaleString()}</div>
                       <div className="text-[10px] font-bold text-gray-400">AUD</div>
                   </div>
               </div>
           </div>
        </div>

        {/* Investments Section */}
        <div>
           <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center">
             <TrendingUp className="w-4 h-4 mr-2 text-gray-400" /> Investments
           </h2>
           <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
               
               {/* HK Stocks */}
               <div onClick={() => setSelectedStockRegion('HK')} className="p-4 flex justify-between items-center active:bg-gray-50 cursor-pointer transition-colors">
                   <div className="flex items-center">
                       <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500 mr-3"><Building2 className="w-4 h-4" /></div>
                       <div>
                           <div className="font-bold text-gray-700">HK Stocks</div>
                           <div className="text-xs text-gray-400 flex items-center gap-1">
                               HKEX Holdings
                               {assetGroups.stocks.hkYield > 0 && <span className="text-green-600 font-bold bg-green-50 px-1 rounded ml-1">Avg Yield: {assetGroups.stocks.hkYield.toFixed(2)}%</span>}
                           </div>
                       </div>
                   </div>
                   <div className="text-right">
                       <div className="font-bold text-gray-800 font-roboto text-lg">${assetGroups.stocks.hk.toLocaleString()}</div>
                       <div className="text-[10px] font-bold text-gray-400">HKD &bull; Tap to view</div>
                   </div>
               </div>
               <div className="h-px bg-gray-50 mx-4" />
               
               {/* AU Stocks */}
               <div onClick={() => setSelectedStockRegion('AU')} className="p-4 flex justify-between items-center active:bg-gray-50 cursor-pointer transition-colors">
                   <div className="flex items-center">
                       <div className="w-8 h-8 rounded-full bg-teal-50 flex items-center justify-center text-teal-500 mr-3"><Globe className="w-4 h-4" /></div>
                       <div>
                           <div className="font-bold text-gray-700">AU Stocks</div>
                           <div className="text-xs text-gray-400 flex items-center gap-1">
                               ASX Holdings
                               {assetGroups.stocks.auYield > 0 && <span className="text-green-600 font-bold bg-green-50 px-1 rounded ml-1">Avg Yield: {assetGroups.stocks.auYield.toFixed(2)}%</span>}
                           </div>
                       </div>
                   </div>
                   <div className="text-right">
                       <div className="font-bold text-gray-800 font-roboto text-lg">A$ {assetGroups.stocks.au.toLocaleString()}</div>
                       <div className="text-[10px] font-bold text-gray-400">AUD &bull; Tap to view</div>
                   </div>
               </div>

               {/* US Stocks */}
               {assetGroups.stocks.us > 0 && (
                 <>
                   <div className="h-px bg-gray-50 mx-4" />
                   <div onClick={() => setSelectedStockRegion('US')} className="p-4 flex justify-between items-center active:bg-gray-50 cursor-pointer transition-colors">
                       <div className="flex items-center">
                           <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center text-purple-500 mr-3"><Globe className="w-4 h-4" /></div>
                           <div>
                               <div className="font-bold text-gray-700">US Stocks</div>
                               <div className="text-xs text-gray-400 flex items-center gap-1">
                                   NYSE/NASDAQ
                                   {assetGroups.stocks.usYield > 0 && <span className="text-green-600 font-bold bg-green-50 px-1 rounded ml-1">Avg Yield: {assetGroups.stocks.usYield.toFixed(2)}%</span>}
                               </div>
                           </div>
                       </div>
                       <div className="text-right">
                           <div className="font-bold text-gray-800 font-roboto text-lg">US$ {assetGroups.stocks.us.toLocaleString()}</div>
                           <div className="text-[10px] font-bold text-gray-400">USD &bull; Tap to view</div>
                       </div>
                   </div>
                 </>
               )}
           </div>
           <button onClick={onNavigateToUpdate} className="w-full text-center text-sm text-[#0052CC] font-bold py-4 mt-2 hover:bg-gray-50 rounded-xl transition-colors">Update Balances</button>
        </div>
      </div>

      {/* --- STOCK DETAIL MODAL --- */}
      {selectedStockRegion && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
             <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedStockRegion(null)} />
             <div className="bg-white w-full max-w-sm rounded-[2rem] overflow-hidden relative z-10 animate-in zoom-in-95 flex flex-col max-h-[70vh]">
                 <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                     <div className="flex items-center gap-2">
                         <div className="p-2 bg-white rounded-full shadow-sm">
                            {selectedStockRegion === 'HK' && <span className="text-lg">🇭🇰</span>}
                            {selectedStockRegion === 'AU' && <span className="text-lg">🇦🇺</span>}
                            {selectedStockRegion === 'US' && <span className="text-lg">🇺🇸</span>}
                         </div>
                         <h2 className="text-lg font-black text-gray-800">{selectedStockRegion} Portfolio</h2>
                     </div>
                     <button onClick={() => setSelectedStockRegion(null)} className="p-2 bg-white rounded-full text-gray-400 hover:text-gray-600"><X size={18}/></button>
                 </div>
                 <div className="overflow-y-auto p-4 space-y-3">
                     {getRegionStocks(selectedStockRegion).map(acc => (
                         <div key={acc.id} className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm">
                             <div className="flex justify-between items-start mb-2">
                                 <div>
                                     <div className="text-xl font-black text-gray-800">{acc.symbol}</div>
                                     <div className="text-xs font-bold text-gray-400">{acc.name}</div>
                                 </div>
                                 <div className="text-right">
                                     <div className="text-lg font-black text-[#0052CC]">${acc.lastPrice?.toLocaleString()}</div>
                                     <div className="text-[9px] font-bold text-gray-400 uppercase">Price ({acc.currency})</div>
                                 </div>
                             </div>
                             <div className="flex justify-between items-center bg-gray-50 p-3 rounded-xl">
                                 <div className="flex flex-col">
                                     <span className="text-[9px] font-black text-gray-400 uppercase">Holdings</span>
                                     <span className="text-sm font-bold text-gray-700">{acc.quantity?.toLocaleString()} <span className="text-[10px] text-gray-400">shares</span></span>
                                 </div>
                                 <div className="h-6 w-px bg-gray-200" />
                                 <div className="flex flex-col items-end">
                                     <span className="text-[9px] font-black text-gray-400 uppercase">Div. Yield</span>
                                     <span className="text-sm font-bold text-green-600 flex items-center">
                                         <Receipt className="w-3 h-3 mr-1"/> 
                                         {acc.dividendYield ? `${acc.dividendYield}%` : '-'}
                                     </span>
                                 </div>
                             </div>
                         </div>
                     ))}
                     {getRegionStocks(selectedStockRegion).length === 0 && (
                         <div className="text-center py-10 text-gray-400 text-sm font-bold">No assets found in this region.</div>
                     )}
                 </div>
             </div>
        </div>
      )}

      {/* --- SETTINGS MODAL --- */}
      {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setShowSettings(false)} />
              <div className="bg-white w-full max-w-sm rounded-3xl p-6 relative z-10 animate-in zoom-in-95 duration-200 shadow-2xl overflow-y-auto max-h-[85vh]">
                  <button onClick={() => setShowSettings(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
                  <h2 className="text-xl font-bold text-gray-800 mb-6">System Status</h2>
                  
                  <div className="space-y-4">
                      {/* App Info */}
                      <div className="flex items-center justify-between bg-gray-50 p-4 rounded-xl">
                          <div className="flex items-center">
                              <div className="w-10 h-10 bg-blue-100 text-[#0052CC] rounded-full flex items-center justify-center mr-3"><Smartphone className="w-5 h-5" /></div>
                              <div>
                                  <div className="font-bold text-gray-800 text-sm">Application</div>
                                  <div className="text-xs text-green-600 font-bold flex items-center"><CheckCircle className="w-3 h-3 mr-1" /> PWA Ready</div>
                              </div>
                          </div>
                          <div className="text-[10px] bg-blue-100 text-[#0052CC] px-2 py-1 rounded font-bold">v1.2.0</div>
                      </div>

                      {/* DB Connection */}
                      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                          <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 flex justify-between items-center"><span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Database Connection</span></div>
                          <div className="p-4 flex items-center justify-between border-b border-gray-50">
                              <div className="flex items-center"><Database className="w-4 h-4 text-gray-400 mr-3" /><span className="text-sm font-bold text-gray-700">Local Device</span></div>
                              <span className="flex items-center text-xs text-green-600 font-bold"><span className="w-2 h-2 bg-green-500 rounded-full mr-1.5 animate-pulse"></span>Active</span>
                          </div>
                      </div>

                      <hr className="border-gray-100 my-2" />

                      {/* --- DATA MANAGEMENT SECTION --- */}
                      <div>
                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3">Data Management</h3>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                            {/* Backup JSON */}
                            <button onClick={handleExportJSON} className="flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 border border-gray-100 p-4 rounded-xl transition-all">
                                <HardDrive className="w-6 h-6 text-indigo-500 mb-2" />
                                <span className="text-xs font-bold text-gray-700">Backup (JSON)</span>
                            </button>
                            
                            {/* Restore JSON */}
                            <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 border border-gray-100 p-4 rounded-xl transition-all">
                                <Upload className="w-6 h-6 text-orange-500 mb-2" />
                                <span className="text-xs font-bold text-gray-700">Restore (JSON)</span>
                            </button>
                            <input type="file" ref={fileInputRef} onChange={handleImportJSON} accept=".json" className="hidden" />
                        </div>

                        {/* Export CSV */}
                        <button onClick={handleExportCSV} className="w-full flex items-center justify-center bg-white border border-gray-200 text-gray-600 font-bold py-3 rounded-xl transition-colors text-xs hover:bg-gray-50">
                            <Download className="w-4 h-4 mr-2" /> Export as CSV
                        </button>
                      </div>

                      <hr className="border-gray-100 my-2" />

                      {/* Navigation Links */}
                      <button onClick={() => { setShowSettings(false); onNavigateToWhitepaper(); }} className="w-full flex items-center justify-between bg-gray-900 text-white p-4 rounded-xl shadow-lg hover:bg-black transition-all active:scale-95">
                         <div className="flex items-center">
                            <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center mr-3"><FileKey className="w-5 h-5 text-yellow-400" /></div>
                            <div className="text-left">
                               <div className="font-bold text-sm">Whitepaper</div>
                               <div className="text-[10px] text-gray-400 uppercase tracking-wider">Strategy Docs</div>
                            </div>
                         </div>
                         <ChevronRight className="w-5 h-5 text-gray-500" />
                      </button>

                      {/* Switch Account (Logout) */}
                      <button onClick={onLogout} className="w-full flex items-center justify-between bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 hover:bg-red-100 transition-colors active:scale-95">
                         <div className="flex items-center">
                            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center mr-3 shadow-sm"><LogOut className="w-5 h-5" /></div>
                            <div className="text-left">
                               <div className="font-bold text-sm">Switch Account</div>
                               <div className="text-[10px] text-red-400 uppercase tracking-wider">Log out</div>
                            </div>
                         </div>
                         <ChevronRight className="w-5 h-5 text-red-300" />
                      </button>

                      <div className="bg-yellow-50 p-3 rounded-xl flex items-start mt-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-600 mr-2 mt-0.5" />
                        <p className="text-[10px] text-yellow-700 leading-tight">
                            <strong>Note:</strong> JSON Restore will overwrite current data. Please backup before restoring.
                        </p>
                      </div>

                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Overview;