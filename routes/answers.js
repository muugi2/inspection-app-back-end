const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware } = require('../middleware/auth');
const {
  normalizeRelativePath,
  buildPublicUrl,
  loadImagePayload,
  inferMimeType,
} = require('../utils/imageStorage');

const router = express.Router();
const prisma = new PrismaClient();
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

// Helper function to serialize BigInt
const serializeBigInt = obj => {
  return JSON.parse(
    JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
    )
  );
};

const formatKeyToLabel = key => {
  if (!key || typeof key !== 'string') return '';

  return key
    .replace(/[_\-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, char => char.toUpperCase());
};

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
    console.warn('[answers] Failed to decode base64 string', error.message);
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
        '[answers] Failed to convert binary string to base64',
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
      '[answers] Failed to handle image_data of type',
      typeof imageData,
      err.message
    );
    return null;
  }
}

// GET /api/inspection-answers - Fetch all inspection answers
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 50, inspectionId, answeredBy } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build where clause
    const where = {};
    if (inspectionId) {
      where.inspectionId = BigInt(inspectionId);
    }
    if (answeredBy) {
      where.answeredBy = BigInt(answeredBy);
    }

    const [answers, total] = await Promise.all([
      prisma.InspectionAnswer.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { answeredAt: 'desc' },
        include: {
          inspection: {
            include: {
              device: {
                include: {
                  model: true,
                  site: {
                    include: {
                      organization: true,
                    },
                  },
                },
              },
              assignee: {
                include: {
                  organization: true,
                },
              },
            },
          },
          user: {
            include: {
              organization: true,
            },
          },
        },
      }),
      prisma.InspectionAnswer.count({ where }),
    ]);

    return res.json({
      message: 'Inspection answers retrieved successfully',
      data: serializeBigInt(answers),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Error getting inspection answers:', error);
    return res.status(500).json({
      error: 'Failed to get inspection answers',
      message:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    });
  }
});

