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

  const toHKD = (amount: number, currency: string) => {
    if (currency === 'HKD') return amount;
    if (currency === 'AUD') return amount * (MOCK_RATES.AUD || 5.2);
    if (currency === 'USD') return amount * (MOCK_RATES.USD || 7.8);
    return amount;
  };

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

    let advice = "本月資產增長穩健，建議繼續保持規律的投資節奏，利用複利效應達成長期目標。";
    if (totalPassiveIncome > 5000) {
      advice = "你的被動收入已具備規模，考慮將部分收益再投資，這將顯著加速你的財務自由進程。";
    } else if (cashTotal / totalAssets > 0.4) {
      advice = "當前現金比例偏高。在通脹環境下，建議尋求收益更高的防禦性資產（如增加定期存款）。";
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
            backgroundColor: '#F9FAFB',
            logging: false,
            // 確保捕捉完整高度
            onclone: (clonedDoc) => {
                const element = clonedDoc.getElementById('report-capture-area');
                if (element) element.style.height = 'auto';
            }
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

  const currentDateStr = new Date().toLocaleDateString('zh-HK', { month: 'long', year: 'numeric' });

  return (
    <div className="fixed inset-0 z-[100] bg-gray-900/60 backdrop-blur-md overflow-y-auto pt-4 pb-20 px-4">
      {/* 居中容器 */}
      <div className="w-full max-w-md mx-auto shadow-2xl rounded-[2.5rem] overflow-hidden">
          
          {/* Header (不截圖) */}
          <div className="bg-white flex justify-between items-center p-6 border-b border-gray-100">
             <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-50 rounded-full transition-colors"><X size={22}/></button>
             <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Wealth Snapshot</div>
             <button onClick={handleDownload} disabled={isDownloading} className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors">
                 {isDownloading ? <Loader2 className="animate-spin" size={22}/> : <Download size={22}/>}
             </button>
          </div>

          {/* REPORT BODY (截圖區域) */}
          <div id="report-capture-area" ref={reportRef} className="bg-white p-8 space-y-8 h-auto">
              
              {/* 1. 淨資產 */}
              <div className="text-center pt-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-[10px] font-black uppercase mb-5">
                      <Award size={12} /> {currentDateStr} 
                  </div>
                  <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total Net Worth</div>
                  <div className="text-5xl font-black text-gray-900 tracking-tighter mb-4">
                      ${reportData.currentNetWorth.toLocaleString()}
                  </div>
                  <div className={`inline-flex items-center px-4 py-2 rounded-2xl text-sm font-black ${reportData.isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                      {reportData.isPositive ? <TrendingUp size={18} className="mr-2" /> : <TrendingDown size={18} className="mr-2" />}
                      {reportData.isPositive ? '+' : ''}${Math.abs(reportData.netChange).toLocaleString()} ({Math.abs(reportData.changePercent).toFixed(2)}%)
                  </div>
              </div>

              {/* 2. 核心卡片 */}
              <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-5 rounded-[2rem] border border-gray-100">
                      <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase mb-3">
                          <Zap size={14} className="text-yellow-500 fill-current"/> 被動收入
                      </div>
                      <div className="text-2xl font-black text-gray-900">${Math.round(reportData.totalPassiveIncome).toLocaleString()}</div>
                      <div className="text-[10px] text-gray-400 font-bold mt-1">月均產出</div>
                  </div>
                  <div className="bg-gray-50 p-5 rounded-[2rem] border border-gray-100">
                      <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase mb-3">
                          <Target size={14} className="text-blue-500"/> 目標進度
                      </div>
                      <div className="text-2xl font-black text-gray-900">{reportData.goalProgress.toFixed(1)}%</div>
                      <div className="text-[10px] text-gray-400 font-bold mt-1">已達成</div>
                  </div>
              </div>

              {/* 3. 資產分佈 */}
              <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Asset Allocation</h4>
                  {[
                    { label: '股票投資', val: reportData.stockTotal, color: 'bg-indigo-500', sub: 'Equities' },
                    { label: '定期存款', val: reportData.fdTotal, color: 'bg-orange-400', sub: 'Fixed Deposits' },
                    { label: '流動現金', val: reportData.cashTotal, color: 'bg-emerald-400', sub: 'Cash' }
                  ].map((item) => (
                      <div key={item.label} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl">
                          <div className="flex items-center gap-3">
                              <div className={`w-1.5 h-8 ${item.color} rounded-full`}/>
                              <div>
                                  <div className="font-bold text-gray-800 text-sm">{item.label}</div>
                                  <div className="text-[9px] text-gray-400 font-black uppercase">{item.sub}</div>
                              </div>
                          </div>
                          <div className="text-right">
                              <div className="font-black text-gray-800 text-sm">${item.val.toLocaleString()}</div>
                              <div className="text-[10px] text-gray-400 font-bold">{((item.val/reportData.totalAssets)*100).toFixed(0)}%</div>
                          </div>
                      </div>
                  ))}
              </div>

              {/* 4. 理財建議 */}
              <div className="bg-indigo-600 p-6 rounded-[2.5rem] text-white relative overflow-hidden shadow-lg shadow-indigo-100">
                   <Lightbulb className="absolute -right-2 -bottom-2 text-white/10" size={90} />
                   <div className="relative z-10">
                       <div className="text-[10px] font-black uppercase opacity-70 mb-2">Planner's Advice</div>
                       <div className="text-[13px] font-bold leading-relaxed italic">
                           "{reportData.advice}"
                       </div>
                   </div>
              </div>

              <div className="pt-4 text-center border-t border-gray-50">
                  <div className="text-[9px] font-black text-gray-300 uppercase tracking-[0.3em]">Wealth Management Report</div>
              </div>
          </div>
          
          {/* Footer (不截圖) */}
          <div className="bg-white p-6 border-t border-gray-50">
             <button onClick={onClose} className="w-full py-4 bg-gray-900 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em]">
                 關閉
             </button>
          </div>
      </div>
    </div>
  );
};

export default MonthlyReport;