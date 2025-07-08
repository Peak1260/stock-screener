import React from 'react';

function AnalysisModal({ isOpen, onClose, stock, analysis, isLoading, error }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center" onClick={onClose}>
      {/* Modal content */}
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl z-50 relative" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-2 right-4 text-2xl font-bold text-gray-600 hover:text-gray-900">&times;</button>
        <h2 className="text-2xl font-bold mb-4">{stock.name} Analysis</h2>
        
        {isLoading && (
          <div className="flex justify-center items-center h-48">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        )}

        {error && <div className="text-red-500 bg-red-100 p-4 rounded">{error}</div>}

        {analysis && !isLoading && (
          <div className="space-y-4 text-gray-700 whitespace-pre-wrap">
            {analysis.split('\n\n').map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default AnalysisModal;