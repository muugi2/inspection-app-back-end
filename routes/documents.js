const express = require('express');
const path = require('path');
const fs = require('fs');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  AlignmentType,
  WidthType,
  ImageRun,
  ShadingType,
  BorderStyle,
  VerticalAlign,
} = require('docx');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware } = require('../middleware/auth');
const {
  normalizeRelativePath,
  loadImagePayload,
  inferMimeType,
} = require('../utils/imageStorage');

const router = express.Router();
const prisma = new PrismaClient();
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

// Basic placeholder route to confirm the documents router is mounted
router.get('/', (req, res) => {
  res.json({ message: 'Documents API is available' });
});

function sanitizeText(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/\u2028|\u2029/g, ' ')
    .trim();
}

function normalizeBase64String(value) {
  if (!value || typeof value !== 'string') return null;
  const cleaned = value.replace(/[\r\n\s]+/g, '').trim();
  if (!cleaned) return null;
  const padLength = cleaned.length % 4;
  const padded = padLength ? cleaned + '='.repeat(4 - padLength) : cleaned;
  if (!BASE64_PATTERN.test(padded)) return null;
  try {
    const buffer = Buffer.from(padded, 'base64');
    if (!buffer || buffer.length === 0) return null;
    return {
      base64: buffer.toString('base64'),
      buffer,
    };
  } catch (error) {
    console.warn('[documents] Failed to decode base64 string', error.message);
    return null;
  }
}

function coerceBase64(value, mimeType) {
  const normalized = normalizeBase64String(value);
  if (!normalized) return null;
  return {
    base64: normalized.base64,
    buffer: normalized.buffer,
    mimeType,
  };
}

function extractImagePayload(imageData, providedMimeType) {
  let mimeType = providedMimeType || 'image/png';

  if (!imageData) {
    return null;
  }

  if (Buffer.isBuffer(imageData)) {
    return coerceBase64(imageData.toString('base64'), mimeType);
  }

  if (typeof imageData === 'string') {
    const rawValue = imageData.trim();
    if (!rawValue) return null;

    if (rawValue.startsWith('data:')) {
      const [meta, payload] = rawValue.split(',');
      if (meta) {
        const mimeMatch = meta.match(/data:(.*?);base64/);
        if (mimeMatch) {
          mimeType = mimeMatch[1];
        }
      }
      return coerceBase64(payload || '', mimeType);
    }

    const directCoercion = coerceBase64(rawValue, mimeType);
    if (directCoercion) return directCoercion;

    const noWhitespace = rawValue.replace(/[\r\n\s]+/g, '');
    const noWhitespaceCoercion = coerceBase64(noWhitespace, mimeType);
    if (noWhitespaceCoercion) return noWhitespaceCoercion;

    try {
      const buffer = Buffer.from(rawValue, 'base64');
      if (buffer.length > 0) {
        return coerceBase64(buffer.toString('base64'), mimeType);
      }
    } catch (err) {
      // continue
    }

    try {
      const buffer = Buffer.from(rawValue, 'binary');
      if (buffer.length > 0) {
        return coerceBase64(buffer.toString('base64'), mimeType);
      }
    } catch (err) {
      console.warn(
        '[documents] Failed to convert binary string to base64',
        err.message
      );
    }

    return null;
  }

  try {
    const buffer = Buffer.from(imageData);
    if (buffer.length === 0) return null;
    return coerceBase64(buffer.toString('base64'), mimeType);
  } catch (err) {
    console.warn(
      '[documents] Failed to handle image_data of type',
      typeof imageData,
      err.message
    );
    return null;
  }
}

function getImageBufferFromBase64(base64, context = {}) {
  const normalized = normalizeBase64String(base64);
  if (!normalized) {
    console.warn(
      '[documents] Invalid base64 encountered while building document',
      context
    );
    return null;
  }
  return normalized.buffer;
}

// Route to serve the template file
router.get('/template/:filename', (req, res) => {
  const filename = req.params.filename;
  const templatePath = path.join(__dirname, '..', 'templates', filename);

  // Security: Only allow .docx files
  if (!filename.endsWith('.docx')) {
    return res.status(400).json({ error: 'Invalid file type' });
  }

  res.sendFile(templatePath, err => {
    if (err) {
      console.error('Error sending template file:', err);
      res.status(404).json({ error: 'Template file not found' });
    }
  });
});