// GET question images for an inspection answer
// This route must come BEFORE /:id route to avoid conflict
router.get('/:id/question-images', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { fieldId, section } = req.query;

    let answerId;
    try {
      answerId = BigInt(id);
    } catch (e) {
      return res.status(400).json({
        error: 'Invalid id',
        message: 'id must be a numeric identifier',
      });
    }

    // Get the answer to verify it exists and user has access
    const answer = await prisma.InspectionAnswer.findUnique({
      where: { id: answerId },
      include: {
        inspection: {
          select: {
            id: true,
            orgId: true,
          },
        },
      },
    });

    if (!answer) {
      return res.status(404).json({
        error: 'Not found',
        message: `Inspection answer with ID ${id} does not exist`,
      });
    }

    // Verify user has access to this inspection
    const currentUser = await prisma.User.findUnique({
      where: { id: BigInt(req.user.id) },
      include: { role: true },
    });

    // Check if user is admin or belongs to the same organization
    if (
      currentUser?.role?.name !== 'admin' &&
      currentUser?.orgId !== answer.inspection.orgId
    ) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this inspection answer',
      });
    }

    console.log('=== GET Question Images by Answer ID ===');
    console.log('Answer ID:', answerId.toString());
    console.log('Inspection ID:', answer.inspection.id.toString());
    console.log('Query params - fieldId:', fieldId, 'section:', section);

    // Get inspection_id from the answer
    const inspectionId = answer.inspection.id;

    // Build WHERE conditions dynamically using inspection_id
    // Note: inspection_question_images table has answer_id column, not inspection_id
    // But we need to filter by inspection_id, so we'll use answer_id from the answer
    let query;
    if (fieldId && section) {
      query = prisma.$queryRaw`
        SELECT 
          id,
          answer_id,
          field_id,
          section,
          image_order,
          image_url,
          uploaded_by,
          uploaded_at,
          created_at,
          updated_at
        FROM inspection_question_images
        WHERE answer_id = ${answerId}
          AND field_id = ${fieldId}
          AND section = ${section}
        ORDER BY section, field_id, image_order ASC
      `;
    } else if (fieldId) {
      query = prisma.$queryRaw`
        SELECT 
          id,
          answer_id,
          field_id,
          section,
          image_order,
          image_url,
          uploaded_by,
          uploaded_at,
          created_at,
          updated_at
        FROM inspection_question_images
        WHERE answer_id = ${answerId}
          AND field_id = ${fieldId}
        ORDER BY section, field_id, image_order ASC
      `;
    } else if (section) {
      query = prisma.$queryRaw`
        SELECT 
          id,
          answer_id,
          field_id,
          section,
          image_order,
          image_url,
          uploaded_by,
          uploaded_at,
          created_at,
          updated_at
        FROM inspection_question_images
        WHERE answer_id = ${answerId}
          AND section = ${section}
        ORDER BY section, field_id, image_order ASC
      `;
    } else {
      // Get all images for this specific answer
      query = prisma.$queryRaw`
        SELECT 
          id,
          answer_id,
          field_id,
          section,
          image_order,
          image_url,
          uploaded_by,
          uploaded_at,
          created_at,
          updated_at
        FROM inspection_question_images
        WHERE answer_id = ${answerId}
        ORDER BY section, field_id, image_order ASC
      `;
    }

    const images = await query;
    console.log(
      `Found ${images.length} image(s) for answer ${answerId.toString()}`
    );

    const formattedImages = await Promise.all(
      images.map(async (img, index) => {
        const relativePath = normalizeRelativePath(img.image_url);
        const payload = await loadImagePayload(relativePath);
        const publicUrl = img.image_url || buildPublicUrl(relativePath);

        console.log(`[answers] Image ${index + 1}`, {
          relativePath,
          hasBase64: !!payload.base64,
          size: payload.size,
          publicUrl,
        });

        return {
        id: img.id ? img.id.toString() : null,
        answerId: img.answer_id ? img.answer_id.toString() : null,
        inspectionId: inspectionId.toString(),
        fieldId: img.field_id,
        section: img.section,
        order: Number(img.image_order),
          imageUrl: publicUrl,
          storagePath: relativePath,
          fileSize: payload.size,
          mimeType: inferMimeType(relativePath),
          imageData: payload.base64,
        uploadedBy: img.uploaded_by ? img.uploaded_by.toString() : null,
        uploadedAt: img.uploaded_at ? img.uploaded_at.toISOString() : null,
        createdAt: img.created_at ? img.created_at.toISOString() : null,
        updatedAt: img.updated_at ? img.updated_at.toISOString() : null,
      };
      })
    );

    // Use serializeBigInt to ensure all BigInt values are converted
    return res.json(
      serializeBigInt({
      message: 'Question images retrieved successfully',
      data: {
        answerId: answer.id.toString(),
        images: formattedImages,
        count: formattedImages.length,
      },
      })
    );
  } catch (error) {
    console.error('Error fetching question images:', error);
    return res.status(500).json({
      error: 'Failed to fetch question images',
      message:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    });
  }
});

