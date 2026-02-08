/**
 * HR Module Service
 * Handles employees, leave, attendance, and org chart functionality
 */

import { prisma } from '@crm360/database';

export const hrService = {
  // ==================== EMPLOYEES ====================

  async listEmployees({ tenantId, page = 1, limit = 20, status, department, search }) {
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      deletedAt: null,
    };

    if (status) {
      where.status = status;
    }

    if (department) {
      where.department = department;
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { employeeId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.employee.count({ where }),
    ]);

    return {
      data: employees,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async getEmployee({ tenantId, employeeId }) {
    const employee = await prisma.employee.findFirst({
      where: {
        id: employeeId,
        tenantId,
        deletedAt: null,
      },
    });

    if (!employee) {
      throw new Error('Employee not found');
    }

    return employee;
  },

  async createEmployee({ tenantId, data }) {
    const employee = await prisma.employee.create({
      data: {
        tenantId,
        ...data,
        status: data.status || 'ACTIVE',
      },
    });

    return employee;
  },

  async updateEmployee({ tenantId, employeeId, data }) {
    const employee = await prisma.employee.updateMany({
      where: {
        id: employeeId,
        tenantId,
        deletedAt: null,
      },
      data,
    });

    if (employee.count === 0) {
      throw new Error('Employee not found');
    }

    return this.getEmployee({ tenantId, employeeId });
  },

  async deleteEmployee({ tenantId, employeeId }) {
    const result = await prisma.employee.updateMany({
      where: {
        id: employeeId,
        tenantId,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    if (result.count === 0) {
      throw new Error('Employee not found');
    }

    return { success: true };
  },

  // ==================== LEAVE ====================

  async listLeaveRequests({ tenantId, page = 1, limit = 20, status, employeeId }) {
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
    };

    if (status) {
      where.status = status;
    }

    if (employeeId) {
      where.employeeId = employeeId;
    }

    const [requests, total] = await Promise.all([
      prisma.leaveRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
      prisma.leaveRequest.count({ where }),
    ]);

    return {
      data: requests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async createLeaveRequest({ tenantId, employeeId, data }) {
    const request = await prisma.leaveRequest.create({
      data: {
        tenantId,
        employeeId,
        ...data,
        status: 'PENDING',
      },
    });

    return request;
  },

  async approveLeaveRequest({ tenantId, requestId, approverId }) {
    const request = await prisma.leaveRequest.updateMany({
      where: {
        id: requestId,
        tenantId,
        status: 'PENDING',
      },
      data: {
        status: 'APPROVED',
        approvedBy: approverId,
        approvedAt: new Date(),
      },
    });

    if (request.count === 0) {
      throw new Error('Leave request not found or already processed');
    }

    return { success: true };
  },

  async rejectLeaveRequest({ tenantId, requestId, approverId, reason }) {
    const request = await prisma.leaveRequest.updateMany({
      where: {
        id: requestId,
        tenantId,
        status: 'PENDING',
      },
      data: {
        status: 'REJECTED',
        approvedBy: approverId,
        approvedAt: new Date(),
        rejectionReason: reason,
      },
    });

    if (request.count === 0) {
      throw new Error('Leave request not found or already processed');
    }

    return { success: true };
  },

  async getLeaveBalance({ tenantId, employeeId }) {
    // Get current year's leave balance
    const currentYear = new Date().getFullYear();

    const balance = await prisma.leaveBalance.findFirst({
      where: {
        tenantId,
        employeeId,
        year: currentYear,
      },
    });

    if (!balance) {
      // Return default balance if not set
      return {
        annual: 20,
        sick: 10,
        personal: 5,
        used: {
          annual: 0,
          sick: 0,
          personal: 0,
        },
      };
    }

    return balance;
  },

  // ==================== ATTENDANCE ====================

  async listAttendance({ tenantId, page = 1, limit = 20, date, employeeId }) {
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
    };

    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      where.date = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }

    if (employeeId) {
      where.employeeId = employeeId;
    }

    const [records, total] = await Promise.all([
      prisma.attendance.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: 'desc' },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
      prisma.attendance.count({ where }),
    ]);

    return {
      data: records,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async checkIn({ tenantId, employeeId, location }) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if already checked in today
    const existing = await prisma.attendance.findFirst({
      where: {
        tenantId,
        employeeId,
        date: {
          gte: today,
        },
      },
    });

    if (existing && existing.checkIn) {
      throw new Error('Already checked in today');
    }

    const attendance = await prisma.attendance.upsert({
      where: {
        tenantId_employeeId_date: {
          tenantId,
          employeeId,
          date: today,
        },
      },
      update: {
        checkIn: new Date(),
        checkInLocation: location,
      },
      create: {
        tenantId,
        employeeId,
        date: today,
        checkIn: new Date(),
        checkInLocation: location,
        status: 'PRESENT',
      },
    });

    return attendance;
  },

  async checkOut({ tenantId, employeeId, location }) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await prisma.attendance.findFirst({
      where: {
        tenantId,
        employeeId,
        date: {
          gte: today,
        },
      },
    });

    if (!existing || !existing.checkIn) {
      throw new Error('Must check in first');
    }

    if (existing.checkOut) {
      throw new Error('Already checked out today');
    }

    const attendance = await prisma.attendance.update({
      where: { id: existing.id },
      data: {
        checkOut: new Date(),
        checkOutLocation: location,
      },
    });

    return attendance;
  },

  async getAttendanceReport({ tenantId, startDate, endDate, employeeId }) {
    const where = {
      tenantId,
      date: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
    };

    if (employeeId) {
      where.employeeId = employeeId;
    }

    const records = await prisma.attendance.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Calculate summary
    const summary = {
      totalDays: records.length,
      present: records.filter((r) => r.status === 'PRESENT').length,
      absent: records.filter((r) => r.status === 'ABSENT').length,
      late: records.filter((r) => r.status === 'LATE').length,
      halfDay: records.filter((r) => r.status === 'HALF_DAY').length,
    };

    return {
      records,
      summary,
    };
  },

  // ==================== ORG CHART ====================

  async getOrgChart({ tenantId }) {
    const employees = await prisma.employee.findMany({
      where: {
        tenantId,
        deletedAt: null,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        department: true,
        managerId: true,
        avatar: true,
      },
    });

    // Build hierarchical structure
    const buildTree = (employees, managerId = null) => {
      return employees
        .filter((e) => e.managerId === managerId)
        .map((employee) => ({
          ...employee,
          reports: buildTree(employees, employee.id),
        }));
    };

    return {
      data: buildTree(employees),
      flat: employees,
    };
  },

  async updateOrgChart({ tenantId, updates }) {
    // Update manager relationships
    const promises = updates.map(({ employeeId, managerId }) =>
      prisma.employee.updateMany({
        where: {
          id: employeeId,
          tenantId,
        },
        data: {
          managerId,
        },
      })
    );

    await Promise.all(promises);

    return this.getOrgChart({ tenantId });
  },
};
