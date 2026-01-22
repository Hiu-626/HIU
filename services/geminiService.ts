import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// Initialization
// API key must be obtained exclusively from process.env.API_KEY
// We use a fallback string to prevent the app from crashing on load if the environment variable is missing.
// This allows other features (like Data Migration) to work even without an API key.
const apiKey = process.env.API_KEY || "missing_api_key_placeholder";
const ai = new GoogleGenAI({ apiKey });

export interface ScannedAsset {
  category: 'CASH' | 'STOCK';
  institution: string;
  symbol?: string;
  amount: number; 
  currency: string;
  price?: number; // Added for manual price editing
  dividendYield?: number; // Added for live yield
}

/**
 * 自動重試機制
 * 增強版：處理 Quota Exceeded 的等待時間 (指數退避)
 */
const runWithRetry = async <T>(fn: () => Promise<T>, retries = 5, delay = 3000): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    const errorMsg = JSON.stringify(error);
    const isQuotaError = error?.status === 429 || errorMsg.includes("429");
    const isOverloaded = errorMsg.includes("503") || errorMsg.includes("overloaded");

    if ((isQuotaError || isOverloaded) && retries > 0) {
      console.warn(`AI busy (429/503), retrying in ${delay}ms... (${retries} left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      // Exponential backoff: 3s -> 6s -> 12s -> 24s -> 48s
      return runWithRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
};

/**
 * 核心功能：分析財務報表圖片
 * @param base64Data 不含標頭的純 Base64 字串
 */
export const parseFinancialStatement = async (base64Data: string): Promise<ScannedAsset[] | null> => {
  try {
    // Check if API key is missing before making the call
   if (!process.env.API_KEY) {
      console.warn("API Key is missing. AI features are disabled.");
      return null;
    }

    // 💡 修正：更精確的 Prompt，區分 Quantity (股數) 與 Price (股價)
    const prompt = `
      Instructions:
      1. Analyze the attached financial statement image.
      2. Extract all assets into a JSON array.
      3. For each asset, extract the following fields precisely:
         - category: 'STOCK' (for shares/equities/funds) or 'CASH' (for bank balances/deposits).
         - institution: The Name of the holding/bank (e.g. 'Apple Inc', 'HSBC', 'Vanguard 500').
         - symbol: The ticker code (e.g. 'AAPL', '0700.HK', 'IVV'). If CASH, leave empty.
         - quantity: (STOCK ONLY) The number of shares/units held. Do NOT confuse with Price.
         - unitPrice: (STOCK ONLY) The price per share.
         - balance: (CASH ONLY) The total balance. For STOCK, this is the Market Value.
         - currency: 'HKD', 'USD', or 'AUD'.
      
      Return ONLY a JSON array.
    `;

    const response = await runWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview', 
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Data
            }
          },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
      }
    }));

    const text = response.text;
    
    if (!text) return null;

    try {
      const parsed = JSON.parse(text);
      const rawData = Array.isArray(parsed) ? parsed : (parsed.assets || []);
      
      // Map AI response to internal format
      const finalData = rawData.map((item: any) => ({
          category: item.category === 'STOCK' ? 'STOCK' : 'CASH',
          institution: item.institution || item.name || 'Unknown',
          symbol: item.symbol,
          // If STOCK, amount is quantity. If CASH, amount is balance.
          amount: item.category === 'STOCK' ? (Number(item.quantity) || 0) : (Number(item.balance) || 0),
          currency: item.currency || 'HKD',
          price: Number(item.unitPrice) || Number(item.price) || 0
      }));

      console.log("AI Analysis Success:", finalData);
      return finalData as ScannedAsset[];
    } catch (e) {
      console.error("AI JSON Parsing Error. Raw Text:", text);
      return null;
    }

  } catch (error: any) {
    console.error("Critical AI Error Details:", error);
    return null;
  }
};