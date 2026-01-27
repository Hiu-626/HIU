import { AppState, Account, FixedDeposit, HistoricalDataPoint } from '../types';
import { INITIAL_DATA } from '../constants';

const STORAGE_KEY = 'wealth_snapshot_v1';

// Updated GAS URL
export const GAS_URL = 'https://script.google.com/macros/s/AKfycbwr25mwbzxFN06JOfk6xS43YA4JCm9cRIrSbwci_tJQAklCJWFVJXpU1U4A6xS_ci5GLg/exec';

/**
 * Keep as is: Read local storage
 */
export const getStoredData = (): AppState => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    return JSON.parse(stored);
  }
  
  const defaults: AppState = {
    accounts: INITIAL_DATA.accounts as Account[],
    fixedDeposits: INITIAL_DATA.fixedDeposits as FixedDeposit[],
    history: INITIAL_DATA.history as HistoricalDataPoint[],
    lastUpdated: new Date().toISOString(),
    wealthGoal: 2000000 
  };
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
  return defaults;
};

/**
 * Keep as is: Save to local storage
 */
export const saveStoredData = (data: AppState) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

/**
 * Keep as is: Calculation logic
 */
export const calculateTotalWealthHKD = (accounts: Account[], fixedDeposits: FixedDeposit[]): number => {
  let total = 0;
  const RATE_AUD_TO_HKD = 5.1;
  const RATE_USD_TO_HKD = 7.8;

  const toHKD = (amount: number, currency: string) => {
    if (currency === 'HKD') return amount;
    if (currency === 'AUD') return amount * RATE_AUD_TO_HKD;
    if (currency === 'USD') return amount * RATE_USD_TO_HKD;
    return amount;
  };

  accounts.forEach(acc => {
    total += toHKD(acc.balance, acc.currency);
  });

  fixedDeposits.forEach(fd => {
    total += toHKD(fd.principal, fd.currency);
  });

  return Math.round(total);
};

// --- Cloud Functions ---

/**
 * Cloud Read
 */
export const pullFromCloud = async (userId: string) => {
  try {
    const response = await fetch(`${GAS_URL}?action=READ_STOCKS&userId=${userId}`);
    const result = await response.json();
    return result.status === "Success" ? result.data : null;
  } catch (e) {
    console.error("Cloud Pull Error:", e);
    return null;
  }
};

/**
 * Cloud Sync (Deprecated single push, App.tsx uses the main one)
 */
export const pushToCloud = async (userId: string, account: Account) => {
  try {
    await fetch(GAS_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: "SYNC_TRANSACTION",
        userId: userId,
        institution: account.name, // Updated to match GAS
        amount: account.balance,   // Updated to match GAS
        type: account.type === 'Stock' ? 'STOCK' : 'DEPOSIT',
        symbol: account.name, 
        yieldVal: (account as any).dividendYield || 0,
        price: 0
      }),
    });
  } catch (e) {
    console.error("Cloud Push Error:", e);
  }
};