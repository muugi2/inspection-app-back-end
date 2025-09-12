const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get inspection template sections from test data structure
 * @param {Object} templateQuestions - Questions from template
 * @returns {Object} Organized sections
 */
function getTemplateSections(templateQuestions) {
  if (!templateQuestions || !Array.isArray(templateQuestions)) {
    return {};
  }

  const sections = {};
  templateQuestions.forEach((section, index) => {
    if (section.section && section.title && section.fields) {
      sections[section.section] = {
        name: section.section,
        title: section.title,
        order: index + 1,
        questions: section.fields.map(field => ({
          id: field.id,
          question: field.question,
          type: field.type,
          options: field.options || [],
          textRequired: field.text_required || false,
          imageRequired: field.image_required || false,
          required: field.text_required || field.image_required || false
        }))
      };
    }
  });

  return sections;
}

/**
 * Get section answers for a specific section
 * @param {BigInt} inspectionId - Inspection ID
 * @param {string} sectionName - Section name
 * @returns {Object} Section answers
 */
async function getSectionAnswers(inspectionId, sectionName) {
  const answers = await prisma.inspectionAnswer.findMany({
    where: { inspectionId },
    orderBy: { answeredAt: 'desc' },
    select: {
      id: true,
      answers: true,
      answeredBy: true,
      answeredAt: true,
    },
  });

  if (answers.length === 0) {
    return {};
  }

  // Find the latest answer that contains this section
  for (const answer of answers) {
    const answerData = answer.answers || {};
    if (answerData.data && answerData.data[sectionName]) {
      return answerData.data[sectionName];
    }
  }

  return {};
}

/**
 * Get completed sections for an inspection
 * @param {BigInt} inspectionId - Inspection ID
 * @returns {Array} List of completed sections
 */
async function getCompletedSections(inspectionId) {
  const answers = await prisma.inspectionAnswer.findMany({
    where: { inspectionId },
    orderBy: { answeredAt: 'asc' },
    select: {
      answers: true,
      answeredAt: true,
    },
  });

  const completedSections = [];
  const sectionNames = ['exterior', 'indicator', 'jbox', 'sensor', 'foundation', 'cleanliness'];
  
  answers.forEach(answer => {
    const answerData = answer.answers || {};
    if (answerData.data) {
      sectionNames.forEach(sectionName => {
        if (answerData.data[sectionName] && !completedSections.find(s => s.section === sectionName)) {
          completedSections.push({
            section: sectionName,
            completedAt: answer.answeredAt,
            answeredAt: answer.answeredAt
          });
        }
      });
    }
  });

  return completedSections;
}

/**
 * Fetch assigned inspections by type for a user
 * @param {BigInt} userId - User ID
 * @param {string} inspectionType - Type of inspection (optional)
 * @returns {Array} Array of inspections with related data
 */
async function getAssignedInspectionsByType(userId, inspectionType = null) {
  const whereClause = {
    assignedTo: userId,
    deletedAt: null, // Exclude soft-deleted inspections
  };

  // Add type filter if specified
  if (inspectionType) {
    whereClause.type = inspectionType;
  }

  const inspections = await prisma.inspection.findMany({
    where: whereClause,
    include: {
      device: {
        select: {
          id: true,
          serialNumber: true,
          assetTag: true,
          model: {
            select: {
              manufacturer: true,
              model: true,
            },
          },
        },
      },
      site: {
        select: {
          id: true,
          name: true,
        },
      },
      contract: {
        select: {
          id: true,
          contractName: true,
          contractNumber: true,
        },
      },
      createdByUser: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
      template: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
    },
    orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'desc' }],
  });

  // Convert BigInt values to strings for JSON serialization
  return inspections.map(inspection => ({
    ...inspection,
    id: inspection.id.toString(),
    orgId: inspection.orgId.toString(),
    deviceId: inspection.deviceId?.toString(),
    siteId: inspection.siteId?.toString(),
    contractId: inspection.contractId?.toString(),
    templateId: inspection.templateId?.toString(),
    assignedTo: inspection.assignedTo?.toString(),
    createdBy: inspection.createdBy.toString(),
    updatedBy: inspection.updatedBy?.toString(),
    device: inspection.device
      ? {
          ...inspection.device,
          id: inspection.device.id.toString(),
        }
      : null,
    site: inspection.site
      ? {
          ...inspection.site,
          id: inspection.site.id.toString(),
        }
      : null,
    contract: inspection.contract
      ? {
          ...inspection.contract,
          id: inspection.contract.id.toString(),
        }
      : null,
    createdByUser: {
      ...inspection.createdByUser,
      id: inspection.createdByUser.id.toString(),
    },
    template: inspection.template
      ? {
          ...inspection.template,
          id: inspection.template.id.toString(),
        }
      : null,
  }));
}

/**
 * Validate inspection access for user
 * @param {Object} inspection - Inspection record
 * @param {string} orgIdFromToken - Organization ID from JWT token
 * @param {string} userId - User ID
 * @returns {Object} Access validation result
 */
function validateInspectionAccess(inspection, orgIdFromToken, userId) {
  const sameOrg = inspection.orgId.toString() === orgIdFromToken;
  const isAssignee = inspection.assignedTo !== null && 
    inspection.assignedTo.toString() === userId;
  const isCreator = inspection.createdBy.toString() === userId;

  return {
    hasAccess: sameOrg || isAssignee || isCreator,
    sameOrg,
    isAssignee,
    isCreator
  };
}

/**
 * Normalize and validate status
 * @param {string} status - Status to validate
 * @returns {Object} Validation result
 */
function validateStatus(status) {
  const allowedStatuses = [
    'DRAFT',
    'IN_PROGRESS', 
    'SUBMITTED',
    'APPROVED',
    'REJECTED',
    'CANCELED',
  ];

  const normalizedStatus = typeof status === 'string' && status.length > 0
    ? status.toUpperCase()
    : undefined;

  return {
    normalizedStatus,
    isValid: !normalizedStatus || allowedStatuses.includes(normalizedStatus),
    allowedStatuses
  };
}

// =============================================================================
// GET ROUTES - FETCH INSPECTIONS
// =============================================================================

// GET all inspections assigned to logged-in user
router.get('/assigned', authMiddleware, async (req, res) => {
  try {
    const userId = BigInt(req.user.id);
    const inspections = await getAssignedInspectionsByType(userId);

    res.json({
      message: 'All assigned inspections fetched successfully',
      data: inspections,
      count: inspections.length,
    });
  } catch (error) {
    console.error('Error fetching assigned inspections:', error);
    res.status(500).json({
      error: 'Failed to fetch assigned inspections',
      message: process.env.NODE_ENV === 'development'
        ? error.message
        : 'Internal server error',
    });
  }
});

// GET INSPECTION type inspections assigned to logged-in user
router.get('/inspection/assigned', authMiddleware, async (req, res) => {
  try {
    const userId = BigInt(req.user.id);
    const inspections = await getAssignedInspectionsByType(userId, 'INSPECTION');

    res.json({
      message: 'Assigned INSPECTION inspections fetched successfully',
      data: inspections,
      count: inspections.length,
      type: 'INSPECTION',
    });
  } catch (error) {
    console.error('Error fetching assigned INSPECTION inspections:', error);
    res.status(500).json({
      error: 'Failed to fetch assigned INSPECTION inspections',
      message: process.env.NODE_ENV === 'development'
        ? error.message
        : 'Internal server error',
    });
  }
});

