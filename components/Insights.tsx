import React, { useMemo, useState, useEffect } from 'react';
import { 
  Area, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  AreaChart, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  CartesianGrid, Legend, BarChart, Bar, Cell
} from 'recharts';
import { Account, FixedDeposit, HistoricalDataPoint } from '../types';
import { MOCK_RATES, VOO_HISTORY_DATA } from '../constants';
import { 
  TrendingUp, TrendingDown, Zap, 
  Trophy, Sparkles, FileText, Target, ChevronRight, Activity, Shield, Layers, RefreshCcw, Info, X, DollarSign, Percent, Calendar
} from 'lucide-react';
import MonthlyReport from './MonthlyReport';
import Confetti from './Confetti';

// --- 動畫數字組件 ---
const CountUp: React.FC<{ end: number; duration?: number; prefix?: string; suffix?: string; decimals?: number; className?: string }> = ({ 
  end, duration = 1500, prefix = '', suffix = '', decimals = 0, className = ''
}) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = 0;
    const increment = end / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) { clearInterval(timer); setCount(end); } 
      else { setCount(start); }
    }, 16);
    return () => clearInterval(timer);
  }, [end, duration]);
  return <span className={className}>{prefix}{count.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</span>;
};

interface InsightsProps {
  accounts: Account[];
  fixedDeposits: FixedDeposit[];
  history: HistoricalDataPoint[];
  wealthGoal: number;
  onUpdateGoal: (goal: number) => void;
}

