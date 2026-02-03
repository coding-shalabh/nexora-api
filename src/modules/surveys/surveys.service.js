import { prisma } from '@crm360/database';
import { NotFoundError } from '@crm360/shared';

class SurveysService {
  // ==========================================
  // SURVEYS
  // ==========================================

  async getSurveys(tenantId, filters = {}) {
    // TODO: Surveys feature not yet implemented - Survey model doesn't exist
    // Return empty surveys data for now
    const page = filters.page || 1;
    const limit = filters.limit || 25;

    return {
      surveys: [],
      meta: {
        total: 0,
        page,
        limit,
        totalPages: 0,
      },
    };
  }

  async getSurvey(tenantId, surveyId) {
    const survey = await prisma.survey.findFirst({
      where: { id: surveyId, tenantId },
      include: {
        questions: {
          orderBy: { order: 'asc' },
        },
        _count: {
          select: { responses: true },
        },
      },
    });

    if (!survey) {
      throw new NotFoundError('Survey not found');
    }

    return {
      ...survey,
      responseCount: survey._count.responses,
    };
  }

  async createSurvey(tenantId, data) {
    const survey = await prisma.survey.create({
      data: {
        tenantId,
        name: data.name,
        description: data.description,
        type: data.type || 'CUSTOM',
        status: data.status || 'DRAFT',
        isAnonymous: data.isAnonymous ?? false,
        showProgressBar: data.showProgressBar ?? true,
        allowMultiple: data.allowMultiple ?? false,
        thankYouMessage: data.thankYouMessage || 'Thank you for your feedback!',
        redirectUrl: data.redirectUrl,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
      },
    });

    // Create default questions based on survey type
    if (data.type === 'NPS') {
      await prisma.surveyQuestion.create({
        data: {
          surveyId: survey.id,
          type: 'NPS',
          question: 'How likely are you to recommend us to a friend or colleague?',
          isRequired: true,
          order: 0,
          settings: { min: 0, max: 10 },
        },
      });
    } else if (data.type === 'CSAT') {
      await prisma.surveyQuestion.create({
        data: {
          surveyId: survey.id,
          type: 'RATING',
          question: 'How satisfied are you with our service?',
          isRequired: true,
          order: 0,
          settings: {
            min: 1,
            max: 5,
            labels: ['Very Dissatisfied', 'Dissatisfied', 'Neutral', 'Satisfied', 'Very Satisfied'],
          },
        },
      });
    } else if (data.type === 'CES') {
      await prisma.surveyQuestion.create({
        data: {
          surveyId: survey.id,
          type: 'SCALE',
          question: 'How easy was it to resolve your issue?',
          isRequired: true,
          order: 0,
          settings: {
            min: 1,
            max: 7,
            labels: [
              'Very Difficult',
              'Difficult',
              'Somewhat Difficult',
              'Neutral',
              'Somewhat Easy',
              'Easy',
              'Very Easy',
            ],
          },
        },
      });
    }

    return this.getSurvey(tenantId, survey.id);
  }

  async updateSurvey(tenantId, surveyId, data) {
    const survey = await prisma.survey.findFirst({
      where: { id: surveyId, tenantId },
    });

    if (!survey) {
      throw new NotFoundError('Survey not found');
    }

    const updateData = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.isAnonymous !== undefined) updateData.isAnonymous = data.isAnonymous;
    if (data.showProgressBar !== undefined) updateData.showProgressBar = data.showProgressBar;
    if (data.allowMultiple !== undefined) updateData.allowMultiple = data.allowMultiple;
    if (data.thankYouMessage !== undefined) updateData.thankYouMessage = data.thankYouMessage;
    if (data.redirectUrl !== undefined) updateData.redirectUrl = data.redirectUrl;
    if (data.startDate !== undefined)
      updateData.startDate = data.startDate ? new Date(data.startDate) : null;
    if (data.endDate !== undefined)
      updateData.endDate = data.endDate ? new Date(data.endDate) : null;

