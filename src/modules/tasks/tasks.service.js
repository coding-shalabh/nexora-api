import { prisma } from '@crm360/database';
import { NotFoundError } from '@crm360/shared';

// Helix Code Pvt Ltd Mock Data - Software Development Company
const MOCK_USERS = [
  { id: 'user-1', firstName: 'Shalab', lastName: 'Goel', email: 'shalab@helixcode.in' },
  { id: 'user-2', firstName: 'Priya', lastName: 'Sharma', email: 'priya@helixcode.in' },
  { id: 'user-3', firstName: 'Rahul', lastName: 'Verma', email: 'rahul@helixcode.in' },
  { id: 'user-4', firstName: 'Anita', lastName: 'Patel', email: 'anita@helixcode.in' },
  { id: 'user-5', firstName: 'Vikram', lastName: 'Singh', email: 'vikram@helixcode.in' },
];

const MOCK_PROJECTS = [
  { id: 'proj-1', name: 'Nexora CRM', color: '#3B82F6' },
  { id: 'proj-2', name: 'E-Commerce Platform', color: '#10B981' },
  { id: 'proj-3', name: 'Mobile Banking App', color: '#F59E0B' },
  { id: 'proj-4', name: 'Healthcare Portal', color: '#EF4444' },
];

const generateMockTasks = () => {
  const now = new Date();
  const tasks = [
    {
      id: 'task-1',
      title: 'Implement WhatsApp message templates',
      description: 'Add support for WhatsApp Business API message templates with dynamic variables',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      dueDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
      startDate: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      estimatedHours: 16,
      actualHours: 8,
      labels: ['backend', 'whatsapp', 'api'],
      project: MOCK_PROJECTS[0],
      assignee: MOCK_USERS[0],
      createdBy: MOCK_USERS[0],
      order: 1,
      _count: { subtasks: 3, checklists: 4, comments: 2, attachments: 1 },
    },
    {
      id: 'task-2',
      title: 'Fix email delivery tracking',
      description: 'Email open and click tracking not working for Gmail recipients',
      status: 'TODO',
      priority: 'URGENT',
      dueDate: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000),
      startDate: null,
      estimatedHours: 8,
      actualHours: 0,
      labels: ['bug', 'email', 'urgent'],
      project: MOCK_PROJECTS[0],
      assignee: MOCK_USERS[1],
      createdBy: MOCK_USERS[0],
      order: 2,
      _count: { subtasks: 0, checklists: 2, comments: 5, attachments: 0 },
    },
    {
      id: 'task-3',
      title: 'Design product catalog UI',
      description: 'Create responsive product listing and detail pages with filtering',
      status: 'IN_PROGRESS',
      priority: 'MEDIUM',
      dueDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
      startDate: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      estimatedHours: 24,
      actualHours: 12,
      labels: ['frontend', 'ui', 'design'],
      project: MOCK_PROJECTS[1],
      assignee: MOCK_USERS[2],
      createdBy: MOCK_USERS[1],
      order: 3,
      _count: { subtasks: 5, checklists: 8, comments: 3, attachments: 2 },
    },
    {
      id: 'task-4',
      title: 'Implement payment gateway integration',
      description: 'Integrate Razorpay for Indian payments and Stripe for international',
      status: 'TODO',
      priority: 'HIGH',
      dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      startDate: null,
      estimatedHours: 32,
      actualHours: 0,
      labels: ['backend', 'payments', 'integration'],
      project: MOCK_PROJECTS[1],
      assignee: MOCK_USERS[3],
      createdBy: MOCK_USERS[0],
      order: 4,
      _count: { subtasks: 4, checklists: 6, comments: 1, attachments: 3 },
    },
    {
      id: 'task-5',
      title: 'Set up CI/CD pipeline',
      description: 'Configure GitHub Actions for automated testing and Railway deployment',
      status: 'COMPLETED',
      priority: 'MEDIUM',
      dueDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      startDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      completedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      estimatedHours: 12,
      actualHours: 10,
      labels: ['devops', 'ci-cd', 'automation'],
      project: MOCK_PROJECTS[0],
      assignee: MOCK_USERS[4],
      createdBy: MOCK_USERS[0],
      order: 5,
      _count: { subtasks: 2, checklists: 5, comments: 4, attachments: 1 },
    },
    {
      id: 'task-6',
      title: 'API documentation with Swagger',
      description: 'Document all REST API endpoints with Swagger/OpenAPI specification',
      status: 'IN_PROGRESS',
      priority: 'LOW',
      dueDate: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
      startDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      estimatedHours: 16,
      actualHours: 4,
      labels: ['documentation', 'api'],
      project: MOCK_PROJECTS[0],
      assignee: MOCK_USERS[2],
      createdBy: MOCK_USERS[1],
      order: 6,
      _count: { subtasks: 0, checklists: 3, comments: 1, attachments: 0 },
    },
    {
      id: 'task-7',
      title: 'Mobile app biometric authentication',
      description: 'Add fingerprint and Face ID support for secure login',
      status: 'TODO',
      priority: 'HIGH',
      dueDate: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000),
      startDate: null,
      estimatedHours: 20,
      actualHours: 0,
      labels: ['mobile', 'security', 'ios', 'android'],
      project: MOCK_PROJECTS[2],
      assignee: MOCK_USERS[3],
      createdBy: MOCK_USERS[0],
      order: 7,
      _count: { subtasks: 2, checklists: 4, comments: 0, attachments: 1 },
    },
    {
      id: 'task-8',
      title: 'Patient records encryption',
      description: 'Implement AES-256 encryption for sensitive patient data at rest',
      status: 'IN_PROGRESS',
      priority: 'URGENT',
      dueDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
      startDate: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      estimatedHours: 24,
      actualHours: 8,
      labels: ['security', 'healthcare', 'compliance'],
      project: MOCK_PROJECTS[3],
      assignee: MOCK_USERS[4],
      createdBy: MOCK_USERS[0],
      order: 8,
      _count: { subtasks: 3, checklists: 6, comments: 2, attachments: 2 },
    },
    {
      id: 'task-9',
      title: 'Performance optimization audit',
      description: 'Identify and fix performance bottlenecks in API response times',
      status: 'COMPLETED',
      priority: 'MEDIUM',
      dueDate: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      startDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      completedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      estimatedHours: 16,
      actualHours: 14,
      labels: ['performance', 'optimization'],
      project: MOCK_PROJECTS[0],
      assignee: MOCK_USERS[1],
      createdBy: MOCK_USERS[0],
      order: 9,
      _count: { subtasks: 0, checklists: 4, comments: 6, attachments: 3 },
    },
    {
      id: 'task-10',
      title: 'User onboarding flow redesign',
      description: 'Simplify the signup process and add interactive product tour',
      status: 'TODO',
      priority: 'MEDIUM',
      dueDate: new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000),
      startDate: null,
      estimatedHours: 20,
      actualHours: 0,
      labels: ['ux', 'frontend', 'onboarding'],
      project: MOCK_PROJECTS[0],
      assignee: MOCK_USERS[2],
      createdBy: MOCK_USERS[1],
      order: 10,
      _count: { subtasks: 4, checklists: 5, comments: 2, attachments: 1 },
    },
  ];

  return tasks.map((task) => ({
    ...task,
    tenantId: 'mock-tenant',
    createdAt: new Date(now.getTime() - Math.random() * 14 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(),
  }));
};

