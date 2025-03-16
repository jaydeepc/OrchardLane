const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
const PORT = 5001;

// MongoDB Connection
const MONGODB_URI = 'mongodb+srv://admin:admin@cluster0.av5ua.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Define MongoDB Schemas
const materialSchema = new mongoose.Schema({
  name: { type: String, required: true },
  quantity: { type: Number, required: true },
  unit: { type: String, default: 'kg' },
  rate: { type: Number, required: true },
  totalCost: { type: Number },
});

const guardrailSchema = new mongoose.Schema({
  maxPricePerKg: { type: Number },
  deliveryTimeline: { type: Number }, // in days
  certifications: [{ type: String }],
});

const vendorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String },
  phone: { type: String },
  website: { type: String },
  price: { type: Number },
  deliveryTime: { type: Number },
  certifications: [{ type: String }],
  status: { 
    type: String, 
    enum: ['pending', 'contacted', 'responded', 'conversation', 'shortlisted', 'rejected'],
    default: 'pending'
  },
  responseDate: { type: Date },
  notes: { type: String },
});

const executionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['draft', 'email_sent', 'vendor_responded', 'agent_conversation', 'completed'],
    default: 'draft'
  },
  materials: [materialSchema],
  guardrails: guardrailSchema,
  vendors: [vendorSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  vendorsContacted: { type: Number, default: 0 },
  vendorsResponded: { type: Number, default: 0 },
  activeConversations: { type: Number, default: 0 },
});

// Create models
const Execution = mongoose.model('Execution', executionSchema);
const Material = mongoose.model('Material', materialSchema);
const Vendor = mongoose.model('Vendor', vendorSchema);

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

// API Routes

// Get all executions
app.get('/api/executions', async (req, res) => {
  try {
    const executions = await Execution.find().sort({ createdAt: -1 });
    res.json({
      success: true,
      executions
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
    const execution = await Execution.findById(req.params.id);
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
    
    const newExecution = new Execution({
      name,
      materials: processedMaterials,
      guardrails,
      status: 'draft'
    });
    
    await newExecution.save();
    
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
    
    // Calculate total cost for each material
    const processedMaterials = materials?.map(material => ({
      ...material,
      totalCost: material.quantity * material.rate
    }));
    
    const updatedExecution = await Execution.findByIdAndUpdate(
      req.params.id,
      {
        name,
        materials: processedMaterials,
        guardrails,
        status,
        updatedAt: Date.now()
      },
      { new: true }
    );
    
    if (!updatedExecution) {
      return res.status(404).json({
        success: false,
        message: 'Execution not found'
      });
    }
    
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
    const deletedExecution = await Execution.findByIdAndDelete(req.params.id);
    
    if (!deletedExecution) {
      return res.status(404).json({
        success: false,
        message: 'Execution not found'
      });
    }
    
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
    const executions = await Execution.find({ status }).sort({ updatedAt: -1 });
    
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

// Trigger AI research for an execution
app.post('/api/executions/:id/research', async (req, res) => {
  try {
    const execution = await Execution.findById(req.params.id);
    
    if (!execution) {
      return res.status(404).json({
        success: false,
        message: 'Execution not found'
      });
    }
    
    // In a real app, this would trigger the AI research process
    // For this demo, we'll simulate the process with mock vendors
    
    const mockVendors = [
      {
        name: 'Vendor A',
        email: 'vendora@example.com',
        phone: '+91 9876543210',
        website: 'https://vendora.com',
        price: execution.materials[0]?.rate * 0.9,
        deliveryTime: 5,
        certifications: ['FSSAI'],
        status: 'contacted'
      },
      {
        name: 'Vendor B',
        email: 'vendorb@example.com',
        phone: '+91 9876543211',
        website: 'https://vendorb.com',
        price: execution.materials[0]?.rate * 0.95,
        deliveryTime: 3,
        certifications: ['FSSAI', 'ISO 9001'],
        status: 'contacted'
      },
      {
        name: 'Vendor C',
        email: 'vendorc@example.com',
        phone: '+91 9876543212',
        website: 'https://vendorc.com',
        price: execution.materials[0]?.rate * 1.05,
        deliveryTime: 2,
        certifications: ['FSSAI', 'ISO 9001', 'Organic'],
        status: 'contacted'
      },
      {
        name: 'Vendor D',
        email: 'vendord@example.com',
        phone: '+91 9876543213',
        website: 'https://vendord.com',
        price: execution.materials[0]?.rate * 0.85,
        deliveryTime: 7,
        certifications: ['FSSAI'],
        status: 'contacted'
      },
      {
        name: 'Vendor E',
        email: 'vendore@example.com',
        phone: '+91 9876543214',
        website: 'https://vendore.com',
        price: execution.materials[0]?.rate * 1.1,
        deliveryTime: 1,
        certifications: ['FSSAI', 'ISO 9001', 'Organic', 'GMP'],
        status: 'contacted'
      }
    ];
    
    // Add vendors to execution
    execution.vendors = mockVendors;
    execution.status = 'email_sent';
    execution.vendorsContacted = mockVendors.length;
    execution.updatedAt = Date.now();
    
    await execution.save();
    
    // Simulate processing delay
    setTimeout(() => {
      res.json({
        success: true,
        message: 'Research triggered successfully',
        execution
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
    
    const execution = await Execution.findById(executionId);
    
    if (!execution) {
      return res.status(404).json({
        success: false,
        message: 'Execution not found'
      });
    }
    
    if (!execution.vendors[vendorIndex]) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }
    
    // Update vendor status
    execution.vendors[vendorIndex].status = status;
    
    if (notes) {
      execution.vendors[vendorIndex].notes = notes;
    }
    
    if (status === 'responded') {
      execution.vendors[vendorIndex].responseDate = Date.now();
      execution.vendorsResponded += 1;
      
      // If this is the first vendor to respond, update execution status
      if (execution.status === 'email_sent') {
        execution.status = 'vendor_responded';
      }
    } else if (status === 'conversation') {
      execution.activeConversations += 1;
      
      // If this is the first conversation, update execution status
      if (execution.status === 'vendor_responded') {
        execution.status = 'agent_conversation';
      }
    }
    
    execution.updatedAt = Date.now();
    await execution.save();
    
    res.json({
      success: true,
      message: 'Vendor status updated successfully',
      execution
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
    // Get recent executions with updates
    const recentExecutions = await Execution.find()
      .sort({ updatedAt: -1 })
      .limit(10);
    
    const activities = recentExecutions.map(execution => {
      let activityType = '';
      let details = '';
      
      if (execution.status === 'email_sent') {
        activityType = 'email_sent';
        details = `${execution.vendorsContacted} vendors contacted`;
      } else if (execution.status === 'vendor_responded') {
        activityType = 'vendor_response';
        details = `${execution.vendorsResponded} vendors responded`;
      } else if (execution.status === 'agent_conversation') {
        activityType = 'conversation_started';
        details = `${execution.activeConversations} active conversations`;
      }
      
      return {
        id: execution._id,
        executionName: execution.name,
        activityType,
        details,
        timestamp: execution.updatedAt
      };
    });
    
    res.json({
      success: true,
      activities
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
