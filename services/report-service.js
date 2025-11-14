const {
  loadImagePayload,
  inferMimeType,
  normalizeRelativePath,
  buildPublicUrl,
} = require('../utils/imageStorage');

function safeField(section = {}, key) {
  const item = section?.[key] || {};
  return {
    status: item.status || '',
    comment: item.comment || '',
    question: item.question || '',
  };
}

function extractSignatureImage(signatureValue) {
  if (!signatureValue || typeof signatureValue !== 'string') {
    return null;
  }

  const match = signatureValue.match(/^data:(.+);base64,(.+)$/);
  if (!match) {
    return null;
  }

  return {
    data: match[2],
    mimeType: match[1],
  };
}

async function loadImagesForAnswer(prisma, answerId) {
  const rows = await prisma.$queryRaw`
    SELECT
      id,
      field_id,
      section,
      image_order,
      image_url,
      uploaded_at
    FROM inspection_question_images
    WHERE answer_id = ${answerId}
    ORDER BY section, field_id, image_order;
  `;

  const images = [];
  for (const row of rows) {
    const normalizedPath = normalizeRelativePath(row.image_url);
    const payload = await loadImagePayload(normalizedPath);
    const mimeType = inferMimeType(normalizedPath);

    images.push({
      id: row.id?.toString() || null,
      section: row.section || null,
      fieldId: row.field_id || null,
      order: Number(row.image_order) || 0,
      imageUrl: buildPublicUrl(normalizedPath),
      storagePath: normalizedPath,
      base64: payload.base64,
      mimeType,
      uploadedAt: row.uploaded_at || null,
    });
  }

  return images;
}

function mapIndicatorSection(section = {}) {
  return {
    led_display: safeField(section, 'led_display'),
    power_plug: safeField(section, 'power_plug'),
    seal_and_bolt: safeField(section, 'seal_bolt'),
    buttons: safeField(section, 'buttons'),
    junction_wiring: safeField(section, 'junction_wiring'),
    serial_converter_plug: safeField(section, 'serial_converter'),
  };
}

function mapFoundationSection(section = {}) {
  return {
    cross_base: safeField(section, 'cross_base'),
    anchor_plate: safeField(section, 'anchor_plate'),
    ramp_angle: safeField(section, 'ramp_angle'),
    ramp_stopper: safeField(section, 'ramp_stopper'),
    ramp: safeField(section, 'ramp'),
    slab_base: safeField(section, 'slab_base'),
  };
}

function mapCleanlinessSection(section = {}) {
  return {
    under_platform: safeField(section, 'under_platform'),
    top_platform: safeField(section, 'top_platform'),
    gap_platform_ramp: safeField(section, 'gap_platform_ramp'),
    both_sides_area: safeField(section, 'both_sides_area'),
  };
}

function mapExteriorSection(section = {}) {
  return {
    sensor_base: safeField(section, 'sensor_base'),
    beam: safeField(section, 'beam'),
    platform_plate: safeField(section, 'platform_plate'),
    beam_joint_plate: safeField(section, 'beam_joint_plate'),
    stop_bolt: safeField(section, 'stop_bolt'),
    interplatform_bolts: safeField(section, 'interplatform_bolts'),
  };
}

function mapJboxSection(section = {}) {
  return {
    box_integrity: safeField(section, 'box_integrity'),
    collector_board: safeField(section, 'collector_board'),
    wire_tightener: safeField(section, 'wire_tightener'),
    resistor_element: safeField(section, 'resistor_element'),
    protective_box: safeField(section, 'protective_box'),
  };
}

function mapSensorSection(section = {}) {
  return {
    signal_wire: safeField(section, 'signal_wire'),
    ball: safeField(section, 'ball'),
    base: safeField(section, 'base'),
    ball_cup_thin: safeField(section, 'ball_cup_thin'),
    plate: safeField(section, 'plate'),
  };
}

async function buildInspectionReportData(
  prisma,
  identifiers = {}
) {
  let inspectionId = null;
  let answer = null;

  if (
    identifiers &&
    typeof identifiers === 'object' &&
    identifiers !== null
  ) {
    if (identifiers.answerId) {
      const answerId = BigInt(identifiers.answerId);
      answer = await prisma.InspectionAnswer.findUnique({
        where: { id: answerId },
      });
      if (!answer) {
        throw new Error('Inspection answer not found');
      }
      inspectionId = answer.inspectionId;
    }

    if (identifiers.inspectionId) {
      inspectionId = BigInt(identifiers.inspectionId);
    }
  } else if (identifiers) {
    inspectionId = BigInt(identifiers);
  }

  if (!inspectionId) {
    throw new Error('Inspection ID is required');
  }

  const inspection = await prisma.Inspection.findUnique({
    where: { id: inspectionId },
    include: {
      contract: { include: { organization: true } },
      site: { include: { organization: true } },
      device: { include: { model: true } },
    },
  });

  if (!inspection) {
    throw new Error('Inspection not found');
  }

  if (!answer) {
    answer = await prisma.InspectionAnswer.findFirst({
      where: { inspectionId },
      orderBy: [
        { answeredAt: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  let parsedAnswers = {};
  if (answer?.answers) {
    try {
      parsedAnswers =
        typeof answer.answers === 'string'
          ? JSON.parse(answer.answers)
          : answer.answers;
    } catch (error) {
      console.warn(
        '[report-service] Failed to parse answers JSON:',
        error.message
      );
    }
  }

  const dataRoot = parsedAnswers.data || parsedAnswers;
  const metadata = dataRoot.metadata || parsedAnswers.metadata || {};

  const contractorOrg =
    inspection.contract?.organization ||
    inspection.site?.organization ||
    null;

  const signatureInspector = extractSignatureImage(
    parsedAnswers.signatures?.inspector
  );

  const images = answer
    ? await loadImagesForAnswer(prisma, answer.id)
    : [];

  const d = {
    contractor: {
      company: contractorOrg?.name || '',
      contract_no: inspection.contract?.contractNumber || '',
      contact: contractorOrg?.code || '',
    },
    metadata: {
      date: metadata.date || '',
      inspector: metadata.inspector || '',
      location: metadata.location || '',
      scale_id_serial_no: metadata.scale_id_serial_no || '',
      model: metadata.model || inspection.device?.model?.model || '',
    },
    exterior: mapExteriorSection(dataRoot.exterior),
    indicator: mapIndicatorSection(dataRoot.indicator),
    jbox: mapJboxSection(dataRoot.jbox),
    sensor: mapSensorSection(dataRoot.sensor),
    foundation: mapFoundationSection(dataRoot.foundation),
    cleanliness: mapCleanlinessSection(dataRoot.cleanliness),
    remarks: parsedAnswers.remarks || '',
    signatures: {
      inspector: signatureInspector,
    },
    images,
  };

  return {
    inspection: {
      id: inspection.id.toString(),
      title: inspection.title,
      status: inspection.status,
      type: inspection.type,
    },
    answer: answer
      ? {
          id: answer.id.toString(),
          answeredAt: answer.answeredAt,
        }
      : null,
    d,
  };
}

module.exports = {
  buildInspectionReportData,
};

