import { useState, useEffect } from 'react';

function ProcessingPage({ execution, onCancel }) {
  const [processingStatus, setProcessingStatus] = useState(execution.processingStatus || {
    currentMaterial: '',
    processedCount: 0,
    totalCount: 0,
    isProcessing: true,
    results: []
  });
  const [error, setError] = useState(null);
  const [isPolling, setIsPolling] = useState(true);

  // Poll for status updates
  useEffect(() => {
    if (!execution || !execution._id || !isPolling) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`http://localhost:5001/api/process-materials/${execution._id}/status`);
        const data = await response.json();
        
        if (data.success) {
          setProcessingStatus(data.processingStatus);
          
          // Stop polling if processing is complete
          if (!data.processingStatus.isProcessing) {
            setIsPolling(false);
            clearInterval(pollInterval);
          }
        } else {
          setError(data.message || 'Failed to fetch processing status');
          setIsPolling(false);
        }
      } catch (err) {
        console.error('Error polling for status:', err);
        setError('Error fetching processing status: ' + err.message);
        setIsPolling(false);
      }
    }, 2000); // Poll every 2 seconds
    
    return () => {
      clearInterval(pollInterval);
    };
  }, [execution, isPolling]);

  const handleCancelProcessing = async () => {
    try {
      const response = await fetch(`http://localhost:5001/api/process-materials/${execution._id}/cancel`, {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (data.success) {
        setIsPolling(false);
        onCancel();
      } else {
        setError(data.message || 'Failed to cancel processing');
      }
    } catch (err) {
      console.error('Error cancelling processing:', err);
      setError('Error cancelling processing: ' + err.message);
    }
  };

  // Calculate progress percentage
  const progressPercentage = processingStatus.totalCount > 0
    ? Math.round((processingStatus.processedCount / processingStatus.totalCount) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/95 backdrop-blur-sm sticky top-0 z-50 w-full">
        <div className="center-container">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-8">
              <div className="flex flex-col">
                <div className="text-yellow-500 text-2xl font-bold tracking-tight">
                  <span className="text-white">Orchard</span> Lane
                </div>
                <div className="text-gray-400 text-xs tracking-wider uppercase">Agentic Vendor Procurement</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="py-8 flex flex-col items-center w-full flex-grow">
        <div className="center-container">
          <div className="bg-gray-800 rounded-xl p-8 max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-white">Processing Materials</h1>
              <button 
                className="px-4 py-2 rounded-lg border border-gray-600 text-white hover:bg-gray-700"
                onClick={handleCancelProcessing}
              >
                Cancel Process
              </button>
            </div>
            
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-white font-semibold">Execution: {execution.name}</h3>
                <span className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-sm">
                  {processingStatus.processedCount} of {processingStatus.totalCount} materials
                </span>
              </div>
              
              {/* Progress Bar */}
              <div className="w-full bg-gray-700 rounded-full h-4 mb-4">
                <div 
                  className="bg-gradient-to-r from-yellow-500 to-yellow-600 h-4 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
              
              {/* Current Material */}
              {processingStatus.currentMaterial && (
                <div className="bg-gray-700/50 rounded-lg p-4 mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="animate-pulse">
                      <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    </div>
                    <p className="text-white">
                      Currently processing: <span className="text-yellow-500 font-semibold">{processingStatus.currentMaterial}</span>
                    </p>
                  </div>
                </div>
              )}
              
              {/* Processing Complete */}
              {!processingStatus.isProcessing && processingStatus.processedCount >= processingStatus.totalCount && (
                <div className="bg-green-500/10 border border-green-500/20 text-green-400 px-4 py-3 rounded-lg mb-4">
                  <div className="flex items-center space-x-3">
                    <i className="fa-solid fa-check-circle"></i>
                    <p>Processing complete! All materials have been processed.</p>
                  </div>
                </div>
              )}
              
              {/* Error Message */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg mb-4">
                  <div className="flex items-center space-x-3">
                    <i className="fa-solid fa-exclamation-circle"></i>
                    <p>{error}</p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Results Section */}
            <div>
              <h3 className="text-white font-semibold mb-4">Processing Results</h3>
              
              {processingStatus.results && processingStatus.results.length > 0 ? (
                <div className="space-y-4">
                  {processingStatus.results.map((result, index) => (
                    <div key={index} className="bg-gray-700/50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-white">Material #{index + 1}</h4>
                        <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full text-xs">Processed</span>
                      </div>
                      <pre className="text-gray-400 text-sm overflow-x-auto">
                        {JSON.stringify(result, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <p className="text-gray-400">No results yet</p>
                </div>
              )}
            </div>
            
            {/* Return to Dashboard Button */}
            <div className="mt-8 text-center">
              <button 
                className="px-6 py-2 rounded-lg border border-gray-600 text-white hover:bg-gray-700"
                onClick={onCancel}
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default ProcessingPage;
