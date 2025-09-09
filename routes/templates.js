const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Utility function to convert BigInt to string for JSON serialization
const serializeBigInt = obj => {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'bigint') {
    return obj.toString();
  }

  if (Array.isArray(obj)) {
    return obj.map(serializeBigInt);
  }

  if (typeof obj === 'object') {
    const serialized = {};
    for (const [key, value] of Object.entries(obj)) {
      serialized[key] = serializeBigInt(value);
    }
    return serialized;
  }

  return obj;
};

// // GET all inspection templates
// router.get('/inspection', authMiddleware, async (req, res) => {
//   try {
//     const inspectionTemplates = await prisma.inspectionTemplate.findMany({
//       where: {
//         isActive: true,
//       },
//       orderBy: {
//         createdAt: 'desc',
//       },
//     });

//     res.json({
//       message: 'All inspection templates fetched successfully',
//       data: serializeBigInt(inspectionTemplates),
//       count: inspectionTemplates.length,
//     });
//   } catch (error) {
//     console.error('Error fetching inspection templates:', error);
//     res.status(500).json({
//       error: 'Failed to fetch inspection templates',
//       message:
//         process.env.NODE_ENV === 'development'
//           ? error.message
//           : 'Internal server error',
//     });
//   }
// });

// GET inspection templates with dynamic filtering
router.get('/', authMiddleware, async (req, res) => {
  try {
    const {
      type,
      isActive,
      name,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    // Build where clause dynamically
    const where = {};

    if (type) {
      where.type = type.toUpperCase();
    }

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    if (name) {
      where.name = {
        contains: name,
        mode: 'insensitive',
      };
    }

    // If no where clause provided, return null
    if (Object.keys(where).length === 0) {
      return res.json({
        message: 'No filter parameters provided',
        data: null,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          totalCount: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
        filters: {
          type: null,
          isActive: null,
          name: null,
          sortBy,
          sortOrder,
        },
      });
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Build orderBy clause
    const orderBy = {};
    orderBy[sortBy] = sortOrder.toLowerCase();

    // Fetch templates with filtering and pagination
    const [templates, totalCount] = await Promise.all([
      prisma.inspectionTemplate.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          _count: {
            select: {
              inspections: true,
              schedules: true,
            },
          },
        },
      }),
      prisma.inspectionTemplate.count({ where }),
    ]);

    const totalPages = Math.ceil(totalCount / take);

    res.json({
      message: 'Inspection templates fetched successfully',
      data: serializeBigInt(templates),
      pagination: {
        page: parseInt(page),
        limit: take,
        totalCount,
        totalPages,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1,
      },
      filters: {
        type,
        isActive,
        name,
        sortBy,
        sortOrder,
      },
    });
  } catch (error) {
    console.error('Error fetching inspection templates:', error);
    res.status(500).json({
      error: 'Failed to fetch inspection templates',
      message:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    });
  }
});

// GET specific inspection template by ID
router.get('/templates/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const template = await prisma.inspectionTemplate.findUnique({
      where: {
        id: BigInt(id),
      },
      include: {
        _count: {
          select: {
            inspections: true,
            schedules: true,
          },
        },
        inspections: {
          select: {
            id: true,
            title: true,
            status: true,
            scheduledAt: true,
            completedAt: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 5, // Show latest 5 inspections using this template
        },
      },
    });

    if (!template) {
      return res.status(404).json({
        error: 'Template not found',
        message: 'The requested inspection template does not exist',
      });
    }

    res.json({
      message: 'Inspection template fetched successfully',
      data: serializeBigInt(template),
    });
  } catch (error) {
    console.error('Error fetching inspection template:', error);
    res.status(500).json({
      error: 'Failed to fetch inspection template',
      message:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    });
  }
});

module.exports = router;
