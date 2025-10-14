const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Advanced service for handling section answers JSON processing and database operations
 */
class SectionAnswersService {
  
  /**
   * Process and save section answers to database
   * @param {Object} requestData - The processed request data
   * @param {Object} user - User information from auth middleware
   * @returns {Object} Result with section answer and metadata
   */
  async saveSectionAnswers(requestData, user) {
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
    } = requestData;

    // Validation and setup
    this.validateRequest(requestData, user);
    const inspectionId = BigInt(requestData.inspectionId);
    const userId = BigInt(user.id);
    const normalizedSectionStatus = this.normalizeSectionStatus(sectionStatus);
    
    // Verify access and get inspection
    const inspection = await this.verifyInspectionAccess(inspectionId, userId, user.orgId, user.id);
    const statusValidation = this.validateStatus(status);
    
    if (!statusValidation.isValid) {
      throw new Error(`Status must be one of ${statusValidation.allowedStatuses.join(', ')}`);
    }

    // Get template information
    const templateInfo = await this.getTemplateInfo(inspection, requestData);
    const { template, sections, sectionOrder, currentSectionIndex, isLastSection } = templateInfo;

    // Check if this is completion
    const isCompletion = statusValidation.normalizedStatus === 'SUBMITTED' || 
                        (normalizedSectionStatus === 'COMPLETED' && isLastSection);
    
    console.log(`Processing section '${section}' for inspection ${inspectionId}:`, {
      section, currentIndex: currentSectionIndex, totalSections: sectionOrder.length,
      isLastSection, sectionStatus: normalizedSectionStatus, isCompletion, status: statusValidation.normalizedStatus
    });

    // Process and save to database
    const result = await this.processSectionData({
      inspectionId, userId, section, answers, data, answerId, sectionIndex, isFirstSection,
      isCompletion, sections, sectionOrder, currentSectionIndex, isLastSection,
      progress, statusValidation, normalizedSectionStatus, inspection
    });

