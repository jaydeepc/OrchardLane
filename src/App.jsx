import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [view, setView] = useState('dashboard'); // 'dashboard' or 'newExecution'
  const [executions, setExecutions] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // New execution form state
  const [executionName, setExecutionName] = useState('');
  const [materials, setMaterials] = useState([
    { id: 1, name: '', quantity: 0, rate: 0, totalCost: 0 }
  ]);
  const [guardrails, setGuardrails] = useState({
    maxPricePerKg: '',
    deliveryTimeline: '',
    certifications: ['FSSAI']
  });
  
  // Fetch executions and activity on component mount
  useEffect(() => {
    fetchExecutions();
    fetchRecentActivity();
  }, []);
  
  const fetchExecutions = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5001/api/executions');
      const data = await response.json();
      
      if (data.success) {
        setExecutions(data.executions || []);
      } else {
        setError('Failed to fetch executions');
      }
    } catch (err) {
      setError('Error fetching executions: ' + err.message);
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchRecentActivity = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/recent-activity');
      const data = await response.json();
      
      if (data.success) {
        setRecentActivity(data.activities || []);
      }
    } catch (err) {
      console.error('Error fetching recent activity:', err);
    }
  };
  
  const handleAddMaterial = () => {
    const newId = materials.length > 0 
      ? Math.max(...materials.map(m => m.id)) + 1 
      : 1;
    
    setMaterials([
      ...materials,
      { id: newId, name: '', quantity: 0, rate: 0, totalCost: 0 }
    ]);
  };
  
  const handleRemoveMaterial = (id) => {
    setMaterials(materials.filter(material => material.id !== id));
  };
  
  const handleMaterialChange = (id, field, value) => {
    setMaterials(materials.map(material => {
      if (material.id === id) {
        const updatedMaterial = { ...material, [field]: value };
        
        // Recalculate total cost if quantity or rate changes
        if (field === 'quantity' || field === 'rate') {
          updatedMaterial.totalCost = updatedMaterial.quantity * updatedMaterial.rate;
        }
        
        return updatedMaterial;
      }
      return material;
    }));
  };
  
  const handleGuardrailChange = (field, value) => {
    setGuardrails({
      ...guardrails,
      [field]: value
    });
  };
  
  const handleCreateExecution = async () => {
    if (!executionName || materials.some(m => !m.name || m.quantity <= 0 || m.rate <= 0)) {
      setError('Please fill in all required fields');
      setTimeout(() => setError(null), 3000);
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await fetch('http://localhost:5001/api/executions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: executionName,
          materials,
          guardrails
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess('Execution created successfully');
        setTimeout(() => {
          setSuccess(null);
          setView('dashboard');
          fetchExecutions();
          fetchRecentActivity();
          
          // Reset form
          setExecutionName('');
          setMaterials([{ id: 1, name: '', quantity: 0, rate: 0, totalCost: 0 }]);
          setGuardrails({
            maxPricePerKg: '',
            deliveryTimeline: '',
            certifications: ['FSSAI']
          });
        }, 2000);
      } else {
        setError(data.message || 'Failed to create execution');
      }
    } catch (err) {
      setError('Error creating execution: ' + err.message);
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSaveDraft = () => {
    // In a real app, this would save to local storage or backend
    setSuccess('Draft saved successfully');
    setTimeout(() => setSuccess(null), 2000);
  };
  
  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours === 1) {
      return '1 hour ago';
    } else if (diffInHours < 24) {
      return `${diffInHours} hours ago`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return diffInDays === 1 ? '1 day ago' : `${diffInDays} days ago`;
    }
  };
  
  // Group executions by status
  const emailSentExecutions = executions.filter(exec => exec.status === 'email_sent') || [];
  const vendorRespondedExecutions = executions.filter(exec => exec.status === 'vendor_responded') || [];
  const agentConversationExecutions = executions.filter(exec => exec.status === 'agent_conversation') || [];
  
  // Calculate total cost for execution summary
  const totalMaterials = materials.length;
  const estimatedCost = materials.reduce((sum, material) => sum + (material.quantity * material.rate), 0);
  
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
              <nav className="hidden md:flex space-x-6">
                <span className="text-white hover:text-yellow-500 cursor-pointer">Dashboard</span>
                <span className="text-gray-400 hover:text-yellow-500 cursor-pointer">Executions</span>
                <span className="text-gray-400 hover:text-yellow-500 cursor-pointer">Vendors</span>
                <span className="text-gray-400 hover:text-yellow-500 cursor-pointer">Reports</span>
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              <button className="text-gray-400 hover:text-white">
                <i className="fa-regular fa-bell text-xl"></i>
              </button>
              <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-2.jpg" alt="User" className="w-8 h-8 rounded-full" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="py-8 flex flex-col items-center w-full">
        <div className="center-container">
        {view === 'dashboard' ? (
          <>
            {/* Quick Action Section */}
            <section className="mb-12">
              <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl p-8">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between">
                  <div className="mb-6 md:mb-0">
                    <h1 className="text-3xl font-bold text-white mb-2">Vendor Procurement Dashboard</h1>
                    <p className="text-gray-400">Create and manage your vendor procurement executions</p>
                  </div>
                  <button 
                    className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-gray-900 font-semibold px-6 py-3 rounded-lg flex items-center"
                    onClick={() => setView('newExecution')}
                  >
                    <i className="fa-solid fa-plus mr-2"></i>
                    New Execution
                  </button>
                </div>
              </div>
            </section>

            {/* Execution Status Section */}
            <section className="mb-12">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Email Sent Card */}
                <div className="bg-gray-800 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white font-semibold">Email Sent</h3>
                    <span className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-sm">{emailSentExecutions.length}</span>
                  </div>
                  <div className="space-y-4">
                    {emailSentExecutions.length > 0 ? (
                      emailSentExecutions.map(execution => (
                        <div key={execution._id} className="bg-gray-700/50 rounded-lg p-4 cursor-pointer hover:bg-gray-700">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-white">{execution.name}</h4>
                            <i className="fa-solid fa-chevron-right text-gray-400"></i>
                          </div>
                          <p className="text-gray-400 text-sm">{execution.vendorsContacted} vendors contacted</p>
                        </div>
                      ))
                    ) : (
                      <div className="bg-gray-700/50 rounded-lg p-4">
                        <p className="text-gray-400 text-sm">No executions in this status</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Vendor Responded Card */}
                <div className="bg-gray-800 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white font-semibold">Vendor Responded</h3>
                    <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm">{vendorRespondedExecutions.length}</span>
                  </div>
                  <div className="space-y-4">
                    {vendorRespondedExecutions.length > 0 ? (
                      vendorRespondedExecutions.map(execution => (
                        <div key={execution._id} className="bg-gray-700/50 rounded-lg p-4 cursor-pointer hover:bg-gray-700">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-white">{execution.name}</h4>
                            <i className="fa-solid fa-chevron-right text-gray-400"></i>
                          </div>
                          <p className="text-gray-400 text-sm">{execution.vendorsResponded} responses received</p>
                        </div>
                      ))
                    ) : (
                      <div className="bg-gray-700/50 rounded-lg p-4">
                        <p className="text-gray-400 text-sm">No executions in this status</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Agent Conversation Card */}
                <div className="bg-gray-800 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white font-semibold">Agent Conversation</h3>
                    <span className="bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-full text-sm">{agentConversationExecutions.length}</span>
                  </div>
                  <div className="space-y-4">
                    {agentConversationExecutions.length > 0 ? (
                      agentConversationExecutions.map(execution => (
                        <div key={execution._id} className="bg-gray-700/50 rounded-lg p-4 cursor-pointer hover:bg-gray-700">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-white">{execution.name}</h4>
                            <i className="fa-solid fa-chevron-right text-gray-400"></i>
                          </div>
                          <p className="text-gray-400 text-sm">{execution.activeConversations} active conversations</p>
                        </div>
                      ))
                    ) : (
                      <div className="bg-gray-700/50 rounded-lg p-4">
                        <p className="text-gray-400 text-sm">No executions in this status</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Activity Feed Section */}
            <section>
              <div className="bg-gray-800 rounded-xl p-6">
                <h2 className="text-xl font-semibold text-white mb-6">Recent Activity</h2>
                <div className="space-y-6">
                  {recentActivity.length > 0 ? (
                    recentActivity.map((activity, index) => (
                      <div key={index} className="flex items-start space-x-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          activity.activityType === 'email_sent' 
                            ? 'bg-blue-500/20 text-blue-400' 
                            : activity.activityType === 'vendor_response' 
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          <i className={`fa-solid ${
                            activity.activityType === 'email_sent' 
                              ? 'fa-envelope' 
                              : activity.activityType === 'vendor_response'
                                ? 'fa-check'
                                : 'fa-comment'
                          }`}></i>
                        </div>
                        <div>
                          <p className="text-white">
                            {activity.activityType === 'email_sent' && 'New vendor response received for '}
                            {activity.activityType === 'vendor_response' && 'Vendor shortlist completed for '}
                            {activity.activityType === 'conversation_started' && 'Agent conversation started for '}
                            <span className="text-yellow-500">{activity.executionName}</span>
                          </p>
                          <p className="text-gray-400 text-sm">{formatTimeAgo(activity.timestamp)}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex items-start space-x-4">
                      <div>
                        <p className="text-gray-400">No recent activity</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </>
        ) : (
          <>
            {/* New Execution Form */}
            <section id="execution-header" className="mb-8">
              <div className="flex items-center space-x-4 mb-6">
                <button className="text-gray-400 hover:text-white" onClick={() => setView('dashboard')}>
                  <i className="fa-solid fa-arrow-left text-xl"></i>
                </button>
                <h1 className="text-2xl font-bold text-white">New Execution</h1>
              </div>
            </section>

            <section id="execution-form" className="mb-8">
              <div className="bg-gray-800 rounded-xl p-6">
                <div className="grid grid-cols-1 gap-6">
                  {/* Basic Details */}
                  <div id="basic-details" className="space-y-4">
                    <label className="block w-full">
                      <span className="text-white mb-1 block">Execution Name</span>
                      <input 
                        type="text" 
                        placeholder="e.g., Peri Peri Ketchup Vendor Search" 
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-yellow-500"
                        value={executionName}
                        onChange={(e) => setExecutionName(e.target.value)}
                      />
                    </label>
                  </div>

                  {/* Raw Materials Table */}
                  <div id="materials-table">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-white font-semibold">Raw Materials</h3>
                      <div className="flex items-center space-x-4">
                        <button className="text-yellow-500 hover:text-yellow-400">
                          <i className="fa-solid fa-file-csv mr-2"></i>
                          Import Materials CSV
                        </button>
                        <button 
                          className="text-yellow-500 hover:text-yellow-400"
                          onClick={handleAddMaterial}
                        >
                          <i className="fa-solid fa-plus mr-2"></i>
                          Add Material
                        </button>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="text-gray-400 text-sm">
                            <th className="text-left pb-4">Material Name</th>
                            <th className="text-left pb-4">Quantity (Kg)</th>
                            <th className="text-left pb-4">Rate (₹/Kg)</th>
                            <th className="text-left pb-4">Total Cost</th>
                            <th className="text-left pb-4">Certification Required</th>
                            <th className="text-left pb-4"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {materials.map(material => (
                            <tr key={material.id} className="bg-gray-700/50 rounded-lg">
                              <td className="p-3">
                                <input 
                                  type="text" 
                                  placeholder="Enter material name" 
                                  className="w-full bg-transparent text-white placeholder-gray-400 focus:outline-none"
                                  value={material.name}
                                  onChange={(e) => handleMaterialChange(material.id, 'name', e.target.value)}
                                />
                              </td>
                              <td className="p-3">
                                <input 
                                  type="number" 
                                  placeholder="0.00" 
                                  className="w-full bg-transparent text-white placeholder-gray-400 focus:outline-none"
                                  value={material.quantity}
                                  onChange={(e) => handleMaterialChange(material.id, 'quantity', parseFloat(e.target.value) || 0)}
                                />
                              </td>
                              <td className="p-3">
                                <input 
                                  type="number" 
                                  placeholder="0.00" 
                                  className="w-full bg-transparent text-white placeholder-gray-400 focus:outline-none"
                                  value={material.rate}
                                  onChange={(e) => handleMaterialChange(material.id, 'rate', parseFloat(e.target.value) || 0)}
                                />
                              </td>
                              <td className="p-3 text-white">₹{material.totalCost.toFixed(2)}</td>
                              <td className="p-3">
                                <select 
                                  className="w-full bg-transparent text-white focus:outline-none border-0"
                                  value={guardrails.certifications[0]}
                                  onChange={(e) => handleGuardrailChange('certifications', [e.target.value])}
                                >
                                  <option value="FSSAI">FSSAI</option>
                                  <option value="ISO">ISO 9001</option>
                                  <option value="HACCP">HACCP</option>
                                </select>
                              </td>
                              <td className="p-3">
                                {materials.length > 1 && (
                                  <button 
                                    className="text-gray-400 hover:text-red-500"
                                    onClick={() => handleRemoveMaterial(material.id)}
                                  >
                                    <i className="fa-solid fa-trash"></i>
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Global Guardrails Section */}
                  <div id="global-guardrails" className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <h3 className="text-white font-semibold">Global Guardrails</h3>
                      <span className="text-gray-400 text-sm">(Applied to all materials unless overridden)</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <label className="block">
                        <span className="text-white mb-1 block">Delivery Timeline (Days)</span>
                        <input 
                          type="number" 
                          placeholder="Enter days" 
                          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-yellow-500"
                          value={guardrails.deliveryTimeline}
                          onChange={(e) => handleGuardrailChange('deliveryTimeline', parseInt(e.target.value) || '')}
                        />
                      </label>
                      <label className="block">
                        <span className="text-white mb-1 block">Minimum Vendor Rating</span>
                        <select 
                          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-yellow-500"
                          value={guardrails.vendorRating || "4.5"}
                          onChange={(e) => handleGuardrailChange('vendorRating', e.target.value)}
                        >
                          <option value="4.5">4.5+ Stars</option>
                          <option value="4.0">4.0+ Stars</option>
                          <option value="3.5">3.5+ Stars</option>
                        </select>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Preview & Actions Section */}
            <section id="preview-actions" className="bg-gray-800 rounded-xl p-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between">
                <div className="mb-4 md:mb-0">
                  <h3 className="text-white font-semibold mb-2">Execution Summary</h3>
                  <p className="text-gray-400">Total Materials: {totalMaterials} • Estimated Cost: ₹{estimatedCost.toFixed(2)}</p>
                </div>
                <div className="flex space-x-4">
                  <button 
                    className="px-6 py-2 rounded-lg border border-gray-600 text-white hover:bg-gray-700"
                    onClick={handleSaveDraft}
                  >
                    Save Draft
                  </button>
                  <button 
                    className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-gray-900 font-semibold px-6 py-2 rounded-lg flex items-center"
                    onClick={handleCreateExecution}
                    disabled={loading}
                  >
                    <i className="fa-solid fa-rocket mr-2"></i>
                    {loading ? 'Creating...' : 'Create Execution'}
                  </button>
                </div>
              </div>
            </section>
            
            {error && (
              <div className="mt-6 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}
            
            {success && (
              <div className="mt-6 bg-green-500/10 border border-green-500/20 text-green-400 px-4 py-3 rounded-lg">
                {success}
              </div>
            )}
          </>
        )}
        </div>
      </main>
    </div>
  )
}

export default App
