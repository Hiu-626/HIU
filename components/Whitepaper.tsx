import React, { useState, useEffect } from 'react';
import { Lock, Unlock, ChevronLeft, ShieldCheck, FileText, Delete, X } from 'lucide-react';

interface WhitepaperProps {
  onBack: () => void;
}

// 模擬兩個帳戶的白皮書內容
const ACCOUNT_CONTENT = {
  '8888': {
    name: 'Alpha Strategy',
    owner: 'Account A',
    theme: 'blue',
    content: `
      ## 1. Core Philosophy: Aggressive Growth
      The primary objective of Account A is maximizing capital appreciation through high-conviction exposure to technology and emerging markets. Volatility is accepted as the price of admission for superior long-term returns.

      ## 2. Asset Allocation Target
      - **Technology Equities (US):** 60%
      - **Emerging Markets (HK/CN):** 30%
      - **Cash / Opportunity Fund:** 10%

      ## 3. Execution Rules
      1. **DCA Strategy:** Inject capital on the 5th of every month regardless of market conditions.
      2. **Correction Protocol:** If S&P 500 drops >10%, deploy 50% of Cash Reserves immediately.
      3. **Exit Strategy:** Take profit only when individual holding exceeds 15% of total portfolio weight, rebalancing into laggards.

      ## 4. Current Watchlist
      - NVDA (AI Infrastructure)
      - TSM (Semiconductor Monopoly)
      - 0700.HK (Tencent - Value Play)
      
      ## 5. Risk Management
      Stop losses are NOT used for core holdings. Fundamental thesis breach is the only sell signal.
    `
  },
  '9999': {
    name: 'Fortress Yield',
    owner: 'Account B',
    theme: 'emerald',
    content: `
      ## 1. Core Philosophy: Wealth Preservation
      Account B focuses on generating consistent, tax-efficient passive income. The goal is to cover 100% of lifestyle expenses through dividends and interest, rendering market price fluctuations irrelevant.

      ## 2. Asset Allocation Target
      - **Fixed Deposits (Laddered):** 40%
      - **High Dividend Stocks (HK/AU):** 40%
      - **Investment Grade Bonds:** 20%

      ## 3. The "Iron Income" Rules
      1. **Yield Threshold:** No asset purchased under 4.5% yield.
      2. **FD Ladder:** Maturities must be staggered every 3 months to ensure liquidity.
      3. **Reinvestment:** All dividends must be reinvested (DRIP) until monthly income exceeds $20,000 HKD.

      ## 4. Safe Haven List
      - 0005.HK (HSBC)
      - CSL.AX (Healthcare Defensive)
      - HK Government Silver Bonds
      
      ## 5. Emergency Protocol
      Maintain 6 months of living expenses in liquid high-yield savings accounts at all times.
    `
  }
};

