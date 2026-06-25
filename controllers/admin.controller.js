import { client } from "../config/db.js";

const usersCollection = client.db().collection("user");
const promptsCollection = client.db().collection("prompt");
const reviewsCollection = client.db().collection("review");
const bookmarksCollection = client.db().collection("bookmark");
const reportsCollection = client.db().collection("report");
const paymentsCollection = client.db().collection("payment");
const SUCCESS_PAYMENT_STATUSES = new Set(["paid", "succeeded", "completed"]);

const normalizePaymentStatus = (value) => {
  const normalized = String(value || "").trim().toLowerCase();

  if (SUCCESS_PAYMENT_STATUSES.has(normalized)) {
    return "Completed";
  }

  if (normalized.includes("fail")) {
    return "Failed";
  }

  if (normalized.includes("cancel")) {
    return "Cancelled";
  }

  if (normalized.includes("refund")) {
    return "Refunded";
  }

  if (normalized.includes("pend")) {
    return "Pending";
  }

  return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : "Completed";
};

const isSuccessfulPayment = (payment) => {
  const candidates = [payment?.paymentStatus, payment?.status]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean);

  return candidates.some((value) => SUCCESS_PAYMENT_STATUSES.has(value));
};

async function enrichPayments(payments = []) {
  const userIds = [...new Set(payments.map((payment) => String(payment?.userId || "")).filter(Boolean))];
  const users = userIds.length > 0
    ? await usersCollection
        .find(
          {
            _id: { $in: userIds },
          },
          {
            projection: {
              name: 1,
              email: 1,
            },
          }
        )
        .toArray()
    : [];

  const usersById = new Map(users.map((user) => [String(user._id), user]));

  return payments.map((payment) => {
    const matchedUser = usersById.get(String(payment?.userId || ""));
    const createdAt = payment?.createdAt || payment?.paidAt || new Date();

    return {
      ...payment,
      userName: payment?.userName || matchedUser?.name || "",
      userEmail: payment?.userEmail || matchedUser?.email || "",
      paymentIntentId: payment?.paymentIntentId || payment?.transactionId || "",
      status: normalizePaymentStatus(payment?.status || payment?.paymentStatus),
      paymentStatus: payment?.paymentStatus || payment?.status || "completed",
      createdAt,
    };
  });
}

const buildActivePremiumUserQuery = () => ({
  subscription: "premium",
  premiumUntil: {
    $exists: true,
    $gt: new Date(),
  },
});

const getAdminStats = async (req, res) => {
  try {
    const payments = await paymentsCollection
      .find({})
      .sort({ paidAt: -1, createdAt: -1 })
      .toArray();
    const successfulPayments = payments.filter(isSuccessfulPayment);
    const [
      totalUsers,
      totalPrompts,
      totalCreators,
      totalPremiumUsers,
      totalReviews,
      totalBookmarks,
      totalReports,
      pendingPrompts,
      approvedPrompts,
      rejectedPrompts,
      totalCopiesAggregate,
    ] = await Promise.all([
      usersCollection.countDocuments({}),
      promptsCollection.countDocuments({}),
      usersCollection.countDocuments({ role: "creator" }),
      usersCollection.countDocuments({ subscription: "premium" }),
      reviewsCollection.countDocuments({}),
      bookmarksCollection.countDocuments({}),
      reportsCollection.countDocuments({}),
      promptsCollection.countDocuments({ status: "pending" }),
      promptsCollection.countDocuments({ status: "approved" }),
      promptsCollection.countDocuments({ status: "rejected" }),
      promptsCollection
        .aggregate([
          {
            $group: {
              _id: null,
              totalCopies: {
                $sum: { $ifNull: ["$copyCount", 0] },
              },
            },
          },
        ])
        .toArray(),
    ]);

    const totalRevenue = successfulPayments.reduce((sum, payment) => sum + Number(payment?.amount || 0), 0);
    const totalPayments = successfulPayments.length;
    const totalCopies = Number(totalCopiesAggregate[0]?.totalCopies || 0);

    return res.status(200).json({
      totalUsers,
      totalPrompts,
      totalCreators,
      totalPremiumUsers,
      totalReviews,
      totalCopies,
      totalBookmarks,
      totalReports,
      pendingPrompts,
      approvedPrompts,
      rejectedPrompts,
      totalRevenue,
      totalPayments,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch admin stats",
    });
  }
};

