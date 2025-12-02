const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware } = require('../middleware/auth');
const bcrypt = require('bcrypt');
const { serializeBigInt, handleError, parseBigIntId } = require('../utils/routeHelpers');

const router = express.Router();
const prisma = new PrismaClient();

// GET all users (protected route)
router.get('/', authMiddleware, async (req, res) => {
  try {
    // Admin can see all users, others see only their organization
    const whereClause = {
      deletedAt: null, // Exclude soft-deleted users
    };

    // If not admin, filter by organization
    const currentUserRole = await prisma.User.findUnique({
      where: { id: BigInt(req.user.id) },
      include: { role: true },
    });

    if (currentUserRole?.role?.name !== 'admin') {
      whereClause.orgId = BigInt(req.user.orgId);
    }

    const users = await prisma.User.findMany({
      where: whereClause,
      include: {
        organization: true,
        role: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Format response
    const formattedUsers = users.map(user => ({
      id: user.id.toString(),
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      organization: {
        id: user.organization.id.toString(),
        name: user.organization.name,
        code: user.organization.code,
      },
      role: user.role.name,
    }));

    res.json({
      message: 'Users retrieved successfully',
      data: formattedUsers,
    });
  } catch (error) {
    return handleError(res, error, 'fetch users');
  }
});

// GET users by organization
router.get('/organization/:orgId', authMiddleware, async (req, res) => {
  try {
    const { orgId } = req.params;

    const users = await prisma.User.findMany({
      where: {
        orgId: BigInt(orgId),
        deletedAt: null,
        isActive: true,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        role: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        fullName: 'asc',
      },
    });

    // Format response
    const formattedUsers = users.map(user => ({
      id: user.id.toString(),
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      isActive: user.isActive,
      organization: {
        id: user.organization.id.toString(),
        name: user.organization.name,
        code: user.organization.code,
      },
      role: user.role.name,
      roleId: user.role.id.toString(),
    }));

    res.json({
      message: 'Users retrieved successfully',
      data: formattedUsers,
    });
  } catch (error) {
    return handleError(res, error, 'fetch users by organization');
  }
});

// GET current user profile (protected route)
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.User.findUnique({
      where: { id: BigInt(req.user.id) },
      include: {
        organization: true,
        role: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User profile not found',
      });
    }

    res.json({
      message: 'Profile retrieved successfully',
      data: {
        id: user.id.toString(),
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        organization: {
          id: user.organization.id.toString(),
          name: user.organization.name,
          code: user.organization.code,
        },
        role: user.role.name,
      },
    });
  } catch (error) {
    return handleError(res, error, 'fetch profile');
  }
});

// GET user by ID (protected route)
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.User.findFirst({
      where: {
        id: BigInt(id),
        orgId: BigInt(req.user.orgId), // Only allow access to users in same organization
      },
      include: {
        organization: true,
        role: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message:
          'User not found or you do not have permission to view this user',
      });
    }

    res.json({
      message: 'User retrieved successfully',
      data: {
        id: user.id.toString(),
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        organization: {
          id: user.organization.id.toString(),
          name: user.organization.name,
          code: user.organization.code,
        },
        role: user.role.name,
      },
    });
  } catch (error) {
    return handleError(res, error, 'fetch user');
  }
});

  // POST new user (protected route - admin only would be added later)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { email, password, fullName, phone, roleIds, orgId } = req.body;
    
    console.log('Creating new user:', { email, fullName, phone, roleIds, orgId });

    // Validate required fields
    if (!email || !password || !fullName) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Email, password, and fullName are required',
      });
    }

    // Validate orgId
    if (!orgId) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Organization (orgId) is required',
      });
    }

    // Verify organization exists
    const organization = await prisma.Organization.findUnique({
      where: { id: BigInt(orgId) },
    });

    if (!organization) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Organization not found',
      });
    }

    // Check if user already exists (only active users)
    const existingUser = await prisma.User.findFirst({
      where: { 
        email,
        deletedAt: null, // Only check active users
      },
    });

    if (existingUser) {
      return res.status(409).json({
        error: 'User already exists',
        message: 'A user with this email already exists',
      });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Determine roleId - use first role from roleIds array or default to inspector (2)
    let roleId = BigInt(2); // Default to inspector
    if (roleIds && Array.isArray(roleIds) && roleIds.length > 0) {
      roleId = BigInt(roleIds[0]);
    }

    // Create user
    const user = await prisma.User.create({
      data: {
        email,
        passwordHash,
        fullName,
        phone: phone || null, // Ensure null if empty string
        orgId: BigInt(orgId), // Use provided orgId
        roleId: roleId,
      },
      include: {
        organization: true,
        role: true,
      },
    });

    console.log('User created successfully:', user.id.toString());
    
    res.status(201).json({
      message: 'User created successfully',
      data: {
        id: user.id.toString(),
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        isActive: user.isActive,
        organization: {
          id: user.organization.id.toString(),
          name: user.organization.name,
          code: user.organization.code,
        },
        role: user.role.name,
      },
    });
  } catch (error) {
    return handleError(res, error, 'create user');
  }
});