const Whitepaper: React.FC<WhitepaperProps> = ({ onBack }) => {
  const [pin, setPin] = useState('');
  const [isLocked, setIsLocked] = useState(true);
  const [activeAccount, setActiveAccount] = useState<keyof typeof ACCOUNT_CONTENT | null>(null);
  const [error, setError] = useState(false);

  const handleNumClick = (num: string) => {
    if (pin.length < 4) {
      if (navigator.vibrate) navigator.vibrate(10); // Haptic feedback
      setPin(prev => prev + num);
      setError(false);
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setError(false);
  };

  useEffect(() => {
    if (pin.length === 4) {
      if (ACCOUNT_CONTENT[pin as keyof typeof ACCOUNT_CONTENT]) {
        // Success
        setTimeout(() => {
          setActiveAccount(pin as keyof typeof ACCOUNT_CONTENT);
          setIsLocked(false);
          if (navigator.vibrate) navigator.vibrate([20, 30, 20]);
        }, 300);
      } else {
        // Fail
        setError(true);
        if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
        setTimeout(() => setPin(''), 500);
      }
    }
  }, [pin]);

  // --- Render Locked View (Keypad) ---
  if (isLocked) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6 text-white animate-in fade-in duration-500">
        <button onClick={onBack} className="absolute top-6 left-6 p-2 bg-gray-800 rounded-full text-gray-400 hover:text-white">
           <X size={20} />
        </button>

        <div className="mb-10 text-center">
          <div className="w-16 h-16 bg-gray-800 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-black/50">
            <ShieldCheck className="w-8 h-8 text-blue-500" />
          </div>
          <h2 className="text-xl font-bold tracking-widest uppercase mb-2">Restricted Access</h2>
          <p className="text-gray-500 text-xs font-medium">Enter PIN to view Strategy Docs</p>
        </div>

        {/* PIN Dots */}
        <div className={`flex gap-6 mb-12 ${error ? 'animate-shake' : ''}`}>
          {[0, 1, 2, 3].map(i => (
            <div 
              key={i} 
              className={`w-4 h-4 rounded-full transition-all duration-300 ${
                pin.length > i ? 'bg-blue-500 scale-110 shadow-[0_0_10px_rgba(59,130,246,0.8)]' : 'bg-gray-800'
              }`} 
            />
          ))}
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-6 w-full max-w-[280px]">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button
              key={num}
              onClick={() => handleNumClick(num.toString())}
              className="w-20 h-20 rounded-full bg-gray-800/50 hover:bg-gray-700 active:bg-blue-600/20 active:scale-95 transition-all flex items-center justify-center text-2xl font-medium font-mono border border-gray-700/50 backdrop-blur-sm"
            >
              {num}
            </button>
          ))}
          <div className="w-20 h-20" /> {/* Spacer */}
          <button
              onClick={() => handleNumClick('0')}
              className="w-20 h-20 rounded-full bg-gray-800/50 hover:bg-gray-700 active:bg-blue-600/20 active:scale-95 transition-all flex items-center justify-center text-2xl font-medium font-mono border border-gray-700/50 backdrop-blur-sm"
            >
              0
          </button>
          <button
              onClick={handleDelete}
              className="w-20 h-20 rounded-full hover:bg-red-900/20 active:scale-95 transition-all flex items-center justify-center text-red-400"
            >
              <Delete size={24} />
          </button>
        </div>
        
        <div className="mt-12 text-[10px] text-gray-600 font-mono">
           SECURE ENCLAVE v2.0
        </div>
        
        <style>{`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-10px); }
            75% { transform: translateX(10px); }
          }
          .animate-shake { animation: shake 0.3s ease-in-out; }
        `}</style>
      </div>
    );
  }

  // --- Render Content View ---
  const data = activeAccount ? ACCOUNT_CONTENT[activeAccount] : ACCOUNT_CONTENT['8888'];
  const isDark = data.theme === 'blue'; 

  return (
    <div className={`min-h-screen ${isDark ? 'bg-[#F8F9FA]' : 'bg-[#F0FDF4]'} font-sans animate-in slide-in-from-bottom-10`}>
      {/* Header */}
      <div className={`sticky top-0 z-10 px-6 py-4 flex items-center justify-between bg-white/80 backdrop-blur-md border-b ${isDark ? 'border-blue-100' : 'border-green-100'}`}>
         <button onClick={() => { setIsLocked(true); setPin(''); }} className="flex items-center text-sm font-bold text-gray-500 hover:text-gray-900">
            <ChevronLeft size={20} className="mr-1" /> LOCK
         </button>
         <div className="flex flex-col items-end">
            <span className={`text-xs font-black uppercase tracking-widest ${isDark ? 'text-blue-600' : 'text-green-600'}`}>
              {data.owner}
            </span>
            <span className="text-[10px] font-bold text-gray-400">Verified Access</span>
         </div>
      </div>

      <div className="p-6 pb-24 max-w-2xl mx-auto">
         {/* Title Card */}
         <div className={`rounded-3xl p-8 mb-8 shadow-xl ${isDark ? 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white' : 'bg-gradient-to-br from-emerald-600 to-teal-700 text-white'}`}>
            <FileText className="w-8 h-8 mb-4 opacity-80" />
            <h1 className="text-3xl font-black tracking-tight mb-2">{data.name}</h1>
            <p className="text-white/70 text-sm font-medium">Confidential Strategy Document • {new Date().getFullYear()}</p>
         </div>

         {/* Markdown-like Content Rendering */}
         <div className="prose prose-sm max-w-none text-gray-700 space-y-6">
            {data.content.split('\n').map((line, idx) => {
               const trimmed = line.trim();
               if (!trimmed) return null;
               
               if (trimmed.startsWith('## ')) {
                 return <h2 key={idx} className="text-lg font-black text-gray-900 mt-8 mb-3 pb-2 border-b border-gray-200">{trimmed.replace('## ', '')}</h2>;
               }
               if (trimmed.startsWith('- ')) {
                 return (
                   <div key={idx} className="flex items-start mb-2 ml-2">
                      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 mr-3 shrink-0 ${isDark ? 'bg-blue-500' : 'bg-green-500'}`} />
                      <span className="font-medium" dangerouslySetInnerHTML={{ __html: trimmed.replace('- ', '').replace(/\*\*(.*?)\*\*/g, '<b class="text-gray-900">$1</b>') }} />
                   </div>
                 );
               }
               if (trimmed.startsWith('1. ') || trimmed.startsWith('2. ') || trimmed.startsWith('3. ')) {
                 return (
                   <div key={idx} className="flex items-start mb-3 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                      <span className={`font-black mr-3 text-lg ${isDark ? 'text-blue-200' : 'text-green-200'}`}>{trimmed.substring(0, 2)}</span>
                      <span className="font-medium text-sm pt-0.5" dangerouslySetInnerHTML={{ __html: trimmed.substring(3).replace(/\*\*(.*?)\*\*/g, '<b class="text-gray-900">$1</b>') }} />
                   </div>
                 );
               }
               return <p key={idx} className="leading-relaxed text-gray-600 font-medium">{trimmed}</p>;
            })}
         </div>

         <div className="mt-12 p-6 bg-gray-100 rounded-2xl text-center">
            <Unlock className="w-6 h-6 mx-auto text-gray-400 mb-2" />
            <p className="text-[10px] text-gray-400 font-bold uppercase">End of Document</p>
         </div>
      </div>
    </div>
  );
};

export default Whitepaper;
