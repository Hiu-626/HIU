import React, { useRef, useState, useMemo } from 'react';
import html2canvas from 'html2canvas';
import { Account, FixedDeposit, HistoricalDataPoint } from '../types';
import { MOCK_RATES } from '../constants';
import { Download, X, TrendingUp, TrendingDown, Loader2, Target, Award, Zap, Lightbulb } from 'lucide-react';

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
    if (currency === 'AUD') return amount * (MOCK_RATES.AUD || 5.2);
    if (currency === 'USD') return amount * (MOCK_RATES.USD || 7.8);
    return amount;
  };

  // --- Data Calculations ---
  const reportData = useMemo(() => {
    const currentMonthData = history[history.length - 1] || { totalValueHKD: 0 };
    const prevMonthData = history.length > 1 ? history[history.length - 2] : { totalValueHKD: currentMonthData.totalValueHKD };
    
    const currentNetWorth = currentMonthData.totalValueHKD;
    const netChange = currentNetWorth - prevMonthData.totalValueHKD;
    const isPositive = netChange >= 0;
    const changePercent = prevMonthData.totalValueHKD > 0 ? (netChange / prevMonthData.totalValueHKD) * 100 : 0;

    let cashTotal = 0;
    let stockTotal = 0;
    let fdTotal = 0;
    let stockYieldTotal = 0;

    accounts.forEach(acc => {
        const val = toHKD(acc.balance, acc.currency);
        if (acc.type === 'Cash') cashTotal += val;
        if (acc.type === 'Stock') {
            stockTotal += val;
            stockYieldTotal += (val * (acc.dividendYield || 0) / 100 / 12);
        }
    });

    const fdYieldTotal = fixedDeposits.reduce((sum, fd) => {
        const val = toHKD(fd.principal, fd.currency);
        fdTotal += val;
        return sum + (val * (fd.interestRate || 0) / 100 / 12);
    }, 0);
    
    const totalAssets = cashTotal + stockTotal + fdTotal;
    const totalPassiveIncome = stockYieldTotal + fdYieldTotal + (cashTotal * 0.005 / 12);
    const goalProgress = Math.min(100, (currentNetWorth / wealthGoal) * 100);

    // 理財策劃師建議邏輯
    let advice = "本月資產增長穩健，繼續保持規律的投資節奏。";
    if (totalPassiveIncome > 5000) {
      advice = "你的被動收入已具備規模，考慮將部分收益再投資以產生複利效應。";
    } else if (cashTotal / totalAssets > 0.4) {
      advice = "現金佔比略高，建議在市場回調時分批佈署增長型資產。";
    }

    return {
      currentNetWorth, netChange, isPositive, changePercent,
      cashTotal, stockTotal, fdTotal, totalAssets,
      goalProgress, advice, totalPassiveIncome
    };
  }, [accounts, fixedDeposits, history, wealthGoal]);

  const handleDownload = async () => {
    if (!reportRef.current) return;
    setIsDownloading(true);
    try {
        const canvas = await html2canvas(reportRef.current, { 
            scale: 3, 
            useCORS: true,
            backgroundColor: '#F9FAFB'
        });
        const image = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.href = image;
        link.download = `WealthReport_${new Date().toISOString().slice(0, 7)}.png`;
        link.click();
    } catch (e) {
        console.error("Download failed", e);
    } finally {
        setIsDownloading(false);
    }
  };

  const currentDateStr = new Date().toLocaleDateString('zh-HK', { month: 'long', year: 'numeric' });

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-gray-900/60 backdrop-blur-md flex items-center justify-center p-4">
      
      <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-300">
          {/* Header */}
          <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-white">
             <button onClick={onClose} className="p-2 -ml-2 text-gray-400 hover:bg-gray-50 rounded-full transition-colors"><X size={22}/></button>
             <div className="text-xs font-black text-gray-500 uppercase tracking-widest">月度財富報告</div>
             <button onClick={handleDownload} disabled={isDownloading} className="p-2 -mr-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors">
                 {isDownloading ? <Loader2 className="animate-spin" size={22}/> : <Download size={22}/>}
             </button>
          </div>

          {/* REPORT BODY */}
          <div ref={reportRef} className="p-8 bg-gray-50/30 space-y-6">
              
              {/* 1. 淨資產主卡 */}
              <div className="text-center pb-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-[10px] font-black uppercase mb-4 tracking-tighter">
                      <Award size={12} /> {currentDateStr} 結算
                  </div>
                  <div className="text-sm font-bold text-gray-400 mb-1">當前淨資產 (HKD)</div>
                  <div className="text-5xl font-black text-gray-900 tracking-tighter mb-4">
                      ${reportData.currentNetWorth.toLocaleString()}
                  </div>
                  <div className={`inline-flex items-center px-4 py-2 rounded-2xl text-sm font-black ${reportData.isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                      {reportData.isPositive ? <TrendingUp size={18} className="mr-2" /> : <TrendingDown size={18} className="mr-2" />}
                      {reportData.isPositive ? '+' : ''}${Math.abs(reportData.netChange).toLocaleString()} ({Math.abs(reportData.changePercent).toFixed(2)}%)
                  </div>
              </div>

              {/* 2. 被動收入與目標進度 (雙排小卡) */}
              <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-gray-100">
                      <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase mb-2">
                          <Zap size={12} className="text-yellow-500 fill-current"/> 被動收入
                      </div>
                      <div className="text-xl font-black text-gray-900">${Math.round(reportData.totalPassiveIncome).toLocaleString()}</div>
                      <div className="text-[10px] text-gray-400 font-bold">預計每月產出</div>
                  </div>
                  <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-gray-100">
                      <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase mb-2">
                          <Target size={12} className="text-blue-500"/> 目標進度
                      </div>
                      <div className="text-xl font-black text-gray-900">{reportData.goalProgress.toFixed(1)}%</div>
                      <div className="text-[10px] text-gray-400 font-bold">距離目標達成</div>
                  </div>
              </div>

              {/* 3. 資產配置比例 */}
              <div className="space-y-3">
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">資產分布詳情</h4>
                  {[
                    { label: '股票投資', val: reportData.stockTotal, color: 'bg-indigo-500', sub: '增長引擎' },
                    { label: '定期存款', val: reportData.fdTotal, color: 'bg-orange-400', sub: '穩定收益' },
                    { label: '流動現金', val: reportData.cashTotal, color: 'bg-emerald-400', sub: '靈活調度' }
                  ].map((item) => (
                      <div key={item.label} className="bg-white p-4 rounded-2xl flex justify-between items-center border border-gray-50 shadow-sm">
                          <div className="flex items-center gap-3">
                              <div className={`w-1.5 h-8 ${item.color} rounded-full`}/>
                              <div>
                                  <div className="font-bold text-gray-800 text-sm">{item.label}</div>
                                  <div className="text-[10px] text-gray-400 font-bold">{item.sub}</div>
                              </div>
                          </div>
                          <div className="text-right">
                              <div className="font-black text-gray-800 text-sm">${item.val.toLocaleString()}</div>
                              <div className="text-[10px] text-gray-400 font-bold">{((item.val/reportData.totalAssets)*100).toFixed(0)}%</div>
                          </div>
                      </div>
                  ))}
              </div>

              {/* 4. 策劃師建議 */}
              <div className="bg-indigo-600 p-6 rounded-[2rem] text-white shadow-xl shadow-indigo-100 relative overflow-hidden">
                   <Lightbulb className="absolute -right-2 -bottom-2 text-white/10" size={80} />
                   <div className="relative z-10">
                       <div className="text-[10px] font-black uppercase opacity-60 mb-2 tracking-widest">理財策劃師建議</div>
                       <div className="text-sm font-bold leading-relaxed">
                           "{reportData.advice}"
                       </div>
                   </div>
              </div>

          </div>
          
          <div className="bg-white p-6 text-center border-t border-gray-50">
             <button onClick={onClose} className="w-full py-4 bg-gray-900 text-white rounded-2xl text-sm font-black uppercase tracking-widest active:scale-95 transition-transform">
                 關閉報告
             </button>
          </div>
      </div>
    </div>
  );
};

export default MonthlyReport;