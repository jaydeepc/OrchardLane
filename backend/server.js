const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
// Using in-memory storage instead of MongoDB due to connection issues
// const mongoose = require('mongoose');
// const { MongoClient, ObjectId } = require('mongodb');

const app = express();
const PORT = 5001;

// In-memory database
const db = {
  executions: [],
  recentActivity: [],
  nextExecutionId: 1
};

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Accept only CSV, Excel, and PDF files
  const fileTypes = /csv|excel|spreadsheetml|pdf/;
  const mimetype = fileTypes.test(file.mimetype);
  const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());

  if (mimetype || extname) {
    return cb(null, true);
  }
  cb(new Error('Only CSV, Excel, and PDF files are allowed!'));
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB max file size
});

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Make uploads directory accessible
app.use('/uploads', express.static(uploadsDir));

// Helper function to generate ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// API Routes

// Get all executions
app.get('/api/executions', async (req, res) => {
  try {
    res.json({
      success: true,
      executions: db.executions
    });
  } catch (error) {
    console.error('Error fetching executions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching executions',
      error: error.message
    });
  }
});

// Get execution by ID
app.get('/api/executions/:id', async (req, res) => {
  try {
    const execution = db.executions.find(exec => exec._id === req.params.id);
    if (!execution) {
      return res.status(404).json({
        success: false,
        message: 'Execution not found'
      });
    }
    res.json({
      success: true,
      execution
    });
  } catch (error) {
    console.error('Error fetching execution:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching execution',
      error: error.message
    });
  }
});

// Create new execution
app.post('/api/executions', async (req, res) => {
  try {
    const { name, materials, guardrails } = req.body;
    
    // Calculate total cost for each material
    const processedMaterials = materials.map(material => ({
      ...material,
      totalCost: material.quantity * material.rate
    }));
    
    const newExecution = {
      _id: generateId(),
      name,
      materials: processedMaterials,
      guardrails,
      status: 'draft',
      processingStatus: {
        currentMaterial: '',
        processedCount: 0,
        totalCount: processedMaterials.length,
        isProcessing: false,
        results: []
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      vendorsContacted: 0,
      vendorsResponded: 0,
      activeConversations: 0,
      vendors: []
    };
    
    db.executions.push(newExecution);
    
    // Add to recent activity
    addRecentActivity(newExecution, 'created');
    
    res.status(201).json({
      success: true,
      message: 'Execution created successfully',
      execution: newExecution
    });
  } catch (error) {
    console.error('Error creating execution:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating execution',
      error: error.message
    });
  }
});

// Update execution
app.put('/api/executions/:id', async (req, res) => {
  try {
    const { name, materials, guardrails, status } = req.body;
    
    const executionIndex = db.executions.findIndex(exec => exec._id === req.params.id);
    if (executionIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Execution not found'
      });
    }
    
    // Calculate total cost for each material
    const processedMaterials = materials?.map(material => ({
      ...material,
      totalCost: material.quantity * material.rate
    }));
    
    // Update execution
    db.executions[executionIndex] = {
      ...db.executions[executionIndex],
      name: name || db.executions[executionIndex].name,
      materials: processedMaterials || db.executions[executionIndex].materials,
      guardrails: guardrails || db.executions[executionIndex].guardrails,
      status: status || db.executions[executionIndex].status,
      updatedAt: new Date()
    };
    
    const updatedExecution = db.executions[executionIndex];
    
    // Add to recent activity
    addRecentActivity(updatedExecution, 'updated');
    
    res.json({
      success: true,
      message: 'Execution updated successfully',
      execution: updatedExecution
    });
  } catch (error) {
    console.error('Error updating execution:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating execution',
      error: error.message
    });
  }
});

// Delete execution
app.delete('/api/executions/:id', async (req, res) => {
  try {
    const executionIndex = db.executions.findIndex(exec => exec._id === req.params.id);
    if (executionIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Execution not found'
      });
    }
    
    // Remove execution
    db.executions.splice(executionIndex, 1);
    
    res.json({
      success: true,
      message: 'Execution deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting execution:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting execution',
      error: error.message
    });
  }
});

