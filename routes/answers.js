const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Helper function to serialize BigInt
const serializeBigInt = (obj) => {
  return JSON.parse(JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  ));
};

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
                      organization: true
                    }
                  }
                }
              },
              assignee: {
                include: {
                  organization: true
                }
              }
            }
          },
          user: {
            include: {
              organization: true
            }
          }
        }
      }),
      prisma.InspectionAnswer.count({ where })
    ]);

    return res.json({
      message: 'Inspection answers retrieved successfully',
      data: serializeBigInt(answers),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error getting inspection answers:', error);
    return res.status(500).json({
      error: 'Failed to get inspection answers',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
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
        message: 'id must be a numeric identifier'
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
          }
        }
      }
    });

    if (!answer) {
      return res.status(404).json({
        error: 'Not found',
        message: `Inspection answer with ID ${id} does not exist`
      });
    }

    // Verify user has access to this inspection
    const currentUser = await prisma.User.findUnique({
      where: { id: BigInt(req.user.id) },
      include: { role: true },
    });

    // Check if user is admin or belongs to the same organization
    if (currentUser?.role?.name !== 'admin' && currentUser?.orgId !== answer.inspection.orgId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this inspection answer'
      });
    }

    console.log('=== GET Question Images by Answer ID ===');
    console.log('Answer ID:', answerId.toString());
    console.log('Query params - fieldId:', fieldId, 'section:', section);

    // Build WHERE conditions dynamically
    let query;
    if (fieldId && section) {
      query = prisma.$queryRaw`
        SELECT 
          id,
          answer_id,
          field_id,
          section,
          image_order,
          mime_type,
          file_size,
          image_data,
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
          mime_type,
          file_size,
          image_data,
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
          mime_type,
          file_size,
          image_data,
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
          mime_type,
          file_size,
          image_data,
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
    
    console.log(`Found ${images.length} image(s) for answer ${answerId.toString()}`);

    // Format response - ensure all BigInt values are converted to strings
    const formattedImages = images.map((img) => ({
      id: img.id ? img.id.toString() : null,
      answerId: img.answer_id ? img.answer_id.toString() : null,
      fieldId: img.field_id,
      section: img.section,
      order: Number(img.image_order),
      mimeType: img.mime_type,
      fileSize: img.file_size ? img.file_size.toString() : null,
      imageData: img.image_data,
      uploadedBy: img.uploaded_by ? img.uploaded_by.toString() : null,
      uploadedAt: img.uploaded_at ? img.uploaded_at.toISOString() : null,
      createdAt: img.created_at ? img.created_at.toISOString() : null,
      updatedAt: img.updated_at ? img.updated_at.toISOString() : null,
    }));

    // Use serializeBigInt to ensure all BigInt values are converted
    return res.json(serializeBigInt({
      message: 'Question images retrieved successfully',
      data: {
        answerId: answer.id.toString(),
        images: formattedImages,
        count: formattedImages.length,
      },
    }));
  } catch (error) {
    console.error('Error fetching question images:', error);
    return res.status(500).json({
      error: 'Failed to fetch question images',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
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
        message: 'id must be a numeric identifier'
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
      }
    });

    if (!answer) {
      return res.status(404).json({
        error: 'Not found',
        message: `Inspection answer with ID ${id} does not exist`
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
      }
    });
  } catch (error) {
    console.error('Error getting inspection answer:', error);
    return res.status(500).json({
      error: 'Failed to get inspection answer',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
});

module.exports = router;

