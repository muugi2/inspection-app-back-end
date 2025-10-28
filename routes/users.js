const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware } = require('../middleware/auth');
const bcrypt = require('bcrypt');

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
    console.error('Error fetching users:', error);
    res.status(500).json({
      error: 'Failed to fetch users',
      message:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    });
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
    console.error('Error fetching users by organization:', error);
    res.status(500).json({
      error: 'Failed to fetch users',
      message:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    });
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
    console.error('Error fetching profile:', error);
    res.status(500).json({
      error: 'Failed to fetch profile',
      message:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    });
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
    console.error('Error fetching user:', error);
    res.status(500).json({
      error: 'Failed to fetch user',
      message:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    });
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
    console.error('Error creating user:', error);
    console.error('Error details:', error.message);
    console.error('Stack trace:', error.stack);
    res.status(500).json({
      error: 'Failed to create user',
      message:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    });
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
    console.error('Error updating user:', error);
    res.status(500).json({
      error: 'Failed to update user',
      message:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    });
  }
});

// DELETE user (protected route)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

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

    // Use soft delete by setting deletedAt timestamp
    await prisma.User.update({
      where: { id: BigInt(id) },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });

    res.json({
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      error: 'Failed to delete user',
      message:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    });
  }
});

module.exports = router;