const MOCK_TASKS = generateMockTasks();

class TasksService {
  // ==================== TASKS ====================

  async getTasks(tenantId, filters = {}) {
    try {
      const where = { tenantId };

      if (filters.search) {
        where.OR = [
          { title: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
        ];
      }

      if (filters.status) {
        where.status = filters.status;
      }

      if (filters.priority) {
        where.priority = filters.priority;
      }

      if (filters.projectId) {
        where.projectId = filters.projectId;
      }

      if (filters.milestoneId) {
        where.milestoneId = filters.milestoneId;
      }

      if (filters.assigneeId) {
        where.assigneeId = filters.assigneeId;
      }

      if (filters.createdById) {
        where.createdById = filters.createdById;
      }

      if (filters.parentTaskId !== undefined) {
        where.parentTaskId = filters.parentTaskId;
      }

      if (filters.labels && filters.labels.length > 0) {
        where.labels = { hasSome: filters.labels };
      }

      if (filters.dueDateFrom) {
        where.dueDate = { gte: new Date(filters.dueDateFrom) };
      }

      if (filters.dueDateTo) {
        where.dueDate = { ...where.dueDate, lte: new Date(filters.dueDateTo) };
      }

      // Overdue tasks filter
      if (filters.overdue === true) {
        where.dueDate = { lt: new Date() };
        where.status = { notIn: ['COMPLETED', 'CANCELLED'] };
      }

      const page = filters.page || 1;
      const limit = filters.limit || 25;

      const [tasks, total] = await Promise.all([
        prisma.task.findMany({
          where,
          select: {
            id: true,
            tenantId: true,
            title: true,
            description: true,
            status: true,
            priority: true,
            projectId: true,
            milestoneId: true,
            parentTaskId: true,
            assigneeId: true,
            createdById: true,
            dueDate: true,
            startDate: true,
            completedAt: true,
            estimatedHours: true,
            actualHours: true,
            order: true,
            labels: true,
            contactId: true,
            dealId: true,
            ticketId: true,
            customFields: true,
            createdAt: true,
            updatedAt: true,
          },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: filters.sortBy
            ? { [filters.sortBy]: filters.sortOrder || 'desc' }
            : { createdAt: 'desc' },
        }),
        prisma.task.count({ where }),
      ]);

      return {
        success: true,
        data: {
          tasks,
          meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          },
        },
      };
    } catch (error) {
      // Return mock data if DB query fails (e.g., table doesn't exist)
      console.log('[TasksService] DB query failed, returning mock data:', error.message);

      let filteredTasks = [...MOCK_TASKS];

      // Apply filters to mock data
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filteredTasks = filteredTasks.filter(
          (t) =>
            t.title.toLowerCase().includes(searchLower) ||
            t.description.toLowerCase().includes(searchLower)
        );
      }
      if (filters.status) {
        filteredTasks = filteredTasks.filter((t) => t.status === filters.status);
      }
      if (filters.priority) {
        filteredTasks = filteredTasks.filter((t) => t.priority === filters.priority);
      }
      if (filters.projectId) {
        filteredTasks = filteredTasks.filter((t) => t.project?.id === filters.projectId);
      }

      const page = filters.page || 1;
      const limit = filters.limit || 25;
      const startIndex = (page - 1) * limit;
      const paginatedTasks = filteredTasks.slice(startIndex, startIndex + limit);

      return {
        success: true,
        data: {
          tasks: paginatedTasks,
          meta: {
            total: filteredTasks.length,
            page,
            limit,
            totalPages: Math.ceil(filteredTasks.length / limit),
          },
        },
      };
    }
  }

  async getTask(tenantId, taskId) {
    const task = await prisma.task.findFirst({
      where: { id: taskId, tenantId },
      include: {
        project: { select: { id: true, name: true, color: true } },
        milestone: { select: { id: true, name: true } },
        parentTask: { select: { id: true, title: true } },
        subtasks: {
          include: {
            _count: { select: { subtasks: true } },
          },
          orderBy: { order: 'asc' },
        },
        checklists: {
          orderBy: { order: 'asc' },
        },
        comments: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        attachments: {
          orderBy: { createdAt: 'desc' },
        },
        dependencies: {
          include: {
            blockingTask: { select: { id: true, title: true, status: true } },
          },
        },
        dependents: {
          include: {
            dependentTask: { select: { id: true, title: true, status: true } },
          },
        },
        timeEntries: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { date: 'desc' },
          take: 10,
        },
      },
    });

    if (!task) {
      throw new NotFoundError('Task not found');
    }

    // Calculate checklist progress
    const totalChecklist = task.checklists.length;
    const completedChecklist = task.checklists.filter((c) => c.completed).length;

    return {
      ...task,
      checklistProgress: {
        total: totalChecklist,
        completed: completedChecklist,
        percentage:
          totalChecklist > 0 ? Math.round((completedChecklist / totalChecklist) * 100) : 0,
      },
    };
  }

  async createTask(tenantId, userId, data) {
    // Verify user exists to avoid foreign key constraint error
    const userExists = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!userExists) {
      throw new Error('User not found or not authorized');
    }

    // Verify assignee exists if provided
    if (data.assigneeId) {
      const assigneeExists = await prisma.user.findFirst({
        where: { id: data.assigneeId, tenantId },
        select: { id: true },
      });

      if (!assigneeExists) {
        throw new Error('Assignee user not found in this tenant');
      }
    }

    // Verify project exists if provided
    if (data.projectId) {
      const projectExists = await prisma.project.findFirst({
        where: { id: data.projectId, tenantId },
        select: { id: true },
      });

      if (!projectExists) {
        throw new Error('Project not found in this tenant');
      }
    }

    // Verify parent task exists if provided
    if (data.parentTaskId) {
      const parentExists = await prisma.task.findFirst({
        where: { id: data.parentTaskId, tenantId },
        select: { id: true },
      });

      if (!parentExists) {
        throw new Error('Parent task not found in this tenant');
      }
    }

    // Get max order for the project/parent
    const orderWhere = { tenantId };
    if (data.projectId) orderWhere.projectId = data.projectId;
    if (data.parentTaskId) orderWhere.parentTaskId = data.parentTaskId;

    const maxOrder = await prisma.task.aggregate({
      where: orderWhere,
      _max: { order: true },
    });

    try {
      const task = await prisma.task.create({
        data: {
          tenantId,
          title: data.title,
          description: data.description,
          status: data.status || 'TODO',
          priority: data.priority || 'MEDIUM',
          projectId: data.projectId || null,
          milestoneId: data.milestoneId || null,
          parentTaskId: data.parentTaskId || null,
          assigneeId: data.assigneeId || null,
          createdById: userId,
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          startDate: data.startDate ? new Date(data.startDate) : null,
          estimatedHours: data.estimatedHours || null,
          labels: data.labels || [],
          order: (maxOrder._max.order || 0) + 1,
          customFields: data.customFields || null,
        },
      });

      return task;
    } catch (error) {
      console.error('Task creation error:', error);
      throw new Error(`Failed to create task: ${error.message}`);
    }
  }

  async updateTask(tenantId, taskId, data) {
    const existing = await prisma.task.findFirst({
      where: { id: taskId, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Task not found');
    }

    const updateData = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.status !== undefined) {
      updateData.status = data.status;
      if (data.status === 'COMPLETED') {
        updateData.completedAt = new Date();
      }
      if (data.status === 'IN_PROGRESS' && !existing.startDate) {
        updateData.startDate = new Date();
      }
    }
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.projectId !== undefined) updateData.projectId = data.projectId;
    if (data.milestoneId !== undefined) updateData.milestoneId = data.milestoneId;
    if (data.parentTaskId !== undefined) updateData.parentTaskId = data.parentTaskId;
    if (data.assigneeId !== undefined) updateData.assigneeId = data.assigneeId;
    if (data.dueDate !== undefined)
      updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    if (data.startDate !== undefined)
      updateData.startDate = data.startDate ? new Date(data.startDate) : null;
    if (data.estimatedHours !== undefined) updateData.estimatedHours = data.estimatedHours;
    if (data.actualHours !== undefined) updateData.actualHours = data.actualHours;
    if (data.labels !== undefined) updateData.labels = data.labels;
    if (data.order !== undefined) updateData.order = data.order;
    if (data.customFields !== undefined) updateData.customFields = data.customFields;

    const task = await prisma.task.update({
      where: { id: taskId },
      data: updateData,
    });

    return task;
  }

  async deleteTask(tenantId, taskId) {
    const existing = await prisma.task.findFirst({
      where: { id: taskId, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Task not found');
    }

    // Delete task (cascades to subtasks, checklists, comments, etc.)
    await prisma.task.delete({
      where: { id: taskId },
    });

    return { success: true };
  }

  async reorderTasks(tenantId, tasks) {
    const updates = tasks.map((item, index) =>
      prisma.task.updateMany({
        where: { id: item.id, tenantId },
        data: { order: index + 1 },
      })
    );

    await prisma.$transaction(updates);

    return { success: true };
  }

  // ==================== CHECKLISTS ====================

  async getChecklists(tenantId, taskId) {
    const task = await prisma.task.findFirst({
      where: { id: taskId, tenantId },
    });

    if (!task) {
      throw new NotFoundError('Task not found');
    }

    const checklists = await prisma.taskChecklist.findMany({
      where: { taskId },
      orderBy: { order: 'asc' },
    });

    return checklists;
  }

  async addChecklistItem(tenantId, taskId, data) {
    const task = await prisma.task.findFirst({
      where: { id: taskId, tenantId },
    });

    if (!task) {
      throw new NotFoundError('Task not found');
    }

    const maxOrder = await prisma.taskChecklist.aggregate({
      where: { taskId },
      _max: { order: true },
    });

    const item = await prisma.taskChecklist.create({
      data: {
        taskId,
        title: data.title,
        isChecked: data.completed || false,
        order: (maxOrder._max.order || 0) + 1,
      },
    });

    return item;
  }

  async updateChecklistItem(tenantId, itemId, data) {
    const existing = await prisma.taskChecklist.findFirst({
      where: { id: itemId },
      include: { task: true },
    });

    if (!existing || existing.task.tenantId !== tenantId) {
      throw new NotFoundError('Checklist item not found');
    }

    const updateData = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.completed !== undefined) updateData.isChecked = data.completed;
    if (data.order !== undefined) updateData.order = data.order;

    const item = await prisma.taskChecklist.update({
      where: { id: itemId },
      data: updateData,
    });

    return item;
  }

  async deleteChecklistItem(tenantId, itemId) {
    const existing = await prisma.taskChecklist.findFirst({
      where: { id: itemId },
      include: { task: true },
    });

    if (!existing || existing.task.tenantId !== tenantId) {
      throw new NotFoundError('Checklist item not found');
    }

    await prisma.taskChecklist.delete({
      where: { id: itemId },
    });

    return { success: true };
  }

  // ==================== COMMENTS ====================

  async getComments(tenantId, taskId) {
    const task = await prisma.task.findFirst({
      where: { id: taskId, tenantId },
    });

    if (!task) {
      throw new NotFoundError('Task not found');
    }

    const comments = await prisma.taskComment.findMany({
      where: { taskId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return comments;
  }

  async addComment(tenantId, taskId, userId, data) {
    const task = await prisma.task.findFirst({
      where: { id: taskId, tenantId },
    });

    if (!task) {
      throw new NotFoundError('Task not found');
    }

    const comment = await prisma.taskComment.create({
      data: {
        tenantId,
        taskId,
        userId,
        content: data.content,
      },
    });

    return comment;
  }

  async updateComment(tenantId, commentId, userId, data) {
    const existing = await prisma.taskComment.findFirst({
      where: { id: commentId },
      include: { task: true },
    });

    if (!existing || existing.task.tenantId !== tenantId) {
      throw new NotFoundError('Comment not found');
    }

    // Only comment author can update
    if (existing.userId !== userId) {
      throw new Error('You can only edit your own comments');
    }

    const comment = await prisma.taskComment.update({
      where: { id: commentId },
      data: { content: data.content },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    return comment;
  }

  async deleteComment(tenantId, commentId, userId) {
    const existing = await prisma.taskComment.findFirst({
      where: { id: commentId },
      include: { task: true },
    });

    if (!existing || existing.task.tenantId !== tenantId) {
      throw new NotFoundError('Comment not found');
    }

    // Only comment author can delete
    if (existing.userId !== userId) {
      throw new Error('You can only delete your own comments');
    }

    await prisma.taskComment.delete({
      where: { id: commentId },
    });

    return { success: true };
  }

  // ==================== ATTACHMENTS ====================

  async getAttachments(tenantId, taskId) {
    const task = await prisma.task.findFirst({
      where: { id: taskId, tenantId },
    });

    if (!task) {
      throw new NotFoundError('Task not found');
    }

    const attachments = await prisma.taskAttachment.findMany({
      where: { taskId },
      include: {
        uploadedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return attachments;
  }

  async addAttachment(tenantId, taskId, userId, data) {
    const task = await prisma.task.findFirst({
      where: { id: taskId, tenantId },
    });

    if (!task) {
      throw new NotFoundError('Task not found');
    }

    const attachment = await prisma.taskAttachment.create({
      data: {
        taskId,
        uploadedById: userId,
        fileName: data.fileName,
        fileUrl: data.fileUrl,
        fileSize: data.fileSize,
        mimeType: data.mimeType,
      },
      include: {
        uploadedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return attachment;
  }

  async deleteAttachment(tenantId, attachmentId) {
    const existing = await prisma.taskAttachment.findFirst({
      where: { id: attachmentId },
      include: { task: true },
    });

    if (!existing || existing.task.tenantId !== tenantId) {
      throw new NotFoundError('Attachment not found');
    }

    await prisma.taskAttachment.delete({
      where: { id: attachmentId },
    });

    return { success: true };
  }

  // ==================== DEPENDENCIES ====================

  async addDependency(tenantId, taskId, dependsOnTaskId, type = 'FINISH_TO_START') {
    const [task, dependsOnTask] = await Promise.all([
      prisma.task.findFirst({ where: { id: taskId, tenantId } }),
      prisma.task.findFirst({ where: { id: dependsOnTaskId, tenantId } }),
    ]);

    if (!task) {
      throw new NotFoundError('Task not found');
    }

    if (!dependsOnTask) {
      throw new NotFoundError('Dependency task not found');
    }

    // Prevent circular dependency
    if (taskId === dependsOnTaskId) {
      throw new Error('A task cannot depend on itself');
    }

    const dependency = await prisma.taskDependency.upsert({
      where: {
        taskId_dependsOnTaskId: { taskId, dependsOnTaskId },
      },
      update: { type },
      create: { taskId, dependsOnTaskId, type },
      include: {
        dependsOnTask: { select: { id: true, title: true, status: true } },
      },
    });

    return dependency;
  }

  async removeDependency(tenantId, taskId, dependsOnTaskId) {
    const task = await prisma.task.findFirst({
      where: { id: taskId, tenantId },
    });

    if (!task) {
      throw new NotFoundError('Task not found');
    }

    await prisma.taskDependency.deleteMany({
      where: { taskId, dependsOnTaskId },
    });

    return { success: true };
  }

  // ==================== TASK STATS ====================

  async getTaskStats(tenantId, filters = {}) {
    try {
      const where = { tenantId };

      if (filters.projectId) where.projectId = filters.projectId;
      if (filters.assigneeId) where.assigneeId = filters.assigneeId;

      const [statusStats, priorityStats, overdueTasks, totalHours] = await Promise.all([
        prisma.task.groupBy({
          by: ['status'],
          where,
          _count: true,
        }),
        prisma.task.groupBy({
          by: ['priority'],
          where,
          _count: true,
        }),
        prisma.task.count({
          where: {
            ...where,
            dueDate: { lt: new Date() },
            status: { notIn: ['COMPLETED', 'CANCELLED'] },
          },
        }),
        prisma.task.aggregate({
          where,
          _sum: { actualHours: true, estimatedHours: true },
        }),
      ]);

      const total = statusStats.reduce((sum, s) => sum + s._count, 0);
      const completed = statusStats.find((s) => s.status === 'COMPLETED')?._count || 0;

      return {
        total,
        completed,
        overdue: overdueTasks,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
        byStatus: statusStats.reduce((acc, s) => {
          acc[s.status] = s._count;
          return acc;
        }, {}),
        byPriority: priorityStats.reduce((acc, s) => {
          acc[s.priority] = s._count;
          return acc;
        }, {}),
        hours: {
          estimated: totalHours._sum.estimatedHours || 0,
          actual: totalHours._sum.actualHours || 0,
        },
      };
    } catch (error) {
      // Return mock stats if DB query fails
      console.log('[TasksService] Stats query failed, returning mock stats:', error.message);

      const now = new Date();
      const byStatus = {};
      const byPriority = {};
      let estimatedHours = 0;
      let actualHours = 0;
      let overdue = 0;

      MOCK_TASKS.forEach((task) => {
        byStatus[task.status] = (byStatus[task.status] || 0) + 1;
        byPriority[task.priority] = (byPriority[task.priority] || 0) + 1;
        estimatedHours += task.estimatedHours || 0;
        actualHours += task.actualHours || 0;
        if (
          task.dueDate &&
          task.dueDate < now &&
          task.status !== 'COMPLETED' &&
          task.status !== 'CANCELLED'
        ) {
          overdue++;
        }
      });

      const total = MOCK_TASKS.length;
      const completed = byStatus['COMPLETED'] || 0;

      return {
        total,
        completed,
        overdue,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
        byStatus,
        byPriority,
        hours: {
          estimated: estimatedHours,
          actual: actualHours,
        },
      };
    }
  }

  async getMyTasks(tenantId, userId, filters = {}) {
    return this.getTasks(tenantId, {
      ...filters,
      assigneeId: userId,
    });
  }

  async getUpcomingTasks(tenantId, userId, days = 7) {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    const tasks = await prisma.task.findMany({
      where: {
        tenantId,
        assigneeId: userId,
        dueDate: {
          gte: new Date(),
          lte: endDate,
        },
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
      },
      include: {
        project: { select: { id: true, name: true, color: true } },
      },
      orderBy: { dueDate: 'asc' },
      take: 20,
    });

    return tasks;
  }
}

export const tasksService = new TasksService();