// Generate DOCX document from inspection answer data using docx library
router.get('/generate/:answerId', authMiddleware, async (req, res) => {
  try {
    const { answerId } = req.params;

    let id;
    try {
      id = BigInt(answerId);
    } catch (e) {
      return res
        .status(400)
        .json({ error: 'Invalid id', message: 'answerId must be numeric' });
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
      return res
        .status(404)
        .json({
          error: 'Not found',
          message: `Inspection answer ${answerId} not found`,
        });
    }

    const answerJson = answer.answers || {};
    const metadata = answerJson.metadata || answerJson.data?.metadata || {};

    const inspection = answer.inspection || {};
    const device = inspection.device || {};
    const site = device.site || {};
    const organization = site.organization || device.organization || {};
    const assignee = inspection.assignee || {};
    const user = answer.user || {};

    const imagesMap = await fetchSectionImages(id);
    const { templateData, sections, signaturePayload } = buildDocxTemplateData({
      rawAnswers: answerJson,
      metadata,
      contractor: {
        company: organization?.name || '',
        contract_no: inspection?.contractNumber || '',
        contact: assignee?.fullName || '',
      },
      images: imagesMap,
      remarks: answerJson.remarks || '',
      signature:
        extractSignature(answerJson.signature) ||
        extractSignature(answerJson.signatures?.inspector) ||
        null,
    });

    const documentChildren = buildDocumentContents({
      metadata: templateData.d.metadata,
      contractor: templateData.d.contractor,
      sections,
      remarks: templateData.d.remarks,
      signaturePayload,
    });

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: documentChildren,
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    const filenameBase = (inspection.title || 'inspection')
      .replace(/[^a-z0-9]/gi, '_')
      .toLowerCase();

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filenameBase}_${answerId}.docx"`
    );
    return res.send(buffer);
  } catch (error) {
    console.error('Error generating document:', error);
    return res
      .status(500)
      .json({ error: 'Failed to generate document', message: error.message });
  }
});

module.exports = router;