    return prisma.survey.update({
      where: { id: surveyId },
      data: updateData,
      include: {
        questions: { orderBy: { order: 'asc' } },
        _count: { select: { responses: true } },
      },
    });
  }

  async deleteSurvey(tenantId, surveyId) {
    const survey = await prisma.survey.findFirst({
      where: { id: surveyId, tenantId },
    });

    if (!survey) {
      throw new NotFoundError('Survey not found');
    }

    await prisma.survey.delete({
      where: { id: surveyId },
    });

    return { success: true };
  }

  async duplicateSurvey(tenantId, surveyId) {
    const original = await prisma.survey.findFirst({
      where: { id: surveyId, tenantId },
      include: { questions: true },
    });

    if (!original) {
      throw new NotFoundError('Survey not found');
    }

    const newSurvey = await prisma.survey.create({
      data: {
        tenantId,
        name: `${original.name} (Copy)`,
        description: original.description,
        type: original.type,
        status: 'DRAFT',
        isAnonymous: original.isAnonymous,
        showProgressBar: original.showProgressBar,
        allowMultiple: original.allowMultiple,
        thankYouMessage: original.thankYouMessage,
        redirectUrl: original.redirectUrl,
      },
    });

    // Copy questions
    for (const q of original.questions) {
      await prisma.surveyQuestion.create({
        data: {
          surveyId: newSurvey.id,
          type: q.type,
          question: q.question,
          description: q.description,
          options: q.options,
          isRequired: q.isRequired,
          order: q.order,
          settings: q.settings,
        },
      });
    }

    return this.getSurvey(tenantId, newSurvey.id);
  }

  // ==========================================
  // QUESTIONS
  // ==========================================

  async addQuestion(tenantId, surveyId, data) {
    const survey = await prisma.survey.findFirst({
      where: { id: surveyId, tenantId },
    });

    if (!survey) {
      throw new NotFoundError('Survey not found');
    }

    const maxOrder = await prisma.surveyQuestion.aggregate({
      where: { surveyId },
      _max: { order: true },
    });

    const question = await prisma.surveyQuestion.create({
      data: {
        surveyId,
        type: data.type,
        question: data.question,
        description: data.description,
        options: data.options,
        isRequired: data.isRequired ?? true,
        order: data.order ?? (maxOrder._max.order || 0) + 1,
        settings: data.settings,
      },
    });

    return question;
  }

  async updateQuestion(tenantId, surveyId, questionId, data) {
    const survey = await prisma.survey.findFirst({
      where: { id: surveyId, tenantId },
    });

    if (!survey) {
      throw new NotFoundError('Survey not found');
    }

    const question = await prisma.surveyQuestion.findFirst({
      where: { id: questionId, surveyId },
    });

    if (!question) {
      throw new NotFoundError('Question not found');
    }

    const updateData = {};
    if (data.type !== undefined) updateData.type = data.type;
    if (data.question !== undefined) updateData.question = data.question;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.options !== undefined) updateData.options = data.options;
    if (data.isRequired !== undefined) updateData.isRequired = data.isRequired;
    if (data.order !== undefined) updateData.order = data.order;
    if (data.settings !== undefined) updateData.settings = data.settings;

    return prisma.surveyQuestion.update({
      where: { id: questionId },
      data: updateData,
    });
  }

  async deleteQuestion(tenantId, surveyId, questionId) {
    const survey = await prisma.survey.findFirst({
      where: { id: surveyId, tenantId },
    });

    if (!survey) {
      throw new NotFoundError('Survey not found');
    }

    await prisma.surveyQuestion.delete({
      where: { id: questionId },
    });

    return { success: true };
  }

  // ==========================================
  // RESPONSES
  // ==========================================

  async getResponses(tenantId, surveyId, filters = {}) {
    const survey = await prisma.survey.findFirst({
      where: { id: surveyId, tenantId },
    });

    if (!survey) {
      throw new NotFoundError('Survey not found');
    }

    const page = filters.page || 1;
    const limit = filters.limit || 25;

    const [responses, total] = await Promise.all([
      prisma.surveyResponse.findMany({
        where: { surveyId },
        include: {
          answers: {
            include: {
              question: { select: { question: true, type: true } },
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.surveyResponse.count({ where: { surveyId } }),
    ]);

    return {
      responses,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async submitResponse(surveyId, data) {
    const survey = await prisma.survey.findFirst({
      where: { id: surveyId, status: 'ACTIVE' },
      include: { questions: true },
    });

    if (!survey) {
      throw new NotFoundError('Survey not found or not active');
    }

    // Create response
    const response = await prisma.surveyResponse.create({
      data: {
        surveyId,
        contactId: data.contactId,
        ticketId: data.ticketId,
        sessionId: data.sessionId,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        completedAt: new Date(),
        metadata: data.metadata,
      },
    });

    // Create answers
    let totalScore = 0;
    let scoreCount = 0;

    for (const answer of data.answers || []) {
      await prisma.surveyAnswer.create({
        data: {
          responseId: response.id,
          questionId: answer.questionId,
          value: answer.value,
          numericValue: answer.numericValue,
          metadata: answer.metadata,
        },
      });

      if (answer.numericValue !== undefined) {
        totalScore += answer.numericValue;
        scoreCount++;
      }
    }

    // Update response with total score
    if (scoreCount > 0) {
      await prisma.surveyResponse.update({
        where: { id: response.id },
        data: { totalScore: totalScore / scoreCount },
      });
    }

    // Update survey response count and average score
    const stats = await prisma.surveyResponse.aggregate({
      where: { surveyId },
      _count: true,
      _avg: { totalScore: true },
    });

    await prisma.survey.update({
      where: { id: surveyId },
      data: {
        responseCount: stats._count,
        avgScore: stats._avg.totalScore,
      },
    });

    return response;
  }

  // ==========================================
  // STATS
  // ==========================================

  async getStats(tenantId) {
    const [total, active, draft, totalResponses] = await Promise.all([
      prisma.survey.count({ where: { tenantId } }),
      prisma.survey.count({ where: { tenantId, status: 'ACTIVE' } }),
      prisma.survey.count({ where: { tenantId, status: 'DRAFT' } }),
      prisma.surveyResponse.count({
        where: { survey: { tenantId } },
      }),
    ]);

    const avgScore = await prisma.survey.aggregate({
      where: { tenantId, avgScore: { not: null } },
      _avg: { avgScore: true },
    });

    return {
      total,
      active,
      draft,
      completed: total - active - draft,
      totalResponses,
      avgScore: avgScore._avg.avgScore || 0,
    };
  }

  async getSurveyAnalytics(tenantId, surveyId) {
    const survey = await prisma.survey.findFirst({
      where: { id: surveyId, tenantId },
      include: {
        questions: true,
        responses: {
          include: { answers: true },
          orderBy: { createdAt: 'desc' },
          take: 100,
        },
      },
    });

    if (!survey) {
      throw new NotFoundError('Survey not found');
    }

    // Calculate analytics for each question
    const questionAnalytics = await Promise.all(
      survey.questions.map(async (question) => {
        const answers = await prisma.surveyAnswer.findMany({
          where: { questionId: question.id },
        });

        const numericAnswers = answers.filter((a) => a.numericValue !== null);
        const avgValue =
          numericAnswers.length > 0
            ? numericAnswers.reduce((sum, a) => sum + a.numericValue, 0) / numericAnswers.length
            : null;

        // Count value distribution
        const distribution = {};
        answers.forEach((a) => {
          const key = a.value || String(a.numericValue);
          distribution[key] = (distribution[key] || 0) + 1;
        });

        return {
          questionId: question.id,
          question: question.question,
          type: question.type,
          totalAnswers: answers.length,
          avgValue,
          distribution,
        };
      })
    );

    // Response over time (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const responsesOverTime = await prisma.surveyResponse.groupBy({
      by: ['createdAt'],
      where: {
        surveyId,
        createdAt: { gte: thirtyDaysAgo },
      },
      _count: true,
    });

    return {
      survey: {
        id: survey.id,
        name: survey.name,
        type: survey.type,
        responseCount: survey.responseCount,
        avgScore: survey.avgScore,
      },
      questionAnalytics,
      responsesOverTime,
    };
  }
}

export const surveysService = new SurveysService();
