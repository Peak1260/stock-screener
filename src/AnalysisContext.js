import React, { createContext, useState, useContext } from 'react';
import AnalysisModal from './AnalysisModal'; 
import { fetchCompanyAnalysis } from './gemini'; 

// 1. Create the context
const AnalysisContext = createContext();

// 2. Create a custom hook to easily use the context
export const useAnalysis = () => useContext(AnalysisContext);

// 3. Create the Provider component
export function AnalysisProvider({ children }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState(null);
  const [analysisResult, setAnalysisResult] = useState("");
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [analysisError, setAnalysisError] = useState(null);

  const handleSearchSubmit = async (ticker) => {
    const stockForAnalysis = { symbol: ticker, name: ticker };
    setSelectedStock(stockForAnalysis);
    setIsModalOpen(true);
    setIsLoadingAnalysis(true);
    setAnalysisResult("");
    setAnalysisError(null);

    const result = await fetchCompanyAnalysis(ticker, ticker);
    
    setAnalysisResult(result);
    if (result.startsWith("Error:")) {
      setAnalysisError(result);
    }
    setIsLoadingAnalysis(false);
    setSearchQuery(""); 
  };

  const value = {
    searchQuery,
    setSearchQuery,
    handleSearchSubmit,
  };

  return (
    <AnalysisContext.Provider value={value}>
      {children}
      <AnalysisModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        stock={selectedStock}
        analysis={analysisResult}
        isLoading={isLoadingAnalysis}
        error={analysisError}
      />
    </AnalysisContext.Provider>
  );
}