function formatKeyToLabel(key = '') {
  return key
    .toString()
    .replace(/[_\-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, char => char.toUpperCase());
}

function normalizeAnswers(rawAnswers = {}) {
  const normalized = { ...rawAnswers };

  if (normalized.indicator) {
    const indicator = { ...normalized.indicator };
    if (!indicator.seal_and_bolt && indicator.seal_bolt) {
      indicator.seal_and_bolt = indicator.seal_bolt;
    }
    if (!indicator.serial_converter_plug && indicator.serial_converter) {
      indicator.serial_converter_plug = indicator.serial_converter;
    }
    normalized.indicator = indicator;
  }

  if (!normalized.metadata && rawAnswers.data?.metadata) {
    normalized.metadata = rawAnswers.data.metadata;
  }

  return normalized;
}

async function fetchSectionImages(answerId) {
  const images = await prisma.$queryRaw`
    SELECT 
      field_id,
      section,
      image_order,
      image_url
    FROM inspection_question_images
    WHERE answer_id = ${answerId}
    ORDER BY section, field_id, image_order ASC
  `;

  const sectionMap = {};

  for (const img of images) {
    const sectionKey = img.section || 'other';
    const fieldId = img.field_id || 'unknown';
    const relativePath = normalizeRelativePath(img.image_url);
    const mimeType = inferMimeType(img.image_url);

    const payload = await loadImagePayload(relativePath);
    if (!payload?.base64) {
      console.warn('[documents] Skipping image without payload', {
        section: sectionKey,
        fieldId,
        relativePath,
      });
      continue;
    }

    if (!sectionMap[sectionKey]) {
      sectionMap[sectionKey] = {};
    }

    if (!sectionMap[sectionKey][fieldId]) {
      sectionMap[sectionKey][fieldId] = [];
    }

    sectionMap[sectionKey][fieldId].push({
      data: payload.base64,
      mimeType,
    });
  }

  return sectionMap;
}

function buildDocxTemplateData({
  rawAnswers,
  metadata,
  contractor,
  images,
  remarks,
  signature,
}) {
  const normalizedAnswers = normalizeAnswers(rawAnswers);
  const combinedMetadata = {
    ...(normalizedAnswers.metadata || {}),
    ...metadata,
  };

  const sectionKeys = Object.keys(normalizedAnswers || {}).filter(key => {
    const normalizedKey = key.toLowerCase();
    return !['metadata', 'signature', 'signatures', 'remarks'].includes(
      normalizedKey
    );
  });

  const sections = sectionKeys
    .map(sectionKey => {
      const sectionData = normalizedAnswers[sectionKey] || {};
      const fieldEntries = Object.entries(sectionData).filter(
        ([, value]) => value && typeof value === 'object'
      );

      const fields = fieldEntries.map(([fieldId, fieldValue]) => {
        const field = ensureFieldObject(fieldId, fieldValue);
        const imageList = ((images || {})[sectionKey] || {})[fieldId] || [];

        return {
          fieldId,
          fieldLabel: field.question || formatKeyToLabel(fieldId),
          status: field.status || '',
          comment: field.comment || '',
          images: imageList
            .filter(img => !!img.data)
            .map(img => ({
              data: img.data,
              mimeType: img.mimeType || 'image/png',
            })),
        };
      });

      if (fields.length === 0) {
        return null;
      }

      return {
        sectionKey,
        sectionLabel: getSectionLabel(sectionKey),
        fields,
      };
    })
    .filter(Boolean);

  return {
    templateData: {
      d: {
        contractor,
        metadata: combinedMetadata,
        sections,
        remarks: remarks || '',
      },
    },
    sections,
    signaturePayload: signature || null,
  };
}

function buildDocumentContents({
  metadata,
  contractor,
  sections,
  remarks,
  signaturePayload,
}) {
  const children = [];

  const logoBuffer = getLogoBuffer();
  if (logoBuffer) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [
          new ImageRun({
            data: logoBuffer,
            transformation: {
              width: 120,
              height: 60,
            },
          }),
        ],
      })
    );
  }

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [
        new TextRun({
          text: 'АВТО ЖИН ХЭМЖҮҮРИЙН ҮЗЛЭГИЙН ХУУДАС',
          bold: true,
          color: COLORS.primary,
          size: 36,
        }),
      ],
    })
  );

  const contractorRows = [
    { label: 'Гэрээт компанийн нэр', value: contractor?.company || '' },
    { label: 'Гэрээний дугаар', value: contractor?.contract_no || '' },
    { label: 'Холбоо барих', value: contractor?.contact || '' },
  ].filter(row => hasContent(row.value));

  const generalRows = [
    { label: 'Огноо', value: metadata?.date || '' },
    { label: 'Шалгагч', value: metadata?.inspector || '' },
    { label: 'Байршил', value: metadata?.location || '' },
    {
      label: 'Авто жингийн дугаар',
      value: metadata?.scale_id_serial_no || metadata?.scaleSerial || '',
    },
    { label: 'Модель', value: metadata?.model || '' },
  ].filter(row => hasContent(row.value));

  createInfoTable('Гэрээний мэдээлэл', contractorRows).forEach(node =>
    children.push(node)
  );
  createInfoTable('Ерөнхий мэдээлэл', generalRows).forEach(node =>
    children.push(node)
  );

  sections.forEach(section => {
    createSectionBlock(section).forEach(node => children.push(node));
  });

  if (hasContent(remarks)) {
    children.push(
      new Paragraph({
        spacing: { before: 240, after: 80 },
        children: [
          new TextRun({
            text: 'Тэмдэглэл',
            bold: true,
            color: COLORS.primary,
            size: 28,
          }),
        ],
      }),
      new Paragraph({
        shading: {
          type: ShadingType.CLEAR,
          color: 'auto',
          fill: COLORS.noteBackground,
        },
        spacing: { before: 80, after: 160 },
        children: [
          new TextRun({
            text: sanitizeText(remarks),
            color: COLORS.text,
            size: 22,
          }),
        ],
      })
    );
  }

  if (signaturePayload) {
    const buffer = getImageBufferFromBase64(signaturePayload.data, {
      signature: true,
    });
    if (!buffer) {
      console.warn(
        '[documents] Skipping signature image due to invalid base64'
      );
    }
    children.push(
      new Paragraph({
        spacing: { before: 240, after: 80 },
        children: [
          new TextRun({
            text: 'Инспекторын гарын үсэг',
            bold: true,
            color: COLORS.primary,
            size: 28,
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [
          ...(buffer
            ? [
                new ImageRun({
                  data: buffer,
                  transformation: {
                    width: signaturePayload.width || 220,
                    height: signaturePayload.height || 80,
                  },
                }),
              ]
            : []),
        ],
      })
    );
  }

  if (children.length === 0) {
    children.push(
      new Paragraph({
        text: 'Мэдээлэл олдсонгүй.',
      })
    );
  }

  return children;
}

const COLORS = {
  primary: '1F4E78',
  headerText: 'FFFFFF',
  infoValueFill: 'F3F4F6',
  rowEven: 'F9FBFF',
  rowOdd: 'FFFFFF',
  borderStrong: '1F4E78',
  borderLight: 'D1D5DB',
  noteBackground: 'F5F7FB',
  text: '1F2937',
};

const DEFAULT_CELL_MARGINS = {
  top: 120,
  bottom: 120,
  left: 160,
  right: 160,
};

const SECTION_LABELS = {
  exterior: 'Авто жингийн тавцан',
  indicator: 'Тоолуур',
  sensor: 'Мэдрэгчийн хэсэг',
  jbox: 'Кабель бокс',
  foundation: 'Суурь',
  cleanliness: 'Цэвэрлэгээ',
};

const DEFAULT_LOGO_PATH = path.join(__dirname, '..', 'assets', 'docx-logo.png');
let cachedLogoBuffer;

function getLogoBuffer() {
  if (cachedLogoBuffer !== undefined) {
    return cachedLogoBuffer;
  }

  if (process.env.DOCX_LOGO_BASE64) {
    try {
      cachedLogoBuffer = Buffer.from(process.env.DOCX_LOGO_BASE64, 'base64');
      return cachedLogoBuffer;
    } catch (error) {
      console.warn('Failed to decode DOCX_LOGO_BASE64', error);
    }
  }

  if (fs.existsSync(DEFAULT_LOGO_PATH)) {
    cachedLogoBuffer = fs.readFileSync(DEFAULT_LOGO_PATH);
  } else {
    cachedLogoBuffer = null;
  }

  return cachedLogoBuffer;
}

function hasContent(value) {
  if (value === null || value === undefined) return false;
  return sanitizeText(value).length > 0;
}

function createInfoTable(title, rows) {
  if (!rows || rows.length === 0) {
    return [];
  }

  const titleParagraph = new Paragraph({
    spacing: { before: 200, after: 80 },
    children: [
      new TextRun({
        text: sanitizeText(title),
        bold: true,
        color: COLORS.primary,
        size: 28,
      }),
    ],
  });

  const tableRows = rows.map(
    row =>
      new TableRow({
        children: [
          createInfoLabelCell(row.label),
          createInfoValueCell(row.value),
        ],
      })
  );

  return [
    titleParagraph,
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: tableBorders(),
      rows: tableRows,
    }),
  ];
}