    return {
      result,
      nextSection: this.getNextSection(sectionOrder, currentSectionIndex),
      sectionOrder,
      currentSectionIndex,
      isLastSection,
      isCompletion,
      template: !!template
    };
  }

  /**
   * Validate request data
   */
  validateRequest(requestData, user) {
    const required = ['inspectionId', 'section', 'answers'];
    const missing = required.filter(field => !requestData[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }

    if (typeof requestData.answers !== 'object' || Array.isArray(requestData.answers)) {
      throw new Error('answers must be a non-array object');
    }
  }

  /**
   * Normalize section status
   */
  normalizeSectionStatus(sectionStatus) {
    const validStatuses = ['IN_PROGRESS', 'COMPLETED', 'SKIPPED'];
    return sectionStatus && validStatuses.includes(sectionStatus.toUpperCase()) 
      ? sectionStatus.toUpperCase() 
      : 'IN_PROGRESS';
  }

  /**
   * Verify inspection exists and user has access
   */
  async verifyInspectionAccess(inspectionId, userId, orgIdFromToken, userStringId) {
    console.log('Looking for inspection with ID:', inspectionId.toString());
    
    const inspection = await prisma.inspection.findUnique({
      where: { id: inspectionId },
      select: {
        id: true, orgId: true, status: true, assignedTo: true, 
        createdBy: true, templateId: true, type: true,
      },
    });

    if (!inspection) {
      console.error('❌ Inspection not found in database');
      throw new Error(`Inspection with ID ${inspectionId} does not exist`);
    }

    console.log('✅ Inspection found:', {
      id: inspection.id.toString(), orgId: inspection.orgId.toString(),
      assignedTo: inspection.assignedTo?.toString(), createdBy: inspection.createdBy.toString(),
      templateId: inspection.templateId?.toString(), status: inspection.status
    });

    // Check access
    const sameOrg = inspection.orgId.toString() === orgIdFromToken;
    const isAssignee = inspection.assignedTo?.toString() === userStringId;
    const isCreator = inspection.createdBy.toString() === userStringId;
    const hasAccess = sameOrg || isAssignee || isCreator;

    console.log('Access check:', { hasAccess, sameOrg, isAssignee, isCreator });
    
    if (!hasAccess) {
      console.error('❌ Access denied');
      throw new Error('You do not have access to this inspection');
    }

    return inspection;
  }

  /**
   * Validate status
   */
  validateStatus(status) {
    const allowedStatuses = ['DRAFT', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELED'];
    const normalizedStatus = typeof status === 'string' && status.length > 0 ? status.toUpperCase() : undefined;

    return {
      normalizedStatus,
      isValid: !normalizedStatus || allowedStatuses.includes(normalizedStatus),
      allowedStatuses
    };
  }

  /**
   * Get template information
   */
  async getTemplateInfo(inspection, requestData) {
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
        const questions = typeof template.questions === 'string' ? JSON.parse(template.questions) : template.questions;
        sections = this.getTemplateSections(questions);
        sectionOrder = Object.keys(sections).sort((a, b) => sections[a].order - sections[b].order);
        currentSectionIndex = sectionOrder.indexOf(requestData.section || '');
        isLastSection = currentSectionIndex === sectionOrder.length - 1;
        
        console.log('Section info:', {
          requestedSection: requestData.section, availableSections: sectionOrder,
          currentSectionIndex, isLastSection, totalSections: sectionOrder.length
        });
      } else {
        console.warn('⚠️ Template not found - proceeding without template validation');
      }
    } else {
      console.log('ℹ️ No template assigned - proceeding without template validation');
    }

    return { template, sections, sectionOrder, currentSectionIndex, isLastSection };
  }

  /**
   * Get inspection template sections from test data structure
   */
  getTemplateSections(templateQuestions) {
    if (!templateQuestions || !Array.isArray(templateQuestions)) return {};

    const sections = {};
    templateQuestions.forEach((section, index) => {
      if (section.section && section.title && section.fields) {
        sections[section.section] = {
          name: section.section, title: section.title, order: index + 1,
          questions: section.fields.map(field => ({
            id: field.id, question: field.question, type: field.type,
            options: field.options || [], textRequired: field.text_required || false,
            imageRequired: field.image_required || false,
            required: field.text_required || field.image_required || false
          }))
        };
      }
    });

    return sections;
  }

  /**
   * Sort section data according to template field order
   */
  sortSectionDataByTemplate(sectionData, sectionName, sections) {
    if (!sectionData || !sections[sectionName]) return sectionData;

    const templateSection = sections[sectionName];
    const sortedData = {};

    templateSection.questions.forEach(question => {
      const fieldId = question.id;
      const possibleKeys = [
        fieldId, `field_${fieldId}`, fieldId.replace(/_/g, ''),
        fieldId.replace(/_status$/, ''), fieldId.replace(/_status$/, '').replace(/_/g, ''),
        fieldId.replace(/_status$/, '').replace(/_([a-z])/g, (match, letter) => letter.toUpperCase())
      ];

      for (const key of possibleKeys) {
        if (sectionData[key]) {
          sortedData[key] = sectionData[key];
          break;
        }
      }
    });

    // Add remaining fields
    Object.keys(sectionData).forEach(key => {
      if (!sortedData[key]) sortedData[key] = sectionData[key];
    });

    return sortedData;
  }

  /**
   * Process section data and save to database
   */
  async processSectionData(params) {
    return await prisma.$transaction(async (tx) => {
      try {
        const extractedMetadata = this.extractMetadata(params);
        
        if (params.isCompletion) {
          return await this.handleCompletion({ tx, ...params, extractedMetadata });
        } else {
          return await this.handleRegularSave({ tx, ...params, extractedMetadata });
        }
      } catch (transactionError) {
        console.error('Transaction error:', transactionError);
        throw transactionError;
      }
    });
  }

  /**
   * Extract metadata from first section
   */
  extractMetadata(params) {
    if (params.isFirstSection !== true) return null;
    
    const metadataFields = ['date', 'inspector', 'location', 'scale_id_serial_no', 'model'];
    const extractedMetadata = {};
    
    metadataFields.forEach(field => {
      if (params.answers[field] !== undefined) {
        extractedMetadata[field] = params.answers[field];
      }
    });
    
    console.log('Extracted metadata from first section:', extractedMetadata);
    return Object.keys(extractedMetadata).length > 0 ? extractedMetadata : null;
  }

  /**
   * Handle completion - merge all sections into final record
   */
  async handleCompletion(params) {
    const { tx, inspectionId, userId, section, answers, data, sections, extractedMetadata } = params;

    // Get all previous section answers
    const allPreviousAnswers = await tx.inspectionAnswer.findMany({
      where: { inspectionId },
      orderBy: { answeredAt: 'asc' }
    });
    
    console.log(`Merging ${allPreviousAnswers.length} previous section records`);
    
    // Merge all previous answers
    let mergedData = {};
    let storedMetadata = null;
    
    allPreviousAnswers.forEach(prevAnswer => {
      const prevData = prevAnswer.answers || {};
      
      if (prevData.metadata) {
        storedMetadata = { ...storedMetadata, ...prevData.metadata };
      }
      
      const sectionData = prevData.data || prevData;
      if (sectionData && typeof sectionData === 'object') {
        Object.keys(sectionData).forEach(sectionName => {
          if (sectionName === 'metadata') return;
          
          if (!mergedData[sectionName]) mergedData[sectionName] = {};
          mergedData[sectionName] = { ...mergedData[sectionName], ...sectionData[sectionName] };
        });
      }
    });
    
    // Add current section
    const finalMetadata = extractedMetadata || storedMetadata;
    let rawSectionData = data?.[section] || { ...answers };
    
    // Remove metadata fields from section data
    if (finalMetadata) {
      Object.keys(finalMetadata).forEach(key => delete rawSectionData[key]);
    }
    
    const sectionData = Object.keys(sections).length > 0 
      ? this.sortSectionDataByTemplate(rawSectionData, section, sections)
      : rawSectionData;
    
    mergedData[section] = sectionData;
    
    // Build final answers without data wrapper
    const finalAnswers = { ...mergedData };
    if (finalMetadata && Object.keys(finalMetadata).length > 0) {
      finalAnswers.metadata = finalMetadata;
    }
    
    console.log(`Merged ${Object.keys(mergedData).length} sections for final record`);
    
    // Delete all previous records and create final merged record
    const deleteResult = await tx.inspectionAnswer.deleteMany({ where: { inspectionId } });
    console.log(`Deleted ${deleteResult.count} previous section records`);
    
    const sectionAnswer = await tx.inspectionAnswer.create({
      data: { inspectionId, answers: finalAnswers, answeredBy: userId, answeredAt: new Date() }
    });
    
    console.log(`Created final merged record ${sectionAnswer.id}`);
    return { sectionAnswer, didCreate: true, extractedMetadata };
  }

  /**
   * Handle regular section save
   */
  async handleRegularSave(params) {
    const { tx, inspectionId, userId, section, answers, data, answerId, sections, extractedMetadata } = params;

    // Process section data
    let rawSectionData = data?.[section] || { ...answers };
    
    if (extractedMetadata) {
      Object.keys(extractedMetadata).forEach(key => delete rawSectionData[key]);
    }

    const sectionData = Object.keys(sections).length > 0 
      ? this.sortSectionDataByTemplate(rawSectionData, section, sections)
      : rawSectionData;

    // Find target answer row
    let targetAnswer = null;
    if (answerId) {
      try {
        const found = await tx.inspectionAnswer.findUnique({ where: { id: BigInt(answerId) } });
        if (found && found.inspectionId === inspectionId) targetAnswer = found;
      } catch (e) {
        console.warn('Invalid answerId provided. A new row will be created.');
      }
    }

    let sectionAnswer;
    let didCreate = false;

    if (!targetAnswer) {
      // Create new record
      const sectionAnswers = { [section]: sectionData };
      if (extractedMetadata) sectionAnswers.metadata = extractedMetadata;
      
      sectionAnswer = await tx.inspectionAnswer.create({
        data: { inspectionId, answers: sectionAnswers, answeredBy: userId, answeredAt: new Date() }
      });
      didCreate = true;
      console.log(`Created initial answer record ${sectionAnswer.id} for section '${section}'`);
    } else {
      // Update existing record
      const existing = targetAnswer.answers || {};
      const existingData = existing.data || existing;
      
      const mergedData = { 
        ...existingData, 
        [section]: { ...(existingData[section] || {}), ...sectionData } 
      };
      
      const merged = { ...mergedData };
      if (extractedMetadata) {
        merged.metadata = { ...(existing.metadata || {}), ...extractedMetadata };
      } else if (existing.metadata) {
        merged.metadata = existing.metadata;
      }
      
      sectionAnswer = await tx.inspectionAnswer.update({
        where: { id: targetAnswer.id },
        data: { answers: merged, answeredBy: userId, answeredAt: new Date() }
      });
      console.log(`Updated answer record ${sectionAnswer.id} by merging section '${section}'`);
    }

    return { sectionAnswer, didCreate, extractedMetadata };
  }

  /**
   * Get next section information
   */
  getNextSection(sectionOrder, currentSectionIndex) {
    return sectionOrder.length > 0 && currentSectionIndex >= 0 && currentSectionIndex < sectionOrder.length - 1 
      ? sectionOrder[currentSectionIndex + 1] 
      : null;
  }
}

module.exports = new SectionAnswersService();