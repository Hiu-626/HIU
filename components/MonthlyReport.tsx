import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { Account, FixedDeposit, HistoricalDataPoint } from '../types';
import { MOCK_RATES } from '../constants';
import { Download, X, TrendingUp, TrendingDown, Loader2, ArrowRight } from 'lucide-react';

interface MonthlyReportProps {
  accounts: Account[];
  fixedDeposits: FixedDeposit[];
  history: HistoricalDataPoint[];
  wealthGoal: number;
  onClose: () => void;
  onNavigateToFD: () => void;
}

const MonthlyReport: React.FC<MonthlyReportProps> = ({ 
  accounts, fixedDeposits, history, wealthGoal, onClose, onNavigateToFD 
}) => {
  const reportRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // --- Helper Functions ---
  const toHKD = (amount: number, currency: string) => {
    if (currency === 'HKD') return amount;
    if (currency === 'AUD') return amount * MOCK_RATES.AUD;
    if (currency === 'USD') return amount * MOCK_RATES.USD;
    return amount;
  };

  // --- Data Calculations ---
  
  // 1. Wealth & Change
  const currentMonthData = history[history.length - 1] || { totalValueHKD: 0 };
  const prevMonthData = history.length > 1 ? history[history.length - 2] : { totalValueHKD: currentMonthData.totalValueHKD };
  const currentNetWorth = currentMonthData.totalValueHKD;
  const netChange = currentNetWorth - prevMonthData.totalValueHKD;
  const isPositive = netChange >= 0;
  const changePercent = prevMonthData.totalValueHKD > 0 ? (netChange / prevMonthData.totalValueHKD) * 100 : 0;

  // 2. Asset Allocation
  let cashTotal = 0;
  let stockTotal = 0;
  let fdTotal = 0;

  accounts.forEach(acc => {
      const val = toHKD(acc.balance, acc.currency);
      if (acc.type === 'Cash') cashTotal += val;
      if (acc.type === 'Stock') stockTotal += val;
  });
  fixedDeposits.forEach(fd => {
      const val = toHKD(fd.principal, fd.currency);
      fdTotal += val;
  });
  
  const totalAssets = cashTotal + stockTotal + fdTotal;

  // 3. Passive Income
  const monthlyPassiveIncome = fixedDeposits.reduce((sum, fd) => {
      const rate = fd.interestRate || 0;
      const principalHKD = toHKD(fd.principal, fd.currency);
      return sum + (principalHKD * (rate / 100) / 12);
  }, 0);

  const handleDownload = async () => {
    if (!reportRef.current) return;
    setIsDownloading(true);
    try {
        const canvas = await html2canvas(reportRef.current, { 
            scale: 2, 
            useCORS: true,
            backgroundColor: '#FFFFFF'
        });
        const image = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.href = image;
        link.download = `WealthSnapshot_${new Date().toISOString().slice(0, 10)}.png`;
        link.click();
    } catch (e) {
        console.error("Download failed", e);
    } finally {
        setIsDownloading(false);
    }
  };

  const currentDateStr = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-300">
          {/* Header Actions */}
          <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50/50">
             <button onClick={onClose} className="p-2 -ml-2 text-gray-400 hover:text-gray-800 transition-colors"><X size={20}/></button>
             <div className="text-xs font-black text-gray-400 uppercase tracking-widest">Snapshot</div>
             <button onClick={handleDownload} disabled={isDownloading} className="p-2 -mr-2 text-blue-600 hover:text-blue-700 transition-colors">
                 {isDownloading ? <Loader2 className="animate-spin" size={20}/> : <Download size={20}/>}
             </button>
          </div>

          {/* REPORT BODY */}
          <div ref={reportRef} className="p-6 bg-white space-y-6">
              
              {/* 1. Net Worth Hero */}
              <div className="text-center">
                  <div className="text-sm font-bold text-gray-400 mb-1">{currentDateStr}</div>
                  <div className="text-4xl font-black text-gray-900 tracking-tight font-roboto mb-3">
                      ${currentNetWorth.toLocaleString()}
                  </div>
                  <div className={`inline-flex items-center px-3 py-1.5 rounded-xl text-sm font-bold ${isPositive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {isPositive ? <TrendingUp size={16} className="mr-1.5" /> : <TrendingDown size={16} className="mr-1.5" />}
                      {isPositive ? '+' : ''}${Math.abs(netChange).toLocaleString()} ({Math.abs(changePercent).toFixed(2)}%)
                  </div>
              </div>

              <div className="border-t border-dashed border-gray-200" />

              {/* 2. Key Metrics Grid */}
              <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-2xl">
                      <div className="text-[10px] font-black text-gray-400 uppercase mb-1">Passive Income</div>
                      <div className="text-lg font-black text-gray-800">${Math.round(monthlyPassiveIncome).toLocaleString()} <span className="text-xs text-gray-400 font-bold">/mo</span></div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-2xl">
                      <div className="text-[10px] font-black text-gray-400 uppercase mb-1">Cash Weight</div>
                      <div className="text-lg font-black text-gray-800">{((cashTotal/totalAssets)*100).toFixed(1)}%</div>
                  </div>
              </div>

              {/* 3. Asset Allocation List */}
              <div>
                  <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest mb-4">Allocation</h4>
                  <div className="space-y-3">
                      {/* Stocks */}
                      <div className="flex justify-between items-center">
                          <div className="flex items-center gap-3">
                              <div className="w-2 h-8 bg-indigo-500 rounded-full"/>
                              <div>
                                  <div className="font-bold text-gray-800 text-sm">Equities</div>
                                  <div className="text-[10px] text-gray-400 font-bold">Growth Engine</div>
                              </div>
                          </div>
                          <div className="text-right">
                              <div className="font-bold text-gray-800 text-sm">${stockTotal.toLocaleString()}</div>
                              <div className="text-[10px] text-gray-400 font-bold">{((stockTotal/totalAssets)*100).toFixed(0)}%</div>
                          </div>
                      </div>
                      
                      {/* Fixed Income */}
                      <div className="flex justify-between items-center">
                          <div className="flex items-center gap-3">
                              <div className="w-2 h-8 bg-orange-400 rounded-full"/>
                              <div>
                                  <div className="font-bold text-gray-800 text-sm">Fixed Deposits</div>
                                  <div className="text-[10px] text-gray-400 font-bold">Stable Yield</div>
                              </div>
                          </div>
                          <div className="text-right">
                              <div className="font-bold text-gray-800 text-sm">${fdTotal.toLocaleString()}</div>
                              <div className="text-[10px] text-gray-400 font-bold">{((fdTotal/totalAssets)*100).toFixed(0)}%</div>
                          </div>
                      </div>

                      {/* Cash */}
                      <div className="flex justify-between items-center">
                          <div className="flex items-center gap-3">
                              <div className="w-2 h-8 bg-emerald-400 rounded-full"/>
                              <div>
                                  <div className="font-bold text-gray-800 text-sm">Cash</div>
                                  <div className="text-[10px] text-gray-400 font-bold">Liquidity</div>
                              </div>
                          </div>
                          <div className="text-right">
                              <div className="font-bold text-gray-800 text-sm">${cashTotal.toLocaleString()}</div>
                              <div className="text-[10px] text-gray-400 font-bold">{((cashTotal/totalAssets)*100).toFixed(0)}%</div>
                          </div>
                      </div>
                  </div>
              </div>

              {/* Footer Note */}
              <div className="bg-blue-50 p-4 rounded-xl text-center">
                   <div className="text-blue-800 text-xs font-bold leading-relaxed">
                       "Focus on increasing your equity exposure to beat inflation in the long run."
                   </div>
              </div>

          </div>
          
          <div className="bg-gray-50 p-4 text-center border-t border-gray-100">
             <button onClick={onClose} className="text-sm font-bold text-gray-400 hover:text-gray-600 uppercase tracking-widest">Close Report</button>
          </div>
      </div>
    </div>
  );
};

export default MonthlyReport;