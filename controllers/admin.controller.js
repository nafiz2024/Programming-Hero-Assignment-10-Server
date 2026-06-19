import { client } from "../config/db.js";

const usersCollection = client.db().collection("user");
const promptsCollection = client.db().collection("prompt");
const reviewsCollection = client.db().collection("review");
const bookmarksCollection = client.db().collection("bookmark");
const reportsCollection = client.db().collection("report");
const paymentsCollection = client.db().collection("payment");

const buildActivePremiumUserQuery = () => ({
  subscription: "premium",
  premiumUntil: {
    $exists: true,
    $gt: new Date(),
  },
});

const getAdminStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalPrompts,
      totalPremiumUsers,
      totalReviews,
      totalBookmarks,
      totalReports,
      pendingPrompts,
      approvedPrompts,
      rejectedPrompts,
    ] = await Promise.all([
      usersCollection.countDocuments({}),
      promptsCollection.countDocuments({}),
      usersCollection.countDocuments({ subscription: "premium" }),
      reviewsCollection.countDocuments({}),
      bookmarksCollection.countDocuments({}),
      reportsCollection.countDocuments({}),
      promptsCollection.countDocuments({ status: "pending" }),
      promptsCollection.countDocuments({ status: "approved" }),
      promptsCollection.countDocuments({ status: "rejected" }),
    ]);

    return res.status(200).json({
      totalUsers,
      totalPrompts,
      totalPremiumUsers,
      totalReviews,
      totalBookmarks,
      totalReports,
      pendingPrompts,
      approvedPrompts,
      rejectedPrompts,
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

    const totalRevenue = payments.reduce((sum, payment) => {
      return sum + Number(payment.amount || 0);
    }, 0);

    const premiumUserQuery = buildActivePremiumUserQuery();

    const [totalTransactions, countedPremiumUsers] = await Promise.all([
      paymentsCollection.countDocuments({}),
      usersCollection.countDocuments(premiumUserQuery),
    ]);

    let premiumUsers = countedPremiumUsers;

    if (premiumUsers === 0) {
      const paidPremiumUserIds = await paymentsCollection
        .aggregate([
          {
            $match: {
              plan: "premium",
              paymentStatus: "succeeded",
            },
          },
          {
            $group: {
              _id: "$userId",
            },
          },
        ])
        .toArray();

      premiumUsers = paidPremiumUserIds.length;
    }

    return res.status(200).json({
      totalRevenue,
      totalTransactions,
      premiumUsers,
      payments,
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
    const [latestUsers, latestPrompts, latestReports, latestPayments] =
      await Promise.all([
        usersCollection.find({}).sort({ createdAt: -1 }).limit(10).toArray(),
        promptsCollection.find({}).sort({ createdAt: -1 }).limit(10).toArray(),
        reportsCollection.find({}).sort({ createdAt: -1 }).limit(10).toArray(),
        paymentsCollection.find({}).sort({ createdAt: -1 }).limit(10).toArray(),
      ]);

    return res.status(200).json({
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

export { getAdminStats, getRecentActivity, getRevenue };
