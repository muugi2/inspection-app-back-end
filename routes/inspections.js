const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware } = require('../middleware/auth');
const sectionAnswersService = require('../services/section-answers-service');

const router = express.Router();
const prisma = new PrismaClient();

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get section answers for a specific section
 */
async function getSectionAnswers(inspectionId, sectionName) {
  const answers = await prisma.InspectionAnswer.findMany({
    where: { inspectionId },
    orderBy: { answeredAt: 'asc' },
    select: { id: true, answers: true, answeredBy: true, answeredAt: true },
  });

  if (answers.length === 0) return {};

  // Find the latest answer that contains this section
  for (let i = answers.length - 1; i >= 0; i--) {
    const answer = answers[i];
    const answerData = answer.answers || {};
    const sectionData = answerData.data || answerData; // Support both formats
    if (sectionData[sectionName]) {
      return sectionData[sectionName];
    }
  }

  return {};
}

/**
 * Get completed sections for an inspection
 */
async function getCompletedSections(inspectionId) {
  const answers = await prisma.InspectionAnswer.findMany({
    where: { inspectionId },
    orderBy: { answeredAt: 'asc' },
    select: { answers: true, answeredAt: true },
  });

  const completedSections = [];
  const sectionNames = ['exterior', 'indicator', 'jbox', 'sensor', 'foundation', 'cleanliness'];
  
  answers.forEach(answer => {
    const answerData = answer.answers || {};
    const sectionData = answerData.data || answerData; // Support both formats
    if (sectionData) {
      sectionNames.forEach(sectionName => {
        if (sectionData[sectionName] && !completedSections.find(s => s.section === sectionName)) {
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
 */
async function getAssignedInspectionsByType(userId, inspectionType = null) {
  const whereClause = {
    assignedTo: userId,
    deletedAt: null,
  };

  if (inspectionType) whereClause.type = inspectionType;

  const inspections = await prisma.Inspection.findMany({
    where: whereClause,
    include: {
      device: { select: { id: true, serialNumber: true, assetTag: true, model: { select: { manufacturer: true, model: true } } } },
      site: { select: { id: true, name: true } },
      contract: { select: { id: true, contractName: true, contractNumber: true } },
      createdByUser: { select: { id: true, fullName: true, email: true } },
      template: { select: { id: true, name: true, type: true } },
    },
    orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'desc' }],
  });

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
    device: inspection.device ? { ...inspection.device, id: inspection.device.id.toString() } : null,
    site: inspection.site ? { ...inspection.site, id: inspection.site.id.toString() } : null,
    contract: inspection.contract ? { ...inspection.contract, id: inspection.contract.id.toString() } : null,
    createdByUser: { ...inspection.createdByUser, id: inspection.createdByUser.id.toString() },
    template: inspection.template ? { ...inspection.template, id: inspection.template.id.toString() } : null,
  }));
}

/**
 * Check user access to inspection
 */
function checkInspectionAccess(inspection, orgIdFromToken, userId) {
  const sameOrg = inspection.orgId.toString() === orgIdFromToken;
  const isAssignee = inspection.assignedTo?.toString() === userId;
  const isCreator = inspection.createdBy.toString() === userId;
  return sameOrg || isAssignee || isCreator;
}

/**
 * Common inspection verification and access check
 */
async function verifyInspectionAccess(inspectionId, userId, orgIdFromToken, selectFields = {}) {
  const defaultSelect = {
    id: true, orgId: true, assignedTo: true, createdBy: true, templateId: true, type: true, title: true
  };
  
  const inspection = await prisma.Inspection.findUnique({
    where: { id: inspectionId },
    select: { ...defaultSelect, ...selectFields },
  });

  if (!inspection) {
    throw new Error('Inspection not found');
  }

  if (!checkInspectionAccess(inspection, orgIdFromToken, userId)) {
    throw new Error('You do not have access to this inspection');
  }

  return inspection;
}

/**
 * Get template and sections for inspection
 */
async function getTemplateAndSections(inspection) {
  let template = null;
  if (inspection.templateId) {
    template = await prisma.InspectionTemplate.findUnique({
      where: { id: inspection.templateId },
      select: { id: true, name: true, type: true, description: true, questions: true, isActive: true },
    });
  }

  if (!template) {
    throw new Error('No template found for this inspection');
  }

  const questions = typeof template.questions === 'string' ? JSON.parse(template.questions) : template.questions;
  const sections = sectionAnswersService.getTemplateSections(questions);
  
  return { template, sections };
}

/**
 * Handle common error responses
 */
function handleError(res, error, operation = 'operation') {
  console.error(`Error ${operation}:`, error);
  
  if (error.message.includes('not found') || error.message.includes('does not exist')) {
    return res.status(404).json({ error: 'Not Found', message: error.message });
  }
  
  if (error.message.includes('access')) {
    return res.status(403).json({ error: 'Forbidden', message: error.message });
  }
  
  return res.status(500).json({
    error: `Failed to ${operation}`,
    message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
  });
}

// =============================================================================
// GET ROUTES - FETCH INSPECTIONS
// =============================================================================

// GET all inspections (admin view)
router.get('/', authMiddleware, async (req, res) => {
  try {
    // Build where clause
    const whereClause = {
      deletedAt: null,
    };

    // Check if user is admin or regular user
    const currentUser = await prisma.User.findUnique({
      where: { id: BigInt(req.user.id) },
      include: { role: true },
    });

    // If not admin, filter by organization
    if (currentUser?.role?.name !== 'admin') {
      whereClause.orgId = BigInt(req.user.orgId);
    }

    const inspections = await prisma.Inspection.findMany({
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
        template: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        assignee: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        createdByUser: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
      orderBy: [
        { scheduledAt: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    const formattedInspections = inspections.map((inspection) => ({
      id: inspection.id.toString(),
      orgId: inspection.orgId.toString(),
      deviceId: inspection.deviceId?.toString(),
      siteId: inspection.siteId?.toString(),
      contractId: inspection.contractId?.toString(),
      templateId: inspection.templateId?.toString(),
      type: inspection.type,
      title: inspection.title,
      scheduledAt: inspection.scheduledAt,
      startedAt: inspection.startedAt,
      completedAt: inspection.completedAt,
      status: inspection.status,
      progress: inspection.progress,
      assignedTo: inspection.assignedTo?.toString(),
      notes: inspection.notes,
      device: inspection.device ? {
        id: inspection.device.id.toString(),
        serialNumber: inspection.device.serialNumber,
        assetTag: inspection.device.assetTag,
        model: inspection.device.model,
      } : null,
      site: inspection.site ? {
        id: inspection.site.id.toString(),
        name: inspection.site.name,
      } : null,
      contract: inspection.contract ? {
        id: inspection.contract.id.toString(),
        contractName: inspection.contract.contractName,
        contractNumber: inspection.contract.contractNumber,
      } : null,
      template: inspection.template ? {
        id: inspection.template.id.toString(),
        name: inspection.template.name,
        type: inspection.template.type,
      } : null,
      assignedUser: inspection.assignee ? {
        id: inspection.assignee.id.toString(),
        fullName: inspection.assignee.fullName,
        email: inspection.assignee.email,
      } : null,
      createdByUser: inspection.createdByUser ? {
        id: inspection.createdByUser.id.toString(),
        fullName: inspection.createdByUser.fullName,
      } : null,
      createdAt: inspection.createdAt,
      updatedAt: inspection.updatedAt,
    }));

    res.json({
      message: 'Inspections fetched successfully',
      data: formattedInspections,
    });
  } catch (error) {
    console.error('Error fetching inspections:', error);
    res.status(500).json({
      error: 'Failed to fetch inspections',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
});

// GET all inspections assigned to logged-in user
router.get('/assigned', authMiddleware, async (req, res) => {
  try {
    const inspections = await getAssignedInspectionsByType(BigInt(req.user.id));
    res.json({
      message: 'All assigned inspections fetched successfully',
      data: inspections,
      count: inspections.length,
    });
  } catch (error) {
    handleError(res, error, 'fetch assigned inspections');
  }
});

// GET assigned inspections by type
router.get('/assigned/type/:type', authMiddleware, async (req, res) => {
  try {
    const { type } = req.params;
    const validTypes = ['INSPECTION', 'INSTALLATION', 'MAINTENANCE', 'VERIFICATION'];
    const normalizedType = type.toUpperCase();
    
    if (!validTypes.includes(normalizedType)) {
      return res.status(400).json({
        error: 'Invalid inspection type',
        message: `Type must be one of: ${validTypes.join(', ')}`,
        validTypes,
      });
    }

    const inspections = await getAssignedInspectionsByType(BigInt(req.user.id), normalizedType);
    res.json({
      message: `Assigned ${normalizedType} inspections fetched successfully`,
      data: inspections,
      count: inspections.length,
      type: normalizedType,
    });
  } catch (error) {
    handleError(res, error, 'fetch assigned inspections by type');
  }
});

// =============================================================================
// SECTION BY SECTION INSPECTION FLOW
// =============================================================================

// GET inspection template with sections
router.get('/:id/template', authMiddleware, async (req, res) => {
  try {
    const inspectionId = BigInt(req.params.id);
    const inspection = await verifyInspectionAccess(inspectionId, req.user.id, req.user.orgId);
    const { template, sections } = await getTemplateAndSections(inspection);

    // Get device information if available
    let deviceInfo = null;
    if (inspection.deviceId) {
      const device = await prisma.Device.findUnique({
        where: { id: inspection.deviceId },
        select: {
          id: true, serialNumber: true, assetTag: true, metadata: true,
          model: { select: { id: true, manufacturer: true, model: true, specs: true } },
          organization: { select: { id: true, name: true, code: true } },
          site: { select: { id: true, name: true } }
        },
      });

      if (device) {
        deviceInfo = {
          id: device.id.toString(),
          serialNumber: device.serialNumber,
          assetTag: device.assetTag,
          location: device.metadata?.location || 'Тодорхойлогдоогүй',
          model: { ...device.model, id: device.model?.id?.toString() },
          organization: device.organization ? { ...device.organization, id: device.organization.id.toString() } : null,
          site: device.site ? { ...device.site, id: device.site.id.toString() } : null,
          metadata: device.metadata,
        };
      }
    }

    return res.json({
      message: 'Inspection template retrieved successfully',
      data: {
        inspectionId: inspection.id.toString(),
        inspection: { id: inspection.id.toString(), title: inspection.title, type: inspection.type },
        template: { ...template, id: template.id.toString() },
        device: deviceInfo,
        sections: sections,
        totalSections: Object.keys(sections).length,
        totalQuestions: Object.values(sections).reduce((total, section) => total + section.questions.length, 0),
      },
    });
  } catch (error) {
    handleError(res, error, 'fetch inspection template');
  }
});

// GET current section questions for an inspection
router.get('/:id/section/:sectionName/questions', authMiddleware, async (req, res) => {
  try {
    const inspectionId = BigInt(req.params.id);
    const sectionName = req.params.sectionName;
    const inspection = await verifyInspectionAccess(inspectionId, req.user.id, req.user.orgId);
    const { template, sections } = await getTemplateAndSections(inspection);
    const sectionData = sections[sectionName];

    if (!sectionData) {
      return res.status(404).json({
        error: 'Section not found',
        message: `Section '${sectionName}' does not exist in this inspection template`,
        availableSections: Object.keys(sections),
      });
    }

    const existingAnswers = await getSectionAnswers(inspectionId, sectionName);

    return res.json({
      message: `Questions for section '${sectionName}' retrieved successfully`,
      data: {
        inspectionId: inspection.id.toString(),
        section: { name: sectionName, title: sectionData.title, order: sectionData.order, questions: sectionData.questions, totalQuestions: sectionData.questions.length },
        existingAnswers: existingAnswers,
        hasExistingAnswers: Object.keys(existingAnswers).length > 0,
      },
    });
  } catch (error) {
    handleError(res, error, 'fetch section questions');
  }
});

// GET section review (current section questions and answers for verification)
router.get('/:id/section/:sectionName/review', authMiddleware, async (req, res) => {
  try {
    const inspectionId = BigInt(req.params.id);
    const sectionName = req.params.sectionName;
    const inspection = await verifyInspectionAccess(inspectionId, req.user.id, req.user.orgId);
    const { template, sections } = await getTemplateAndSections(inspection);
    const currentSection = sections[sectionName];

    if (!currentSection) {
      return res.status(404).json({
        error: 'Section not found',
        message: `Section '${sectionName}' does not exist in this inspection template`,
        availableSections: Object.keys(sections),
      });
    }

    const sectionAnswers = await getSectionAnswers(inspectionId, sectionName);
    const questionsWithAnswers = currentSection.questions.map(question => {
      const answer = sectionAnswers[question.id] || {};
      return {
        id: question.id, question: question.question, type: question.type, options: question.options,
        textRequired: question.textRequired, imageRequired: question.imageRequired,
        answer: { status: answer.status || '', comment: answer.comment || '', images: answer.images || [] },
        hasAnswer: !!answer.status
      };
    });

    const sectionOrder = Object.keys(sections).sort((a, b) => sections[a].order - sections[b].order);
    const currentIndex = sectionOrder.indexOf(sectionName);
    const nextSection = currentIndex < sectionOrder.length - 1 ? sectionOrder[currentIndex + 1] : null;

    return res.json({
      message: `Section '${sectionName}' review data retrieved successfully`,
      data: {
        inspectionId: inspection.id.toString(),
        section: { name: sectionName, title: currentSection.title, order: currentSection.order, isLast: currentIndex === sectionOrder.length - 1 },
        questionsWithAnswers: questionsWithAnswers,
        totalQuestions: questionsWithAnswers.length,
        answeredQuestions: questionsWithAnswers.filter(q => q.hasAnswer).length,
        nextSection: nextSection,
        sectionOrder: sectionOrder,
        currentIndex: currentIndex,
        totalSections: sectionOrder.length,
        progress: { current: currentIndex + 1, total: sectionOrder.length, percentage: Math.round(((currentIndex + 1) / sectionOrder.length) * 100) }
      }
    });
  } catch (error) {
    handleError(res, error, 'fetch section review');
  }
});

// POST section confirmation (confirm current section and proceed to next)
router.post('/:id/section/:sectionName/confirm', authMiddleware, async (req, res) => {
  try {
    const inspectionId = BigInt(req.params.id);
    const sectionName = req.params.sectionName;
    const inspection = await verifyInspectionAccess(inspectionId, req.user.id, req.user.orgId);
    const { template, sections } = await getTemplateAndSections(inspection);
    
    const sectionOrder = Object.keys(sections).sort((a, b) => sections[a].order - sections[b].order);
    const currentIndex = sectionOrder.indexOf(sectionName);
    const nextSection = currentIndex < sectionOrder.length - 1 ? sectionOrder[currentIndex + 1] : null;
    const isLastSection = currentIndex === sectionOrder.length - 1;

    // Mark section as confirmed/completed
    const result = await prisma.$transaction(async (tx) => {
      const existingAnswers = await tx.inspectionAnswer.findFirst({
        where: { inspectionId },
        orderBy: { answeredAt: 'desc' }
      });

      let existingData = {};
      if (existingAnswers && existingAnswers.answers) {
        const answerData = existingAnswers.answers;
        existingData = answerData.data || answerData; // Support both formats
      }

      // Mark current section as confirmed
      if (existingData[sectionName]) {
        existingData[sectionName].confirmed = true;
        existingData[sectionName].confirmedAt = new Date().toISOString();
      }

      const sectionAnswers = { data: existingData };
      const sectionAnswer = await tx.inspectionAnswer.create({
        data: { inspectionId: inspectionId, answers: sectionAnswers, answeredBy: BigInt(req.user.id), answeredAt: new Date() }
      });

      // Update inspection progress
      const progressPercentage = Math.round(((currentIndex + 1) / sectionOrder.length) * 100);
      const updatedInspection = await tx.inspection.update({
        where: { id: inspectionId },
        data: {
          progress: progressPercentage,
          status: isLastSection ? 'SUBMITTED' : 'IN_PROGRESS',
          completedAt: isLastSection ? new Date() : undefined,
          updatedBy: BigInt(req.user.id),
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
            section: sectionName, confirmed: true, status: updatedInspection.status,
            progress: updatedInspection.progress, isLastSection: isLastSection
          },
          userId: BigInt(req.user.id),
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
        progress: { current: currentIndex + 1, total: sectionOrder.length, percentage: Math.round(((currentIndex + 1) / sectionOrder.length) * 100) },
        inspection: { status: result.updatedInspection.status, progress: result.updatedInspection.progress, completedAt: result.updatedInspection.completedAt }
      }
    });
  } catch (error) {
    handleError(res, error, 'confirm section');
  }
});

// GET next section after completing current one
router.get('/:id/next-section/:currentSection', authMiddleware, async (req, res) => {
  try {
    const inspectionId = BigInt(req.params.id);
    const currentSection = req.params.currentSection;
    const inspection = await verifyInspectionAccess(inspectionId, req.user.id, req.user.orgId);
    const { template, sections } = await getTemplateAndSections(inspection);
    
    const sectionOrder = Object.keys(sections).sort((a, b) => sections[a].order - sections[b].order);
    const currentIndex = sectionOrder.indexOf(currentSection);
    const nextSection = currentIndex < sectionOrder.length - 1 ? sectionOrder[currentIndex + 1] : null;
    const completedSections = await getCompletedSections(inspectionId);

    return res.json({
      message: 'Next section information retrieved successfully',
      data: {
        inspectionId: inspection.id.toString(),
        currentSection: currentSection,
        nextSection: nextSection,
        isLastSection: currentIndex === sectionOrder.length - 1,
        isInspectionComplete: nextSection === null,
        progress: { current: currentIndex + 1, total: sectionOrder.length, percentage: Math.round(((currentIndex + 1) / sectionOrder.length) * 100) },
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
    handleError(res, error, 'fetch next section');
  }
});

// =============================================================================
// SECTION ANSWER ROUTES - SECTION BY SECTION SAVING
// =============================================================================

// GET section status for an inspection
router.get('/:id/section-status', authMiddleware, async (req, res) => {
  try {
    const inspectionId = BigInt(req.params.id);
    const inspection = await verifyInspectionAccess(inspectionId, req.user.id, req.user.orgId);
    const sectionAnswers = await prisma.InspectionAnswer.findMany({
      where: { inspectionId },
      orderBy: { answeredAt: 'asc' },
      select: { id: true, answers: true, answeredBy: true, answeredAt: true },
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
    handleError(res, error, 'fetch section status');
  }
});

// GET section review (show questions and answers for verification)
router.get('/:id/section-review/:section', authMiddleware, async (req, res) => {
  try {
    const inspectionId = BigInt(req.params.id);
    const section = req.params.section;
    const inspection = await verifyInspectionAccess(inspectionId, req.user.id, req.user.orgId);
    
    const allAnswers = await prisma.InspectionAnswer.findMany({
      where: { inspectionId: inspectionId },
      orderBy: { answeredAt: 'asc' },
      select: { id: true, answers: true, answeredBy: true, answeredAt: true },
    });

    // Filter answers that contain the specific section
    const sectionAnswers = allAnswers.filter(answer => {
      const answerData = answer.answers || {};
      const sectionData = answerData.data || answerData; // Support both formats
      return sectionData[section];
    });

    console.log(`Section review for inspection ${inspectionId}, section '${section}':`, {
      totalAnswers: allAnswers.length, sectionAnswers: sectionAnswers.length,
      availableSections: allAnswers.map(a => {
        const data = a.answers?.data || a.answers;
        return data ? Object.keys(data).filter(key => key !== 'metadata') : [];
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
            const data = a.answers?.data || a.answers;
            return data ? Object.keys(data).filter(key => key !== 'metadata') : [];
          }).flat(),
          requestedSection: section
        }
      });
    }

    // Get the latest answer
    const latestAnswer = sectionAnswers[sectionAnswers.length - 1];
    const answerData = latestAnswer.answers || {};
    const sectionData = (answerData.data || answerData)[section] || {};

    // Extract questions and answers for review
    const questionAnswerPairs = [];
    const excludedKeys = ['sectionStatus', 'completedAt', 'section', 'sessionStartedAt', 'lastUpdatedAt'];
    
    Object.entries(sectionData).forEach(([key, value]) => {
      if (!excludedKeys.includes(key)) {
        let questionText = key;
        let answerText = value;
        let images = [];
        let additionalInfo = {};

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
          questionId: key, questionText: questionText, answerText: answerText,
          images: images, additionalInfo: additionalInfo, rawValue: value
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
          section: section, totalQuestions: reviewData.metadata.totalQuestions,
          status: reviewData.metadata.sectionStatus,
          answeredAt: reviewData.metadata.answeredAt,
          isCompleted: reviewData.metadata.sectionStatus === 'COMPLETED',
          sessionStartedAt: reviewData.metadata.sessionStartedAt,
          lastUpdatedAt: reviewData.metadata.lastUpdatedAt
        }
      },
    });
  } catch (error) {
    handleError(res, error, 'fetch section review');
  }
});

// GET section answers for an inspection
router.get('/:id/section-answers', authMiddleware, async (req, res) => {
  try {
    const inspectionId = BigInt(req.params.id);
    const inspection = await verifyInspectionAccess(inspectionId, req.user.id, req.user.orgId);
    const sectionAnswers = await prisma.InspectionAnswer.findMany({
      where: { inspectionId },
      orderBy: { answeredAt: 'asc' },
      select: { id: true, answers: true, answeredBy: true, answeredAt: true, createdAt: true },
    });

    // Group answers by session
    const groupedAnswers = {};
    sectionAnswers.forEach(answer => {
      const answerData = answer.answers;
      if (answerData) {
        const sessionId = answer.id.toString();
        const sections = answerData.data || answerData; // Support both formats
        const allSections = Object.keys(sections).filter(key => key !== 'metadata');
        
        // Count total questions across all sections
        let totalQuestions = 0;
        allSections.forEach(sectionName => {
          if (sections[sectionName]) {
            totalQuestions += Object.keys(sections[sectionName]).length;
          }
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
    handleError(res, error, 'fetch section answers');
  }
});

// POST initialize inspection metadata (called before starting first section)
router.post('/initialize-metadata', authMiddleware, async (req, res) => {
  try {
    console.log('=== Initialize Metadata Request ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));

    const { date, inspector, location, scale_id_serial_no, model, deviceId } = req.body.data || req.body;

    return res.json({
      message: 'Metadata received - will be saved with first section',
      data: {
        metadata: { date, inspector, location, scale_id_serial_no, model },
        note: 'Send this metadata along with first section answers'
      }
    });
  } catch (error) {
    handleError(res, error, 'initialize metadata');
  }
});

// POST save signatures for inspection
router.post('/:id/signatures', authMiddleware, async (req, res) => {
  try {
    console.log('=== Save Signatures Request ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));

    const inspectionId = BigInt(req.params.id);
    const { signatures } = req.body.data || req.body;

    if (!signatures || typeof signatures !== 'object') {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'signatures field is required and must be an object'
      });
    }

    // Verify inspection access
    const inspection = await verifyInspectionAccess(inspectionId, req.user.id, req.user.orgId);

    // Find the main inspection answer record
    const mainAnswer = await prisma.InspectionAnswer.findFirst({
      where: { 
        inspectionId,
        answers: {
          path: '$.data',
          not: null
        }
      },
      orderBy: { answeredAt: 'asc' }
    });

    if (!mainAnswer) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Main inspection record not found. Please save sections first.'
      });
    }

    // Update the main record with signatures
    const existingAnswers = mainAnswer.answers || {};
    const updatedAnswers = {
      ...existingAnswers,
      signatures: signatures
    };

    const updatedAnswer = await prisma.InspectionAnswer.update({
      where: { id: mainAnswer.id },
      data: { 
        answers: updatedAnswers,
        answeredBy: BigInt(req.user.id),
        answeredAt: new Date()
      }
    });

    console.log(`Updated main record ${updatedAnswer.id} with signatures`);

    return res.json({
      message: 'Signatures saved successfully',
      data: {
        inspectionId: inspection.id.toString(),
        answerId: updatedAnswer.id.toString(),
        signatures: signatures,
        savedAt: updatedAnswer.answeredAt
      }
    });
  } catch (error) {
    handleError(res, error, 'save signatures');
  }
});

// GET latest answer ID for inspection
router.get('/:id/latest-answer-id', authMiddleware, async (req, res) => {
  try {
    const inspectionId = BigInt(req.params.id);
    const inspection = await verifyInspectionAccess(inspectionId, req.user.id, req.user.orgId);

    // Find the latest inspection answer with sections data
    const latestAnswer = await prisma.InspectionAnswer.findFirst({
      where: {
        inspectionId,
        answers: {
          path: '$.metadata',
          not: null
        }
      },
      orderBy: {
        answeredAt: 'desc'
      }
    });

    if (latestAnswer) {
      res.json({ answerId: latestAnswer.id.toString() });
    } else {
      res.json({ answerId: null });
    }
  } catch (error) {
    handleError(res, error, 'get latest answer ID');
  }
});

// GET test endpoint to check remarks and signatures
router.get('/:id/test-data', authMiddleware, async (req, res) => {
  try {
    const inspectionId = BigInt(req.params.id);
    const inspection = await verifyInspectionAccess(inspectionId, req.user.id, req.user.orgId);

    // Get all answers for this inspection
    const answers = await prisma.InspectionAnswer.findMany({
      where: { inspectionId },
      orderBy: { answeredAt: 'asc' },
      select: { id: true, answers: true, answeredBy: true, answeredAt: true },
    });

    // Extract remarks and signatures from all answers
    let extractedRemarks = null;
    let extractedSignatures = null;
    let extractedMetadata = null;

    answers.forEach(answer => {
      const answerData = answer.answers || {};
      
      // Check for metadata
      if (answerData.metadata) {
        extractedMetadata = answerData.metadata;
      }
      
      // Check for remarks
      if (answerData.remarks) {
        extractedRemarks = answerData.remarks;
      }
      
      // Check for signatures
      if (answerData.signatures) {
        extractedSignatures = answerData.signatures;
      }
      
      // Check data wrapper
      if (answerData.data) {
        if (answerData.data.remarks) {
          extractedRemarks = answerData.data.remarks;
        }
        if (answerData.data.signatures) {
          extractedSignatures = answerData.data.signatures;
        }
        if (answerData.data.metadata) {
          extractedMetadata = answerData.data.metadata;
        }
      }
    });

    return res.json({
      message: 'Test data retrieved successfully',
      data: {
        inspectionId: inspection.id.toString(),
        totalAnswers: answers.length,
        extractedMetadata: extractedMetadata,
        extractedRemarks: extractedRemarks,
        extractedSignatures: extractedSignatures,
        allAnswers: answers.map(a => ({
          id: a.id.toString(),
          answeredAt: a.answeredAt,
          hasMetadata: !!(a.answers?.metadata),
          hasRemarks: !!(a.answers?.remarks),
          hasSignatures: !!(a.answers?.signatures),
          hasDataWrapper: !!(a.answers?.data),
        }))
      }
    });
  } catch (error) {
    handleError(res, error, 'get test data');
  }
});

// POST save signature image (for Flutter signature pad)
router.post('/:id/signature-image', authMiddleware, async (req, res) => {
  try {
    console.log('=== Save Signature Image Request ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));

    const inspectionId = BigInt(req.params.id);
    const { signatureImage, signatureType = 'inspector', answerId } = req.body.data || req.body;

    if (!signatureImage) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'signatureImage field is required'
      });
    }

    // Verify inspection access
    const inspection = await verifyInspectionAccess(inspectionId, req.user.id, req.user.orgId);

    // If answerId is provided, use that specific record
    if (answerId) {
      const targetAnswer = await prisma.InspectionAnswer.findFirst({
        where: { 
          id: BigInt(answerId),
          inspectionId
        }
      });
      
      if (targetAnswer) {
        console.log('🔍 Found target answer record for signature image:', targetAnswer.id.toString());
        
        const existingAnswers = targetAnswer.answers || {};
        const existingSignatures = existingAnswers.signatures || {};
        
        const updatedSignatures = {
          ...existingSignatures,
          [signatureType]: signatureImage
        };

        const updatedAnswers = {
          ...existingAnswers,
          signatures: updatedSignatures
        };

        const updatedAnswer = await prisma.InspectionAnswer.update({
          where: { id: targetAnswer.id },
          data: { 
            answers: updatedAnswers,
            answeredBy: BigInt(req.user.id),
            answeredAt: new Date()
          }
        });

        console.log(`Updated target record ${updatedAnswer.id} with signature image`);

        return res.json({
          message: 'Signature image saved successfully',
          data: {
            inspectionId: inspection.id.toString(),
            answerId: updatedAnswer.id.toString(),
            signatureType: signatureType,
            signatureImage: signatureImage,
            savedAt: updatedAnswer.answeredAt
          }
        });
      } else {
        console.log('⚠️ Target answer record not found, falling back to main record search');
      }
    }

    // Find the main inspection answer record
    // First try to find record with data field
    let mainAnswer = await prisma.InspectionAnswer.findFirst({
      where: { 
        inspectionId,
        answers: {
          path: '$.data',
          not: null
        }
      },
      orderBy: { answeredAt: 'asc' }
    });

    // If not found, try to find record with multiple sections (jbox, sensor, exterior, etc.)
    if (!mainAnswer) {
      const sectionPaths = ['$.jbox', '$.sensor', '$.exterior', '$.indicator', '$.foundation', '$.cleanliness'];
      
      for (const path of sectionPaths) {
        mainAnswer = await prisma.InspectionAnswer.findFirst({
          where: { 
            inspectionId,
            answers: {
              path: path,
              not: null
            }
          },
          orderBy: { answeredAt: 'asc' }
        });
        
        if (mainAnswer) {
          console.log(`🔍 Found main record with ${path} section`);
          break;
        }
      }
    }

    // If still not found, try to find record with metadata
    if (!mainAnswer) {
      mainAnswer = await prisma.InspectionAnswer.findFirst({
        where: { 
          inspectionId,
          answers: {
            path: '$.metadata',
            not: null
          }
        },
        orderBy: { answeredAt: 'asc' }
      });
    }

    console.log('🔍 Found main answer record for signature image:', mainAnswer ? mainAnswer.id.toString() : 'NOT FOUND');

    if (!mainAnswer) {
      // Try to find any record for this inspection
      const anyAnswer = await prisma.InspectionAnswer.findFirst({
        where: { inspectionId },
        orderBy: { answeredAt: 'asc' }
      });
      
      console.log('🔍 Any answer record found for signature image:', anyAnswer ? anyAnswer.id.toString() : 'NOT FOUND');
      
      if (!anyAnswer) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'No inspection record found for this inspection ID. Please save sections first.'
        });
      }
      
      // Use the first available record
      const existingAnswers = anyAnswer.answers || {};
      const existingSignatures = existingAnswers.signatures || {};
      
      const updatedSignatures = {
        ...existingSignatures,
        [signatureType]: signatureImage
      };

      const updatedAnswers = {
        ...existingAnswers,
        signatures: updatedSignatures
      };

      const updatedAnswer = await prisma.InspectionAnswer.update({
        where: { id: anyAnswer.id },
        data: { 
          answers: updatedAnswers,
          answeredBy: BigInt(req.user.id),
          answeredAt: new Date()
        }
      });

      console.log(`Updated record ${updatedAnswer.id} with signature image`);

      return res.json({
        message: 'Signature image saved successfully',
        data: {
          inspectionId: inspection.id.toString(),
          answerId: updatedAnswer.id.toString(),
          signatureType: signatureType,
          signatureImage: signatureImage,
          savedAt: updatedAnswer.answeredAt
        }
      });
    }

    // Clean up any existing separate signatures records
    await prisma.InspectionAnswer.deleteMany({
      where: {
        inspectionId,
        answers: {
          path: '$.signatures',
          not: null
        },
        id: {
          not: mainAnswer.id
        }
      }
    });

    // Update the main record with signature image
    const existingAnswers = mainAnswer.answers || {};
    const existingSignatures = existingAnswers.signatures || {};
    
    console.log('🔍 Existing answers before signature update:', JSON.stringify(existingAnswers, null, 2));
    
    const updatedSignatures = {
      ...existingSignatures,
      [signatureType]: signatureImage
    };

    const updatedAnswers = {
      ...existingAnswers,
      signatures: updatedSignatures
    };
    
    console.log('🔍 Updated answers with signature:', JSON.stringify(updatedAnswers, null, 2));

    const updatedAnswer = await prisma.InspectionAnswer.update({
      where: { id: mainAnswer.id },
      data: { 
        answers: updatedAnswers,
        answeredBy: BigInt(req.user.id),
        answeredAt: new Date()
      }
    });

    console.log(`Updated main record ${updatedAnswer.id} with signature image`);
    console.log('🔍 Final saved answers:', JSON.stringify(updatedAnswer.answers, null, 2));

    return res.json({
      message: 'Signature image saved successfully',
      data: {
        inspectionId: inspection.id.toString(),
        answerId: updatedAnswer.id.toString(),
        signatureType: signatureType,
        signatureImage: signatureImage,
        savedAt: updatedAnswer.answeredAt
      }
    });
  } catch (error) {
    handleError(res, error, 'save signature image');
  }
});

// POST save section answers (section by section saving with smart data management)
router.post('/section-answers', authMiddleware, async (req, res) => {
  try {
    console.log('=== Section Answers Request ===');
    console.log('Request body keys:', Object.keys(req.body));
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    const requestData = req.body.data || req.body;
    console.log('Processed request data:', JSON.stringify(requestData, null, 2));
    
    const serviceResult = await sectionAnswersService.saveSectionAnswers(requestData, req.user);
    const completedSections = await getCompletedSections(BigInt(requestData.inspectionId));

    const baseMessage = serviceResult.isCompletion 
      ? `Section '${requestData.section}' completed successfully. Inspection finished!`
      : `Section '${requestData.section}' saved successfully. ${serviceResult.nextSection ? `Next: ${serviceResult.nextSection}` : 'This was the last section.'}`;
    
    console.log(`Section '${requestData.section}' processed:`, {
      isCompletion: serviceResult.isCompletion,
      answerId: serviceResult.result.sectionAnswer.id.toString(),
      nextSection: serviceResult.nextSection,
      isLastSection: serviceResult.isLastSection,
      totalQuestions: Object.keys(serviceResult.result.sectionAnswer.answers || {}).filter(key => key !== 'metadata').length,
    });

    const responseBuilder = serviceResult.result.didCreate
      ? res.status(201).location(`/api/inspection-answers/${serviceResult.result.sectionAnswer.id.toString()}`)
      : res.status(200);

    return responseBuilder.json({
      message: baseMessage,
      data: {
        inspectionId: requestData.inspectionId.toString(),
        answerId: serviceResult.result.sectionAnswer.id.toString(),
        section: requestData.section,
        sectionIndex: requestData.sectionIndex ?? serviceResult.currentSectionIndex,
        status: requestData.status || 'IN_PROGRESS',
        progress: requestData.progress ?? null,
        answeredAt: serviceResult.result.sectionAnswer.answeredAt,
        metadata: serviceResult.result.extractedMetadata || null,
        isCompletion: serviceResult.isCompletion,
        isLastSection: serviceResult.isLastSection,
        isFirstSection: requestData.isFirstSection,
        nextSection: serviceResult.nextSection,
        sectionOrder: serviceResult.sectionOrder.length > 0 ? serviceResult.sectionOrder : [requestData.section],
        currentSectionIndex: serviceResult.currentSectionIndex >= 0 ? serviceResult.currentSectionIndex : 0,
        totalSections: serviceResult.sectionOrder.length > 0 ? serviceResult.sectionOrder.length : 1,
        completedSections: completedSections,
        hasTemplate: serviceResult.template,
        navigation: {
          canGoToNext: serviceResult.nextSection !== null,
          canGoToPrevious: serviceResult.currentSectionIndex > 0,
          nextSection: serviceResult.nextSection,
          previousSection: serviceResult.currentSectionIndex > 0 && serviceResult.sectionOrder.length > 0 
            ? serviceResult.sectionOrder[serviceResult.currentSectionIndex - 1] 
            : null,
        },
      },
    });
  } catch (error) {
    console.error('❌ Error saving section answers:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    if (error.message.includes('Missing required field') || 
        error.message.includes('must be') || 
        error.message.includes('does not exist') ||
        error.message.includes('do not have access')) {
      return res.status(400).json({
        error: 'Validation Error',
        message: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }

    if (error.message.includes('access')) {
      return res.status(403).json({
        error: 'Forbidden',
        message: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }

    return res.status(500).json({
      error: 'Failed to save section answers',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

// =============================================================================
// DEVICE AND TEMPLATE ENDPOINTS
// =============================================================================

// GET /api/inspections/:id/devices - Get devices for an inspection
router.get('/:id/devices', authMiddleware, async (req, res) => {
  try {
    const inspectionId = BigInt(req.params.id);
    const inspection = await verifyInspectionAccess(inspectionId, req.user.id, req.user.orgId, { deviceId: true });
    
    const templateQuestions = inspection.template?.questions || [];
    const sections = sectionAnswersService.getTemplateSections(templateQuestions);
    const sectionAnswers = await prisma.InspectionAnswer.findMany({
      where: { inspectionId: inspectionId },
      orderBy: { answeredAt: 'asc' }
    });

    // Organize answers by section
    const organizedAnswers = {};
    let inspectionMetadata = null;
    
    sectionAnswers.forEach(answer => {
      const answerData = answer.answers || {};
      
      if (answerData.metadata && !inspectionMetadata) {
        inspectionMetadata = answerData.metadata;
      }
      
      const sectionData = answerData.data || answerData; // Support both formats
      if (sectionData) {
        Object.keys(sectionData).forEach(sectionName => {
          if (sectionName !== 'metadata') {
            organizedAnswers[sectionName] = sectionData[sectionName];
          }
        });
      }
    });

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
    handleError(res, error, 'get inspection devices');
  }
});

// GET all device models
router.get('/device-models', authMiddleware, async (req, res) => {
  try {
    const deviceModels = await prisma.DeviceModel.findMany({
      include: { _count: { select: { devices: true } } },
      orderBy: { manufacturer: 'asc' },
    });

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
    handleError(res, error, 'fetch device models');
  }
});

// GET specific device model by ID
router.get('/device-models/:id', authMiddleware, async (req, res) => {
  try {
    const deviceModel = await prisma.DeviceModel.findUnique({
      where: { id: BigInt(req.params.id) },
      include: {
        _count: { select: { devices: true } },
        devices: {
          select: {
            id: true, serialNumber: true, assetTag: true, status: true, installedAt: true,
            organization: { select: { name: true, code: true } },
            site: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!deviceModel) {
      return res.status(404).json({
        error: 'Device model not found',
        message: 'The requested device model does not exist',
      });
    }

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
    handleError(res, error, 'fetch device model');
  }
});

// GET all devices (for organization users)
router.get('/devices', authMiddleware, async (req, res) => {
  try {
    const orgIdFromToken = req.user.orgId;
    const { status, siteId, modelId, search, page = 1, limit = 10 } = req.query;

    // Build where clause
    const where = { orgId: BigInt(orgIdFromToken), deletedAt: null };
    if (status) where.status = status.toUpperCase();
    if (siteId) where.siteId = BigInt(siteId);
    if (modelId) where.modelId = BigInt(modelId);
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
      prisma.Device.findMany({
        where,
        include: {
          model: { select: { id: true, manufacturer: true, model: true, specs: true } },
          site: { select: { id: true, name: true } },
          contract: { select: { id: true, contractName: true, contractNumber: true } },
          organization: { select: { id: true, name: true, code: true } },
          _count: { select: { inspections: true } },
        },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip, take,
      }),
      prisma.Device.count({ where }),
    ]);

    const formattedDevices = devices.map(device => ({
      id: device.id.toString(),
      serialNumber: device.serialNumber,
      assetTag: device.assetTag,
      status: device.status,
      installedAt: device.installedAt,
      metadata: device.metadata,
      inspectionCount: device._count.inspections,
      model: device.model ? { ...device.model, id: device.model.id.toString() } : null,
      site: device.site ? { ...device.site, id: device.site.id.toString() } : null,
      contract: device.contract ? { ...device.contract, id: device.contract.id.toString() } : null,
      organization: { ...device.organization, id: device.organization.id.toString() },
      createdAt: device.createdAt,
      updatedAt: device.updatedAt,
    }));

    const totalPages = Math.ceil(totalCount / take);

    res.json({
      message: 'Devices retrieved successfully',
      data: formattedDevices,
      pagination: {
        page: parseInt(page), limit: parseInt(limit), totalCount, totalPages,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1,
      },
    });
  } catch (error) {
    handleError(res, error, 'fetch devices');
  }
});

// GET specific device by ID
router.get('/devices/:id', authMiddleware, async (req, res) => {
  try {
    const device = await prisma.Device.findFirst({
      where: {
        id: BigInt(req.params.id),
        orgId: BigInt(req.user.orgId),
        deletedAt: null,
      },
      include: {
        model: { select: { id: true, manufacturer: true, model: true, specs: true, createdAt: true, updatedAt: true } },
        site: { select: { id: true, name: true } },
        contract: { select: { id: true, contractName: true, contractNumber: true, startDate: true, endDate: true, metadata: true } },
        organization: { select: { id: true, name: true, code: true } },
        inspections: {
          select: {
            id: true, title: true, type: true, status: true, progress: true, scheduledAt: true, completedAt: true,
            assignee: { select: { id: true, fullName: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: { select: { inspections: true, attachments: true } },
      },
    });

    if (!device) {
      return res.status(404).json({
        error: 'Device not found',
        message: 'The requested device does not exist or you do not have access to it',
      });
    }

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
      model: device.model ? { ...device.model, id: device.model.id.toString() } : null,
      site: device.site ? { ...device.site, id: device.site.id.toString() } : null,
      contract: device.contract ? { ...device.contract, id: device.contract.id.toString() } : null,
      organization: { ...device.organization, id: device.organization.id.toString() },
      inspections: device.inspections.map(inspection => ({
        ...inspection,
        id: inspection.id.toString(),
        assignee: inspection.assignee ? { ...inspection.assignee, id: inspection.assignee.id.toString() } : null,
      })),
      createdAt: device.createdAt,
      updatedAt: device.updatedAt,
    };

    res.json({
      message: 'Device retrieved successfully',
      data: formattedDevice,
    });
  } catch (error) {
    handleError(res, error, 'fetch device');
  }
});

// =============================================================================
// GET INSPECTIONS BY DEVICE
// =============================================================================

/**
 * GET /api/inspections/device/:deviceId
 * Get all inspections for a specific device
 */
router.get('/device/:deviceId', authMiddleware, async (req, res) => {
  try {
    const { deviceId } = req.params;

    const inspections = await prisma.Inspection.findMany({
      where: {
        deviceId: BigInt(deviceId),
        deletedAt: null,
      },
      include: {
        assignee: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        device: {
          select: {
            id: true,
            serialNumber: true,
            assetTag: true,
          },
        },
      },
      orderBy: {
        scheduledAt: 'desc',
      },
    });

    // Format response
    const formattedInspections = inspections.map(inspection => ({
      id: inspection.id.toString(),
      title: inspection.title,
      type: inspection.type,
      status: inspection.status,
      scheduledAt: inspection.scheduledAt,
      startedAt: inspection.startedAt,
      completedAt: inspection.completedAt,
      progress: inspection.progress,
      assignee: inspection.assignee ? {
        id: inspection.assignee.id.toString(),
        fullName: inspection.assignee.fullName,
        email: inspection.assignee.email,
      } : null,
      device: inspection.device ? {
        id: inspection.device.id.toString(),
        serialNumber: inspection.device.serialNumber,
        assetTag: inspection.device.assetTag,
      } : null,
      createdAt: inspection.createdAt,
    }));

    res.json({
      message: 'Inspections retrieved successfully',
      data: formattedInspections,
    });
  } catch (error) {
    console.error('Error fetching inspections:', error);
    res.status(500).json({
      error: 'Failed to fetch inspections',
      message:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    });
  }
});

// =============================================================================
// ASSIGN INSPECTION TO USER
// =============================================================================

/**
 * POST /api/inspections
 * Create a new inspection
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      orgId,
      deviceId,
      siteId,
      contractId,
      templateId,
      type,
      title,
      scheduledAt,
      notes,
    } = req.body;

    // Validation
    if (!deviceId || !type || !title) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Device, type, and title are required',
      });
    }

    // Verify device exists and get related data
    const device = await prisma.Device.findUnique({
      where: { id: BigInt(deviceId) },
      include: {
        organization: true,
        site: true,
        contract: true,
      },
    });

    if (!device) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Device not found',
      });
    }

    // Use device's related data if not provided
    const finalOrgId = orgId || device.orgId.toString();
    const finalSiteId = siteId || device.siteId?.toString();
    const finalContractId = contractId || device.contractId?.toString();

    // Verify template if provided
    if (templateId) {
      const template = await prisma.InspectionTemplate.findUnique({
        where: { id: BigInt(templateId) },
      });

      if (!template) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Template not found',
        });
      }
    }

    // Normalize type to uppercase (Prisma enum requirement)
    const normalizedType = type.toUpperCase();

    // Create inspection
    const inspection = await prisma.Inspection.create({
      data: {
        orgId: BigInt(finalOrgId),
        deviceId: BigInt(deviceId),
        siteId: finalSiteId ? BigInt(finalSiteId) : null,
        contractId: finalContractId ? BigInt(finalContractId) : null,
        templateId: templateId ? BigInt(templateId) : null,
        type: normalizedType,
        title: title,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        status: 'DRAFT',
        progress: 0,
        createdBy: BigInt(req.user.id),
        notes: notes || null,
      },
      include: {
        device: {
          select: {
            id: true,
            serialNumber: true,
            assetTag: true,
          },
        },
        site: {
          select: {
            id: true,
            name: true,
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
    });

    res.status(201).json({
      message: 'Inspection created successfully',
      data: {
        id: inspection.id.toString(),
        orgId: inspection.orgId.toString(),
        deviceId: inspection.deviceId?.toString(),
        siteId: inspection.siteId?.toString(),
        contractId: inspection.contractId?.toString(),
        templateId: inspection.templateId?.toString(),
        type: inspection.type,
        title: inspection.title,
        scheduledAt: inspection.scheduledAt,
        status: inspection.status,
        progress: inspection.progress,
        notes: inspection.notes,
        device: inspection.device ? {
          id: inspection.device.id.toString(),
          serialNumber: inspection.device.serialNumber,
          assetTag: inspection.device.assetTag,
        } : null,
        site: inspection.site ? {
          id: inspection.site.id.toString(),
          name: inspection.site.name,
        } : null,
        template: inspection.template ? {
          id: inspection.template.id.toString(),
          name: inspection.template.name,
          type: inspection.template.type,
        } : null,
        createdAt: inspection.createdAt,
        updatedAt: inspection.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error creating inspection:', error);
    res.status(500).json({
      error: 'Failed to create inspection',
      message:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    });
  }
});

/**
 * PUT /api/inspections/:id
 * Update an inspection
 */
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, scheduledAt, notes, status } = req.body;

    // Check if inspection exists
    const inspection = await prisma.Inspection.findFirst({
      where: {
        id: BigInt(id),
        deletedAt: null,
      },
    });

    if (!inspection) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Inspection not found',
      });
    }

    // Build update data
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (scheduledAt !== undefined) updateData.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
    if (notes !== undefined) updateData.notes = notes;
    if (status !== undefined) updateData.status = status;
    updateData.updatedBy = BigInt(req.user.id);

    // Update inspection
    const updatedInspection = await prisma.Inspection.update({
      where: { id: BigInt(id) },
      data: updateData,
      include: {
        device: {
          select: {
            id: true,
            serialNumber: true,
            assetTag: true,
          },
        },
        site: {
          select: {
            id: true,
            name: true,
          },
        },
        template: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.json({
      message: 'Inspection updated successfully',
      data: {
        id: updatedInspection.id.toString(),
        orgId: updatedInspection.orgId.toString(),
        deviceId: updatedInspection.deviceId?.toString(),
        siteId: updatedInspection.siteId?.toString(),
        contractId: updatedInspection.contractId?.toString(),
        templateId: updatedInspection.templateId?.toString(),
        type: updatedInspection.type,
        title: updatedInspection.title,
        scheduledAt: updatedInspection.scheduledAt,
        status: updatedInspection.status,
        notes: updatedInspection.notes,
        device: updatedInspection.device ? {
          id: updatedInspection.device.id.toString(),
          serialNumber: updatedInspection.device.serialNumber,
          assetTag: updatedInspection.device.assetTag,
        } : null,
        site: updatedInspection.site ? {
          id: updatedInspection.site.id.toString(),
          name: updatedInspection.site.name,
        } : null,
        template: updatedInspection.template ? {
          id: updatedInspection.template.id.toString(),
          name: updatedInspection.template.name,
        } : null,
        updatedAt: updatedInspection.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error updating inspection:', error);
    res.status(500).json({
      error: 'Failed to update inspection',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
});

/**
 * DELETE /api/inspections/:id
 * Soft delete an inspection
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if inspection exists
    const inspection = await prisma.Inspection.findFirst({
      where: {
        id: BigInt(id),
        deletedAt: null,
      },
    });

    if (!inspection) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Inspection not found',
      });
    }

    // Soft delete the inspection
    await prisma.Inspection.update({
      where: { id: BigInt(id) },
      data: {
        deletedAt: new Date(),
      },
    });

    res.json({
      message: 'Inspection deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting inspection:', error);
    res.status(500).json({
      error: 'Failed to delete inspection',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
});

/**
 * PUT /api/inspections/:id/assign
 * Assign an inspection to a user
 */
router.put('/:id/assign', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    console.log(`Assigning inspection ${id} to user ${userId}`);

    // Validate userId
    if (!userId) {
      return res.status(400).json({
        error: 'Missing required field',
        message: 'userId is required',
      });
    }

    // Check if inspection exists
    const inspection = await prisma.Inspection.findFirst({
      where: {
        id: BigInt(id),
        deletedAt: null,
      },
    });

    if (!inspection) {
      return res.status(404).json({
        error: 'Inspection not found',
        message: 'Inspection not found',
      });
    }

    // Check if target user exists and is active
    const targetUser = await prisma.User.findFirst({
      where: {
        id: BigInt(userId),
        deletedAt: null,
        isActive: true,
      },
    });

    if (!targetUser) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User not found or inactive',
      });
    }

    // Optionally verify user belongs to same organization as inspection
    // (commented out to allow admin to assign across organizations)
    // if (targetUser.orgId !== inspection.orgId) {
    //   return res.status(400).json({
    //     error: 'Invalid assignment',
    //     message: 'User must belong to the same organization as the inspection',
    //   });
    // }

    // Update inspection assignee
    const updatedInspection = await prisma.Inspection.update({
      where: { id: BigInt(id) },
      data: {
        assignedTo: BigInt(userId),
        updatedBy: BigInt(req.user.id),
      },
      include: {
        assignee: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        device: {
          select: {
            id: true,
            serialNumber: true,
            assetTag: true,
          },
        },
      },
    });

    console.log(`Inspection ${id} assigned successfully to user ${userId}`);

    res.json({
      message: 'Inspection assigned successfully',
      data: {
        id: updatedInspection.id.toString(),
        title: updatedInspection.title,
        assignee: updatedInspection.assignee ? {
          id: updatedInspection.assignee.id.toString(),
          fullName: updatedInspection.assignee.fullName,
          email: updatedInspection.assignee.email,
        } : null,
      },
    });
  } catch (error) {
    console.error('Error assigning inspection:', error);
    res.status(500).json({
      error: 'Failed to assign inspection',
      message:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    });
  }
});

module.exports = router;