// Get executions by status
app.get('/api/executions/status/:status', async (req, res) => {
  try {
    const { status } = req.params;
    const executions = db.executions.filter(exec => exec.status === status);
    
    res.json({
      success: true,
      executions
    });
  } catch (error) {
    console.error(`Error fetching ${req.params.status} executions:`, error);
    res.status(500).json({
      success: false,
      message: `Error fetching ${req.params.status} executions`,
      error: error.message
    });
  }
});

// Process materials through webhook
app.post('/api/process-materials/:executionId', async (req, res) => {
  try {
    const { executionId } = req.params;
    
    // Find the execution
    const executionIndex = db.executions.findIndex(exec => exec._id === executionId);
    if (executionIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Execution not found'
      });
    }
    
    // Update execution status to processing
    db.executions[executionIndex].status = 'processing';
    db.executions[executionIndex].processingStatus.isProcessing = true;
    db.executions[executionIndex].processingStatus.totalCount = db.executions[executionIndex].materials.length;
    
    // Start processing in the background
    processExecutionMaterials(db.executions[executionIndex]);
    
    // Return immediately with the updated execution
    res.json({
      success: true,
      message: 'Processing started',
      execution: db.executions[executionIndex]
    });
  } catch (error) {
    console.error('Error starting material processing:', error);
    res.status(500).json({
      success: false,
      message: 'Error starting material processing',
      error: error.message
    });
  }
});

// Get processing status
app.get('/api/process-materials/:executionId/status', async (req, res) => {
  try {
    const { executionId } = req.params;
    
    // Find the execution
    const execution = db.executions.find(exec => exec._id === executionId);
    if (!execution) {
      return res.status(404).json({
        success: false,
        message: 'Execution not found'
      });
    }
    
    res.json({
      success: true,
      processingStatus: execution.processingStatus,
      status: execution.status
    });
  } catch (error) {
    console.error('Error fetching processing status:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching processing status',
      error: error.message
    });
  }
});

// Cancel processing
app.post('/api/process-materials/:executionId/cancel', async (req, res) => {
  try {
    const { executionId } = req.params;
    
    // Find the execution
    const executionIndex = db.executions.findIndex(exec => exec._id === executionId);
    if (executionIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Execution not found'
      });
    }
    
    // Update execution status
    db.executions[executionIndex].status = 'draft';
    db.executions[executionIndex].processingStatus.isProcessing = false;
    
    res.json({
      success: true,
      message: 'Processing cancelled',
      execution: db.executions[executionIndex]
    });
  } catch (error) {
    console.error('Error cancelling processing:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling processing',
      error: error.message
    });
  }
});

// Helper function to process materials sequentially
async function processExecutionMaterials(execution) {
  try {
    const results = [];
    const materials = execution.materials;
    const guardrails = execution.guardrails;
    
    // Find execution index
    const executionIndex = db.executions.findIndex(exec => exec._id === execution._id);
    if (executionIndex === -1) {
      throw new Error('Execution not found');
    }
    
    for (let i = 0; i < materials.length; i++) {
      const material = materials[i];
      
      // Update processing status
      db.executions[executionIndex].processingStatus.currentMaterial = material.name;
      db.executions[executionIndex].processingStatus.processedCount = i;
      
      // Prepare payload for webhook
      const payload = {
        executionDetails: {
          id: execution._id,
          name: execution.name
        },
        material: {
          name: material.name,
          quantity: material.quantity,
          rate: material.rate,
          totalCost: material.totalCost
        },
        guardrails: {
          maxPricePerKg: guardrails.maxPricePerKg,
          deliveryTimeline: guardrails.deliveryTimeline,
          certifications: guardrails.certifications
        }
      };
      
      console.log(`Processing material ${i+1}/${materials.length}: ${material.name}`);
      
      try {
        // Simulate webhook call with mock response
        const responseData = {
          success: true,
          vendorCount: Math.floor(Math.random() * 5) + 1,
          bestPrice: material.rate * (0.8 + Math.random() * 0.4),
          fastestDelivery: Math.floor(Math.random() * 7) + 1,
          material: material.name
        };
        
        results.push(responseData);
        
        // Update execution with result
        db.executions[executionIndex].processingStatus.results.push(responseData);
        
        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`Error processing material ${material.name}:`, error);
        results.push({ error: error.message, material: material.name });
      }
    }
    
    // Update execution status when complete
    db.executions[executionIndex].status = 'email_sent';
    db.executions[executionIndex].processingStatus.isProcessing = false;
    db.executions[executionIndex].processingStatus.processedCount = materials.length;
    db.executions[executionIndex].vendorsContacted = 5;
    
    // Add mock vendors
    db.executions[executionIndex].vendors = generateMockVendors(execution);
    
    // Add to recent activity
    addRecentActivity(db.executions[executionIndex], 'email_sent');
    
    console.log('Processing completed for execution:', execution._id);
    return results;
  } catch (error) {
    console.error('Error in processExecutionMaterials:', error);
    
    // Find execution index
    const executionIndex = db.executions.findIndex(exec => exec._id === execution._id);
    if (executionIndex !== -1) {
      // Update execution status on error
      db.executions[executionIndex].status = 'draft';
      db.executions[executionIndex].processingStatus.isProcessing = false;
    }
    
    throw error;
  }
}