router.get('/:id/docx-data', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    let answerId;

    try {
      answerId = BigInt(id);
    } catch (e) {
      return res.status(400).json({
        error: 'Invalid id',
        message: 'id must be a numeric identifier',
      });
    }

    const answer = await prisma.InspectionAnswer.findUnique({
      where: { id: answerId },
      include: {
        inspection: {
          include: {
            device: {
              include: {
                model: true,
                site: {
                  include: {
                    organization: true,
                  },
                },
              },
            },
            assignee: {
              include: {
                organization: true,
              },
            },
            organization: true,
            contract: true,
          },
        },
        user: {
          include: {
            organization: true,
          },
        },
      },
    });

    if (!answer) {
      return res.status(404).json({
        error: 'Not found',
        message: `Inspection answer with ID ${id} does not exist`,
      });
    }

    const currentUser = await prisma.User.findUnique({
      where: { id: BigInt(req.user.id) },
      include: { role: true },
    });

    if (
      currentUser?.role?.name !== 'admin' &&
      currentUser?.orgId !== answer.inspection.orgId
    ) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this inspection answer',
      });
    }

    const answersJson = answer.answers || {};
    const metadata = answersJson.metadata || {};
    const remarks = answersJson.remarks || '';
    const signature = answersJson.signature || null;

    const sectionKeys = Object.keys(answersJson).filter(key => {
      const normalized = key.toLowerCase();
      return !['metadata', 'signature', 'remarks'].includes(normalized);
    });

    const sections = sectionKeys.map(sectionKey => {
      const sectionData = answersJson[sectionKey] || {};
      const fields = Object.entries(sectionData)
        .filter(([, value]) => value && typeof value === 'object')
        .map(([fieldKey, fieldValue]) => {
          const label = fieldValue?.question || formatKeyToLabel(fieldKey);
          return {
            fieldId: fieldKey,
            fieldLabel: label,
            status: fieldValue?.status || '',
            comment: fieldValue?.comment || '',
          };
        });

      return {
        key: sectionKey,
        label: formatKeyToLabel(sectionKey),
        fields,
      };
    });

    const rawImages = await prisma.$queryRaw`
      SELECT 
        id,
        answer_id,
        field_id,
        section,
        image_order,
        image_url,
        created_at,
        updated_at
      FROM inspection_question_images
      WHERE answer_id = ${answerId}
      ORDER BY section, field_id, image_order ASC
    `;

    const sectionImages = {};

    for (const row of rawImages) {
      const sectionKey = row.section || 'other';
      const fieldId = row.field_id || 'unknown';
      const relativePath = normalizeRelativePath(row.image_url);
      const mimeType = inferMimeType(row.image_url);
      const payload = await loadImagePayload(relativePath);
      if (!payload?.base64) {
        console.warn('[answers] Skipping invalid image payload', {
          section: sectionKey,
          fieldId,
          imageId: row.id ? row.id.toString() : null,
        });
        continue;
      }

      if (!sectionImages[sectionKey]) {
        sectionImages[sectionKey] = {};
      }

      if (!sectionImages[sectionKey][fieldId]) {
        sectionImages[sectionKey][fieldId] = [];
      }

      const fieldSource = answersJson?.[sectionKey]?.[fieldId];
      const fieldLabel = fieldSource?.question || formatKeyToLabel(fieldId);

      sectionImages[sectionKey][fieldId].push({
        id: row.id ? row.id.toString() : null,
        order: row.image_order ?? null,
        mimeType,
        base64: payload.base64,
        dataUri: payload.base64
          ? `data:${mimeType};base64,${payload.base64}`
          : null,
        imageUrl: row.image_url,
        storagePath: relativePath,
        fileSize: payload.size,
        fieldLabel,
        sectionLabel: formatKeyToLabel(sectionKey),
      });
    }

    const inspectionData = answer.inspection || {};
    const deviceData = inspectionData.device || {};
    const siteData = deviceData.site || {};
    const organizationData =
      siteData.organization || inspectionData.organization || {};
    const contractData = inspectionData.contract || {};
    const assigneeData = inspectionData.assignee || {};
    const contractor = {
      company: organizationData?.name || '',
      contract_no: contractData?.contractNumber || '',
      contact: assigneeData?.fullName || '',
    };

    const responseData = {
      answer: {
        id: answer.id,
        inspectionId: answer.inspectionId,
        answeredAt: answer.answeredAt,
        createdAt: answer.createdAt,
        updatedAt: answer.updatedAt,
      },
      metadata,
      remarks,
      signature,
      sections,
      images: sectionImages,
      contractor,
      rawAnswers: answersJson,
    };

    return res.json({
      message: 'Inspection docx data prepared successfully',
      data: serializeBigInt(responseData),
    });
  } catch (error) {
    console.error('Error preparing inspection docx data:', error);
    return res.status(500).json({
      error: 'Failed to prepare docx data',
      message:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    });
  }
});

// GET /api/inspection-answers/:id - Fetch inspection answer by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    let answerId;
    try {
      answerId = BigInt(id);
    } catch (e) {
      return res.status(400).json({
        error: 'Invalid id',
        message: 'id must be a numeric identifier',
      });
    }

    const answer = await prisma.InspectionAnswer.findUnique({
      where: { id: answerId },
      select: {
        id: true,
        inspectionId: true,
        answers: true,
        answeredBy: true,
        answeredAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!answer) {
      return res.status(404).json({
        error: 'Not found',
        message: `Inspection answer with ID ${id} does not exist`,
      });
    }

    return res.json({
      message: 'Inspection answer retrieved successfully',
      data: {
        id: answer.id.toString(),
        inspectionId: answer.inspectionId.toString(),
        answers: answer.answers,
        answeredBy: answer.answeredBy ? answer.answeredBy.toString() : null,
        answeredAt: answer.answeredAt,
        createdAt: answer.createdAt,
        updatedAt: answer.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error getting inspection answer:', error);
    return res.status(500).json({
      error: 'Failed to get inspection answer',
      message:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    });
  }
});

module.exports = router;