function createInfoLabelCell(label) {
  return new TableCell({
    children: [
      new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [
          new TextRun({
            text: sanitizeText(label),
            bold: true,
            color: COLORS.headerText,
            size: 22,
          }),
        ],
      }),
    ],
    shading: {
      type: ShadingType.CLEAR,
      color: 'auto',
      fill: COLORS.primary,
    },
    verticalAlign: VerticalAlign.CENTER,
    width: { size: 35, type: WidthType.PERCENTAGE },
    margins: DEFAULT_CELL_MARGINS,
  });
}

function createInfoValueCell(value) {
  return new TableCell({
    children: [
      new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [
          new TextRun({
            text: sanitizeText(value ?? ''),
            color: COLORS.text,
            size: 22,
          }),
        ],
      }),
    ],
    shading: {
      type: ShadingType.CLEAR,
      color: 'auto',
      fill: COLORS.infoValueFill,
    },
    verticalAlign: VerticalAlign.CENTER,
    width: { size: 65, type: WidthType.PERCENTAGE },
    margins: DEFAULT_CELL_MARGINS,
  });
}

function tableBorders() {
  return {
    top: { style: BorderStyle.SINGLE, size: 4, color: COLORS.borderStrong },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: COLORS.borderStrong },
    left: { style: BorderStyle.SINGLE, size: 4, color: COLORS.borderStrong },
    right: { style: BorderStyle.SINGLE, size: 4, color: COLORS.borderStrong },
    insideH: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderLight },
    insideV: { style: BorderStyle.SINGLE, size: 2, color: COLORS.borderLight },
  };
}

