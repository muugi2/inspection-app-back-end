const express = require('express');
const path = require('path');
const carbone = require('carbone');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Basic placeholder route to confirm the documents router is mounted
router.get('/', (req, res) => {
  res.json({ message: 'Documents API is available' });
});

// Route to serve the template file
router.get('/template/:filename', (req, res) => {
  const filename = req.params.filename;
  const templatePath = path.join(__dirname, '..', 'templates', filename);
  
  // Security: Only allow .docx files
  if (!filename.endsWith('.docx')) {
    return res.status(400).json({ error: 'Invalid file type' });
  }
  
  res.sendFile(templatePath, (err) => {
    if (err) {
      console.error('Error sending template file:', err);
      res.status(404).json({ error: 'Template file not found' });
    }
  });
});

// Generate document (PDF or DOCX) from template and inspection answer data
// GET /api/documents/generate/:answerId?format=pdf|docx
router.get('/generate/:answerId', authMiddleware, async (req, res) => {
  try {
    const { answerId } = req.params;
    const format = (req.query.format || 'pdf').toLowerCase();

    let id;
    try {
      id = BigInt(answerId);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid id', message: 'answerId must be numeric' });
    }

    // Fetch answer with related data
    const answer = await prisma.InspectionAnswer.findUnique({
      where: { id },
      include: {
        inspection: {
          include: {
            device: {
              include: {
                model: true,
                site: { include: { organization: true } },
              },
            },
            assignee: { include: { organization: true } },
          },
        },
        user: { include: { organization: true } },
      },
    });

    if (!answer) {
      return res.status(404).json({ error: 'Not found', message: `Inspection answer ${answerId} not found` });
    }

    const answerJson = answer.answers || {};
    const metadata = answerJson.metadata || answerJson.data?.metadata || {};

    // Build data similar to frontend template viewer for placeholder compatibility
    const inspection = answer.inspection || {};
    const device = inspection.device || {};
    const site = device.site || {};
    const organization = site.organization || device.organization || {};
    const assignee = inspection.assignee || {};
    const user = answer.user || {};

    const actualData = answerJson.data || answerJson;
    const dataWithMetadata = { ...actualData };
    if (metadata && Object.keys(metadata).length > 0) {
      Object.assign(dataWithMetadata, metadata);
      dataWithMetadata.metadata = metadata;
    }

    const dataMap = {
      ...answerJson,
      data: dataWithMetadata,
      metadata: metadata,
      ...(metadata && Object.keys(metadata).length > 0 ? metadata : {}),
      inspection: {
        id: inspection?.id ? inspection.id.toString() : '',
        title: inspection?.title || '',
        type: inspection?.type || '',
        status: inspection?.status || '',
      },
      device: {
        serialNumber: device?.serialNumber || '',
        assetTag: device?.assetTag || '',
        model: device?.model
          ? {
              manufacturer: device.model.manufacturer || '',
              model: device.model.model || '',
            }
          : null,
      },
      contractor: {
        company: organization?.name || '',
        code: organization?.code || '',
      },
      organization: {
        name: organization?.name || '',
        code: organization?.code || '',
      },
      site: { name: site?.name || '' },
      user: {
        fullName: user?.fullName || '',
        organization: user?.organization
          ? { name: user.organization.name || '', code: user.organization.code || '' }
          : null,
      },
      assignee: {
        fullName: assignee?.fullName || '',
        organization: assignee?.organization
          ? { name: assignee.organization.name || '', code: assignee.organization.code || '' }
          : null,
      },
      d: {
        contractor: { company: organization?.name || '' },
        device: { serialNumber: device?.serialNumber || '', assetTag: device?.assetTag || '' },
        data: dataWithMetadata,
        metadata: metadata,
      },
    };

    // Template file path
    const templateFile = 'auto_scale_inspection_template_fin.docx';
    const templatePath = path.join(__dirname, '..', 'templates', templateFile);

    // For PDF, we'll generate DOCX first (since LibreOffice might not be available)
    // Frontend will handle PDF conversion from HTML if needed
    // For now, always generate DOCX to avoid LibreOffice dependency
    const carboneOptions = {
      reportName: `inspection_${answerId}`,
    };

    carbone.render(templatePath, dataMap, carboneOptions, function (err, result) {
      if (err) {
        console.error('Carbone render error:', err);
        return res.status(500).json({ 
          error: 'Render failed', 
          message: err.message,
          hint: format === 'pdf' ? 'PDF conversion requires LibreOffice. Generating DOCX instead. Use frontend HTML-to-PDF conversion for PDF.' : ''
        });
      }

      const filenameBase = (inspection.title || 'inspection').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      // Always return DOCX for now (PDF would require LibreOffice)
      const outExt = 'docx';
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}_${answerId}.${outExt}"`);
      return res.send(result);
    });
  } catch (error) {
    console.error('Error generating document:', error);
    return res.status(500).json({ error: 'Failed to generate document', message: error.message });
  }
});

module.exports = router;