// Generate mock vendors
function generateMockVendors(execution) {
  const vendorCount = 5;
  const vendors = [];
  
  for (let i = 0; i < vendorCount; i++) {
    vendors.push({
      id: generateId(),
      name: `Vendor ${String.fromCharCode(65 + i)}`,
      email: `vendor${String.fromCharCode(97 + i)}@example.com`,
      phone: `+91 98765432${i}0`,
      website: `https://vendor${String.fromCharCode(97 + i)}.com`,
      price: execution.materials[0]?.rate * (0.8 + Math.random() * 0.4),
      deliveryTime: Math.floor(Math.random() * 7) + 1,
      certifications: ['FSSAI'],
      status: 'contacted',
      responseDate: null,
      notes: ''
    });
  }
  
  return vendors;
}

// Add to recent activity
function addRecentActivity(execution, activityType) {
  const activity = {
    id: generateId(),
    executionName: execution.name,
    activityType,
    details: '',
    timestamp: new Date()
  };
  
  if (activityType === 'email_sent') {
    activity.details = `${execution.vendorsContacted} vendors contacted`;
  } else if (activityType === 'vendor_response') {
    activity.details = `${execution.vendorsResponded} vendors responded`;
  } else if (activityType === 'conversation_started') {
    activity.details = `${execution.activeConversations} active conversations`;
  } else if (activityType === 'created') {
    activity.details = `Execution created`;
  } else if (activityType === 'updated') {
    activity.details = `Execution updated`;
  }
  
  db.recentActivity.unshift(activity);
  
  // Keep only the 20 most recent activities
  if (db.recentActivity.length > 20) {
    db.recentActivity = db.recentActivity.slice(0, 20);
  }
}

// Trigger AI research for an execution
app.post('/api/executions/:id/research', async (req, res) => {
  try {
    const executionIndex = db.executions.findIndex(exec => exec._id === req.params.id);
    if (executionIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Execution not found'
      });
    }
    
    // Add vendors to execution
    db.executions[executionIndex].vendors = generateMockVendors(db.executions[executionIndex]);
    db.executions[executionIndex].status = 'email_sent';
    db.executions[executionIndex].vendorsContacted = db.executions[executionIndex].vendors.length;
    db.executions[executionIndex].updatedAt = new Date();
    
    // Add to recent activity
    addRecentActivity(db.executions[executionIndex], 'email_sent');
    
    // Simulate processing delay
    setTimeout(() => {
      res.json({
        success: true,
        message: 'Research triggered successfully',
        execution: db.executions[executionIndex]
      });
    }, 1500);
  } catch (error) {
    console.error('Error triggering research:', error);
    res.status(500).json({
      success: false,
      message: 'Error triggering research',
      error: error.message
    });
  }
});

