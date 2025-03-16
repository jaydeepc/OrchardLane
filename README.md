# Procurement Management System

A modern procurement management system with a React frontend and Node.js/Express backend API that handles file uploads, data extraction, and vendor research automation.

## Project Structure

- `/src` - React frontend code with dark theme UI
- `/backend` - Express.js backend API with file upload and processing capabilities
- `/backend/uploads` - Directory for storing uploaded files

## Setup Instructions

### Install Dependencies

1. Install frontend dependencies:
   ```
   npm install
   ```

2. Install backend dependencies:
   ```
   cd backend
   npm install
   ```

## Running the Application

### Start the Backend Server

```
cd backend
npm start
```

This will start the backend server on http://localhost:5001.

### Start the Frontend Development Server

In a new terminal:

```
npm run dev
```

This will start the Vite development server, typically on http://localhost:5173.

## Features

- Modern dark theme UI with intuitive design
- File upload system supporting CSV, Excel, and PDF files
- Drag and drop file upload functionality
- Automatic extraction of raw materials from ZBC files
- Dashboard to monitor raw materials and research status
- Integration with research agent for vendor outreach
- Email tracking for vendor responses
- Progress indicators and status badges

## Workflow

1. **Upload ZBC Files**: Upload CSV, Excel, or PDF files containing Zero Based Costing (ZBC) data
2. **Process Files**: System extracts raw materials, quantities, and rates from the uploaded files
3. **View Dashboard**: See all extracted raw materials in a tabular format
4. **Trigger Research**: Initiate vendor research for each raw material or all at once
5. **Monitor Status**: Track which materials have had emails sent and are awaiting responses

## API Endpoints

### POST /api/upload

Uploads files to the server.

### POST /api/process-files

Processes uploaded files and extracts raw materials data.

### POST /api/data

Triggers the research agent for a specific raw material.

Example request:
```json
{
  "materialId": "1",
  "action": "research"
}
```

Example response:
```json
{
  "success": true,
  "message": "Research agent triggered successfully",
  "materialId": "1",
  "emailSent": true,
  "timestamp": "2025-03-16T13:30:45.123Z"
}
```
