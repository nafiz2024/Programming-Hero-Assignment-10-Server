import { ObjectId } from "mongodb";

import { client } from "../config/db.js";

const REPORT_STATUSES = ["open", "resolved", "dismissed"];
const REPORT_ADMIN_ACTIONS = ["none", "removed", "warned", "dismissed"];

const reportsCollection = client.db().collection("report");

const createReportDocument = ({
  prompt,
  reporter,
  reason,
  description,
}) => {
  const now = new Date();

  return {
    _id: new ObjectId().toHexString(),
    promptId: prompt._id,
    promptTitle: prompt.title,
    reportedByUserId: reporter.id,
    reportedByName: reporter.name,
    reportedByEmail: reporter.email,
    creatorId: prompt.creatorId,
    creatorName: prompt.creatorName,
    creatorEmail: prompt.creatorEmail,
    reason,
    description,
    status: "open",
    adminAction: "none",
    warningMessage: "",
    createdAt: now,
    updatedAt: now,
  };
};

export {
  REPORT_ADMIN_ACTIONS,
  REPORT_STATUSES,
  createReportDocument,
  reportsCollection,
};