// Update vendor status
app.put('/api/executions/:executionId/vendors/:vendorIndex', async (req, res) => {
  try {
    const { executionId, vendorIndex } = req.params;
    const { status, notes } = req.body;
    
    const executionIndex = db.executions.findIndex(exec => exec._id === executionId);
    if (executionIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Execution not found'
      });
    }
    
    const vendorIdx = parseInt(vendorIndex);
    if (!db.executions[executionIndex].vendors[vendorIdx]) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }
    
    // Update vendor status
    db.executions[executionIndex].vendors[vendorIdx].status = status;
    
    if (notes) {
      db.executions[executionIndex].vendors[vendorIdx].notes = notes;
    }
    
    if (status === 'responded') {
      db.executions[executionIndex].vendors[vendorIdx].responseDate = new Date();
      db.executions[executionIndex].vendorsResponded += 1;
      
      // If this is the first vendor to respond, update execution status
      if (db.executions[executionIndex].status === 'email_sent') {
        db.executions[executionIndex].status = 'vendor_responded';
        
        // Add to recent activity
        addRecentActivity(db.executions[executionIndex], 'vendor_response');
      }
    } else if (status === 'conversation') {
      db.executions[executionIndex].activeConversations += 1;
      
      // If this is the first conversation, update execution status
      if (db.executions[executionIndex].status === 'vendor_responded') {
        db.executions[executionIndex].status = 'agent_conversation';
        
        // Add to recent activity
        addRecentActivity(db.executions[executionIndex], 'conversation_started');
      }
    }
    
    db.executions[executionIndex].updatedAt = new Date();
    
    res.json({
      success: true,
      message: 'Vendor status updated successfully',
      execution: db.executions[executionIndex]
    });
  } catch (error) {
    console.error('Error updating vendor status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating vendor status',
      error: error.message
    });
  }
});

// Get recent activity
app.get('/api/recent-activity', async (req, res) => {
  try {
    res.json({
      success: true,
      activities: db.recentActivity
    });
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching recent activity',
      error: error.message
    });
  }
});

// POST endpoint for file upload
app.post('/api/upload', upload.array('files', 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files were uploaded.'
      });
    }

    const uploadedFiles = req.files.map(file => ({
      filename: file.filename,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      path: file.path
    }));

    console.log('Files uploaded:', uploadedFiles);

    res.json({
      success: true,
      message: 'Files uploaded successfully',
      files: uploadedFiles
    });
  } catch (error) {
    console.error('Error uploading files:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading files',
      error: error.message
    });
  }
});

// POST endpoint for importing materials from CSV
app.post('/api/import-materials-csv', upload.single('file'), (req, res) => {
  try {
    console.log('CSV import request received');
    
    if (!req.file) {
      console.log('No file uploaded');
      return res.status(400).json({
        success: false,
        message: 'No file was uploaded.'
      });
    }

    console.log('File uploaded:', req.file);

    // Check if the file is a CSV
    if (!req.file.mimetype.includes('csv') && !req.file.originalname.endsWith('.csv')) {
      console.log('File is not a CSV:', req.file.mimetype, req.file.originalname);
      return res.status(400).json({
        success: false,
        message: 'Please upload a CSV file.'
      });
    }

    const results = [];
    let nextId = 1;
    let certification = 'FSSAI';

    // Parse the CSV file
    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (data) => {
        console.log('CSV row data:', data);
        
        // Map CSV columns to material object
        // Expected CSV columns: Material, Quantity in Kgs, Rate, COST, Certification if any
        const quantity = parseFloat(data['Quantity in Kgs']) || 0;
        const rate = parseFloat(data['Rate']) || 0;
        const totalCost = parseFloat(data['COST']) || (quantity * rate);
        
        // Store certification from first row if available
        if (results.length === 0 && data['Certification if any']) {
          certification = data['Certification if any'];
        }
        
        const material = {
          id: nextId++,
          name: data['Material'] || '',
          quantity: quantity,
          rate: rate,
          totalCost: totalCost
        };
        
        console.log('Processed material:', material);
        results.push(material);
      })
      .on('end', () => {
        console.log('CSV parsing complete. Total materials:', results.length);
        // Return the parsed materials
        res.json({
          success: true,
          message: 'CSV imported successfully',
          materials: results,
          certification: certification
        });
      })
      .on('error', (error) => {
        console.error('Error parsing CSV:', error);
        res.status(500).json({
          success: false,
          message: 'Error parsing CSV file',
          error: error.message
        });
      });
  } catch (error) {
    console.error('Error importing CSV:', error);
    res.status(500).json({
      success: false,
      message: 'Error importing CSV',
      error: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: err.message || 'Something went wrong!',
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
