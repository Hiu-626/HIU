import React, { useMemo, useState, useEffect } from 'react';
import { 
  Area, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  AreaChart, Radar, RadarChart, PolarGrid, PolarAngleAxis, 
  CartesianGrid
} from 'recharts';
import { Account, FixedDeposit, HistoricalDataPoint } from '../types';
import { MOCK_RATES, VOO_HISTORY_DATA } from '../constants';
import { 
  TrendingUp, TrendingDown, Zap, 
  Trophy, Sparkles, FileText, Target, ChevronRight, Activity, Shield, X, 
  Calendar, Languages, Coffee, DollarSign, Coins
} from 'lucide-react';
import MonthlyReport from './MonthlyReport';
import Confetti from './Confetti';

// --- 語言配置 ---
const I18N = {
  zh: {
    insights: '洞察分析',
    realTime: '實時資產分析',
    report: '月度報告',
    benchmark: '基準對比: S&P 500',
    vsMarket: '對標市場',
    outperforming: '領先大市',
    lagging: '落後大市',
    marketDesc: '對比首日全倉買入 VOO (S&P 500 ETF) 的表現',
    health: '投資組合健康度',
    healthScore: '健康評分',
    passiveIncome: '被動收入',
    perMonth: '/月',
    fd: '定期存款',
    dividends: '股票股息',
    goal: '淨資產目標',
    reached: '已達成',
    confirm: '確認目標',
    updateGoal: '更新財富目標',
    incomeBreakdown: '收益細節',
    avgRate: '平均利率',
    avgYield: '平均股息率',
    topContributors: '主要貢獻來源',
    noAssets: '此類別暫無資產',
    freedom: '財務自由度',
    freedomDesc: '覆蓋預計月開支',
    radar: { liquid: '流動性', growth: '增長性', safety: '防禦性', yield: '收益率', divs: '多元化' },
    sourceBreakdown: '貨幣來源分佈'
  },
  en: {
    insights: 'Insights',
    realTime: 'Real-time Analysis',
    report: 'Report',
    benchmark: 'Benchmark: S&P 500',
    vsMarket: 'vs Market',
    outperforming: 'Outperforming',
    lagging: 'Lagging',
    marketDesc: 'Compared to buying VOO (S&P 500 ETF) on day 1.',
    health: 'Portfolio Health',
    healthScore: 'Health Score',
    passiveIncome: 'Passive Income',
    perMonth: '/mo',
    fd: 'Fixed Deposits',
    dividends: 'Dividends',
    goal: 'Net Worth Goal',
    reached: 'Reached',
    confirm: 'CONFIRM TARGET',
    updateGoal: 'Update Wealth Goal',
    incomeBreakdown: 'Income Breakdown',
    avgRate: 'Avg. Interest Rate',
    avgYield: 'Avg. Dividend Yield',
    topContributors: 'Top Contributors',
    noAssets: 'No assets found.',
    freedom: 'Freedom Index',
    freedomDesc: 'Covers est. expense',
    radar: { liquid: 'Liquid', growth: 'Growth', safety: 'Safety', yield: 'Yield', divs: 'Divs' },
    sourceBreakdown: 'Source Breakdown'
  }
};

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
  const [lang, setLang] = useState<'zh' | 'en'>('zh');
  const [displayCur, setDisplayCur] = useState<'HKD' | 'AUD'>('HKD');
  const t = I18N[lang];
  
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [tempGoal, setTempGoal] = useState(wealthGoal.toString());
  const [activeIncomeDetail, setActiveIncomeDetail] = useState<'FD' | 'STOCK' | null>(null);

  // 匯率轉換核心函數
  const convert = (amount: number, fromCurrency: string) => {
    let valInHKD = amount;
    if (fromCurrency === 'AUD') valInHKD = amount * (MOCK_RATES.AUD || 5.1);
    else if (fromCurrency === 'USD') valInHKD = amount * (MOCK_RATES.USD || 7.8);
    
    if (displayCur === 'HKD') return valInHKD;
    return valInHKD / (MOCK_RATES.AUD || 5.1);
  };

  const handleSaveGoal = () => {
    // Save goal in HKD regardless of display
    let val = parseFloat(tempGoal);
    if (displayCur === 'AUD') val = val * (MOCK_RATES.AUD || 5.1); // Convert input back to HKD for storage
    
    if (val > 0) { onUpdateGoal(val); setIsEditingGoal(false); }
  };

  // 當貨幣切換時，重置目標輸入框的值
  useEffect(() => {
    setTempGoal(Math.round(convert(wealthGoal, 'HKD')).toString());
  }, [displayCur, wealthGoal]);

  const passiveData = useMemo(() => {
    const netWorth = history.length > 0 ? convert(history[history.length - 1].totalValueHKD, 'HKD') : 0;
    const incomeBySource = { HKD: 0, AUD: 0, USD: 0 };
    
    // 1. 定期詳情
    const fdDetails = fixedDeposits.map(fd => {
        // Principal in Display Currency
        const principal = convert(fd.principal, fd.currency);
        // Monthly Interest in Display Currency
        const monthly = (principal * ((fd.interestRate || 0) / 100) / 12);
        
        incomeBySource[fd.currency as keyof typeof incomeBySource] += monthly;

        return {
            id: fd.id,
            name: fd.bankName,
            monthly: monthly,
            yield: fd.interestRate || 0,
            currency: fd.currency,
            principal: principal,
            maturity: fd.maturityDate
        };
    }).sort((a, b) => b.monthly - a.monthly);
    
    const totalFDMonthly = fdDetails.reduce((sum, item) => sum + item.monthly, 0);
    const totalFDPrincipal = fdDetails.reduce((sum, item) => sum + item.principal, 0);
    const weightedFDRate = totalFDPrincipal > 0 ? fdDetails.reduce((sum, item) => sum + (item.principal * item.yield), 0) / totalFDPrincipal : 0;

    // 2. 股票詳情
    const stockDetails = accounts.filter(a => a.type === 'Stock').map(acc => {
      // Balance in Display Currency
      const balance = convert(acc.balance, acc.currency);
      const yieldRate = acc.dividendYield || 0;
      const monthly = (balance * (yieldRate / 100) / 12);

      incomeBySource[acc.currency as keyof typeof incomeBySource] += monthly;

      return {
        id: acc.id,
        name: acc.symbol || acc.name,
        fullName: acc.name,
        monthly: monthly,
        yield: yieldRate,
        currency: acc.currency,
        balance: balance
      };
    }).sort((a, b) => b.monthly - a.monthly);
    
    const totalStockMonthly = stockDetails.reduce((sum, item) => sum + item.monthly, 0);
    const totalStockBalance = stockDetails.reduce((sum, item) => sum + item.balance, 0);
    const weightedStockYield = totalStockBalance > 0 ? stockDetails.reduce((sum, item) => sum + (item.balance * item.yield), 0) / totalStockBalance : 0;

    const cashReserve = accounts.filter(a => a.type === 'Cash').reduce((sum, acc) => sum + convert(acc.balance, acc.currency), 0);
    const totalCashMonthly = (cashReserve * 0.005 / 12);
    // Add cash interest to source breakdown roughly (simplified to base currency of account)
    accounts.filter(a => a.type === 'Cash').forEach(acc => {
        incomeBySource[acc.currency as keyof typeof incomeBySource] += convert(acc.balance * 0.005 / 12, acc.currency);
    });

    const totalMonthly = totalFDMonthly + totalStockMonthly + totalCashMonthly;
    
    // 財務自由度預計支出 (假設每月 15,000 HKD = ~2900 AUD)
    const expenseTarget = displayCur === 'HKD' ? 15000 : 2900;
    const freedomProgress = Math.min(100, (totalMonthly / expenseTarget) * 100);

    return {
      totalMonthly, totalFDMonthly, totalStockMonthly, fdDetails, stockDetails,
      weightedFDRate, weightedStockYield, netWorth, cashReserve,
      stockTotal: totalStockBalance, fdTotal: totalFDPrincipal, freedomProgress,
      incomeBySource, expenseTarget
    };
  }, [accounts, fixedDeposits, history, displayCur]);

  const benchmarkChartData = useMemo(() => {
    if (history.length < 1) return [];
    const startData = history[0];
    const startVooPrice = VOO_HISTORY_DATA[startData.date] || 380; 
    
    // Initial Wealth converted to Display Currency
    const initialWealth = convert(startData.totalValueHKD, 'HKD');

    return history.map(point => {
        const currentVooPrice = VOO_HISTORY_DATA[point.date];
        const hypotheticalVOO = currentVooPrice ? initialWealth * (currentVooPrice / startVooPrice) : initialWealth;
        const myVal = convert(point.totalValueHKD, 'HKD');
        return {
            date: point.date,
            MyPortfolio: myVal,
            SP500_Benchmark: Math.round(hypotheticalVOO),
            diff: myVal - hypotheticalVOO
        };
    });
  }, [history, displayCur]);

  const currentBenchmark = benchmarkChartData.length > 0 ? benchmarkChartData[benchmarkChartData.length - 1] : null;
  const isBeatingMarket = currentBenchmark ? currentBenchmark.diff >= 0 : false;

  const radarData = useMemo(() => {
      const total = passiveData.netWorth || 1;
      return [
        { subject: t.radar.liquid, A: Math.min(100, (passiveData.cashReserve / total) * 400), fullMark: 100 },
        { subject: t.radar.growth, A: Math.min(100, (passiveData.stockTotal / total) * 150), fullMark: 100 },
        { subject: t.radar.safety, A: Math.min(100, (passiveData.fdTotal / total) * 200), fullMark: 100 },
        { subject: t.radar.yield, A: Math.min(100, (passiveData.totalMonthly * 12 / total) * 1500), fullMark: 100 },
        { subject: t.radar.divs, A: Math.min(100, (accounts.length + fixedDeposits.length) * 8), fullMark: 100 },
      ];
  }, [passiveData, accounts, fixedDeposits, t]);

  const displayGoal = convert(wealthGoal, 'HKD');
  const goalPercent = Math.min(100, (passiveData.netWorth / displayGoal) * 100);

  return (
    <div className="p-6 pb-28 space-y-8 bg-gray-50/50 min-h-screen font-sans animate-in fade-in duration-500 max-w-md mx-auto">
      <Confetti active={showConfetti} onComplete={() => setShowConfetti(false)} />

      {/* --- HEADER --- */}
      <div className="flex justify-between items-start">
        <div>
           <h1 className="text-3xl font-black text-gray-900 tracking-tighter">{t.insights}</h1>
           <div className="flex items-center gap-2 mt-1">
               <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.realTime}</p>
           </div>
        </div>
        <div className="flex flex-col items-end gap-2">
            <div className="flex gap-2">
                {/* Currency Toggle */}
                <button onClick={() => setDisplayCur(displayCur === 'HKD' ? 'AUD' : 'HKD')} className="bg-white border border-gray-100 px-3 py-2 rounded-xl shadow-sm hover:bg-gray-50 transition-colors flex items-center gap-1.5 active:scale-95">
                    <Coins className="w-3.5 h-3.5 text-indigo-500" />
                    <span className="text-xs font-black text-gray-700">{displayCur}</span>
                </button>
                
                {/* Language Toggle */}
                <button onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')} className="bg-white border border-gray-100 p-2 rounded-xl shadow-sm text-gray-500 hover:bg-gray-50 transition-colors active:scale-95">
                    <Languages className="w-4 h-4" />
                </button>
            </div>
            <button onClick={() => setShowReport(true)} className="text-blue-600 hover:text-blue-700 flex items-center gap-1 font-bold text-[10px] uppercase tracking-wider">
                <FileText className="w-3 h-3" /> {t.report}
            </button>
        </div>
      </div>

      {/* --- BENCHMARK CHART --- */}
      <section className="bg-white rounded-[2.5rem] p-6 shadow-xl shadow-indigo-900/5 border border-white relative overflow-hidden">
          <div className="mb-6">
             <div className="flex justify-between items-start">
                 <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                    <Target className="w-4 h-4" /> {t.benchmark}
                 </h3>
                 {currentBenchmark && (
                     <div className={`px-2.5 py-1 rounded-full text-[10px] font-black flex items-center gap-1 ${isBeatingMarket ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>
                         {isBeatingMarket ? <TrendingUp size={12}/> : <TrendingDown size={12}/>}
                         {isBeatingMarket ? t.outperforming : t.lagging}
                     </div>
                 )}
             </div>
             
             {currentBenchmark && (
                 <div className="mt-2 flex items-baseline gap-2">
                     <span className="text-2xl font-black text-gray-900">
                         {isBeatingMarket ? '+' : '-'}{displayCur === 'HKD' ? '$' : 'A$'}{Math.abs(currentBenchmark.diff).toLocaleString(undefined, {maximumFractionDigits: 0})}
                     </span>
                     <span className="text-[10px] font-bold text-gray-400">{t.vsMarket}</span>
                 </div>
             )}
             <p className="text-[9px] text-gray-400 mt-1 leading-tight">{t.marketDesc}</p>
          </div>

          <div className="h-48 w-full">
             <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={benchmarkChartData} margin={{ top: 5, right: 0, left: -30, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorMy" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#4F46E5" stopOpacity={0.2}/><stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="date" tick={{fontSize: 9, fill: '#9CA3AF', fontWeight: 'bold'}} tickLine={false} axisLine={false} tickFormatter={(val) => val.split('-')[1]} />
                  <YAxis tick={{fontSize: 9, fill: '#9CA3AF', fontWeight: 'bold'}} tickLine={false} axisLine={false} tickFormatter={(val) => `${(val/1000).toFixed(0)}k`} />
                  <Tooltip 
                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '10px'}} 
                    formatter={(value: number) => [`${displayCur} ${Math.round(value).toLocaleString()}`, '']}
                  />
                  <Area type="monotone" dataKey="SP500_Benchmark" stroke="#9CA3AF" strokeWidth={1} strokeDasharray="4 4" fill="transparent" />
                  <Area type="monotone" dataKey="MyPortfolio" stroke="#4F46E5" strokeWidth={3} fill="url(#colorMy)" />
                </AreaChart>
             </ResponsiveContainer>
          </div>
      </section>

      {/* --- RADAR & PASSIVE --- */}
      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-gray-100 relative">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center">
                <Activity className="w-4 h-4 mr-2 text-blue-500" /> {t.health}
            </h3>
            <div className="h-48 -ml-6">
                 <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                      <PolarGrid stroke="#f3f4f6" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#9CA3AF', fontSize: 10, fontWeight: 800 }} />
                      <Radar name="Portfolio" dataKey="A" stroke="#0052CC" strokeWidth={2} fill="#0052CC" fillOpacity={0.15} />
                    </RadarChart>
                 </ResponsiveContainer>
            </div>
            <div className="absolute top-6 right-6 text-right">
                <div className="text-3xl font-black text-gray-900">{Math.round(radarData.reduce((a,b)=>a+b.A,0)/5)}</div>
                <div className="text-[9px] font-bold text-gray-400 uppercase">{t.healthScore}</div>
            </div>
        </div>

        {/* Passive Income Card */}
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-[3rem] p-7 shadow-2xl text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500 rounded-full blur-[60px] opacity-20"></div>
            <div className="flex justify-between items-center mb-2">
               <div className="flex items-center space-x-2">
                  <Zap className="w-4 h-4 text-yellow-400 fill-current" />
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t.passiveIncome}</span>
               </div>
               <div className="flex items-center gap-1.5 bg-white/10 px-2 py-1 rounded-lg">
                  <Coffee className="w-3 h-3 text-emerald-400" />
                  <span className="text-[10px] font-bold text-emerald-400">{passiveData.freedomProgress.toFixed(0)}% {t.freedom}</span>
               </div>
            </div>
            <div className="flex items-end gap-2 mb-6"><div className="text-4xl font-black tracking-tighter"><CountUp end={passiveData.totalMonthly} prefix={displayCur === 'HKD' ? "$" : "A$"} /></div><span className="text-sm font-bold text-gray-400 mb-1.5">{t.perMonth}</span></div>
            <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setActiveIncomeDetail('FD')} className="bg-white/5 rounded-2xl p-4 backdrop-blur-md hover:bg-white/10 transition-all active:scale-95 text-left group border border-white/5">
                    <div className="text-[9px] text-gray-400 uppercase font-black mb-1">{t.fd}</div>
                    <div className="font-black text-white text-lg">{displayCur === 'HKD' ? "$" : "A$"}{Math.round(passiveData.totalFDMonthly).toLocaleString()}</div>
                </button>
                <button onClick={() => setActiveIncomeDetail('STOCK')} className="bg-white/5 rounded-2xl p-4 backdrop-blur-md hover:bg-white/10 transition-all active:scale-95 text-left group border border-white/5">
                    <div className="text-[9px] text-gray-400 uppercase font-black mb-1">{t.dividends}</div>
                    <div className="font-black text-white text-lg">{displayCur === 'HKD' ? "$" : "A$"}{Math.round(passiveData.totalStockMonthly).toLocaleString()}</div>
                </button>
            </div>
            <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                <div className="text-[9px] text-gray-500 font-bold">{t.freedomDesc} ({displayCur === 'HKD' ? "$" : "A$"}{passiveData.expenseTarget.toLocaleString()})</div>
                <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 transition-all duration-1000" style={{width: `${passiveData.freedomProgress}%`}} />
                </div>
            </div>
        </div>
      </div>

      {/* --- GOAL PROGRESS --- */}
      <div onClick={() => setIsEditingGoal(true)} className="bg-white border border-gray-100 rounded-[2.5rem] p-6 shadow-sm cursor-pointer active:scale-95 transition-transform">
          <div className="flex justify-between items-start mb-4">
             <div><h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-2"><Target className="w-4 h-4" /> {t.goal}</h3><div className="text-2xl font-black text-gray-900 tracking-tight">{displayCur === 'HKD' ? "$" : "A$"}{displayGoal.toLocaleString(undefined, {maximumFractionDigits: 0})}</div></div>
             <div className="bg-gray-50 p-2 rounded-full text-gray-400"><ChevronRight className="w-5 h-5" /></div>
          </div>
          <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden"><div className="absolute top-0 left-0 h-full bg-[#0052CC] transition-all duration-1000" style={{ width: `${goalPercent}%` }} /></div>
          <div className="flex justify-between mt-2 text-[10px] font-bold text-gray-400 uppercase"><span>Current: {displayCur === 'HKD' ? "$" : "A$"}{passiveData.netWorth.toLocaleString(undefined, {maximumFractionDigits: 0})}</span><span className="text-[#0052CC]">{goalPercent.toFixed(1)}% {t.reached}</span></div>
      </div>

      {/* --- MODALS (Income Details) --- */}
      {activeIncomeDetail && (
          <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:px-4">
              <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={() => setActiveIncomeDetail(null)} />
              <div className="bg-white w-full max-w-sm rounded-t-[3rem] sm:rounded-[3rem] p-8 pb-12 sm:pb-8 relative z-10 animate-in slide-in-from-bottom-20 max-h-[90vh] overflow-y-auto no-scrollbar">
                  <div className="flex justify-between items-center mb-6">
                      <div className="flex items-center gap-3">
                          <div className={`p-3 rounded-2xl ${activeIncomeDetail === 'FD' ? 'bg-yellow-100 text-yellow-600' : 'bg-blue-100 text-blue-600'}`}>
                             {activeIncomeDetail === 'FD' ? <Shield size={24}/> : <Sparkles size={24}/>}
                          </div>
                          <div><h2 className="text-xl font-black text-gray-900 leading-none">{activeIncomeDetail === 'FD' ? t.fd : t.dividends}</h2><span className="text-[10px] font-bold text-gray-400 uppercase">{t.incomeBreakdown}</span></div>
                      </div>
                      <button onClick={() => setActiveIncomeDetail(null)} className="p-2 bg-gray-50 rounded-full text-gray-400"><X size={20}/></button>
                  </div>

                  <div className={`p-5 rounded-[2rem] mb-6 flex justify-between items-center ${activeIncomeDetail === 'FD' ? 'bg-yellow-50 text-yellow-800' : 'bg-blue-50 text-blue-800'}`}>
                      <div><div className="text-[9px] uppercase font-black opacity-60 mb-1">{activeIncomeDetail === 'FD' ? t.avgRate : t.avgYield}</div><div className="text-3xl font-black tracking-tight">{(activeIncomeDetail === 'FD' ? passiveData.weightedFDRate : passiveData.weightedStockYield).toFixed(2)}<span className="text-lg ml-0.5">%</span></div></div>
                      <div className="text-right"><div className="text-[9px] uppercase font-black opacity-60 mb-1">{t.passiveIncome}</div><div className="text-xl font-black">{displayCur === 'HKD' ? "$" : "A$"}{Math.round(activeIncomeDetail === 'FD' ? passiveData.totalFDMonthly : passiveData.totalStockMonthly).toLocaleString()}</div></div>
                  </div>

                  {/* Currency Breakdown */}
                  <div className="bg-gray-50 rounded-2xl p-4 mb-6">
                      <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1">
                          <Coins size={12}/> {t.sourceBreakdown} ({displayCur})
                      </h4>
                      <div className="flex justify-between gap-2">
                         {['HKD', 'AUD', 'USD'].map(cur => {
                             const amount = passiveData.incomeBySource[cur as keyof typeof passiveData.incomeBySource] || 0;
                             if (amount === 0) return null;
                             return (
                                 <div key={cur} className="flex-1 bg-white p-3 rounded-xl border border-gray-100 shadow-sm text-center">
                                     <div className="text-[9px] font-black text-gray-400 mb-1">{cur} Asset</div>
                                     <div className="font-bold text-gray-800 text-sm">{displayCur === 'HKD' ? "$" : "A$"}{Math.round(amount).toLocaleString()}</div>
                                 </div>
                             );
                         })}
                      </div>
                  </div>

                  <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Trophy size={14} className="text-yellow-500"/> {t.topContributors}</h3>
                  <div className="space-y-3">
                      {(activeIncomeDetail === 'FD' ? passiveData.fdDetails : passiveData.stockDetails).map((item, idx) => (
                          <div key={item.id} className="bg-white border border-gray-100 rounded-2xl p-4 flex justify-between items-center group hover:border-blue-200 transition-colors">
                              <div className="flex items-center gap-3 overflow-hidden">
                                  <div className="w-6 h-6 shrink-0 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-black text-gray-500">{idx + 1}</div>
                                  <div className="overflow-hidden"><div className="font-bold text-gray-900 text-sm truncate">{item.name}</div><div className="text-[9px] font-bold text-gray-400 flex items-center gap-1">{activeIncomeDetail === 'FD' ? <><Calendar size={10}/> {new Date((item as any).maturity).toLocaleDateString()}</> : `${item.currency} Asset`}</div></div>
                              </div>
                              <div className="text-right shrink-0 ml-2">
                                  <div className={`font-black text-sm ${activeIncomeDetail === 'FD' ? 'text-yellow-600' : 'text-blue-600'}`}>+{displayCur === 'HKD' ? "$" : "A$"}{Math.round(item.monthly).toLocaleString()}</div>
                                  <div className="text-[9px] font-bold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded inline-block mt-0.5">{item.yield.toFixed(2)}%</div>
                              </div>
                          </div>
                      ))}
                      {(activeIncomeDetail === 'FD' ? passiveData.fdDetails : passiveData.stockDetails).length === 0 && (
                          <div className="text-center py-8 text-gray-400 font-bold text-sm bg-gray-50 rounded-2xl border-dashed border-2 border-gray-200">{t.noAssets}</div>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* --- GOAL EDIT MODAL --- */}
      {isEditingGoal && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
              <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={() => setIsEditingGoal(false)} />
              <div className="bg-white w-full max-w-xs rounded-[3rem] p-8 relative z-10 animate-in zoom-in-95 shadow-2xl">
                  <h2 className="text-lg font-black text-gray-900 mb-6 text-center">{t.updateGoal}</h2>
                  <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 font-black text-xl">{displayCur === 'HKD' ? "$" : "A$"}</span>
                      <input type="number" autoFocus value={tempGoal} onChange={(e) => setTempGoal(e.target.value)} className="w-full bg-gray-50 p-6 pl-12 rounded-[2rem] text-3xl font-black text-blue-600 text-center outline-none ring-2 ring-transparent focus:ring-blue-100 transition-all" />
                  </div>
                  <button onClick={handleSaveGoal} className="w-full bg-gray-900 text-white font-black py-5 rounded-[2rem] mt-6 shadow-xl active:scale-95 transition-transform uppercase tracking-wider text-xs">{t.confirm}</button>
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