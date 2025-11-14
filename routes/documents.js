const express = require('express');
const path = require('path');
const fs = require('fs');
const { TemplateHandler, MimeType } = require('easy-template-x');
const MIME_TYPE_MAP = {
  'image/png': MimeType.Png,
  'image/jpeg': MimeType.Jpeg,
  'image/jpg': MimeType.Jpeg,
  'image/gif': MimeType.Gif,
  'image/bmp': MimeType.Bmp,
  'image/svg+xml': MimeType.Svg,
};

function createImageContent(signature) {
  if (
    !signature ||
    typeof signature !== 'object' ||
    !signature.data ||
    !signature.mimeType
  ) {
    return null;
  }

  const normalizedType = signature.mimeType.toLowerCase();
  const format = MIME_TYPE_MAP[normalizedType] || MimeType.Png;

  try {
    const source = Buffer.from(signature.data, 'base64');
    if (!source.length) {
      return null;
    }

    return {
      _type: 'image',
      source,
      format,
      width: 180,
      height: 80,
    };
  } catch (error) {
    console.warn(
      '[documents] Failed to build signature image:',
      error.message
    );
    return null;
  }
}
const { PrismaClient } = require('@prisma/client');
const { authMiddleware } = require('../middleware/auth');
const { buildInspectionReportData } = require('../services/report-service');

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    !(value instanceof Date) &&
    !(value instanceof Buffer)
  );
}

function flattenTemplateFields(value, prefix = '', result = {}) {
  if (!isPlainObject(value)) {
    return result;
  }

  Object.entries(value).forEach(([key, entry]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key;

    if (
      entry === null ||
      typeof entry === 'string' ||
      typeof entry === 'number' ||
      typeof entry === 'boolean'
    ) {
      result[nextKey] = entry ?? '';
      return;
    }

    if (isPlainObject(entry)) {
      flattenTemplateFields(entry, nextKey, result);
    }
  });

  return result;
}

const router = express.Router();
const prisma = new PrismaClient();
const templateHandler = new TemplateHandler({
  delimiters: {
    tagStart: '{{',
    tagEnd: '}}',
    containerTagOpen: '#',
    containerTagClose: '/',
  },
});

// Basic placeholder route to confirm the documents router is mounted
router.get('/', (req, res) => {
  res.json({ message: 'Documents API is available' });
});

const REPORT_TEMPLATE_FILE =
  process.env.REPORT_TEMPLATE_FILE || 'template (1).docx';

// Preview data for inspection report based on answer ID
router.get('/answers/:answerId/preview', authMiddleware, async (req, res) => {
  try {
    const answerId = BigInt(req.params.answerId);
    const data = await buildInspectionReportData(prisma, { answerId });
    return res.json({ data });
  } catch (error) {
    console.error('Error building inspection preview data:', error);
    return res.status(500).json({
      error: 'Failed to build preview data',
      message: error.message,
    });
  }
});

// Generate DOCX using Docxtemplater (answer ID)
router.get('/answers/:answerId/docx', authMiddleware, async (req, res) => {
  try {
    const answerId = BigInt(req.params.answerId);
    const reportData = await buildInspectionReportData(prisma, { answerId });

    const templatePath = path.join(
      __dirname,
      '..',
      'templates',
      REPORT_TEMPLATE_FILE
    );

    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({
        error: 'Template not found',
        message: `Template file ${REPORT_TEMPLATE_FILE} is missing.`,
      });
    }

    const templateFile = fs.readFileSync(templatePath);
    const flattenedFields = flattenTemplateFields(reportData);
    const templateData = {
      ...reportData,
      ...flattenedFields,
    };

    const inspectorSignature = reportData.d?.signatures?.inspector;
    const inspectorImage = createImageContent(inspectorSignature);
    if (inspectorImage) {
      templateData['d.signatures.inspector'] = inspectorImage;
    }

    const buffer = await templateHandler.process(templateFile, templateData);
    const filename = `inspection-${reportData.inspection.id}.docx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (error) {
    console.error('Error generating inspection DOCX:', error);
    return res.status(500).json({
      error: 'Failed to generate document',
      message: error.message,
    });
  }
});

module.exports = router;



