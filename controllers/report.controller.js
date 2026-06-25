import { ObjectId } from "mongodb";

import { promptsCollection } from "../models/prompt.model.js";
import {
  REPORT_STATUSES,
  createReportDocument,
  reportsCollection,
} from "../models/report.model.js";

const normalizeText = (value) => String(value || "").trim();
const buildIdCandidates = (id) => {
  const normalized = normalizeText(id);
  const candidates = [normalized];

  if (ObjectId.isValid(normalized)) {
    candidates.push(new ObjectId(normalized));
  }

  return candidates;
};
const buildReportIdQuery = (id) => ({ _id: normalizeText(id) });
const buildPromptIdQuery = (id) => ({ _id: { $in: buildIdCandidates(id) } });

const findReportById = async (id) => {
  return reportsCollection.findOne(buildReportIdQuery(id));
};

const findPromptById = async (id) => {
  return promptsCollection.findOne(buildPromptIdQuery(id));
};

const createReport = async (req, res) => {
  try {
    const prompt = await findPromptById(req.params.promptId);

    if (!prompt) {
      return res.status(404).json({
        success: false,
        message: "Prompt not found",
      });
    }

    const reason = normalizeText(req.body.reason);
    const description = normalizeText(req.body.description);

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "Reason is required",
      });
    }

    const existingReport = await reportsCollection.findOne({
      promptId: prompt._id,
      reportedByUserId: req.user.id,
    });

    if (existingReport) {
      return res.status(409).json({
        success: false,
        message: "You have already reported this prompt",
      });
    }

    const report = createReportDocument({
      prompt,
      reporter: req.user,
      reason,
      description,
    });

    await reportsCollection.insertOne(report);

    return res.status(201).json({
      success: true,
      message: "Prompt reported successfully",
      report,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to submit report",
    });
  }
};

const getReports = async (req, res) => {
  try {
    const filters = {};

    if (req.query.status) {
      const status = normalizeText(req.query.status);

      if (!REPORT_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status filter",
        });
      }

      filters.status = status;
    }

    if (req.query.reason) {
      filters.reason = normalizeText(req.query.reason);
    }

    if (req.query.search) {
      filters.promptTitle = {
        $regex: normalizeText(req.query.search),
        $options: "i",
      };
    }

    const reports = await reportsCollection
      .find(filters)
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      reports,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch reports",
    });
  }
};

const removePromptFromReport = async (req, res) => {
  try {
    const reportId = String(req.params.id || "").trim();
    const report = await reportsCollection.findOne({ _id: reportId });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    const prompt = await findPromptById(report.promptId);

    if (!prompt) {
      return res.status(404).json({
        success: false,
        message: "Related prompt not found",
      });
    }

    const rejectionFeedback = normalizeText(req.body.rejectionFeedback);

    await promptsCollection.updateOne(
      { _id: prompt._id },
      {
        $set: {
          status: "rejected",
          rejectionFeedback,
          updatedAt: new Date(),
        },
      }
    );

    await reportsCollection.updateOne(
      { _id: reportId },
      {
        $set: {
          status: "resolved",
          adminAction: "removed",
          updatedAt: new Date(),
        },
      }
    );

    const updatedReport = await findReportById(report._id);

    return res.status(200).json({
      success: true,
      message: "Prompt removed successfully",
      report: updatedReport,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to remove prompt",
    });
  }
};

const warnCreator = async (req, res) => {
  try {
    const reportId = String(req.params.id || "").trim();
    const report = await reportsCollection.findOne({ _id: reportId });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    const warningMessage = normalizeText(req.body.warningMessage);

    if (!warningMessage) {
      return res.status(400).json({
        success: false,
        message: "Warning message is required",
      });
    }

    await reportsCollection.updateOne(
      { _id: reportId },
      {
        $set: {
          status: "resolved",
          adminAction: "warned",
          warningMessage,
          updatedAt: new Date(),
        },
      }
    );

    const updatedReport = await findReportById(report._id);

    return res.status(200).json({
      success: true,
      message: "Creator warned successfully",
      report: updatedReport,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to warn creator",
    });
  }
};

const dismissReport = async (req, res) => {
  try {
    const reportId = String(req.params.id || "").trim();
    const report = await reportsCollection.findOne({ _id: reportId });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    await reportsCollection.updateOne(
      { _id: reportId },
      {
        $set: {
          status: "dismissed",
          adminAction: "dismissed",
          warningMessage: "",
          updatedAt: new Date(),
        },
      }
    );

    const updatedReport = await findReportById(report._id);

    return res.status(200).json({
      success: true,
      message: "Report dismissed successfully",
      report: updatedReport,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to dismiss report",
    });
  }
};

export {
  createReport,
  dismissReport,
  getReports,
  removePromptFromReport,
  warnCreator,
};
