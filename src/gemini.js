import { GoogleGenerativeAI } from "@google/generative-ai";

// Ensure you have your API key in a .env.local file
const API_KEY = process.env.REACT_APP_GEMINI_API_KEY;

if (!API_KEY) {
  throw new Error("Missing Google Gemini API Key. Please set it in your .env.local file.");
}

const genAI = new GoogleGenerativeAI(API_KEY);

/**
 * Fetches a 3-paragraph analysis of a company using the Gemini API.
 * @param {string} companyName The name of the company (e.g., "Tesla Inc.").
 * @param {string} ticker The stock ticker (e.g., "TSLA").
 * @returns {Promise<string>} The generated text analysis.
 */
export async function fetchCompanyAnalysis(companyName, ticker) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `
    Analyze the company ${companyName} (Ticker: ${ticker}). Provide the analysis in exactly three distinct paragraphs:

    Write Company Overview then a brief, one-paragraph overview of the company. What is its primary business and what does it sell?

    Then a newline for spacing between paragraphs.

    Write Qualities then a bullish case for the company. What are its core strengths, competitive advantages, and potential future growth catalysts?

    Then a newline for spacing between paragraphs.

    Write Risks then a bearish case for the company. What are the primary risks, challenges, and weaknesses it faces?
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Error fetching analysis from Gemini API:", error);
    return "Error: Could not fetch analysis. The API may be unavailable or the request may have been blocked.";
  }
}