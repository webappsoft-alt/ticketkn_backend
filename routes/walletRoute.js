const express = require("express");
const { User } = require("../models/user");
const Transaction = require("../models/Transaction");
const Resell = require("../models/Resell");
const router = express.Router();

router.put("/purchase", async (req, res) => {
  const userId = req.user._id;
  const { balance, ticketId } = req.body;
  const user = await User.findById(userId);

  if (!user) {
    return res.status(400).send({ success: false, message: "No User found" });
  }

  if (Number(balance) > Number(user.balance)) {
    return res.status(400).send({
      success: false,
      message: "You don't have enough balance in your account",
    });
  }

  const eightPer = Number(balance) * 0.08;

  const transaction = new Transaction({
    user: userId,
    ticket: ticketId,
    total_price: Number(balance),
    type: "purchase",
    originalPrice: Number(balance) + eightPer,
    commission: Number(eightPer),
    reason: `Purchase a Ticket`,
  });

  await transaction.save();

  const userbalance = Number(user?.balance) || 0;
  const totalPrice = Number(balance);

  user.balance = userbalance - totalPrice;
  await user.save();

  res.send({ success: true, message: "Balance dedduct successfully" });
});
router.get("/admin/transactions", async (req, res) => {
  const { userId, type, page = 1, limit = 10, id } = req.query;
  let query = {};

  if (id) {
    query._id = { $lt: id };
  }
  // Fix: use req.query.type instead of req.params.type
  if (type && type !== "all") {
    query.type = type;
  }
  if (userId) {
    query.user = userId;
  }

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const skip = (pageNum - 1) * limitNum;

  // Get total count for pagination
  const total = await Transaction.countDocuments(query);
  const totalPages = Math.ceil(total / limitNum);

  const transactions = await Transaction.find(query)
    .populate({
      path: "ticket",
      populate: [{ path: "event", model: "Event" }],
    })
    .sort({ _id: -1 })
    .skip(skip)
    .limit(limitNum)
    .lean();

  res.send({
    success: true,
    transactions,
    pagination: {
      currentPage: pageNum,
      totalPages,
      totalTransactions: total,
      transactionsOnPage: transactions.length,
      hasNext: pageNum < totalPages,
      hasPrev: pageNum > 1,
      limit: limitNum,
    },
  });
});
router.get("/transactions/:type/:id?", async (req, res) => {
  const userId = req.user._id;
  let query = {};

  if (req.params.id) {
    query._id = { $lt: req.params.id };
  }
  if (req.params.type !== "all") {
    query.type = req.params.type;
  }
  query.user = userId;

  const transactions = await Transaction.find(query)
    .populate({
      path: "ticket",
      populate: [{ path: "event", model: "Event" }],
    })
    .sort({ _id: -1 })
    .limit(10)
    .lean();

  if (transactions.length > 0) {
    res.send({ success: true, transactions: transactions });
  } else {
    res.send({ success: false, transactions: [] });
  }
});

router.post("/admin/transaction/deposit", async (req, res) => {
  try {
    const { userId, amount, reason, resellId } = req.body;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(400).send({ success: false, message: "No User found" });
    }

    const transaction = new Transaction({
      user: userId,
      ticket: null,
      total_price: Number(amount),
      commission: 0,
      originalPrice: Number(amount),
      type: "deposit",
      reason: reason,
    });

    await transaction.save();

    const userbalance = Number(user?.balance) || 0;
    const totalPrice = Number(amount);

    user.balance = userbalance + totalPrice;
    await user.save();

    transaction.type = "deposit";
    transaction.reason = reason;
    await transaction.save();

    let paidDate = null;
    if (resellId) {
      paidDate = new Date();
      await Resell.findByIdAndUpdate(
        resellId,
        { $set: { isPaid: true, paidDate } },
        { new: true }
      );
    }

    res.send({
      success: true,
      message: "Deposit successfully",
      ...(paidDate && { paidDate }),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

module.exports = router;