// GET INSTALLATION type inspections assigned to logged-in user
router.get('/installation/assigned', authMiddleware, async (req, res) => {
  try {
    const userId = BigInt(req.user.id);
    const inspections = await getAssignedInspectionsByType(userId, 'INSTALLATION');

    res.json({
      message: 'Assigned INSTALLATION inspections fetched successfully',
      data: inspections,
      count: inspections.length,
      type: 'INSTALLATION',
    });
  } catch (error) {
    console.error('Error fetching assigned INSTALLATION inspections:', error);
    res.status(500).json({
      error: 'Failed to fetch assigned INSTALLATION inspections',
      message: process.env.NODE_ENV === 'development'
        ? error.message
        : 'Internal server error',
    });
  }
});

// GET MAINTENANCE type inspections assigned to logged-in user
router.get('/maintenance/assigned', authMiddleware, async (req, res) => {
  try {
    const userId = BigInt(req.user.id);
    const inspections = await getAssignedInspectionsByType(userId, 'MAINTENANCE');

    res.json({
      message: 'Assigned MAINTENANCE inspections fetched successfully',
      data: inspections,
      count: inspections.length,
      type: 'MAINTENANCE',
    });
  } catch (error) {
    console.error('Error fetching assigned MAINTENANCE inspections:', error);
    res.status(500).json({
      error: 'Failed to fetch assigned MAINTENANCE inspections',
      message: process.env.NODE_ENV === 'development'
        ? error.message
        : 'Internal server error',
    });
  }
});

// GET VERIFICATION type inspections assigned to logged-in user
router.get('/verification/assigned', authMiddleware, async (req, res) => {
  try {
    const userId = BigInt(req.user.id);
    const inspections = await getAssignedInspectionsByType(userId, 'VERIFICATION');

    res.json({
      message: 'Assigned VERIFICATION inspections fetched successfully',
      data: inspections,
      count: inspections.length,
      type: 'VERIFICATION',
    });
  } catch (error) {
    console.error('Error fetching assigned VERIFICATION inspections:', error);
    res.status(500).json({
      error: 'Failed to fetch assigned VERIFICATION inspections',
      message: process.env.NODE_ENV === 'development'
        ? error.message
        : 'Internal server error',
    });
  }
});