const getRevenue = async (req, res) => {
  try {
    const payments = await paymentsCollection
      .find({})
      .sort({ paidAt: -1, createdAt: -1 })
      .toArray();
    const enrichedPayments = await enrichPayments(payments);
    const successfulPayments = enrichedPayments.filter(isSuccessfulPayment);

    const totalRevenue = successfulPayments.reduce((sum, payment) => {
      return sum + Number(payment.amount || 0);
    }, 0);

    const premiumUserQuery = buildActivePremiumUserQuery();

    const [, countedPremiumUsers] = await Promise.all([
      paymentsCollection.countDocuments({}),
      usersCollection.countDocuments(premiumUserQuery),
    ]);
    const totalTransactions = successfulPayments.length;

    let premiumUsers = countedPremiumUsers;

    if (premiumUsers === 0) {
      premiumUsers = [
        ...new Set(
          successfulPayments
            .filter((payment) => String(payment?.plan || "").toLowerCase().includes("premium"))
            .map((payment) => String(payment?.userId || ""))
            .filter(Boolean),
        ),
      ].length;
    }

    return res.status(200).json({
      totalRevenue,
      totalTransactions,
      premiumUsers,
      payments: successfulPayments,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch revenue stats",
    });
  }
};

const getRecentActivity = async (req, res) => {
  try {
    const [latestUsers, latestPrompts, latestReports, latestPaymentsRaw] =
      await Promise.all([
        usersCollection.find({}).sort({ createdAt: -1 }).limit(10).toArray(),
        promptsCollection.find({}).sort({ createdAt: -1 }).limit(10).toArray(),
        reportsCollection.find({}).sort({ createdAt: -1 }).limit(10).toArray(),
        paymentsCollection.find({}).sort({ createdAt: -1 }).limit(10).toArray(),
      ]);
    const latestPayments = await enrichPayments(latestPaymentsRaw);
    const activities = [
      ...latestPayments.map((payment) => ({
        id: payment._id,
        type: "payment",
        title: `${String(payment.plan || "Premium").replace(/[-_]/g, " ")} payment`,
        subtitle: payment.userName
          ? `by ${payment.userName}${payment.userEmail ? ` (${payment.userEmail})` : ""}`
          : payment.userEmail || "PromptFlow customer",
        status: payment.status,
        amount: `$${Number(payment.amount || 0).toFixed(2)}`,
        createdAt: payment.createdAt || payment.paidAt || new Date(),
      })),
      ...latestUsers.map((user) => ({
        id: user._id,
        type: "user",
        title: user.name || user.email || "New user",
        subtitle: user.email || "PromptFlow member",
        createdAt: user.createdAt || new Date(),
      })),
      ...latestPrompts.map((prompt) => ({
        id: prompt._id,
        type: "prompt",
        title: prompt.title || "Prompt submitted",
        subtitle: prompt.creatorName || prompt.creatorEmail || "Prompt creator",
        status: prompt.status || "pending",
        createdAt: prompt.createdAt || new Date(),
      })),
      ...latestReports.map((report) => ({
        id: report._id,
        type: "report",
        title: report.reason || report.category || "New report",
        subtitle: report.description || report.message || "Moderation report submitted",
        status: report.status || "open",
        createdAt: report.createdAt || new Date(),
      })),
    ]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 30);

    return res.status(200).json({
      activities,
      latestUsers,
      latestPrompts,
      latestReports,
      latestPayments,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch recent activity",
    });
  }
};

const getAdminPayments = async (req, res) => {
  try {
    const payments = await paymentsCollection
      .find({})
      .sort({ paidAt: -1, createdAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      payments: await enrichPayments(payments),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch admin payments",
    });
  }
};

export { getAdminPayments, getAdminStats, getRecentActivity, getRevenue };