const Insights: React.FC<InsightsProps> = ({ accounts, fixedDeposits, history, wealthGoal, onUpdateGoal }) => {
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [tempGoal, setTempGoal] = useState(wealthGoal.toString());
  
  // 新增：控制被動收入詳情彈窗的狀態
  const [activeIncomeDetail, setActiveIncomeDetail] = useState<'FD' | 'STOCK' | null>(null);

  const toHKD = (amount: number, currency: string) => {
    if (currency === 'HKD') return amount;
    if (currency === 'AUD') return amount * MOCK_RATES.AUD;
    if (currency === 'USD') return amount * MOCK_RATES.USD;
    return amount;
  };

  const handleSaveGoal = () => {
    const val = parseFloat(tempGoal);
    if (val > 0) { onUpdateGoal(val); setIsEditingGoal(false); }
  };

  // --- 計算核心數據 ---
  const passiveData = useMemo(() => {
    const netWorth = history.length > 0 ? history[history.length - 1].totalValueHKD : 0;
    
    // 1. 定期收益詳情
    const fdDetails = fixedDeposits.map(fd => {
        const principalHKD = toHKD(fd.principal, fd.currency);
        const monthly = (principalHKD * ((fd.interestRate || 0) / 100) / 12);
        return {
            id: fd.id,
            name: fd.bankName,
            monthly: monthly,
            yield: fd.interestRate || 0,
            currency: fd.currency,
            principal: principalHKD,
            maturity: fd.maturityDate
        };
    }).sort((a, b) => b.monthly - a.monthly); // 按月收入排序
    
    const totalFDMonthly = fdDetails.reduce((sum, item) => sum + item.monthly, 0);
    const totalFDPrincipal = fdDetails.reduce((sum, item) => sum + item.principal, 0);
    // 加權平均利率
    const weightedFDRate = totalFDPrincipal > 0 
        ? fdDetails.reduce((sum, item) => sum + (item.principal * item.yield), 0) / totalFDPrincipal 
        : 0;

    // 2. 股票股息詳情
    const stockDetails = accounts.filter(a => a.type === 'Stock').map(acc => {
      const balanceHKD = toHKD(acc.balance, acc.currency);
      const yieldRate = acc.dividendYield || 0;
      const monthly = (balanceHKD * (yieldRate / 100) / 12);
      return {
        id: acc.id,
        name: acc.symbol || acc.name,
        fullName: acc.name,
        monthly: monthly,
        yield: yieldRate,
        currency: acc.currency,
        balance: balanceHKD
      };
    }).sort((a, b) => b.monthly - a.monthly);
    
    const totalStockMonthly = stockDetails.reduce((sum, item) => sum + item.monthly, 0);
    const totalStockBalance = stockDetails.reduce((sum, item) => sum + item.balance, 0);
    // 加權平均股息率
    const weightedStockYield = totalStockBalance > 0
        ? stockDetails.reduce((sum, item) => sum + (item.balance * item.yield), 0) / totalStockBalance
        : 0;

    // 3. 活期利息
    const cashReserve = accounts.filter(a => a.type === 'Cash').reduce((sum, acc) => sum + toHKD(acc.balance, acc.currency), 0);
    const totalCashMonthly = (cashReserve * 0.005 / 12); // 假設 0.5%

    const totalMonthly = totalFDMonthly + totalStockMonthly + totalCashMonthly;
    
    return {
      totalMonthly,
      totalFDMonthly,
      totalStockMonthly,
      fdDetails,
      stockDetails,
      weightedFDRate,
      weightedStockYield,
      netWorth,
      cashReserve,
      stockTotal: totalStockBalance,
      fdTotal: totalFDPrincipal
    };
  }, [accounts, fixedDeposits, history]);

  // --- Benchmark Comparison Data Preparation (Using Real VOO Data) ---
  const benchmarkChartData = useMemo(() => {
    if (history.length < 1) return [];

    const startData = history[0];
    const startDateKey = startData.date; // e.g., '2023-05'
    
    // 獲取起始日的 VOO 價格。如果找不到，用最近的數據或默認值
    const startVooPrice = VOO_HISTORY_DATA[startDateKey] || 380; 
    const initialWealth = startData.totalValueHKD;

    return history.map(point => {
        // 查找該月份的 VOO 真實價格
        const currentVooPrice = VOO_HISTORY_DATA[point.date];
        let hypotheticalVOO = initialWealth;

        if (currentVooPrice) {
            // 計算：如果當初全買 VOO，現在值多少？
            // 公式：初始資金 * (現在股價 / 初始股價)
            hypotheticalVOO = initialWealth * (currentVooPrice / startVooPrice);
        } else {
            // Fallback if future date or missing data: use last known growth or flat
             hypotheticalVOO = initialWealth; 
        }

        return {
            date: point.date,
            MyPortfolio: point.totalValueHKD,
            SP500_Benchmark: Math.round(hypotheticalVOO),
            diff: point.totalValueHKD - hypotheticalVOO
        };
    });
  }, [history]);

  const currentBenchmark = benchmarkChartData.length > 0 ? benchmarkChartData[benchmarkChartData.length - 1] : null;
  const isBeatingMarket = currentBenchmark ? currentBenchmark.diff >= 0 : false;

  // --- 雷達圖數據 ---
  const radarData = useMemo(() => {
      const totalAssets = passiveData.netWorth || 1;
      const liquidAssets = passiveData.cashReserve + passiveData.stockTotal;
      const liquidityScore = Math.min(100, (liquidAssets / totalAssets) * 100);
      const growthScore = Math.min(100, (passiveData.stockTotal / totalAssets) * 100 * 1.5); 
      const safetyScore = Math.min(100, ((passiveData.cashReserve + passiveData.fdTotal) / totalAssets) * 100);
      const weightedYield = (passiveData.totalMonthly * 12 / totalAssets) * 100;
      const yieldScore = Math.min(100, weightedYield * 20); 
      const assetCount = accounts.length + fixedDeposits.length;
      let divScore = Math.min(100, assetCount * 12);
      if (passiveData.stockTotal > 0 && passiveData.fdTotal > 0) divScore += 20;

      return [
        { subject: 'Liquid', A: liquidityScore, fullMark: 100 },
        { subject: 'Growth', A: growthScore, fullMark: 100 },
        { subject: 'Safety', A: safetyScore, fullMark: 100 },
        { subject: 'Yield', A: yieldScore, fullMark: 100 },
        { subject: 'Divs', A: divScore, fullMark: 100 }, // Diversification abbreviated
      ];
  }, [passiveData, accounts, fixedDeposits]);

  const goalPercent = Math.min(100, (passiveData.netWorth / wealthGoal) * 100);

  return (
    <div className="p-6 pb-28 space-y-8 bg-gray-50/50 min-h-screen font-sans animate-in fade-in duration-500">
      <Confetti active={showConfetti} onComplete={() => setShowConfetti(false)} />

      {/* --- HEADER --- */}
      <div className="flex justify-between items-end">
        <div>
           <h1 className="text-3xl font-black text-gray-900 tracking-tighter">Insights</h1>
           <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Real-time Analysis</p>
        </div>
        <button 
          onClick={() => setShowReport(true)}
          className="bg-white border border-gray-100 p-3 rounded-2xl shadow-sm text-blue-600 hover:scale-105 transition-transform active:scale-95 flex items-center gap-2 font-bold text-xs"
        >
           <FileText className="w-4 h-4" /> Report
        </button>
      </div>

      {/* --- REAL BENCHMARK CHART --- */}
      <section className="bg-white rounded-[2.5rem] p-6 shadow-xl shadow-indigo-900/5 border border-white relative overflow-hidden">
          <div className="mb-6">
             <div className="flex justify-between items-start">
                 <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                    <Target className="w-4 h-4" /> Benchmark: S&P 500
                 </h3>
                 {currentBenchmark && (
                     <div className={`px-3 py-1 rounded-full text-xs font-black flex items-center gap-1 ${isBeatingMarket ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>
                         {isBeatingMarket ? <TrendingUp size={14}/> : <TrendingDown size={14}/>}
                         {isBeatingMarket ? 'Outperforming' : 'Lagging'}
                     </div>
                 )}
             </div>
             
             {currentBenchmark && (
                 <div className="mt-2 flex items-baseline gap-2">
                     <span className="text-2xl font-black text-gray-900">
                         {isBeatingMarket ? '+' : ''}HK${Math.abs(currentBenchmark.diff).toLocaleString()}
                     </span>
                     <span className="text-xs font-bold text-gray-400">vs Market</span>
                 </div>
             )}
             <p className="text-[10px] text-gray-400 mt-1">
                 Compared to buying VOO (S&P 500 ETF) on day 1.
             </p>
          </div>

          <div className="h-64 w-full">
             <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={benchmarkChartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorMy" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis 
                    dataKey="date" 
                    tick={{fontSize: 10, fill: '#9CA3AF', fontWeight: 'bold'}} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(val) => val.split('-')[1]} // 只顯示月份
                  />
                  <YAxis 
                    tick={{fontSize: 10, fill: '#9CA3AF', fontWeight: 'bold'}} 
                    tickLine={false} 
                    axisLine={false}
                    tickFormatter={(val) => `${(val/1000).toFixed(0)}k`} 
                  />
                  <Tooltip 
                    contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'}}
                    labelStyle={{color: '#6B778C', fontWeight: 'bold', fontSize: '10px', marginBottom: '4px'}}
                    formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                  />
                  <Legend iconType="circle" wrapperStyle={{fontSize: '10px', fontWeight: 'bold', paddingTop: '10px'}}/>
                  
                  {/* Market (Benchmark) Line */}
                  <Area 
                    type="monotone" 
                    dataKey="SP500_Benchmark" 
                    name="S&P 500 Strategy"
                    stroke="#9CA3AF" 
                    strokeWidth={2} 
                    strokeDasharray="4 4"
                    fill="transparent" 
                  />
                  
                  {/* User Line */}
                  <Area 
                    type="monotone" 
                    dataKey="MyPortfolio" 
                    name="My Portfolio"
                    stroke="#4F46E5" 
                    strokeWidth={3} 
                    fill="url(#colorMy)" 
                  />
                </AreaChart>
             </ResponsiveContainer>
          </div>
      </section>

      {/* --- RADAR & PASSIVE INCOME (Side by Side) --- */}
      <div className="grid grid-cols-1 gap-6">
        
        {/* Radar */}
        <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-gray-100 relative">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center">
                <Activity className="w-4 h-4 mr-2 text-blue-500" /> Portfolio Health
            </h3>
            <div className="h-48 -ml-6">
                 <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                      <PolarGrid stroke="#f3f4f6" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#9CA3AF', fontSize: 9, fontWeight: 800 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar
                        name="Portfolio"
                        dataKey="A"
                        stroke="#0052CC"
                        strokeWidth={2}
                        fill="#0052CC"
                        fillOpacity={0.2}
                      />
                    </RadarChart>
                 </ResponsiveContainer>
            </div>
            <div className="absolute top-6 right-6 text-right">
                <div className="text-3xl font-black text-gray-900">{Math.round(radarData.reduce((a,b)=>a+b.A,0)/5)}</div>
                <div className="text-[9px] font-bold text-gray-400 uppercase">Health Score</div>
            </div>
        </div>

        {/* Passive Income Card (Interactive) */}
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-[2.5rem] p-6 shadow-xl text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500 rounded-full blur-[60px] opacity-20"></div>
            
            <div className="flex items-center space-x-2 mb-2 relative z-10">
               <Zap className="w-4 h-4 text-yellow-400 fill-current" />
               <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Passive Income</span>
            </div>
            
            <div className="flex items-end gap-2 mb-6 relative z-10">
               <div className="text-4xl font-black tracking-tighter">
                   <CountUp end={passiveData.totalMonthly} prefix="$" />
               </div>
               <span className="text-sm font-bold text-gray-400 mb-1.5">/mo</span>
            </div>

            <div className="grid grid-cols-2 gap-4 relative z-10">
                <button onClick={() => setActiveIncomeDetail('FD')} className="bg-white/10 rounded-xl p-3 backdrop-blur-sm hover:bg-white/20 transition-all active:scale-95 text-left group relative border border-transparent hover:border-yellow-400/30">
                    <div className="text-[9px] text-gray-400 uppercase font-bold mb-1 group-hover:text-white transition-colors">Fixed Deposits</div>
                    <div className="font-bold text-yellow-400 text-lg">${Math.round(passiveData.totalFDMonthly).toLocaleString()}</div>
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ChevronRight className="w-4 h-4 text-white/50"/>
                    </div>
                </button>
                <button onClick={() => setActiveIncomeDetail('STOCK')} className="bg-white/10 rounded-xl p-3 backdrop-blur-sm hover:bg-white/20 transition-all active:scale-95 text-left group relative border border-transparent hover:border-blue-400/30">
                    <div className="text-[9px] text-gray-400 uppercase font-bold mb-1 group-hover:text-white transition-colors">Dividends</div>
                    <div className="font-bold text-blue-300 text-lg">${Math.round(passiveData.totalStockMonthly).toLocaleString()}</div>
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ChevronRight className="w-4 h-4 text-white/50"/>
                    </div>
                </button>
            </div>
        </div>

      </div>

      {/* --- GOAL PROGRESS --- */}
      <div 
        onClick={() => setIsEditingGoal(true)}
        className="bg-white border border-gray-100 rounded-[2.5rem] p-6 shadow-sm cursor-pointer active:scale-95 transition-transform"
      >
          <div className="flex justify-between items-start mb-4">
             <div>
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                   <Target className="w-4 h-4" /> Net Worth Goal
                </h3>
                <div className="text-2xl font-black text-gray-900 tracking-tight">${wealthGoal.toLocaleString()}</div>
             </div>
             <div className="bg-gray-50 p-2 rounded-full text-gray-400">
                <ChevronRight className="w-5 h-5" />
             </div>
          </div>

          <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
             <div 
               className="absolute top-0 left-0 h-full bg-[#0052CC] transition-all duration-1000"
               style={{ width: `${goalPercent}%` }}
             />
          </div>
          <div className="flex justify-between mt-2 text-[10px] font-bold text-gray-400 uppercase">
             <span>Current: ${passiveData.netWorth.toLocaleString()}</span>
             <span className="text-[#0052CC]">{goalPercent.toFixed(1)}% Reached</span>
          </div>
      </div>

      {/* --- INCOME DETAILS MODAL --- */}
      {activeIncomeDetail && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:px-4">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setActiveIncomeDetail(null)} />
              <div className="bg-white w-full max-w-sm rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 pb-12 sm:pb-8 relative z-10 animate-in slide-in-from-bottom-20 sm:zoom-in-95 max-h-[85vh] overflow-y-auto">
                  
                  {/* Header */}
                  <div className="flex justify-between items-center mb-6">
                      <div className="flex items-center gap-3">
                          <div className={`p-3 rounded-2xl ${activeIncomeDetail === 'FD' ? 'bg-yellow-100 text-yellow-600' : 'bg-blue-100 text-blue-600'}`}>
                             {activeIncomeDetail === 'FD' ? <Shield size={24}/> : <Sparkles size={24}/>}
                          </div>
                          <div>
                              <h2 className="text-xl font-black text-gray-900 leading-none">
                                  {activeIncomeDetail === 'FD' ? 'Fixed Deposits' : 'Dividend Stocks'}
                              </h2>
                              <span className="text-xs font-bold text-gray-400 uppercase">Income Breakdown</span>
                          </div>
                      </div>
                      <button onClick={() => setActiveIncomeDetail(null)} className="p-2 bg-gray-50 rounded-full text-gray-400">
                          <X size={20}/>
                      </button>
                  </div>

                  {/* Summary Metric (Weighted Avg) */}
                  <div className={`p-5 rounded-2xl mb-6 flex justify-between items-center ${activeIncomeDetail === 'FD' ? 'bg-yellow-50 text-yellow-800' : 'bg-blue-50 text-blue-800'}`}>
                      <div>
                          <div className="text-[10px] uppercase font-black opacity-60 mb-1">
                              {activeIncomeDetail === 'FD' ? 'Avg. Interest Rate' : 'Avg. Dividend Yield'}
                          </div>
                          <div className="text-3xl font-black tracking-tight flex items-baseline">
                              {activeIncomeDetail === 'FD' 
                                  ? passiveData.weightedFDRate.toFixed(2) 
                                  : passiveData.weightedStockYield.toFixed(2)}
                              <span className="text-lg ml-0.5">%</span>
                          </div>
                      </div>
                      <div className="text-right">
                          <div className="text-[10px] uppercase font-black opacity-60 mb-1">Monthly Income</div>
                          <div className="text-xl font-black">
                              ${Math.round(activeIncomeDetail === 'FD' ? passiveData.totalFDMonthly : passiveData.totalStockMonthly).toLocaleString()}
                          </div>
                      </div>
                  </div>

                  {/* Ranking List */}
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Trophy size={14} className="text-yellow-500"/> Top Contributors
                  </h3>
                  
                  <div className="space-y-3">
                      {(activeIncomeDetail === 'FD' ? passiveData.fdDetails : passiveData.stockDetails).map((item, idx) => (
                          <div key={item.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex justify-between items-center">
                              <div className="flex items-center gap-3">
                                  <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-black text-gray-500">
                                      {idx + 1}
                                  </div>
                                  <div>
                                      <div className="font-bold text-gray-900 text-sm">{item.name}</div>
                                      {activeIncomeDetail === 'FD' ? (
                                           <div className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                                               <Calendar size={10}/> Due {new Date((item as any).maturity).toLocaleDateString(undefined, {month:'short', day:'numeric'})}
                                           </div>
                                      ) : (
                                           <div className="text-[10px] font-bold text-gray-400">
                                               {item.currency} Holdings
                                           </div>
                                      )}
                                  </div>
                              </div>
                              <div className="text-right">
                                  <div className={`font-black text-sm ${activeIncomeDetail === 'FD' ? 'text-yellow-600' : 'text-blue-600'}`}>
                                      +${Math.round(item.monthly).toLocaleString()}
                                  </div>
                                  <div className="text-[10px] font-bold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded inline-block mt-0.5">
                                      {item.yield.toFixed(2)}% Yield
                                  </div>
                              </div>
                          </div>
                      ))}
                      
                      {(activeIncomeDetail === 'FD' ? passiveData.fdDetails : passiveData.stockDetails).length === 0 && (
                          <div className="text-center py-8 text-gray-400 font-bold text-sm bg-gray-50 rounded-2xl border-dashed border-2 border-gray-200">
                              No assets found in this category.
                          </div>
                      )}
                  </div>

              </div>
          </div>
      )}

      {/* --- MODALS --- */}
      {isEditingGoal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsEditingGoal(false)} />
              <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 relative z-10 animate-in zoom-in-95">
                  <h2 className="text-xl font-black text-gray-900 mb-6 text-center">Update Wealth Goal</h2>
                  <input type="number" autoFocus value={tempGoal} onChange={(e) => setTempGoal(e.target.value)} 
                    className="w-full bg-gray-50 p-6 rounded-3xl text-3xl font-black text-blue-600 text-center outline-none focus:ring-4 focus:ring-blue-100" />
                  <button onClick={handleSaveGoal} className="w-full bg-gray-900 text-white font-black py-5 rounded-[2rem] mt-6 shadow-xl">
                    CONFIRM TARGET
                  </button>
              </div>
          </div>
      )}

      {showReport && (
         <MonthlyReport accounts={accounts} fixedDeposits={fixedDeposits} history={history} wealthGoal={wealthGoal} onClose={() => { setShowReport(false); setShowConfetti(true); }} onNavigateToFD={() => setShowReport(false)} />
      )}
    </div>
  );
};

export default Insights;