// PUT update user (protected route)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, phone, isActive, password, roleIds } = req.body;

    // Check if user exists and belongs to same organization
    const existingUser = await prisma.User.findFirst({
      where: {
        id: BigInt(id),
        orgId: BigInt(req.user.orgId),
      },
    });

    if (!existingUser) {
      return res.status(404).json({
        error: 'User not found',
        message:
          'User not found or you do not have permission to update this user',
      });
    }

    // Prepare update data
    const updateData = {};
    if (fullName !== undefined) updateData.fullName = fullName;
    if (phone !== undefined) updateData.phone = phone;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Hash new password if provided
    if (password) {
      const saltRounds = 10;
      updateData.passwordHash = await bcrypt.hash(password, saltRounds);
    }

    // Update roleId if provided
    if (roleIds && Array.isArray(roleIds) && roleIds.length > 0) {
      updateData.roleId = BigInt(roleIds[0]);
    }

    // Update user
    const user = await prisma.User.update({
      where: { id: BigInt(id) },
      data: updateData,
      include: {
        organization: true,
        role: true,
      },
    });

    res.json({
      message: 'User updated successfully',
      data: {
        id: user.id.toString(),
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        isActive: user.isActive,
        organization: {
          id: user.organization.id.toString(),
          name: user.organization.name,
          code: user.organization.code,
        },
        role: user.role.name,
      },
    });
  } catch (error) {
    return handleError(res, error, 'update user');
  }
});

// DELETE user (protected route)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🗑️ DELETE user request: ID=${id}, User=${req.user.id}`);

    // Determine if current user is admin to allow cross-organization deletion
    const currentUser = await prisma.User.findUnique({
      where: { id: BigInt(req.user.id) },
      include: { role: true },
    });

    if (!currentUser) {
      console.log(`❌ Authenticated user not found: ID=${req.user.id}`);
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authenticated user not found',
      });
    }

    const isAdmin = currentUser.role?.name === 'admin';

    // Build lookup criteria. Non-admins can delete only within their organization
    const userCriteria = {
      id: BigInt(id),
      deletedAt: null,
    };

    if (!isAdmin) {
      userCriteria.orgId = BigInt(req.user.orgId);
    }

    const existingUser = await prisma.User.findFirst({
      where: userCriteria,
    });

    if (!existingUser) {
      return res.status(404).json({
        error: 'User not found',
        message:
          'User not found or you do not have permission to delete this user',
      });
    }

    // Prevent self-deletion
    if (existingUser.id.toString() === req.user.id) {
      return res.status(400).json({
        error: 'Cannot delete self',
        message: 'You cannot delete your own account',
      });
    }

    // Check if user has related inspections (as assignee or creator)
    const [assignedInspections, createdInspections] = await prisma.$transaction([
      prisma.Inspection.findMany({
        where: { assignedTo: BigInt(id) },
        select: { id: true, title: true, status: true },
        take: 5,
      }),
      prisma.Inspection.findMany({
        where: { createdBy: BigInt(id) },
        select: { id: true, title: true, status: true },
        take: 5,
      }),
    ]);

    if (assignedInspections.length > 0 || createdInspections.length > 0) {
      let details = [];
      if (assignedInspections.length > 0) {
        details.push(`\n📋 Хүлээсэн үзлэгүүд (${assignedInspections.length}):\n• ${assignedInspections.map(i => i.title).join('\n• ')}`);
      }
      if (createdInspections.length > 0) {
        details.push(`\n📝 Үүсгэсэн үзлэгүүд (${createdInspections.length}):\n• ${createdInspections.map(i => i.title).join('\n• ')}`);
      }
      
      return res.status(400).json({
        error: 'Cannot delete',
        message: `Энэ хэрэглэгчтэй холбоотой үзлэгүүд байна:${details.join('\n')}\n\nЭхлээд эдгээр үзлэгүүдийг устгана уу эсвэл өөр хэрэглэгчид шилжүүлнэ үү.`,
        inspections: {
          assigned: assignedInspections.map(i => ({ id: i.id.toString(), title: i.title })),
          created: createdInspections.map(i => ({ id: i.id.toString(), title: i.title })),
        },
      });
    }

    // Hard delete - permanently remove from database
    console.log(`🗑️ Attempting to delete user: ${existingUser.fullName} (ID=${id})`);
    const deletedUser = await prisma.User.delete({
      where: { id: BigInt(id) },
    });

    console.log(`✅ User deleted successfully: ${deletedUser.fullName} (ID=${id})`);
    res.json({
      message: 'User deleted successfully',
    });
  } catch (error) {
    return handleError(res, error, 'delete user');
  }
});

module.exports = router;
