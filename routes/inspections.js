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
    orderBy: { answeredAt: 'asc' },
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
  // Start from the end to get the most recent answer
  for (let i = answers.length - 1; i >= 0; i--) {
    const answer = answers[i];
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

/**
 * Sort section data according to template field order
 * @param {Object} sectionData - Raw section data from frontend
 * @param {string} sectionName - Section name
 * @param {Object} sections - Template sections
 * @returns {Object} Sorted section data
 */
function sortSectionDataByTemplate(sectionData, sectionName, sections) {
  if (!sectionData || !sections[sectionName]) {
    return sectionData;
  }

  const templateSection = sections[sectionName];
  const sortedData = {};

  // Sort according to template field order
  templateSection.questions.forEach(question => {
    const fieldId = question.id;
    // Try different possible keys (camelCase, snake_case, etc.)
    const possibleKeys = [
      fieldId,  // Original field ID
      `field_${fieldId}`,  // field_ prefix added
      fieldId.replace(/_/g, ''),
      fieldId.replace(/_status$/, ''),
      fieldId.replace(/_status$/, '').replace(/_/g, ''),
      // Convert to camelCase
      fieldId.replace(/_status$/, '').replace(/_([a-z])/g, (match, letter) => letter.toUpperCase())
    ];

    // Find the matching key in sectionData
    let found = false;
    for (const key of possibleKeys) {
      if (sectionData[key]) {
        sortedData[key] = sectionData[key];
        found = true;
        break;
      }
    }
    
    if (!found) {
      console.warn(`Field '${fieldId}' not found in section '${sectionName}'. Available keys:`, Object.keys(sectionData));
    }
  });

  // Add any remaining fields that weren't found in template
  Object.keys(sectionData).forEach(key => {
    if (!sortedData[key]) {
      sortedData[key] = sectionData[key];
    }
  });

  return sortedData;
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

// GET assigned inspections by type (RESTful approach)
router.get('/assigned/type/:type', authMiddleware, async (req, res) => {
  try {
    const { type } = req.params;
    const userId = BigInt(req.user.id);

    // Validate type parameter
    const validTypes = ['INSPECTION', 'INSTALLATION', 'MAINTENANCE', 'VERIFICATION'];
    const normalizedType = type.toUpperCase();
    
    if (!validTypes.includes(normalizedType)) {
      return res.status(400).json({
        error: 'Invalid inspection type',
        message: `Type must be one of: ${validTypes.join(', ')}`,
        validTypes,
      });
    }

    const inspections = await getAssignedInspectionsByType(userId, normalizedType);

    res.json({
      message: `Assigned ${normalizedType} inspections fetched successfully`,
      data: inspections,
      count: inspections.length,
      type: normalizedType,
    });
  } catch (error) {
    console.error(`Error fetching assigned ${req.params.type} inspections:`, error);
    res.status(500).json({
      error: 'Failed to fetch assigned inspections',
      message: process.env.NODE_ENV === 'development'
        ? error.message
        : 'Internal server error',
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
          },
          organization: {
            select: {
              id: true,
              name: true,
              code: true,
            }
          },
          site: {
            select: {
              id: true,
              name: true,
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
            id: device.model?.id?.toString(),
            manufacturer: device.model?.manufacturer,
            model: device.model?.model,
            specs: device.model?.specs,
          },
          organization: device.organization ? {
            id: device.organization.id.toString(),
            name: device.organization.name,
            code: device.organization.code,
          } : null,
          site: device.site ? {
            id: device.site.id.toString(),
            name: device.site.name,
          } : null,
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
        data: existingData
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
      orderBy: { answeredAt: 'asc' },
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
      return answerData.data && answerData.data[section];
    });

    // Debug info for section review
    console.log(`Section review for inspection ${inspectionId}, section '${section}':`, {
      totalAnswers: allAnswers.length,
      sectionAnswers: sectionAnswers.length,
      availableSections: allAnswers.map(a => {
        const data = a.answers?.data;
        return data ? Object.keys(data) : [];
      }).flat(),
      requestedSection: section
    });

    if (sectionAnswers.length === 0) {
      return res.status(404).json({
        error: 'Section not found',
        message: `No answers found for section '${section}'`,
        debug: {
          totalAnswers: allAnswers.length,
          availableSections: allAnswers.map(a => {
            const data = a.answers?.data;
            return data ? Object.keys(data) : [];
          }).flat(),
          requestedSection: section
        }
      });
    }

    // Get the latest answer (last in the array since we ordered by asc)
    const latestAnswer = sectionAnswers[sectionAnswers.length - 1];
    const answerData = latestAnswer.answers || {};
    const sectionData = answerData.data?.[section] || {};

    // Extract questions and answers for review with detailed information
    const questionAnswerPairs = [];
    const excludedKeys = ['sectionStatus', 'completedAt', 'section', 'sessionStartedAt', 'lastUpdatedAt'];
    
    Object.entries(sectionData).forEach(([key, value]) => {
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
      inspectionMetadata: answerData.metadata || null,
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
        const sections = answerData.data || {};
        const allSections = Object.keys(sections);
        
        // Count total questions across all sections
        let totalQuestions = 0;
        Object.values(sections).forEach(sectionData => {
          totalQuestions += Object.keys(sectionData).length;
        });
        
        groupedAnswers[sessionId] = {
          sessionId: sessionId,
          sessionStartedAt: answerData.sessionStartedAt,
          lastUpdatedAt: answerData.lastUpdatedAt,
          answeredBy: answer.answeredBy?.toString(),
          answeredAt: answer.answeredAt,
          sections: allSections,
          sectionData: sections,
          metadata: answerData.metadata || null,
          totalQuestions: totalQuestions,
          totalSections: allSections.length
        };
      }
    });

    // Debug info for section answers
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
          note: "All section answers are organized by sections with separate metadata storage."
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

// POST initialize inspection metadata (called before starting first section)
router.post('/initialize-metadata', authMiddleware, async (req, res) => {
  try {
    console.log('=== Initialize Metadata Request ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));

    const { date, inspector, location, scale_id_serial_no, model, deviceId } = req.body;
    const userId = BigInt(req.user.id);

    // Just acknowledge - metadata will be sent with first section
    return res.json({
      message: 'Metadata received - will be saved with first section',
      data: {
        metadata: { date, inspector, location, scale_id_serial_no, model },
        note: 'Send this metadata along with first section answers'
      }
    });
  } catch (error) {
    console.error('Error initializing metadata:', error);
    return res.status(500).json({
      error: 'Failed to initialize metadata',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
});

// POST save section answers (section by section saving with smart data management)
router.post('/section-answers', authMiddleware, async (req, res) => {
  try {
    // Log incoming request for debugging
    console.log('=== Section Answers Request ===');
    console.log('Request body keys:', Object.keys(req.body));
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    let inspectionId = req.body.inspectionId;
    const userId = BigInt(req.user.id);
    const orgIdFromToken = req.user.orgId;

    const { 
      section, 
      answers, 
      progress, 
      status, 
      sectionStatus, 
      data, 
      answerId,
      sectionIndex,
      isFirstSection 
    } = req.body || {};

    // Enhanced validation with detailed error messages
    if (!inspectionId) {
      console.error('Validation failed: Missing inspectionId');
      return res.status(400).json({
        error: 'Missing required field: inspectionId',
        message: 'inspectionId is required',
        received: { inspectionId }
      });
    }

    if (!section) {
      console.error('Validation failed: Missing section');
      return res.status(400).json({
        error: 'Missing required field: section',
        message: 'section is required',
        received: { section }
      });
    }

    if (!answers) {
      console.error('Validation failed: Missing answers');
      return res.status(400).json({
        error: 'Missing required field: answers',
        message: 'answers object is required',
        received: { answers, answersType: typeof answers }
      });
    }

    // Check if answers is an object
    if (typeof answers !== 'object' || Array.isArray(answers)) {
      console.error('Validation failed: answers must be an object');
      return res.status(400).json({
        error: 'Invalid answers format',
        message: 'answers must be a non-array object',
        received: { answersType: typeof answers, isArray: Array.isArray(answers) }
      });
    }

    // Validate section status if provided
    const validSectionStatuses = ['IN_PROGRESS', 'COMPLETED', 'SKIPPED'];
    const normalizedSectionStatus = sectionStatus && validSectionStatuses.includes(sectionStatus.toUpperCase()) 
      ? sectionStatus.toUpperCase() 
      : 'IN_PROGRESS';

    // Convert and validate inspectionId
    try {
      inspectionId = BigInt(inspectionId);
      console.log('InspectionId converted to BigInt:', inspectionId.toString());
    } catch (e) {
      console.error('Failed to convert inspectionId to BigInt:', e.message);
      return res.status(400).json({
        error: 'Invalid inspectionId',
        message: 'inspectionId must be a numeric identifier',
        received: { inspectionId: req.body.inspectionId, type: typeof req.body.inspectionId },
        details: e.message
      });
    }

    // Verify inspection exists and user has access
    console.log('Looking for inspection with ID:', inspectionId.toString());
    console.log('User ID:', userId.toString());
    console.log('User orgId:', orgIdFromToken);
    
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
      console.error('❌ Inspection not found in database');
      return res.status(404).json({
        error: 'Inspection not found',
        message: 'The specified inspection does not exist',
        debug: {
          inspectionId: inspectionId.toString(),
          userId: userId.toString(),
          orgId: orgIdFromToken
        }
      });
    }

    console.log('✅ Inspection found:', {
      id: inspection.id.toString(),
      orgId: inspection.orgId.toString(),
      assignedTo: inspection.assignedTo?.toString(),
      createdBy: inspection.createdBy.toString(),
      templateId: inspection.templateId?.toString(),
      status: inspection.status
    });

    const access = validateInspectionAccess(inspection, orgIdFromToken, req.user.id);
    console.log('Access check:', {
      hasAccess: access.hasAccess,
      sameOrg: access.sameOrg,
      isAssignee: access.isAssignee,
      isCreator: access.isCreator
    });
    
    if (!access.hasAccess) {
      console.error('❌ Access denied');
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this inspection',
        debug: {
          userOrgId: orgIdFromToken,
          inspectionOrgId: inspection.orgId.toString(),
          userId: req.user.id,
          assignedTo: inspection.assignedTo?.toString(),
          createdBy: inspection.createdBy.toString()
        }
      });
    }

    const statusValidation = validateStatus(status);
    if (!statusValidation.isValid) {
      return res.status(400).json({
        error: 'Invalid status',
        message: `Status must be one of ${statusValidation.allowedStatuses.join(', ')}`,
      });
    }

    // Get template to determine section order (OPTIONAL)
    console.log('Looking for template with ID:', inspection.templateId?.toString());
    let template = null;
    let sections = {};
    let sectionOrder = [];
    let currentSectionIndex = -1;
    let isLastSection = false;
    
    if (inspection.templateId) {
      template = await prisma.inspectionTemplate.findUnique({
        where: { id: inspection.templateId },
        select: { questions: true },
      });
      
      if (template) {
        console.log('✅ Template found - using for validation');
        const questions = typeof template.questions === 'string' 
          ? JSON.parse(template.questions) 
          : template.questions;

        sections = getTemplateSections(questions);
        sectionOrder = Object.keys(sections).sort((a, b) => sections[a].order - sections[b].order);
        currentSectionIndex = sectionOrder.indexOf(section);
        isLastSection = currentSectionIndex === sectionOrder.length - 1;
        
        console.log('Section info:', {
          requestedSection: section,
          availableSections: sectionOrder,
          currentSectionIndex,
          isLastSection,
          totalSections: sectionOrder.length
        });
      } else {
        console.warn('⚠️ Template not found - proceeding without template validation');
        // Use sectionIndex from request if available
        if (typeof sectionIndex === 'number') {
          currentSectionIndex = sectionIndex;
        }
      }
    } else {
      console.log('ℹ️ No template assigned - proceeding without template validation');
      // Use sectionIndex from request if available
      if (typeof sectionIndex === 'number') {
        currentSectionIndex = sectionIndex;
      }
    }

    // Check if this is completion (status = SUBMITTED or last section completed)
    const isCompletion = statusValidation.normalizedStatus === 'SUBMITTED' || 
                        (normalizedSectionStatus === 'COMPLETED' && isLastSection);
    
    // Processing section data
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
      let didCreate = false;
      let extractedMetadata = null;

      try {
        // Extract metadata from first section if applicable
        if (isFirstSection === true) {
          const metadataFields = ['date', 'inspector', 'location', 'scale_id_serial_no', 'model'];
          extractedMetadata = {};
          
          metadataFields.forEach(field => {
            if (answers[field] !== undefined) {
              extractedMetadata[field] = answers[field];
            }
          });
          
          console.log('Extracted metadata from first section:', extractedMetadata);
        }

        if (isCompletion) {
          // If completing inspection, merge all previous sections and create final record
          // Completing inspection - merging all sections
          
          // Get all previous section answers
          const allPreviousAnswers = await tx.inspectionAnswer.findMany({
            where: { inspectionId: inspectionId },
            orderBy: { answeredAt: 'asc' }
          });
          
          console.log(`Merging ${allPreviousAnswers.length} previous section records`);
          
          // Merge all previous answers with current section
          let mergedData = {};
          let storedMetadata = null;
          
          allPreviousAnswers.forEach(prevAnswer => {
            const prevData = prevAnswer.answers || {};
            
            // Extract metadata if present
            if (prevData.metadata) {
              storedMetadata = { ...storedMetadata, ...prevData.metadata };
            }
            
            if (prevData.data) {
              Object.keys(prevData.data).forEach(sectionName => {
                if (!mergedData[sectionName]) {
                  mergedData[sectionName] = {};
                }
                mergedData[sectionName] = { ...mergedData[sectionName], ...prevData.data[sectionName] };
              });
            }
          });
          
          // Use extracted metadata if available, otherwise use stored metadata
          const finalMetadata = extractedMetadata || storedMetadata;
          
          // Add current section answers
          // Use data field if provided (legacy format), otherwise use answers
          let rawSectionData = data && data[section] ? data[section] : { ...answers };
          
          // Remove metadata fields from section data
          if (finalMetadata) {
            Object.keys(finalMetadata).forEach(key => {
              delete rawSectionData[key];
            });
          }
          
          // Sort section data if template is available
          const sectionData = Object.keys(sections).length > 0 
            ? sortSectionDataByTemplate(rawSectionData, section, sections)
            : rawSectionData;
          
          // Use section data as-is (template ordering is optional)
          const orderedSectionData = sectionData;
          
          mergedData[section] = orderedSectionData;
          
          // Build final answers with metadata at root level
          const finalAnswers = {
            data: mergedData
          };
          
          // Add metadata if available
          if (finalMetadata && Object.keys(finalMetadata).length > 0) {
            finalAnswers.metadata = finalMetadata;
          }
          
          console.log(`Merged ${Object.keys(mergedData).length} sections for final record`);
          
          // Delete all previous section records FIRST
          const deleteResult = await tx.inspectionAnswer.deleteMany({
            where: { inspectionId: inspectionId }
          });
          
          console.log(`Deleted ${deleteResult.count} previous section records`);
          
          // Create final merged record AFTER deletion
          sectionAnswer = await tx.inspectionAnswer.create({
            data: {
              inspectionId: inspectionId,
              answers: finalAnswers,
              answeredBy: userId,
              answeredAt: new Date(),
            }
          });
          
          console.log(`Created final merged record ${sectionAnswer.id}`);
        } else {
          // Merge into a single row per inspection, creating on first save
          // Use data field if provided (legacy format), otherwise use answers
          let rawSectionData = data && data[section] ? data[section] : { ...answers };
          
          // Remove metadata fields from section data
          if (extractedMetadata) {
            Object.keys(extractedMetadata).forEach(key => {
              delete rawSectionData[key];
            });
          }

          // Sort section data if template is available (optional)
          const sectionData = Object.keys(sections).length > 0 
            ? sortSectionDataByTemplate(rawSectionData, section, sections)
            : rawSectionData;

          // Use section data as-is (template ordering is optional)
          const orderedSectionData = sectionData;

          // Resolve target answer row: by answerId if provided, else latest by inspection
          console.log('Section-answers resolve target row:', { incomingAnswerId: answerId || null, inspectionId: inspectionId.toString(), section });
          let targetAnswer = null;
          if (answerId) {
            try {
              const lookupId = BigInt(answerId);
              const found = await tx.inspectionAnswer.findUnique({ where: { id: lookupId } });
              if (found && found.inspectionId === inspectionId) {
                targetAnswer = found;
              } else {
                console.warn('Provided answerId not found or mismatched inspectionId. Update will be skipped and a new row will be created.', { answerId });
              }
            } catch (e) {
              console.warn('Invalid answerId provided. A new row will be created.', { answerId });
            }
          }
          console.log('Target answer decision:', { exists: !!targetAnswer, targetId: targetAnswer?.id?.toString?.() || null });

          if (!targetAnswer) {
            // First section for this inspection → create new row with consistent structure
            const sectionAnswers = {
              data: {
                [section]: orderedSectionData
              }
            };
            
            // Add metadata if available (from first section)
            if (extractedMetadata && Object.keys(extractedMetadata).length > 0) {
              sectionAnswers.metadata = extractedMetadata;
            }
            
            sectionAnswer = await tx.inspectionAnswer.create({
              data: {
                inspectionId: inspectionId,
                answers: sectionAnswers,
                answeredBy: userId,
                answeredAt: new Date(),
              }
            });
            didCreate = true;
            console.log(`Created initial answer record ${sectionAnswer.id} for section '${section}'`);
          } else {
            // Merge into existing row, preserving previous data
            const existing = targetAnswer.answers || {};
            const existingData = existing.data || {};
            
            // Merge section data
            const mergedData = { 
              ...existingData, 
              [section]: { ...(existingData[section] || {}), ...orderedSectionData } 
            };
            
            // Build consistent structure
            const merged = {
              data: mergedData
            };
            
            // Preserve or update metadata
            if (extractedMetadata && Object.keys(extractedMetadata).length > 0) {
              merged.metadata = { ...(existing.metadata || {}), ...extractedMetadata };
            } else if (existing.metadata) {
              merged.metadata = existing.metadata;
            }
            
            const updatedAnswers = merged;

            sectionAnswer = await tx.inspectionAnswer.update({
              where: { id: targetAnswer.id },
              data: {
                answers: updatedAnswers,
                answeredBy: userId,
                answeredAt: new Date(),
              }
            });
            console.log(`Updated answer record ${sectionAnswer.id} by merging section '${section}'`);
          }
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
          recordId: sectionAnswer.id,
          action: 'CREATE',
          newData: {
            section: section,
            sectionIndex: sectionIndex,
            isFirstSection: isFirstSection,
            hasMetadata: !!extractedMetadata && Object.keys(extractedMetadata).length > 0,
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

      return { sectionAnswer, updatedInspection, didCreate, extractedMetadata };
    });

    // Get next section information (if template available)
    const nextSection = sectionOrder.length > 0 && currentSectionIndex >= 0 && currentSectionIndex < sectionOrder.length - 1 
      ? sectionOrder[currentSectionIndex + 1] 
      : null;
    const completedSections = await getCompletedSections(inspectionId);

    // Generate response message
    const baseMessage = isCompletion 
      ? `Section '${section}' completed successfully. Inspection finished!`
      : `Section '${section}' saved successfully. ${nextSection ? `Next: ${nextSection}` : 'This was the last section.'}`;
    
    // Response summary
    console.log(`Section '${section}' processed:`, {
      isCompletion,
      answerId: result.sectionAnswer.id.toString(),
      nextSection,
      isLastSection,
      totalQuestions: Object.keys(result.sectionAnswer.answers?.data || {}).length,
    });

    const responseBuilder = result.didCreate
      ? res.status(201).location(`/api/inspection-answers/${result.sectionAnswer.id.toString()}`)
      : res.status(200);

    return responseBuilder.json({
      message: baseMessage,
      data: {
        inspectionId: inspection.id.toString(),
        answerId: result.sectionAnswer.id.toString(),
        section: section,
        sectionIndex: sectionIndex ?? currentSectionIndex,
        status: (result.updatedInspection?.status || inspection.status),
        progress: result.updatedInspection?.progress ?? null,
        answeredAt: result.sectionAnswer.answeredAt,
        metadata: result.extractedMetadata || null,
        isCompletion: isCompletion,
        isLastSection: isLastSection,
        isFirstSection: isFirstSection,
        nextSection: nextSection,
        sectionOrder: sectionOrder.length > 0 ? sectionOrder : [section],
        currentSectionIndex: currentSectionIndex >= 0 ? currentSectionIndex : 0,
        totalSections: sectionOrder.length > 0 ? sectionOrder.length : 1,
        completedSections: completedSections,
        hasTemplate: !!template,
        navigation: {
          canGoToNext: nextSection !== null,
          canGoToPrevious: currentSectionIndex > 0,
          nextSection: nextSection,
          previousSection: currentSectionIndex > 0 && sectionOrder.length > 0 
            ? sectionOrder[currentSectionIndex - 1] 
            : null,
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

// =============================================================================
// GET /api/inspections/:id/devices - Get devices for an inspection
// =============================================================================
router.get('/:id/devices', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const inspectionId = BigInt(id);

    // Get inspection with template
    const inspection = await prisma.inspection.findUnique({
      where: { id: inspectionId },
      include: {
        template: true,
        assignee: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      }
    });

    if (!inspection) {
      return res.status(404).json({
        error: 'Inspection not found',
        message: `Inspection with ID ${id} does not exist`
      });
    }

    // Get template sections
    const templateQuestions = inspection.template?.questions || [];
    const sections = getTemplateSections(templateQuestions);

    // Get section answers
    const sectionAnswers = await prisma.inspectionAnswer.findMany({
      where: { inspectionId: inspectionId },
      orderBy: { answeredAt: 'asc' }
    });

    // Organize answers by section
    const organizedAnswers = {};
    let inspectionMetadata = null;
    
    sectionAnswers.forEach(answer => {
      const answerData = answer.answers || {};
      
      // Extract metadata if present
      if (answerData.metadata && !inspectionMetadata) {
        inspectionMetadata = answerData.metadata;
      }
      
      // Extract section data
      if (answerData.data) {
        Object.keys(answerData.data).forEach(sectionName => {
          // Merge or replace section data (latest wins)
          organizedAnswers[sectionName] = answerData.data[sectionName];
        });
      }
    });

    // Get completed sections
    const completedSections = await getCompletedSections(inspectionId);

    return res.json({
      message: 'Devices retrieved successfully',
      data: {
        inspection: {
          id: inspection.id.toString(),
          title: inspection.title,
          status: inspection.status,
          progress: inspection.progress,
          assignedTo: inspection.assignee ? {
            id: inspection.assignee.id.toString(),
            fullName: inspection.assignee.fullName,
            email: inspection.assignee.email
          } : null,
          createdAt: inspection.createdAt,
          updatedAt: inspection.updatedAt
        },
        template: {
          id: inspection.template?.id?.toString(),
          name: inspection.template?.name,
          type: inspection.template?.type,
          sections: sections,
          totalSections: Object.keys(sections).length
        },
        answers: organizedAnswers,
        metadata: inspectionMetadata,
        completedSections: completedSections,
        summary: {
          totalSections: Object.keys(sections).length,
          completedSections: completedSections.length,
          progress: inspection.progress || 0
        }
      }
    });

  } catch (error) {
    console.error('Error getting inspection devices:', error);
    return res.status(500).json({
      error: 'Failed to get inspection devices',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
});

// =============================================================================
// DEVICE MODELS ENDPOINTS
// =============================================================================

// GET all device models
router.get('/device-models', authMiddleware, async (req, res) => {
  try {
    const deviceModels = await prisma.deviceModel.findMany({
      include: {
        _count: {
          select: {
            devices: true,
          },
        },
      },
      orderBy: {
        manufacturer: 'asc',
      },
    });

    // Format response
    const formattedModels = deviceModels.map(model => ({
      id: model.id.toString(),
      manufacturer: model.manufacturer,
      model: model.model,
      specs: model.specs,
      deviceCount: model._count.devices,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    }));

    res.json({
      message: 'Device models retrieved successfully',
      data: formattedModels,
      count: formattedModels.length,
    });
  } catch (error) {
    console.error('Error fetching device models:', error);
    res.status(500).json({
      error: 'Failed to fetch device models',
      message: process.env.NODE_ENV === 'development'
        ? error.message
        : 'Internal server error',
    });
  }
});

// GET specific device model by ID
router.get('/device-models/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    const deviceModel = await prisma.deviceModel.findUnique({
      where: {
        id: BigInt(id),
      },
      include: {
        _count: {
          select: {
            devices: true,
          },
        },
        devices: {
          select: {
            id: true,
            serialNumber: true,
            assetTag: true,
            status: true,
            installedAt: true,
            organization: {
              select: {
                name: true,
                code: true,
              },
            },
            site: {
              select: {
                name: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!deviceModel) {
      return res.status(404).json({
        error: 'Device model not found',
        message: 'The requested device model does not exist',
      });
    }

    // Format response
    const formattedModel = {
      id: deviceModel.id.toString(),
      manufacturer: deviceModel.manufacturer,
      model: deviceModel.model,
      specs: deviceModel.specs,
      deviceCount: deviceModel._count.devices,
      devices: deviceModel.devices.map(device => ({
        id: device.id.toString(),
        serialNumber: device.serialNumber,
        assetTag: device.assetTag,
        status: device.status,
        installedAt: device.installedAt,
        organization: device.organization,
        site: device.site,
      })),
      createdAt: deviceModel.createdAt,
      updatedAt: deviceModel.updatedAt,
    };

    res.json({
      message: 'Device model retrieved successfully',
      data: formattedModel,
    });
  } catch (error) {
    console.error('Error fetching device model:', error);
    res.status(500).json({
      error: 'Failed to fetch device model',
      message: process.env.NODE_ENV === 'development'
        ? error.message
        : 'Internal server error',
    });
  }
});

// =============================================================================
// DEVICES ENDPOINTS
// =============================================================================

// GET all devices (for organization users)
router.get('/devices', authMiddleware, async (req, res) => {
  try {
    const orgIdFromToken = req.user.orgId;
    const {
      status,
      siteId,
      modelId,
      search,
      page = 1,
      limit = 10,
    } = req.query;

    // Build where clause
    const where = {
      orgId: BigInt(orgIdFromToken),
      deletedAt: null,
    };

    if (status) {
      where.status = status.toUpperCase();
    }

    if (siteId) {
      where.siteId = BigInt(siteId);
    }

    if (modelId) {
      where.modelId = BigInt(modelId);
    }

    if (search) {
      where.OR = [
        { serialNumber: { contains: search, mode: 'insensitive' } },
        { assetTag: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Fetch devices with related data
    const [devices, totalCount] = await Promise.all([
      prisma.device.findMany({
        where,
        include: {
          model: {
            select: {
              id: true,
              manufacturer: true,
              model: true,
              specs: true,
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
          organization: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          _count: {
            select: {
              inspections: true,
            },
          },
        },
        orderBy: [
          { status: 'asc' },
          { createdAt: 'desc' },
        ],
        skip,
        take,
      }),
      prisma.device.count({ where }),
    ]);

    // Format response
    const formattedDevices = devices.map(device => ({
      id: device.id.toString(),
      serialNumber: device.serialNumber,
      assetTag: device.assetTag,
      status: device.status,
      installedAt: device.installedAt,
      metadata: device.metadata,
      inspectionCount: device._count.inspections,
      model: device.model ? {
        id: device.model.id.toString(),
        manufacturer: device.model.manufacturer,
        model: device.model.model,
        specs: device.model.specs,
      } : null,
      site: device.site ? {
        id: device.site.id.toString(),
        name: device.site.name,
      } : null,
      contract: device.contract ? {
        id: device.contract.id.toString(),
        contractName: device.contract.contractName,
        contractNumber: device.contract.contractNumber,
      } : null,
      organization: {
        id: device.organization.id.toString(),
        name: device.organization.name,
        code: device.organization.code,
      },
      createdAt: device.createdAt,
      updatedAt: device.updatedAt,
    }));

    const totalPages = Math.ceil(totalCount / take);

    res.json({
      message: 'Devices retrieved successfully',
      data: formattedDevices,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalCount,
        totalPages,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1,
      },
    });
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({
      error: 'Failed to fetch devices',
      message: process.env.NODE_ENV === 'development'
        ? error.message
        : 'Internal server error',
    });
  }
});

// GET specific device by ID
router.get('/devices/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const orgIdFromToken = req.user.orgId;
    
    const device = await prisma.device.findFirst({
      where: {
        id: BigInt(id),
        orgId: BigInt(orgIdFromToken),
        deletedAt: null,
      },
      include: {
        model: {
          select: {
            id: true,
            manufacturer: true,
            model: true,
            specs: true,
            createdAt: true,
            updatedAt: true,
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
            startDate: true,
            endDate: true,
            metadata: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        inspections: {
          select: {
            id: true,
            title: true,
            type: true,
            status: true,
            progress: true,
            scheduledAt: true,
            completedAt: true,
            assignee: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 10, // Latest 10 inspections
        },
        _count: {
          select: {
            inspections: true,
            attachments: true,
          },
        },
      },
    });

    if (!device) {
      return res.status(404).json({
        error: 'Device not found',
        message: 'The requested device does not exist or you do not have access to it',
      });
    }

    // Format response
    const formattedDevice = {
      id: device.id.toString(),
      serialNumber: device.serialNumber,
      assetTag: device.assetTag,
      status: device.status,
      installedAt: device.installedAt,
      retiredAt: device.retiredAt,
      metadata: device.metadata,
      inspectionCount: device._count.inspections,
      attachmentCount: device._count.attachments,
      model: device.model ? {
        id: device.model.id.toString(),
        manufacturer: device.model.manufacturer,
        model: device.model.model,
        specs: device.model.specs,
        createdAt: device.model.createdAt,
        updatedAt: device.model.updatedAt,
      } : null,
      site: device.site ? {
        id: device.site.id.toString(),
        name: device.site.name,
      } : null,
      contract: device.contract ? {
        id: device.contract.id.toString(),
        contractName: device.contract.contractName,
        contractNumber: device.contract.contractNumber,
        startDate: device.contract.startDate,
        endDate: device.contract.endDate,
        metadata: device.contract.metadata,
      } : null,
      organization: {
        id: device.organization.id.toString(),
        name: device.organization.name,
        code: device.organization.code,
      },
      inspections: device.inspections.map(inspection => ({
        id: inspection.id.toString(),
        title: inspection.title,
        type: inspection.type,
        status: inspection.status,
        progress: inspection.progress,
        scheduledAt: inspection.scheduledAt,
        completedAt: inspection.completedAt,
        assignee: inspection.assignee ? {
          id: inspection.assignee.id.toString(),
          fullName: inspection.assignee.fullName,
          email: inspection.assignee.email,
        } : null,
      })),
      createdAt: device.createdAt,
      updatedAt: device.updatedAt,
    };

    res.json({
      message: 'Device retrieved successfully',
      data: formattedDevice,
    });
  } catch (error) {
    console.error('Error fetching device:', error);
    res.status(500).json({
      error: 'Failed to fetch device',
      message: process.env.NODE_ENV === 'development'
        ? error.message
        : 'Internal server error',
    });
  }
});


module.exports = router;