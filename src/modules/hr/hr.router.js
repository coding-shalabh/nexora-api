/**
 * HR Module Router
 * Handles employees, leave, attendance, and org chart endpoints
 */

import { Router } from 'express';
import { z } from 'zod';
import { hrService } from './hr.service.js';

const router = Router();

// Validation schemas
const createEmployeeSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email'),
  employeeId: z.string().optional(),
  phone: z.string().optional(),
  role: z.string().optional(),
  department: z.string().optional(),
  managerId: z.string().optional(),
  joinDate: z.string().optional(),
  status: z.enum(['ACTIVE', 'ON_LEAVE', 'TERMINATED', 'PROBATION']).optional(),
});

const createLeaveRequestSchema = z.object({
  type: z.enum(['ANNUAL', 'SICK', 'PERSONAL', 'MATERNITY', 'PATERNITY', 'UNPAID']),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().optional(),
});

const validate = (schema) => (req, res, next) => {
  try {
    req.validatedBody = schema.parse(req.body);
    next();
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      details: error.errors,
    });
  }
};

// ==================== EMPLOYEES ====================

// GET /hr/employees - List all employees
router.get('/employees', async (req, res) => {
  try {
    const { page, limit, status, department, search } = req.query;

    const result = await hrService.listEmployees({
      tenantId: req.tenantId,
      page: parseInt(page) || 1,
      limit: Math.min(parseInt(limit) || 20, 100),
      status,
      department,
      search,
    });

    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('List employees error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /hr/employees/:id - Get employee details
router.get('/employees/:id', async (req, res) => {
  try {
    const employee = await hrService.getEmployee({
      tenantId: req.tenantId,
      employeeId: req.params.id,
    });

    return res.json({ success: true, data: employee });
  } catch (error) {
    console.error('Get employee error:', error);
    return res.status(404).json({ success: false, error: error.message });
  }
});

// POST /hr/employees - Create new employee
router.post('/employees', validate(createEmployeeSchema), async (req, res) => {
  try {
    const employee = await hrService.createEmployee({
      tenantId: req.tenantId,
      data: req.validatedBody,
    });

    return res.status(201).json({ success: true, data: employee });
  } catch (error) {
    console.error('Create employee error:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
});

// PUT /hr/employees/:id - Update employee
router.put('/employees/:id', async (req, res) => {
  try {
    const employee = await hrService.updateEmployee({
      tenantId: req.tenantId,
      employeeId: req.params.id,
      data: req.body,
    });

    return res.json({ success: true, data: employee });
  } catch (error) {
    console.error('Update employee error:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
});

// DELETE /hr/employees/:id - Delete employee (soft delete)
router.delete('/employees/:id', async (req, res) => {
  try {
    await hrService.deleteEmployee({
      tenantId: req.tenantId,
      employeeId: req.params.id,
    });

    return res.json({ success: true, message: 'Employee deleted' });
  } catch (error) {
    console.error('Delete employee error:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
});

// ==================== LEAVE ====================

// GET /hr/leave - List leave requests
router.get('/leave', async (req, res) => {
  try {
    const { page, limit, status, employeeId } = req.query;

    const result = await hrService.listLeaveRequests({
      tenantId: req.tenantId,
      page: parseInt(page) || 1,
      limit: Math.min(parseInt(limit) || 20, 100),
      status,
      employeeId,
    });

    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('List leave requests error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /hr/leave - Create leave request
router.post('/leave', validate(createLeaveRequestSchema), async (req, res) => {
  try {
    const request = await hrService.createLeaveRequest({
      tenantId: req.tenantId,
      employeeId: req.userId, // Current user as employee
      data: req.validatedBody,
    });

    return res.status(201).json({ success: true, data: request });
  } catch (error) {
    console.error('Create leave request error:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
});

// PUT /hr/leave/:id/approve - Approve leave request
router.put('/leave/:id/approve', async (req, res) => {
  try {
    await hrService.approveLeaveRequest({
      tenantId: req.tenantId,
      requestId: req.params.id,
      approverId: req.userId,
    });

    return res.json({ success: true, message: 'Leave request approved' });
  } catch (error) {
    console.error('Approve leave error:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
});

// PUT /hr/leave/:id/reject - Reject leave request
router.put('/leave/:id/reject', async (req, res) => {
  try {
    const { reason } = req.body;

    await hrService.rejectLeaveRequest({
      tenantId: req.tenantId,
      requestId: req.params.id,
      approverId: req.userId,
      reason,
    });

    return res.json({ success: true, message: 'Leave request rejected' });
  } catch (error) {
    console.error('Reject leave error:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
});

// GET /hr/leave/balance - Get current user's leave balance
router.get('/leave/balance', async (req, res) => {
  try {
    const balance = await hrService.getLeaveBalance({
      tenantId: req.tenantId,
      employeeId: req.userId,
    });

    return res.json({ success: true, data: balance });
  } catch (error) {
    console.error('Get leave balance error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== ATTENDANCE ====================

// GET /hr/attendance - List attendance records
router.get('/attendance', async (req, res) => {
  try {
    const { page, limit, date, employeeId } = req.query;

    const result = await hrService.listAttendance({
      tenantId: req.tenantId,
      page: parseInt(page) || 1,
      limit: Math.min(parseInt(limit) || 20, 100),
      date,
      employeeId,
    });

    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('List attendance error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /hr/attendance/check-in - Check in
router.post('/attendance/check-in', async (req, res) => {
  try {
    const { location } = req.body;

    const attendance = await hrService.checkIn({
      tenantId: req.tenantId,
      employeeId: req.userId,
      location,
    });

    return res.json({ success: true, data: attendance });
  } catch (error) {
    console.error('Check in error:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
});

// POST /hr/attendance/check-out - Check out
router.post('/attendance/check-out', async (req, res) => {
  try {
    const { location } = req.body;

    const attendance = await hrService.checkOut({
      tenantId: req.tenantId,
      employeeId: req.userId,
      location,
    });

    return res.json({ success: true, data: attendance });
  } catch (error) {
    console.error('Check out error:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
});

// GET /hr/attendance/report - Get attendance report
router.get('/attendance/report', async (req, res) => {
  try {
    const { startDate, endDate, employeeId } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate are required',
      });
    }

    const report = await hrService.getAttendanceReport({
      tenantId: req.tenantId,
      startDate,
      endDate,
      employeeId,
    });

    return res.json({ success: true, data: report });
  } catch (error) {
    console.error('Get attendance report error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== ORG CHART ====================

// GET /hr/org-chart - Get organization chart
router.get('/org-chart', async (req, res) => {
  try {
    const orgChart = await hrService.getOrgChart({
      tenantId: req.tenantId,
    });

    return res.json({ success: true, ...orgChart });
  } catch (error) {
    console.error('Get org chart error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /hr/org-chart - Update org chart (manager relationships)
router.put('/org-chart', async (req, res) => {
  try {
    const { updates } = req.body;

    if (!updates || !Array.isArray(updates)) {
      return res.status(400).json({
        success: false,
        error: 'updates array is required',
      });
    }

    const orgChart = await hrService.updateOrgChart({
      tenantId: req.tenantId,
      updates,
    });

    return res.json({ success: true, ...orgChart });
  } catch (error) {
    console.error('Update org chart error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== RECRUITMENT (placeholder) ====================

// GET /hr/jobs - List job postings
router.get('/jobs', async (req, res) => {
  // Placeholder - returns empty list until recruitment module is fully implemented
  return res.json({
    success: true,
    data: [],
    pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
  });
});

// GET /hr/applicants - List applicants
router.get('/applicants', async (req, res) => {
  // Placeholder - returns empty list until recruitment module is fully implemented
  return res.json({
    success: true,
    data: [],
    pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
  });
});

export { router as hrRouter };