// GET all inspections (TODO: Implement)
router.get('/', (req, res) => {
  try {
    // TODO: Implement database query
    res.json({
      message: 'Get all inspections',
      data: [],
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch inspections' });
  }
});

// GET inspection by ID (TODO: Implement)
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    // TODO: Implement database query
    res.json({
      message: `Get inspection ${id}`,
      data: { id, status: 'pending' },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch inspection' });
  }
});

// =============================================================================
// POST ROUTES - CREATE INSPECTIONS
// =============================================================================

// POST new inspection (TODO: Implement)
router.post('/', (req, res) => {
  try {
    const inspectionData = req.body;
    // TODO: Implement database insert
    res.status(201).json({
      message: 'Inspection created successfully',
      data: { id: Date.now(), ...inspectionData },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create inspection' });
  }
});

// =============================================================================
// PUT ROUTES - UPDATE INSPECTIONS
// =============================================================================

// PUT update inspection (TODO: Implement)
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    // TODO: Implement database update
    res.json({
      message: `Inspection ${id} updated successfully`,
      data: { id, ...updateData },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update inspection' });
  }
});

// =============================================================================
// DELETE ROUTES - DELETE INSPECTIONS
// =============================================================================

// DELETE inspection (TODO: Implement)
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    // TODO: Implement database delete
    res.json({
      message: `Inspection ${id} deleted successfully`,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete inspection' });
  }
});

// =============================================================================
// ANSWER ROUTES - SAVE INSPECTION ANSWERS
// =============================================================================

// POST save answers for an inspection (legacy - saves all answers at once)
router.post('/answers', authMiddleware, async (req, res) => {
  try {
    let inspectionId = req.body.inspectionId;
    const userId = BigInt(req.user.id);
    const orgIdFromToken = req.user.orgId;

    const { answers, progress, status } = req.body || {};

    if (answers === undefined) {
      return res.status(400).json({
        error: 'Missing answers',
        message: 'Request body must include answers (JSON object)'
      });
    }

    try {
      inspectionId = BigInt(inspectionId);
    } catch (e) {
      return res.status(400).json({
        error: 'Invalid inspectionId',
        message: 'inspectionId must be a numeric identifier'
      });
    }

    const inspection = await prisma.inspection.findUnique({
      where: { id: inspectionId },
      select: {
        id: true,
        orgId: true,
        status: true,
        assignedTo: true,
        createdBy: true,
      },
    });

    if (!inspection) {
      return res.status(404).json({
        error: 'Inspection not found',
        message: 'The specified inspection does not exist'
      });
    }

    const access = validateInspectionAccess(inspection, orgIdFromToken, req.user.id);
    if (!access.hasAccess) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this inspection'
      });
    }

    const statusValidation = validateStatus(status);
    if (!statusValidation.isValid) {
      return res.status(400).json({
        error: 'Invalid status',
        message: `Status must be one of ${statusValidation.allowedStatuses.join(', ')}`,
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Always create new answer record (don't overwrite existing data)
      const savedAnswer = await tx.inspectionAnswer.create({
        data: {
          inspectionId,
          answers,
          answeredBy: userId,
          answeredAt: new Date(),
        },
      });

      const shouldUpdateProgress = typeof progress === 'number';
      const shouldUpdateStatus = typeof statusValidation.normalizedStatus === 'string' && statusValidation.normalizedStatus.length > 0;

      let updatedInspection = null;
      if (shouldUpdateProgress || shouldUpdateStatus) {
        updatedInspection = await tx.inspection.update({
          where: { id: inspectionId },
          data: {
            progress: shouldUpdateProgress ? progress : undefined,
            status: shouldUpdateStatus ? statusValidation.normalizedStatus : undefined,
            completedAt: shouldUpdateStatus && statusValidation.normalizedStatus === 'SUBMITTED' ? new Date() : undefined,
            updatedBy: userId,
          },
          select: { id: true, status: true, progress: true, completedAt: true },
        });
      }

      // Audit log
      await tx.auditLog.create({
        data: {
          tableId: 'inspections',
          recordId: inspectionId,
          action: 'UPDATE',
          newData: {
            status: updatedInspection?.status ?? inspection.status,
            progress: updatedInspection?.progress ?? null,
            answersSaved: true,
          },
          userId,
        },
      });

      return { savedAnswer, updatedInspection };
    });

    return res.json({
      message: 'Answers saved',
      data: {
        inspectionId: inspection.id.toString(),
        answerId: result.savedAnswer.id.toString(),
        status: (result.updatedInspection?.status || inspection.status),
        progress: result.updatedInspection?.progress ?? null,
        answeredAt: result.savedAnswer.answeredAt,
      },
    });
  } catch (error) {
    console.error('Error saving answers:', error);
    return res.status(500).json({
      error: 'Failed to save answers',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
});

// POST save individual question answers (each question as separate row)
router.post('/question-answers', authMiddleware, async (req, res) => {
  try {
    let inspectionId = req.body.inspectionId;
    const userId = BigInt(req.user.id);
    const orgIdFromToken = req.user.orgId;

    const { answers, progress, status } = req.body || {};

    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({
        error: 'Missing answers',
        message: 'Request body must include answers (object with question data)'
      });
    }

    try {
      inspectionId = BigInt(inspectionId);
    } catch (e) {
      return res.status(400).json({
        error: 'Invalid inspectionId',
        message: 'inspectionId must be a numeric identifier'
      });
    }

    const inspection = await prisma.inspection.findUnique({
      where: { id: inspectionId },
      select: {
        id: true,
        orgId: true,
        status: true,
        assignedTo: true,
        createdBy: true,
      },
    });

    if (!inspection) {
      return res.status(404).json({
        error: 'Inspection not found',
        message: 'The specified inspection does not exist'
      });
    }

    const access = validateInspectionAccess(inspection, orgIdFromToken, req.user.id);
    if (!access.hasAccess) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this inspection'
      });
    }

    const statusValidation = validateStatus(status);
    if (!statusValidation.isValid) {
      return res.status(400).json({
        error: 'Invalid status',
        message: `Status must be one of ${statusValidation.allowedStatuses.join(', ')}`,
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Create new answers record (don't delete existing ones)
      const mainAnswer = await tx.inspectionAnswer.create({
        data: {
          inspectionId: inspectionId,
          answers: answers,
          answeredBy: userId,
          answeredAt: new Date(),
        }
      });

      // Update inspection progress and status if provided
      const shouldUpdateProgress = typeof progress === 'number';
      const shouldUpdateStatus = typeof statusValidation.normalizedStatus === 'string' && statusValidation.normalizedStatus.length > 0;

      let updatedInspection = null;
      if (shouldUpdateProgress || shouldUpdateStatus) {
        updatedInspection = await tx.inspection.update({
          where: { id: inspectionId },
          data: {
            progress: shouldUpdateProgress ? progress : undefined,
            status: shouldUpdateStatus ? statusValidation.normalizedStatus : undefined,
            completedAt: shouldUpdateStatus && statusValidation.normalizedStatus === 'SUBMITTED' ? new Date() : undefined,
            updatedBy: userId,
          },
          select: { id: true, status: true, progress: true, completedAt: true },
        });
      }

      // Audit log
      await tx.auditLog.create({
        data: {
          tableId: 'inspection_question_answers',
          recordId: inspectionId,
          action: 'CREATE',
          newData: {
            answerId: mainAnswer.id.toString(),
            status: updatedInspection?.status ?? inspection.status,
            progress: updatedInspection?.progress ?? null,
          },
          userId,
        },
      });

      return { mainAnswer, updatedInspection };
    });

    return res.json({
      message: 'Answers saved successfully',
      data: {
        inspectionId: inspection.id.toString(),
        answerId: result.mainAnswer.id.toString(),
        status: (result.updatedInspection?.status || inspection.status),
        progress: result.updatedInspection?.progress ?? null,
        answeredAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Error saving question answers:', error);
    return res.status(500).json({
      error: 'Failed to save question answers',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
});

// =============================================================================
// SECTION BY SECTION INSPECTION FLOW
// =============================================================================

// GET inspection template with sections
router.get('/:id/template', authMiddleware, async (req, res) => {
  try {
    const inspectionId = BigInt(req.params.id);
    const userId = BigInt(req.user.id);
    const orgIdFromToken = req.user.orgId;

    // Verify inspection exists and user has access
    const inspection = await prisma.inspection.findUnique({
      where: { id: inspectionId },
      select: {
        id: true,
        orgId: true,
        assignedTo: true,
        createdBy: true,
        templateId: true,
        type: true,
        title: true,
      },
    });

    if (!inspection) {
      return res.status(404).json({
        error: 'Inspection not found',
        message: 'The specified inspection does not exist'
      });
    }

    const access = validateInspectionAccess(inspection, orgIdFromToken, req.user.id);
    if (!access.hasAccess) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this inspection'
      });
    }

    // Get template with sections
    let template = null;
    if (inspection.templateId) {
      template = await prisma.inspectionTemplate.findUnique({
        where: { id: inspection.templateId },
        select: {
          id: true,
          name: true,
          type: true,
          description: true,
          questions: true,
          isActive: true,
        },
      });
    }

    // Get device information if available
    let deviceInfo = null;
    if (inspection.deviceId) {
      const device = await prisma.device.findUnique({
        where: { id: inspection.deviceId },
        select: {
          id: true,
          serialNumber: true,
          assetTag: true,
          metadata: true,
          model: {
            select: {
              id: true,
              manufacturer: true,
              model: true,
              specs: true,
            }
          }
        },
      });

      if (device) {
        deviceInfo = {
          id: device.id.toString(),
          serialNumber: device.serialNumber,
          assetTag: device.assetTag,
          location: device.metadata?.location || 'Тодорхойлогдоогүй',
          model: {
            id: device.model.id.toString(),
            manufacturer: device.model.manufacturer,
            model: device.model.model,
            specs: device.model.specs,
          },
          metadata: device.metadata,
        };
      }
    }

    if (!template) {
      return res.status(404).json({
        error: 'Template not found',
        message: 'No template found for this inspection'
      });
    }

    // Parse questions and organize by sections
    const questions = typeof template.questions === 'string' 
      ? JSON.parse(template.questions) 
      : template.questions;

    const sections = getTemplateSections(questions);

    return res.json({
      message: 'Inspection template retrieved successfully',
      data: {
        inspectionId: inspection.id.toString(),
        inspection: {
          id: inspection.id.toString(),
          title: inspection.title,
          type: inspection.type,
        },
        template: {
          id: template.id.toString(),
          name: template.name,
          type: template.type,
          description: template.description,
          isActive: template.isActive,
        },
        device: deviceInfo,
        sections: sections,
        totalSections: Object.keys(sections).length,
        totalQuestions: Object.values(sections).reduce((total, section) => total + section.questions.length, 0),
      },
    });
  } catch (error) {
    console.error('Error fetching inspection template:', error);
    return res.status(500).json({
      error: 'Failed to fetch inspection template',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
});

// GET current section questions for an inspection
router.get('/:id/section/:sectionName/questions', authMiddleware, async (req, res) => {
  try {
    const inspectionId = BigInt(req.params.id);
    const sectionName = req.params.sectionName;
    const userId = BigInt(req.user.id);
    const orgIdFromToken = req.user.orgId;

    // Verify inspection exists and user has access
    const inspection = await prisma.inspection.findUnique({
      where: { id: inspectionId },
      select: {
        id: true,
        orgId: true,
        assignedTo: true,
        createdBy: true,
        templateId: true,
        type: true,
        title: true,
      },
    });

    if (!inspection) {
      return res.status(404).json({
        error: 'Inspection not found',
        message: 'The specified inspection does not exist'
      });
    }

    const access = validateInspectionAccess(inspection, orgIdFromToken, req.user.id);
    if (!access.hasAccess) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this inspection'
      });
    }

    // Get template questions
    let template = null;
    if (inspection.templateId) {
      template = await prisma.inspectionTemplate.findUnique({
        where: { id: inspection.templateId },
        select: { questions: true },
      });
    }

    if (!template) {
      return res.status(404).json({
        error: 'Template not found',
        message: 'No template found for this inspection'
      });
    }

    const questions = typeof template.questions === 'string' 
      ? JSON.parse(template.questions) 
      : template.questions;

    const sections = getTemplateSections(questions);
    const sectionData = sections[sectionName];

    if (!sectionData) {
      return res.status(404).json({
        error: 'Section not found',
        message: `Section '${sectionName}' does not exist in this inspection template`,
        availableSections: Object.keys(sections),
      });
    }

    // Get existing answers for this section
    const existingAnswers = await getSectionAnswers(inspectionId, sectionName);

    return res.json({
      message: `Questions for section '${sectionName}' retrieved successfully`,
      data: {
        inspectionId: inspection.id.toString(),
        section: {
          name: sectionName,
          title: sectionData.title,
          order: sectionData.order,
          questions: sectionData.questions,
          totalQuestions: sectionData.questions.length,
        },
        existingAnswers: existingAnswers,
        hasExistingAnswers: Object.keys(existingAnswers).length > 0,
      },
    });
  } catch (error) {
    console.error('Error fetching section questions:', error);
    return res.status(500).json({
      error: 'Failed to fetch section questions',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
});

// GET section review (current section questions and answers for verification)
router.get('/:id/section/:sectionName/review', authMiddleware, async (req, res) => {
  try {
    const inspectionId = BigInt(req.params.id);
    const sectionName = req.params.sectionName;
    const userId = BigInt(req.user.id);
    const orgIdFromToken = req.user.orgId;

    // Verify inspection exists and user has access
    const inspection = await prisma.inspection.findUnique({
      where: { id: inspectionId },
      select: {
        id: true,
        orgId: true,
        assignedTo: true,
        createdBy: true,
        templateId: true,
        type: true,
        title: true,
      },
    });

    if (!inspection) {
      return res.status(404).json({
        error: 'Inspection not found',
        message: 'The specified inspection does not exist'
      });
    }

    const access = validateInspectionAccess(inspection, orgIdFromToken, req.user.id);
    if (!access.hasAccess) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this inspection'
      });
    }

    // Get template for section questions
    let template = null;
    if (inspection.templateId) {
      template = await prisma.inspectionTemplate.findUnique({
        where: { id: inspection.templateId },
        select: { questions: true },
      });
    }

    if (!template) {
      return res.status(404).json({
        error: 'Template not found',
        message: 'No template found for this inspection'
      });
    }

    const questions = typeof template.questions === 'string' 
      ? JSON.parse(template.questions) 
      : template.questions;

    const sections = getTemplateSections(questions);
    const currentSection = sections[sectionName];

    if (!currentSection) {
      return res.status(404).json({
        error: 'Section not found',
        message: `Section '${sectionName}' does not exist in this inspection template`,
        availableSections: Object.keys(sections),
      });
    }

    // Get answers for this specific section
    const sectionAnswers = await getSectionAnswers(inspectionId, sectionName);

    // Format questions with answers for review
    const questionsWithAnswers = currentSection.questions.map(question => {
      const answer = sectionAnswers[question.id] || {};
      return {
        id: question.id,
        question: question.question,
        type: question.type,
        options: question.options,
        textRequired: question.textRequired,
        imageRequired: question.imageRequired,
        answer: {
          status: answer.status || '',
          comment: answer.comment || '',
          images: answer.images || []
        },
        hasAnswer: !!answer.status
      };
    });

    // Get section order for navigation
    const sectionOrder = Object.keys(sections).sort((a, b) => sections[a].order - sections[b].order);
    const currentIndex = sectionOrder.indexOf(sectionName);
    const nextSection = currentIndex < sectionOrder.length - 1 ? sectionOrder[currentIndex + 1] : null;

    return res.json({
      message: `Section '${sectionName}' review data retrieved successfully`,
      data: {
        inspectionId: inspection.id.toString(),
        section: {
          name: sectionName,
          title: currentSection.title,
          order: currentSection.order,
          isLast: currentIndex === sectionOrder.length - 1
        },
        questionsWithAnswers: questionsWithAnswers,
        totalQuestions: questionsWithAnswers.length,
        answeredQuestions: questionsWithAnswers.filter(q => q.hasAnswer).length,
        nextSection: nextSection,
        sectionOrder: sectionOrder,
        currentIndex: currentIndex,
        totalSections: sectionOrder.length,
        progress: {
          current: currentIndex + 1,
          total: sectionOrder.length,
          percentage: Math.round(((currentIndex + 1) / sectionOrder.length) * 100)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching section review:', error);
    return res.status(500).json({
      error: 'Failed to fetch section review',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
});

// POST section confirmation (confirm current section and proceed to next)
router.post('/:id/section/:sectionName/confirm', authMiddleware, async (req, res) => {
  try {
    const inspectionId = BigInt(req.params.id);
    const sectionName = req.params.sectionName;
    const userId = BigInt(req.user.id);
    const orgIdFromToken = req.user.orgId;

    // Verify inspection exists and user has access
    const inspection = await prisma.inspection.findUnique({
      where: { id: inspectionId },
      select: {
        id: true,
        orgId: true,
        assignedTo: true,
        createdBy: true,
        templateId: true,
        type: true,
        title: true,
      },
    });

    if (!inspection) {
      return res.status(404).json({
        error: 'Inspection not found',
        message: 'The specified inspection does not exist'
      });
    }

    const access = validateInspectionAccess(inspection, orgIdFromToken, req.user.id);
    if (!access.hasAccess) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this inspection'
      });
    }

    // Get template for section order
    let template = null;
    if (inspection.templateId) {
      template = await prisma.inspectionTemplate.findUnique({
        where: { id: inspection.templateId },
        select: { questions: true },
      });
    }

    if (!template) {
      return res.status(404).json({
        error: 'Template not found',
        message: 'No template found for this inspection'
      });
    }

    const questions = typeof template.questions === 'string' 
      ? JSON.parse(template.questions) 
      : template.questions;

    const sections = getTemplateSections(questions);
    const sectionOrder = Object.keys(sections).sort((a, b) => sections[a].order - sections[b].order);
    const currentIndex = sectionOrder.indexOf(sectionName);
    const nextSection = currentIndex < sectionOrder.length - 1 ? sectionOrder[currentIndex + 1] : null;
    const isLastSection = currentIndex === sectionOrder.length - 1;

    // Mark section as confirmed/completed
    const result = await prisma.$transaction(async (tx) => {
      // Get existing answers
      const existingAnswers = await tx.inspectionAnswer.findFirst({
        where: { inspectionId },
        orderBy: { answeredAt: 'desc' }
      });

      let existingData = {};
      if (existingAnswers && existingAnswers.answers && existingAnswers.answers.data) {
        existingData = existingAnswers.answers.data;
      }

      // Mark current section as confirmed
      if (existingData[sectionName]) {
        existingData[sectionName].confirmed = true;
        existingData[sectionName].confirmedAt = new Date().toISOString();
      }

      const sectionAnswers = {
        data: existingData,
        section: sectionName,
        sectionStatus: 'CONFIRMED',
        confirmedAt: new Date().toISOString()
      };

      const sectionAnswer = await tx.inspectionAnswer.create({
        data: {
          inspectionId: inspectionId,
          answers: sectionAnswers,
          answeredBy: userId,
          answeredAt: new Date(),
        }
      });

      // Update inspection progress
      const progressPercentage = Math.round(((currentIndex + 1) / sectionOrder.length) * 100);
      const updatedInspection = await tx.inspection.update({
        where: { id: inspectionId },
        data: {
          progress: progressPercentage,
          status: isLastSection ? 'SUBMITTED' : 'IN_PROGRESS',
          completedAt: isLastSection ? new Date() : undefined,
          updatedBy: userId,
        },
        select: { id: true, status: true, progress: true, completedAt: true },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          tableId: 'inspection_section_confirm',
          recordId: inspectionId,
          action: 'UPDATE',
          newData: {
            section: sectionName,
            confirmed: true,
            status: updatedInspection.status,
            progress: updatedInspection.progress,
            isLastSection: isLastSection
          },
          userId,
        },
      });

      return { sectionAnswer, updatedInspection };
    });

    return res.json({
      message: `Section '${sectionName}' confirmed successfully`,
      data: {
        inspectionId: inspection.id.toString(),
        section: sectionName,
        nextSection: nextSection,
        isLastSection: isLastSection,
        isInspectionComplete: isLastSection,
        sectionOrder: sectionOrder,
        currentIndex: currentIndex,
        totalSections: sectionOrder.length,
        progress: {
          current: currentIndex + 1,
          total: sectionOrder.length,
          percentage: Math.round(((currentIndex + 1) / sectionOrder.length) * 100)
        },
        inspection: {
          status: result.updatedInspection.status,
          progress: result.updatedInspection.progress,
          completedAt: result.updatedInspection.completedAt
        }
      }
    });
  } catch (error) {
    console.error('Error confirming section:', error);
    return res.status(500).json({
      error: 'Failed to confirm section',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
});

// GET next section after completing current one
router.get('/:id/next-section/:currentSection', authMiddleware, async (req, res) => {
  try {
    const inspectionId = BigInt(req.params.id);
    const currentSection = req.params.currentSection;
    const userId = BigInt(req.user.id);
    const orgIdFromToken = req.user.orgId;

    // Verify inspection exists and user has access
    const inspection = await prisma.inspection.findUnique({
      where: { id: inspectionId },
      select: {
        id: true,
        orgId: true,
        assignedTo: true,
        createdBy: true,
        templateId: true,
        type: true,
        title: true,
      },
    });

    if (!inspection) {
      return res.status(404).json({
        error: 'Inspection not found',
        message: 'The specified inspection does not exist'
      });
    }

    const access = validateInspectionAccess(inspection, orgIdFromToken, req.user.id);
    if (!access.hasAccess) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this inspection'
      });
    }

    // Get template sections
    let template = null;
    if (inspection.templateId) {
      template = await prisma.inspectionTemplate.findUnique({
        where: { id: inspection.templateId },
        select: { questions: true },
      });
    }

    if (!template) {
      return res.status(404).json({
        error: 'Template not found',
        message: 'No template found for this inspection'
      });
    }

    const questions = typeof template.questions === 'string' 
      ? JSON.parse(template.questions) 
      : template.questions;

    const sections = getTemplateSections(questions);
    const sectionOrder = Object.keys(sections).sort((a, b) => sections[a].order - sections[b].order);

    const currentIndex = sectionOrder.indexOf(currentSection);
    const nextSection = currentIndex < sectionOrder.length - 1 ? sectionOrder[currentIndex + 1] : null;

    // Get completion status
    const completedSections = await getCompletedSections(inspectionId);

    return res.json({
      message: 'Next section information retrieved successfully',
      data: {
        inspectionId: inspection.id.toString(),
        currentSection: currentSection,
        nextSection: nextSection,
        isLastSection: currentIndex === sectionOrder.length - 1,
        isInspectionComplete: nextSection === null,
        progress: {
          current: currentIndex + 1,
          total: sectionOrder.length,
          percentage: Math.round(((currentIndex + 1) / sectionOrder.length) * 100),
        },
        completedSections: completedSections,
        sectionOrder: sectionOrder,
        navigation: {
          canGoToPrevious: currentIndex > 0,
          canGoToNext: nextSection !== null,
          previousSection: currentIndex > 0 ? sectionOrder[currentIndex - 1] : null,
          nextSection: nextSection,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching next section:', error);
    return res.status(500).json({
      error: 'Failed to fetch next section',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
});

// =============================================================================
// SECTION ANSWER ROUTES - SECTION BY SECTION SAVING
// =============================================================================

// GET section status for an inspection
router.get('/:id/section-status', authMiddleware, async (req, res) => {
  try {
    const inspectionId = BigInt(req.params.id);
    const userId = BigInt(req.user.id);
    const orgIdFromToken = req.user.orgId;

    // Verify inspection exists and user has access
    const inspection = await prisma.inspection.findUnique({
      where: { id: inspectionId },
      select: {
        id: true,
        orgId: true,
        assignedTo: true,
        createdBy: true,
      },
    });

    if (!inspection) {
      return res.status(404).json({
        error: 'Inspection not found',
        message: 'The specified inspection does not exist'
      });
    }

    const access = validateInspectionAccess(inspection, orgIdFromToken, req.user.id);
    if (!access.hasAccess) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this inspection'
      });
    }

    // Get all section answers for this inspection
    const sectionAnswers = await prisma.inspectionAnswer.findMany({
      where: { inspectionId },
      orderBy: { answeredAt: 'asc' },
      select: {
        id: true,
        answers: true,
        answeredBy: true,
        answeredAt: true,
      },
    });

    // Extract section statuses
    const sectionStatuses = {};
    sectionAnswers.forEach(answer => {
      const answerData = answer.answers;
      if (answerData && answerData.sectionStatus) {
        const sectionName = answerData.section || 'unknown';
        sectionStatuses[sectionName] = {
          status: answerData.sectionStatus,
          completedAt: answerData.completedAt,
          answeredAt: answer.answeredAt,
          answeredBy: answer.answeredBy?.toString(),
        };
      }
    });

    return res.json({
      message: 'Section status retrieved successfully',
      data: {
        inspectionId: inspection.id.toString(),
        sectionStatuses,
        totalSections: Object.keys(sectionStatuses).length,
        completedSections: Object.values(sectionStatuses).filter(s => s.status === 'COMPLETED').length,
        inProgressSections: Object.values(sectionStatuses).filter(s => s.status === 'IN_PROGRESS').length,
        skippedSections: Object.values(sectionStatuses).filter(s => s.status === 'SKIPPED').length,
      },
    });
  } catch (error) {
    console.error('Error fetching section status:', error);
    return res.status(500).json({
      error: 'Failed to fetch section status',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
});

// GET section review (show questions and answers for verification)
router.get('/:id/section-review/:section', authMiddleware, async (req, res) => {
  try {
    const inspectionId = BigInt(req.params.id);
    const section = req.params.section;
    const userId = BigInt(req.user.id);
    const orgIdFromToken = req.user.orgId;

    // Verify inspection exists and user has access
    const inspection = await prisma.inspection.findUnique({
      where: { id: inspectionId },
      select: {
        id: true,
        orgId: true,
        assignedTo: true,
        createdBy: true,
      },
    });

    if (!inspection) {
      return res.status(404).json({
        error: 'Inspection not found',
        message: 'The specified inspection does not exist'
      });
    }

    const access = validateInspectionAccess(inspection, orgIdFromToken, req.user.id);
    if (!access.hasAccess) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this inspection'
      });
    }

    // Get section answers for review
    // First get all answers for this inspection, then filter by section
    const allAnswers = await prisma.inspectionAnswer.findMany({
      where: { 
        inspectionId: inspectionId
      },
      orderBy: { answeredAt: 'desc' },
      select: {
        id: true,
        answers: true,
        answeredBy: true,
        answeredAt: true,
      },
    });

    // Filter answers that contain the specific section
    const sectionAnswers = allAnswers.filter(answer => {
      const answerData = answer.answers || {};
      return answerData.section === section;
    });

    console.log(`Section review debug for inspection ${inspectionId}, section '${section}':`, {
      totalAnswers: allAnswers.length,
      sectionAnswers: sectionAnswers.length,
      allAnswerSections: allAnswers.map(a => a.answers?.section).filter(Boolean),
      requestedSection: section
    });

    if (sectionAnswers.length === 0) {
      return res.status(404).json({
        error: 'Section not found',
        message: `No answers found for section '${section}'`,
        debug: {
          totalAnswers: allAnswers.length,
          availableSections: allAnswers.map(a => a.answers?.section).filter(Boolean),
          requestedSection: section
        }
      });
    }

    const latestAnswer = sectionAnswers[0];
    const answerData = latestAnswer.answers || {};

    // Extract questions and answers for review with detailed information
    const questionAnswerPairs = [];
    const excludedKeys = ['sectionStatus', 'completedAt', 'section', 'sessionStartedAt', 'lastUpdatedAt'];
    
    Object.entries(answerData).forEach(([key, value]) => {
      if (!excludedKeys.includes(key)) {
        // Parse the value to extract question details
        let questionText = key;
        let answerText = value;
        let images = [];
        let additionalInfo = {};

        // If value is an object, extract detailed information
        if (typeof value === 'object' && value !== null) {
          questionText = value.question || value.questionText || key;
          answerText = value.answer || value.answerText || value.value || JSON.stringify(value);
          images = value.images || value.photos || [];
          additionalInfo = {
            type: value.type || 'text',
            required: value.required || false,
            options: value.options || [],
            notes: value.notes || '',
            timestamp: value.timestamp || null
          };
        }

        questionAnswerPairs.push({
          questionId: key,
          questionText: questionText,
          answerText: answerText,
          images: images,
          additionalInfo: additionalInfo,
          rawValue: value
        });
      }
    });

    const reviewData = {
      section: section,
      questionAnswerPairs: questionAnswerPairs,
      metadata: {
        answeredAt: latestAnswer.answeredAt,
        answeredBy: latestAnswer.answeredBy?.toString(),
        sectionStatus: answerData.sectionStatus || 'IN_PROGRESS',
        completedAt: answerData.completedAt || null,
        totalQuestions: questionAnswerPairs.length,
        sessionStartedAt: answerData.sessionStartedAt,
        lastUpdatedAt: answerData.lastUpdatedAt
      }
    };

    return res.json({
      message: `Section '${section}' review data retrieved successfully`,
      data: {
        inspectionId: inspection.id.toString(),
        review: reviewData,
        summary: {
          section: section,
          totalQuestions: reviewData.metadata.totalQuestions,
          status: reviewData.metadata.sectionStatus,
          answeredAt: reviewData.metadata.answeredAt,
          isCompleted: reviewData.metadata.sectionStatus === 'COMPLETED',
          sessionStartedAt: reviewData.metadata.sessionStartedAt,
          lastUpdatedAt: reviewData.metadata.lastUpdatedAt
        }
      },
    });
  } catch (error) {
    console.error('Error fetching section review:', error);
    return res.status(500).json({
      error: 'Failed to fetch section review',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
});

// POST complete a section (mark section as completed)
router.post('/:id/complete-section', authMiddleware, async (req, res) => {
  try {
    const inspectionId = BigInt(req.params.id);
    const userId = BigInt(req.user.id);
    const orgIdFromToken = req.user.orgId;

    const { section } = req.body;

    if (!section) {
      return res.status(400).json({
        error: 'Missing section',
        message: 'Request body must include section name'
      });
    }

    // Verify inspection exists and user has access
    const inspection = await prisma.inspection.findUnique({
      where: { id: inspectionId },
      select: {
        id: true,
        orgId: true,
        assignedTo: true,
        createdBy: true,
      },
    });

    if (!inspection) {
      return res.status(404).json({
        error: 'Inspection not found',
        message: 'The specified inspection does not exist'
      });
    }

    const access = validateInspectionAccess(inspection, orgIdFromToken, req.user.id);
    if (!access.hasAccess) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this inspection'
      });
    }

    // Find the latest answer record for this inspection
    const latestAnswer = await prisma.inspectionAnswer.findFirst({
      where: { inspectionId },
      orderBy: { answeredAt: 'desc' }
    });

    if (!latestAnswer) {
      return res.status(404).json({
        error: 'No answers found',
        message: 'No answers found for this inspection'
      });
    }

    // Update the answer record to mark section as completed
    const updatedAnswer = await prisma.inspectionAnswer.update({
      where: { id: latestAnswer.id },
      data: {
        answers: {
          ...latestAnswer.answers,
          sectionStatus: 'COMPLETED',
          completedAt: new Date().toISOString()
        },
        answeredBy: userId,
        answeredAt: new Date(),
      }
    });

    return res.json({
      message: `Section '${section}' completed successfully`,
      data: {
        inspectionId: inspection.id.toString(),
        section: section,
        status: 'COMPLETED',
        completedAt: updatedAnswer.answers.completedAt,
        answeredAt: updatedAnswer.answeredAt,
      },
    });
  } catch (error) {
    console.error('Error completing section:', error);
    return res.status(500).json({
      error: 'Failed to complete section',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
});

// GET section answers for an inspection
router.get('/:id/section-answers', authMiddleware, async (req, res) => {
  try {
    const inspectionId = BigInt(req.params.id);
    const userId = BigInt(req.user.id);
    const orgIdFromToken = req.user.orgId;

    // Verify inspection exists and user has access
    const inspection = await prisma.inspection.findUnique({
      where: { id: inspectionId },
      select: {
        id: true,
        orgId: true,
        assignedTo: true,
        createdBy: true,
      },
    });

    if (!inspection) {
      return res.status(404).json({
        error: 'Inspection not found',
        message: 'The specified inspection does not exist'
      });
    }

    const access = validateInspectionAccess(inspection, orgIdFromToken, req.user.id);
    if (!access.hasAccess) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this inspection'
      });
    }

    // Get all section answers for this inspection
    const sectionAnswers = await prisma.inspectionAnswer.findMany({
      where: { inspectionId },
      orderBy: { answeredAt: 'asc' },
      select: {
        id: true,
        answers: true,
        answeredBy: true,
        answeredAt: true,
        createdAt: true,
      },
    });

    // Group answers by session
    const groupedAnswers = {};
    sectionAnswers.forEach(answer => {
      const answerData = answer.answers;
      if (answerData) {
        const sessionId = answer.id.toString();
        groupedAnswers[sessionId] = {
          sessionId: sessionId,
          sessionStartedAt: answerData.sessionStartedAt,
          lastUpdatedAt: answerData.lastUpdatedAt,
          answeredBy: answer.answeredBy?.toString(),
          answeredAt: answer.answeredAt,
          currentSection: answerData.currentSection,
          mergedAnswers: answerData.mergedAnswers || {},
          sectionHistory: answerData.sectionHistory || [],
          totalQuestions: Object.keys(answerData.mergedAnswers || {}).length
        };
      }
    });

    console.log(`Retrieved section answers for inspection ${inspectionId}:`, {
      totalSessions: Object.keys(groupedAnswers).length,
      totalAnswers: sectionAnswers.length,
      sessions: Object.keys(groupedAnswers)
    });

    return res.json({
      message: 'Section answers retrieved successfully',
      data: {
        inspectionId: inspection.id.toString(),
        sessions: groupedAnswers,
        totalSessions: Object.keys(groupedAnswers).length,
        totalAnswers: sectionAnswers.length,
        summary: {
          message: `Found ${Object.keys(groupedAnswers).length} inspection session(s) with ${sectionAnswers.length} total answer record(s)`,
          note: "All section answers are merged into one answers object. Section history is preserved for tracking."
        }
      },
    });
  } catch (error) {
    console.error('Error fetching section answers:', error);
    return res.status(500).json({
      error: 'Failed to fetch section answers',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
});

// POST save section answers (section by section saving with smart data management)
router.post('/section-answers', authMiddleware, async (req, res) => {
  try {
    let inspectionId = req.body.inspectionId;
    const userId = BigInt(req.user.id);
    const orgIdFromToken = req.user.orgId;

    const { section, answers, progress, status, sectionStatus } = req.body || {};

    if (!section || !answers) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Request body must include section and answers'
      });
    }

    // Validate section status if provided
    const validSectionStatuses = ['IN_PROGRESS', 'COMPLETED', 'SKIPPED'];
    const normalizedSectionStatus = sectionStatus && validSectionStatuses.includes(sectionStatus.toUpperCase()) 
      ? sectionStatus.toUpperCase() 
      : 'IN_PROGRESS';

    try {
      inspectionId = BigInt(inspectionId);
    } catch (e) {
      return res.status(400).json({
        error: 'Invalid inspectionId',
        message: 'inspectionId must be a numeric identifier'
      });
    }

    // Verify inspection exists and user has access
    const inspection = await prisma.inspection.findUnique({
      where: { id: inspectionId },
      select: {
        id: true,
        orgId: true,
        status: true,
        assignedTo: true,
        createdBy: true,
        templateId: true,
        type: true,
      },
    });

    if (!inspection) {
      return res.status(404).json({
        error: 'Inspection not found',
        message: 'The specified inspection does not exist'
      });
    }

    const access = validateInspectionAccess(inspection, orgIdFromToken, req.user.id);
    if (!access.hasAccess) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this inspection'
      });
    }

    const statusValidation = validateStatus(status);
    if (!statusValidation.isValid) {
      return res.status(400).json({
        error: 'Invalid status',
        message: `Status must be one of ${statusValidation.allowedStatuses.join(', ')}`,
      });
    }

    // Get template to determine section order and total sections
    let template = null;
    if (inspection.templateId) {
      template = await prisma.inspectionTemplate.findUnique({
        where: { id: inspection.templateId },
        select: { questions: true },
      });
    }

    if (!template) {
      return res.status(404).json({
        error: 'Template not found',
        message: 'No template found for this inspection'
      });
    }

    const questions = typeof template.questions === 'string' 
      ? JSON.parse(template.questions) 
      : template.questions;

    const sections = getTemplateSections(questions);
    const sectionOrder = Object.keys(sections).sort((a, b) => sections[a].order - sections[b].order);
    const currentSectionIndex = sectionOrder.indexOf(section);
    const isLastSection = currentSectionIndex === sectionOrder.length - 1;

    // Check if this is completion (status = SUBMITTED or last section completed)
    const isCompletion = statusValidation.normalizedStatus === 'SUBMITTED' || 
                        (normalizedSectionStatus === 'COMPLETED' && isLastSection);
    
    console.log(`Processing section '${section}' for inspection ${inspectionId}:`, {
      section,
      currentIndex: currentSectionIndex,
      totalSections: sectionOrder.length,
      isLastSection,
      sectionStatus: normalizedSectionStatus,
      isCompletion,
      status: statusValidation.normalizedStatus
    });

    const result = await prisma.$transaction(async (tx) => {
      let sectionAnswer;

      try {
        if (isCompletion) {
          // If completing inspection, merge all previous sections and create final record
          console.log(`Completing inspection - merging all sections and creating final record`);
          
          // Get all previous section answers
          const allPreviousAnswers = await tx.inspectionAnswer.findMany({
            where: { inspectionId: inspectionId },
            orderBy: { answeredAt: 'asc' }
          });
          
          console.log(`Found ${allPreviousAnswers.length} previous section records to merge:`, 
            allPreviousAnswers.map(a => ({ id: a.id.toString(), answeredAt: a.answeredAt }))
          );
          
          // Merge all previous answers with current section
          let mergedData = {};
          allPreviousAnswers.forEach(prevAnswer => {
            const prevData = prevAnswer.answers || {};
            if (prevData.data) {
              Object.keys(prevData.data).forEach(sectionName => {
                if (!mergedData[sectionName]) {
                  mergedData[sectionName] = {};
                }
                mergedData[sectionName] = { ...mergedData[sectionName], ...prevData.data[sectionName] };
              });
            }
          });
          
          // Add current section answers
          mergedData[section] = answers;
          
          const finalAnswers = {
            data: mergedData,
            section: section,
            sectionStatus: 'COMPLETED',
            completedAt: new Date().toISOString()
          };
          
          console.log(`Merged all sections:`, {
            previousSections: allPreviousAnswers.length,
            currentSection: section,
            totalSections: Object.keys(mergedData).length,
            mergedKeys: Object.keys(mergedData)
          });
          
          // Delete all previous section records FIRST
          const deleteResult = await tx.inspectionAnswer.deleteMany({
            where: { inspectionId: inspectionId }
          });
          
          console.log(`Deleted ${deleteResult.count} previous section records (expected: ${allPreviousAnswers.length})`);
          
          // Create final merged record AFTER deletion
          sectionAnswer = await tx.inspectionAnswer.create({
            data: {
              inspectionId: inspectionId,
              answers: finalAnswers,
              answeredBy: userId,
              answeredAt: new Date(),
            }
          });
          
          console.log(`Created final merged record ${sectionAnswer.id} with all sections`);
        } else {
          // For regular sections, create new record to preserve data
          console.log(`Creating new answer record for section '${section}'`);
          
          // Get existing data to merge with current section
          const existingAnswers = await tx.inspectionAnswer.findFirst({
            where: { inspectionId: inspectionId },
            orderBy: { answeredAt: 'desc' }
          });
          
          let existingData = {};
          if (existingAnswers && existingAnswers.answers && existingAnswers.answers.data) {
            existingData = existingAnswers.answers.data;
          }
          
          // Add current section to existing data
          existingData[section] = answers;
          
          const sectionAnswers = {
            data: existingData,
            section: section,
            sectionStatus: normalizedSectionStatus,
            completedAt: normalizedSectionStatus === 'COMPLETED' ? new Date().toISOString() : null
          };
          
          sectionAnswer = await tx.inspectionAnswer.create({
            data: {
              inspectionId: inspectionId,
              answers: sectionAnswers,
              answeredBy: userId,
              answeredAt: new Date(),
            }
          });
          
          console.log(`Created new answer record ${sectionAnswer.id} for section '${section}'`);
        }
      } catch (transactionError) {
        console.error('Transaction error:', transactionError);
        throw transactionError;
      }

      // Update inspection progress and status if provided
      const shouldUpdateProgress = typeof progress === 'number';
      const shouldUpdateStatus = typeof statusValidation.normalizedStatus === 'string' && statusValidation.normalizedStatus.length > 0;

      let updatedInspection = null;
      if (shouldUpdateProgress || shouldUpdateStatus) {
        updatedInspection = await tx.inspection.update({
          where: { id: inspectionId },
          data: {
            progress: shouldUpdateProgress ? progress : undefined,
            status: shouldUpdateStatus ? statusValidation.normalizedStatus : undefined,
            completedAt: shouldUpdateStatus && statusValidation.normalizedStatus === 'SUBMITTED' ? new Date() : undefined,
            updatedBy: userId,
          },
          select: { id: true, status: true, progress: true, completedAt: true },
        });
      }

      // Audit log
      await tx.auditLog.create({
        data: {
          tableId: 'inspection_section_answers',
          recordId: inspectionId,
          action: 'CREATE',
          newData: {
            section: section,
            answerId: sectionAnswer.id.toString(),
            status: updatedInspection?.status ?? inspection.status,
            progress: updatedInspection?.progress ?? null,
            isCompletion: isCompletion,
            totalQuestions: Object.keys(sectionAnswer.answers?.data || {}).length,
            dataPersistence: isCompletion 
              ? 'Inspection completed - all sections merged into final record'
              : 'Data preservation - each section preserved separately to prevent data loss'
          },
          userId,
        },
      });

      return { sectionAnswer, updatedInspection };
    });

    // Get next section information
    const nextSection = currentSectionIndex < sectionOrder.length - 1 ? sectionOrder[currentSectionIndex + 1] : null;
    const completedSections = await getCompletedSections(inspectionId);

    // Generate response message
    const baseMessage = isCompletion 
      ? `Section '${section}' completed successfully. Inspection finished!`
      : `Section '${section}' saved successfully. ${nextSection ? `Next: ${nextSection}` : 'This was the last section.'}`;
    
    console.log(`Response for section '${section}':`, {
      isCompletion,
      answerId: result.sectionAnswer.id.toString(),
      nextSection,
      isLastSection,
      totalQuestions: Object.keys(result.sectionAnswer.answers?.data || {}).length,
    });

    return res.json({
      message: baseMessage,
      data: {
        inspectionId: inspection.id.toString(),
        answerId: result.sectionAnswer.id.toString(),
        section: section,
        status: (result.updatedInspection?.status || inspection.status),
        progress: result.updatedInspection?.progress ?? null,
        answeredAt: result.sectionAnswer.answeredAt,
        isCompletion: isCompletion,
        isLastSection: isLastSection,
        nextSection: nextSection,
        sectionOrder: sectionOrder,
        currentSectionIndex: currentSectionIndex,
        totalSections: sectionOrder.length,
        completedSections: completedSections,
        navigation: {
          canGoToNext: nextSection !== null,
          canGoToPrevious: currentSectionIndex > 0,
          nextSection: nextSection,
          previousSection: currentSectionIndex > 0 ? sectionOrder[currentSectionIndex - 1] : null,
        },
      },
    });
  } catch (error) {
    console.error('Error saving section answers:', error);
    return res.status(500).json({
      error: 'Failed to save section answers',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
});

// GET device information for inspection (model and location from metadata)
router.get('/:id/device-info', authMiddleware, async (req, res) => {
  try {
    const inspectionId = BigInt(req.params.id);
    const userId = BigInt(req.user.id);
    const orgIdFromToken = req.user.orgId;

    // Verify inspection exists and user has access
    const inspection = await prisma.inspection.findUnique({
      where: { id: inspectionId },
      select: {
        id: true,
        orgId: true,
        deviceId: true,
        assignedTo: true,
        createdBy: true,
      },
    });

    if (!inspection) {
      return res.status(404).json({
        error: 'Inspection not found',
        message: 'The specified inspection does not exist'
      });
    }

    const access = validateInspectionAccess(inspection, orgIdFromToken, req.user.id);
    if (!access.hasAccess) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this inspection'
      });
    }

    if (!inspection.deviceId) {
      return res.status(404).json({
        error: 'Device not found',
        message: 'No device associated with this inspection'
      });
    }

    // Get device information with model details
    const device = await prisma.device.findUnique({
      where: { id: inspection.deviceId },
      select: {
        id: true,
        serialNumber: true,
        assetTag: true,
        metadata: true,
        model: {
          select: {
            id: true,
            manufacturer: true,
            model: true,
            specs: true,
          }
        }
      },
    });

    if (!device) {
      return res.status(404).json({
        error: 'Device not found',
        message: 'The device associated with this inspection does not exist'
      });
    }

    // Extract location from metadata
    const location = device.metadata?.location || 'Тодорхойлогдоогүй';

    return res.json({
      message: 'Device information retrieved successfully',
      data: {
        inspectionId: inspection.id.toString(),
        device: {
          id: device.id.toString(),
          serialNumber: device.serialNumber,
          assetTag: device.assetTag,
          location: location,
          model: {
            id: device.model.id.toString(),
            manufacturer: device.model.manufacturer,
            model: device.model.model,
            specs: device.model.specs,
          },
          metadata: device.metadata,
        }
      }
    });
  } catch (error) {
    console.error('Error fetching device information:', error);
    return res.status(500).json({
      error: 'Failed to fetch device information',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
});

module.exports = router;