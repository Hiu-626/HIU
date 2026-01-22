
export const THEME = {
  bg: '#F8F9FA',
  primary: '#0052CC',
  alert: '#FF5252',
  warning: '#FFC107',
  success: '#4CAF50',
  text: '#172B4D',
  textLight: '#6B778C'
};

export const MOCK_RATES = {
  AUD: 5.1, // 1 AUD = 5.1 HKD
  USD: 7.8, // 1 USD = 7.8 HKD
  HKD: 1
};

// 真實 S&P 500 (VOO) 每月收盤價數據 (USD)
// 用於 Insights 頁面的真實 Benchmark 比較
export const VOO_HISTORY_DATA: Record<string, number> = {
  '2023-01': 366.59,
  '2023-02': 356.68,
  '2023-03': 370.16,
  '2023-04': 376.62,
  '2023-05': 378.20,
  '2023-06': 403.62,
  '2023-07': 416.58,
  '2023-08': 409.68,
  '2023-09': 390.17,
  '2023-10': 381.01,
  '2023-11': 415.69,
  '2023-12': 434.33,
  '2024-01': 441.74,
  '2024-02': 468.03,
  '2024-03': 483.07,
  '2024-04': 463.63,
  '2024-05': 486.27,
  '2024-06': 503.20,
  '2024-07': 508.62,
  '2024-08': 520.25,
  '2024-09': 531.02,
  '2024-10': 526.47,
  '2024-11': 557.06,
  '2024-12': 550.84, // Est
  '2025-01': 565.20, // Est
  '2025-02': 572.10, // Est
};

export const INITIAL_DATA = {
  accounts: [
    { id: '1', name: 'HSBC HK', type: 'Cash', currency: 'HKD', balance: 150000 },
    { id: '2', name: 'CommBank AU', type: 'Cash', currency: 'AUD', balance: 5000 },
    { id: '3', name: 'Interactive Brokers', type: 'Stock', currency: 'HKD', balance: 45000, symbol: '0700.HK', quantity: 100, lastPrice: 450 },
  ],
  fixedDeposits: [
    { id: '101', bankName: 'Standard Chartered', principal: 100000, currency: 'HKD', maturityDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), actionOnMaturity: 'Renew', interestRate: 4.1, autoRoll: true }, // 5 days from now
    { id: '102', bankName: 'Virtual Bank (Mox)', principal: 50000, currency: 'HKD', maturityDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(), actionOnMaturity: 'Transfer Out', interestRate: 3.8, autoRoll: false }, // 25 days from now
  ],
  history: [
    { date: '2023-05', totalValueHKD: 180000 },
    { date: '2023-06', totalValueHKD: 185000 },
    { date: '2023-07', totalValueHKD: 182000 },
    { date: '2023-08', totalValueHKD: 195000 },
    { date: '2023-09', totalValueHKD: 210000 },
    { date: '2023-10', totalValueHKD: 215000 },
  ]
};