function createSectionBlock(section) {
  const nodes = [
    new Paragraph({
      spacing: { before: 260, after: 80 },
      children: [
        new TextRun({
          text: sanitizeText(section.sectionLabel),
          bold: true,
          color: COLORS.primary,
          size: 28,
        }),
      ],
    }),
  ];

  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      createHeaderCell('№', { width: 8 }),
      createHeaderCell('Үзлэгийн эд анги', {
        width: 42,
        alignment: AlignmentType.LEFT,
      }),
      createHeaderCell('Төлөв', { width: 20 }),
      createHeaderCell('Тайлбар', { width: 30, alignment: AlignmentType.LEFT }),
    ],
  });

  const bodyRows = section.fields.map(
    (field, index) =>
      new TableRow({
        children: [
          createBodyCell(String(index + 1), index),
          createBodyCell(field.fieldLabel, index, AlignmentType.LEFT),
          createBodyCell(field.status || '', index),
          createBodyCell(field.comment || '', index, AlignmentType.LEFT),
        ],
      })
  );

  nodes.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: tableBorders(),
      rows: [headerRow, ...bodyRows],
    })
  );

  section.fields.forEach(field => {
    if (!field.images || field.images.length === 0) {
      return;
    }

    nodes.push(
      new Paragraph({
        spacing: { before: 160, after: 60 },
        children: [
          new TextRun({
            text: sanitizeText(`${field.fieldLabel} - зураг`),
            bold: true,
            color: COLORS.primary,
            size: 24,
          }),
        ],
      })
    );

    field.images.forEach(image => {
      const buffer = getImageBufferFromBase64(image.data, {
        fieldId: field.fieldId,
        sectionKey: section.sectionKey,
        sectionLabel: section.sectionLabel,
      });

      if (!buffer) {
        console.warn(
          '[documents] Skipping image due to invalid base64 during document build',
          {
            fieldId: field.fieldId,
            sectionKey: section.sectionKey,
          }
        );
        return;
      }

      nodes.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 120 },
          children: [
            new ImageRun({
              data: buffer,
              transformation: {
                width: 320,
                height: 200,
              },
            }),
          ],
        })
      );
    });
  });

  return nodes;
}

function createHeaderCell(text, options = {}) {
  const width = options.width ?? 25;
  const alignment = options.alignment ?? AlignmentType.CENTER;

  return new TableCell({
    children: [
      new Paragraph({
        alignment,
        children: [
          new TextRun({
            text: sanitizeText(text),
            bold: true,
            color: COLORS.headerText,
            size: 22,
          }),
        ],
      }),
    ],
    shading: {
      type: ShadingType.CLEAR,
      color: 'auto',
      fill: COLORS.primary,
    },
    verticalAlign: VerticalAlign.CENTER,
    width: { size: width, type: WidthType.PERCENTAGE },
    margins: DEFAULT_CELL_MARGINS,
  });
}

function createBodyCell(text, rowIndex, alignment = AlignmentType.CENTER) {
  const fill = rowIndex % 2 === 0 ? COLORS.rowOdd : COLORS.rowEven;

  return new TableCell({
    children: [
      new Paragraph({
        alignment,
        children: [
          new TextRun({
            text: sanitizeText(text),
            color: COLORS.text,
            size: 22,
          }),
        ],
      }),
    ],
    shading: {
      type: ShadingType.CLEAR,
      color: 'auto',
      fill,
    },
    verticalAlign: VerticalAlign.CENTER,
    margins: DEFAULT_CELL_MARGINS,
  });
}

function ensureFieldObject(fieldId, value) {
  if (value && typeof value === 'object') {
    return {
      status: value.status ?? '',
      comment: value.comment ?? '',
      question: value.question ?? formatKeyToLabel(fieldId),
    };
  }

  return {
    status: '',
    comment: '',
    question: formatKeyToLabel(fieldId),
  };
}

function getSectionLabel(sectionKey) {
  return SECTION_LABELS[sectionKey] || formatKeyToLabel(sectionKey);
}

function extractSignature(data) {
  if (!data) return null;

  const possibleValue =
    data?.signature_field?.signatureImage ||
    data?.signature?.signatureImage ||
    data?.signatureImage ||
    data;

  if (typeof possibleValue !== 'string') {
    return null;
  }

  if (possibleValue.startsWith('data:')) {
    const [meta, base64] = possibleValue.split(',');
    const mimeMatch = meta.match(/data:(.*);base64/);
    return {
      data: base64 || '',
      mimeType: mimeMatch ? mimeMatch[1] : 'image/png',
      width: DEFAULT_IMAGE_WIDTH,
      height: DEFAULT_IMAGE_HEIGHT,
    };
  }

  return {
    data: possibleValue,
    mimeType: 'image/png',
    width: DEFAULT_IMAGE_WIDTH,
    height: DEFAULT_IMAGE_HEIGHT,
  };
}

const DEFAULT_IMAGE_WIDTH = 220;
const DEFAULT_IMAGE_HEIGHT = 80;
