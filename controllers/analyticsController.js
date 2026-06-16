const mongoose = require("mongoose");
const moment = require("moment");
const Event = require("../models/Event");
const Purchase = require("../models/Purchase");

function round2(value) {
  return Math.round(Number(value) * 100) / 100;
}

function parseCosts(query) {
  const venueCost = Number(query.venueCost) || 0;
  const marketingCost = Number(query.marketingCost) || 0;
  const staffCost = Number(query.staffCost) || 0;
  const equipmentCost = Number(query.equipmentCost) || 0;
  const variableCostPerUnit =
    Number(query.variableCostPerUnit ?? query.v) || 0;

  const totalCostsOverride = Number(query.totalCosts);
  let totalFixedCost;

  if (!Number.isNaN(totalCostsOverride) && totalCostsOverride >= 0) {
    totalFixedCost = totalCostsOverride;
  } else {
    totalFixedCost = venueCost + marketingCost + staffCost + equipmentCost;
  }

  if (totalFixedCost <= 0) {
    return null;
  }

  return {
    venueCost,
    marketingCost,
    staffCost,
    equipmentCost,
    variableCostPerUnit,
    totalFixedCost,
  };
}

function computeSalesTrend(purchases) {
  const currentStart = moment().subtract(6, "days").startOf("day");
  const currentEnd = moment().endOf("day");
  const priorStart = moment().subtract(13, "days").startOf("day");
  const priorEnd = moment().subtract(7, "days").endOf("day");

  const currentTickets = ticketsSoldInWindow(
    purchases,
    currentStart,
    currentEnd,
  );
  const priorTickets = ticketsSoldInWindow(purchases, priorStart, priorEnd);

  if (priorTickets === 0 && currentTickets === 0) {
    return "Stable";
  }
  if (priorTickets === 0) {
    return "Rising";
  }

  const currentVelocity = currentTickets / 7;
  const priorVelocity = priorTickets / 7;

  if (currentVelocity > priorVelocity * 1.05) {
    return "Rising";
  }
  if (currentVelocity < priorVelocity * 0.95) {
    return "Falling";
  }
  return "Stable";
}

function buildChartPoints(fixedCost, pricePerUnit, variableCostPerUnit, maxQty) {
  const steps = 20;
  const maxQuantity = Math.max(Math.ceil(maxQty), 1);
  const stepSize = maxQuantity / steps;
  const points = [];

  for (let i = 0; i <= steps; i++) {
    const quantity = round2(i * stepSize);
    points.push({
      quantity,
      revenue: round2(quantity * pricePerUnit),
      totalCost: round2(fixedCost + quantity * variableCostPerUnit),
    });
  }

  return points;
}

function ticketTypeLabel(type) {
  const labels = {
    general: "General Admission",
    vip: "VIP",
    vvip: "VVIP",
    earlybird: "Early Bird",
  };
  return labels[type] || type || "Unknown";
}

function normalizeEventName(name) {
  if (!name || typeof name !== "string") {
    return "";
  }
  return name
    .toLowerCase()
    .replace(/\b(19|20)\d{2}\b/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractYearFromName(name) {
  const match = String(name || "").match(/\b((19|20)\d{2})\b/);
  return match ? Number(match[1]) : null;
}

function buildWeeklyTrend(purchases, event) {
  const sortedPurchases = purchases
    .filter((purchase) => purchase.createdAt)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const windowStart = moment(
    sortedPurchases[0]?.createdAt || event.createdAt,
  ).startOf("day");
  const eventEnd = event.start_Date ? moment(event.start_Date) : moment();
  const windowEnd = moment.min(moment(), eventEnd.endOf("day"));

  if (!windowEnd.isAfter(windowStart)) {
    return Array.from({ length: 7 }, (_, index) => ({
      week: `W${index + 1}`,
      ticketsSold: 0,
      revenue: 0,
    }));
  }

  const totalMs = windowEnd.diff(windowStart);
  const buckets = Array.from({ length: 7 }, () => ({
    ticketsSold: 0,
    revenue: 0,
  }));

  purchases.forEach((purchase) => {
    const createdAt = moment(purchase.createdAt);
    if (!createdAt.isValid() || !createdAt.isBetween(windowStart, windowEnd, null, "[]")) {
      return;
    }

    const ratio = createdAt.diff(windowStart) / totalMs;
    const bucketIndex = Math.min(6, Math.floor(ratio * 7));
    buckets[bucketIndex].ticketsSold += Number(purchase.tickets || 0);
    buckets[bucketIndex].revenue += Number(purchase.totalPrice || 0);
  });

  let cumulativeTickets = 0;
  let cumulativeRevenue = 0;

  return buckets.map((bucket, index) => {
    cumulativeTickets += bucket.ticketsSold;
    cumulativeRevenue += bucket.revenue;
    return {
      week: `W${index + 1}`,
      ticketsSold: cumulativeTickets,
      revenue: round2(cumulativeRevenue),
    };
  });
}

async function getHistoricalFinalTicketSales(ownerId, categoryId, excludeEventId) {
  const historicalEvents = await Event.find({
    user: ownerId,
    category: categoryId,
    start_Date: { $lt: new Date() },
    _id: { $ne: excludeEventId },
    status: "active",
  })
    .select("_id")
    .lean();

  const finalTicketCounts = [];

  for (const historicalEvent of historicalEvents) {
    const purchases = await getEventPurchases(
      historicalEvent._id,
      "tickets",
    );
    if (!purchases.length) {
      continue;
    }
    finalTicketCounts.push(sumTicketsSold(purchases));
  }

  return {
    historicalFinalTicketSales: Math.round(median(finalTicketCounts)),
    sampleSize: finalTicketCounts.length,
  };
}

async function getOwnerCategoryBenchmarks(ownerId, categoryId) {
  const categoryEvents = await Event.find({
    user: ownerId,
    category: categoryId,
    status: "active",
  })
    .select("_id likes")
    .lean();

  if (!categoryEvents.length) {
    return {
      averageTicketsSold: 0,
      averageRevenue: 0,
      averageAttendanceRate: 0,
      averageMarketingConversion: 0,
      eventCount: 0,
    };
  }

  let totalTickets = 0;
  let totalRevenue = 0;
  let totalAttendanceRate = 0;
  let totalConversionRate = 0;

  for (const categoryEvent of categoryEvents) {
    const purchases = await getEventPurchases(categoryEvent._id);
    const ticketsSold = sumTicketsSold(purchases);
    const scannedTickets = sumScannedTickets(purchases);
    const grossRevenue = sumRevenue(purchases);
    const likesCount = Array.isArray(categoryEvent.likes)
      ? categoryEvent.likes.length
      : 0;
    const purchaseCount = purchases.length;

    totalTickets += ticketsSold;
    totalRevenue += grossRevenue;
    totalAttendanceRate += ticketsSold > 0 ? scannedTickets / ticketsSold : 0;
    totalConversionRate += likesCount > 0 ? purchaseCount / likesCount : 0;
  }

  const eventCount = categoryEvents.length;

  return {
    averageTicketsSold: round2(totalTickets / eventCount),
    averageRevenue: round2(totalRevenue / eventCount),
    averageAttendanceRate: round2(totalAttendanceRate / eventCount),
    averageMarketingConversion: round2(totalConversionRate / eventCount),
    eventCount,
  };
}

function buildEventMetrics(event, purchases) {
  const ticketsSold = sumTicketsSold(purchases);
  const scannedTickets = sumScannedTickets(purchases);
  const grossRevenue = sumRevenue(purchases);
  const likesCount = Array.isArray(event.likes) ? event.likes.length : 0;
  const purchaseCount = purchases.length;
  const attendanceRate = ticketsSold > 0 ? scannedTickets / ticketsSold : 0;
  const conversionRate = likesCount > 0 ? purchaseCount / likesCount : 0;

  return {
    ticketsSold,
    scannedTickets,
    grossRevenue,
    likesCount,
    purchaseCount,
    attendanceRate,
    conversionRate,
  };
}

function buildYoYComparisons(events, metricsByEventId) {
  const groups = {};

  events.forEach((event) => {
    const key = normalizeEventName(event.name);
    if (!key) {
      return;
    }
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(event);
  });

  const comparisons = [];

  Object.entries(groups).forEach(([eventGroup, groupedEvents]) => {
    if (groupedEvents.length < 2) {
      return;
    }

    const sortedEvents = [...groupedEvents].sort(
      (a, b) => new Date(a.start_Date) - new Date(b.start_Date),
    );
    const baselineEvent = sortedEvents[sortedEvents.length - 2];
    const comparisonEvent = sortedEvents[sortedEvents.length - 1];
    const baselineMetrics = metricsByEventId[baselineEvent._id.toString()];
    const comparisonMetrics = metricsByEventId[comparisonEvent._id.toString()];

    if (!baselineMetrics || !comparisonMetrics) {
      return;
    }

    comparisons.push({
      eventGroup: eventGroup
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" "),
      baselineEvent: {
        eventId: baselineEvent._id,
        name: baselineEvent.name,
        year:
          extractYearFromName(baselineEvent.name) ||
          moment(baselineEvent.start_Date).year(),
      },
      comparisonEvent: {
        eventId: comparisonEvent._id,
        name: comparisonEvent.name,
        year:
          extractYearFromName(comparisonEvent.name) ||
          moment(comparisonEvent.start_Date).year(),
      },
      revenueVariance: round2(
        comparisonMetrics.grossRevenue - baselineMetrics.grossRevenue,
      ),
      ticketsVariance:
        comparisonMetrics.ticketsSold - baselineMetrics.ticketsSold,
      attendanceRateVariance: round2(
        comparisonMetrics.attendanceRate - baselineMetrics.attendanceRate,
      ),
    });
  });

  return comparisons;
}

async function assertEventAccess(eventId, userId, userType) {
  if (!mongoose.Types.ObjectId.isValid(eventId)) {
    const error = new Error("Invalid eventId");
    error.statusCode = 400;
    throw error;
  }

  const event = await Event.findById(eventId).lean();
  if (!event) {
    const error = new Error("Event not found");
    error.statusCode = 404;
    throw error;
  }

  if (userType !== "admin" && event.user?.toString() !== userId.toString()) {
    const error = new Error("Access denied");
    error.statusCode = 403;
    throw error;
  }

  return event;
}

async function getEventPurchases(eventId, select) {
  const query = Purchase.find({
    event: eventId,
    resel_by: { $exists: false },
  });

  if (select) {
    query.select(select);
  }

  return query.lean();
}

function sumTicketsSold(purchases) {
  return purchases.reduce((sum, purchase) => sum + Number(purchase.tickets || 0), 0);
}

function sumRevenue(purchases) {
  return purchases.reduce(
    (sum, purchase) => sum + Number(purchase.totalPrice || 0),
    0,
  );
}

function sumScannedTickets(purchases) {
  return purchases.reduce((sum, purchase) => {
    const scanned = purchase.tickets_type_sale?.scanned;
    return sum + (Array.isArray(scanned) ? scanned.length : 0);
  }, 0);
}

function avgTicketPriceFromPlans(event) {
  const plans = event?.ticket_plans || [];
  if (!plans.length) {
    return 0;
  }

  const totalWeight = plans.reduce(
    (sum, plan) => sum + Number(plan.totalTicket || 1),
    0,
  );
  if (totalWeight <= 0) {
    return (
      plans.reduce((sum, plan) => sum + Number(plan.price || 0), 0) /
      plans.length
    );
  }

  return (
    plans.reduce(
      (sum, plan) =>
        sum + Number(plan.price || 0) * Number(plan.totalTicket || 1),
      0,
    ) / totalWeight
  );
}

function avgTicketPrice(purchases, event) {
  const ticketsSold = sumTicketsSold(purchases);
  if (ticketsSold > 0) {
    return sumRevenue(purchases) / ticketsSold;
  }
  return avgTicketPriceFromPlans(event);
}

function toDistribution(counts) {
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  if (total <= 0) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(counts).map(([key, count]) => [key, round2(count / total)]),
  );
}

function ageBracket(dateOfBirth) {
  if (!dateOfBirth) {
    return "Unknown";
  }

  const age = moment().diff(moment(dateOfBirth), "years");
  if (age < 18) {
    return "Under 18";
  }
  if (age <= 24) {
    return "18-24";
  }
  if (age <= 34) {
    return "25-34";
  }
  if (age <= 44) {
    return "35-44";
  }
  return "45+";
}

function parseCityState(address) {
  if (!address || typeof address !== "string") {
    return { city: "Unknown", state: "Unknown" };
  }

  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return {
      city: parts[parts.length - 2] || "Unknown",
      state: parts[parts.length - 1] || "Unknown",
    };
  }

  if (parts.length === 1) {
    return { city: parts[0], state: "Unknown" };
  }

  return { city: "Unknown", state: "Unknown" };
}

function daysBetween(start, end) {
  return Math.max(0, moment(end).diff(moment(start), "days", true));
}

function median(values) {
  if (!values.length) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }

  return sorted[mid];
}

function ticketsSoldInWindow(purchases, start, end) {
  return purchases.reduce((sum, purchase) => {
    const createdAt = moment(purchase.createdAt);
    if (!createdAt.isValid()) {
      return sum;
    }
    if (createdAt.isBetween(start, end, null, "[]")) {
      return sum + Number(purchase.tickets || 0);
    }
    return sum;
  }, 0);
}

function handleError(res, error) {
  const statusCode = error.statusCode || 500;
  if (statusCode === 500) {
    console.log(error);
  }
  return res.status(statusCode).json({
    success: false,
    message: error.message || "Internal server error",
  });
}

exports.breakEven = async (req, res) => {
  try {
    const { eventId } = req.query;
    if (!eventId) {
      return res
        .status(400)
        .json({ success: false, message: "eventId is required" });
    }
    // console.log(req.query);
    const costs = parseCosts(req.query);
    if (costs === null) {
      return res.status(400).json({
        success: false,
        message:
          "Provide totalCosts or venueCost, marketingCost, staffCost, and/or equipmentCost",
      });
    }

    const event = await assertEventAccess(
      eventId,
      req.user._id,
      req.user.type,
    );
    const purchases = await getEventPurchases(eventId);

    const totalRevenue = sumRevenue(purchases);
    const ticketsSold = sumTicketsSold(purchases);
    const pricePerUnit = avgTicketPrice(purchases, event);
    const variableCostPerUnit = costs.variableCostPerUnit;
    const contributionMargin = pricePerUnit - variableCostPerUnit;

    if (contributionMargin <= 0) {
      return res.status(400).json({
        success: false,
        message: "variableCostPerUnit must be less than pricePerUnit",
      });
    }

    const breakEvenTickets = costs.totalFixedCost / contributionMargin;
    const progressPercentage =
      breakEvenTickets > 0 ? (ticketsSold / breakEvenTickets) * 100 : 0;
    const ticketsRemaining = Math.max(
      0,
      Math.ceil(breakEvenTickets - ticketsSold),
    );

    const firstPurchase = purchases
      .filter((purchase) => purchase.createdAt)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0];
    const salesStart = firstPurchase?.createdAt || event.createdAt;
    const daysElapsed = Math.max(1, daysBetween(salesStart, new Date()));
    const ticketsPerDay = ticketsSold / daysElapsed;
    const salesTrend = computeSalesTrend(purchases);

    const daysUntilEvent = Math.max(
      0,
      moment(event.start_Date).diff(moment(), "days"),
    );
    const projectedTickets = ticketsSold + ticketsPerDay * daysUntilEvent;
    const projectedRevenue = projectedTickets * pricePerUnit;
    const projectedProfitLoss =
      projectedRevenue - costs.totalFixedCost - projectedTickets * variableCostPerUnit;

    const maxQuantity = Math.max(
      projectedTickets,
      breakEvenTickets * 1.5,
      ticketsSold,
    );

    return res.send({
      success: true,
      eventId,
      totalCosts: round2(costs.totalFixedCost),
      totalRevenue: round2(totalRevenue),
      ticketsSold,
      averageTicketPrice: round2(pricePerUnit),
      pricePerUnit: round2(pricePerUnit),
      breakEvenTickets: round2(breakEvenTickets),
      progressPercentage: round2(progressPercentage),
      ticketsRemaining,
      salesTrend,
      costs: {
        venueCost: round2(costs.venueCost),
        marketingCost: round2(costs.marketingCost),
        staffCost: round2(costs.staffCost),
        equipmentCost: round2(costs.equipmentCost),
        variableCostPerUnit: round2(variableCostPerUnit),
        totalFixedCost: round2(costs.totalFixedCost),
      },
      salesVelocity: {
        ticketsPerDay: round2(ticketsPerDay),
        daysElapsed: Math.round(daysElapsed),
      },
      projection: {
        daysUntilEvent,
        projectedTickets: round2(projectedTickets),
        projectedRevenue: round2(projectedRevenue),
        projectedProfitLoss: round2(projectedProfitLoss),
      },
      chart: {
        fixedCost: round2(costs.totalFixedCost),
        pricePerUnit: round2(pricePerUnit),
        variableCostPerUnit: round2(variableCostPerUnit),
        breakEvenQuantity: round2(breakEvenTickets),
        maxQuantity: round2(maxQuantity),
        points: buildChartPoints(
          costs.totalFixedCost,
          pricePerUnit,
          variableCostPerUnit,
          maxQuantity,
        ),
      },
      _meta: { costsSource: "query_params" },
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.attendeeDemographics = async (req, res) => {
  try {
    const { eventId } = req.query;
    if (!eventId) {
      return res
        .status(400)
        .json({ success: false, message: "eventId is required" });
    }

    await assertEventAccess(eventId, req.user._id, req.user.type);

    const attendees = await Purchase.aggregate([
      {
        $match: {
          event: new mongoose.Types.ObjectId(eventId),
          resel_by: { $exists: false },
        },
      },
      { $group: { _id: "$user" } },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
    ]);

    const ticketPurchases = await getEventPurchases(
      eventId,
      "tickets tickets_type_sale.type",
    );

    const ageCounts = {};
    const genderCounts = {};
    const cityCounts = {};
    const stateCounts = {};
    const ticketTypeCounts = {};

    attendees.forEach((attendee) => {
      const user = attendee.user || {};
      const ageKey = ageBracket(user.dateOfBirth);
      const genderKey = user.gender || "Unknown";
      const address = user.address || user.location?.address || "";
      const { city, state } = parseCityState(address);

      ageCounts[ageKey] = (ageCounts[ageKey] || 0) + 1;
      genderCounts[genderKey] = (genderCounts[genderKey] || 0) + 1;
      cityCounts[city] = (cityCounts[city] || 0) + 1;
      stateCounts[state] = (stateCounts[state] || 0) + 1;
    });

    ticketPurchases.forEach((purchase) => {
      const type = purchase.tickets_type_sale?.type || "general";
      const label = ticketTypeLabel(type);
      ticketTypeCounts[label] =
        (ticketTypeCounts[label] || 0) + Number(purchase.tickets || 0);
    });

    const totalAttendees = attendees.length;

    return res.send({
      success: true,
      eventId,
      totalAttendees,
      age_distribution: toDistribution(ageCounts),
      gender_distribution: toDistribution(genderCounts),
      city_distribution: toDistribution(cityCounts),
      state_distribution: toDistribution(stateCounts),
      ticket_type_distribution: toDistribution(ticketTypeCounts),
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.eventComparison = async (req, res) => {
  try {
    const { eventIds } = req.query;
    if (!eventIds) {
      return res
        .status(400)
        .json({ success: false, message: "eventIds is required" });
    }

    const ids = eventIds
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    if (!ids.length) {
      return res
        .status(400)
        .json({ success: false, message: "eventIds is required" });
    }

    if (ids.length > 10) {
      return res.status(400).json({
        success: false,
        message: "A maximum of 10 eventIds is allowed",
      });
    }

    for (const id of ids) {
      await assertEventAccess(id, req.user._id, req.user.type);
    }

    const events = await Event.find({ _id: { $in: ids } })
      .select("name total_tickets_sale likes start_Date createdAt user category")
      .lean();

    const metricsByEventId = {};
    const comparison = await Promise.all(
      events.map(async (event) => {
        const purchases = await getEventPurchases(event._id);
        const metrics = buildEventMetrics(event, purchases);
        metricsByEventId[event._id.toString()] = metrics;

        return {
          eventId: event._id,
          name: event.name,
          totalTicketsSold: Number(event.total_tickets_sale || 0),
          grossRevenue: round2(metrics.grossRevenue),
          attendanceRate: round2(metrics.attendanceRate),
          totalRefunds: 0,
          conversionRate: round2(metrics.conversionRate),
          leadsProxy: {
            likes: metrics.likesCount,
            purchases: metrics.purchaseCount,
          },
          selectorSummary: {
            ticketsSold: metrics.ticketsSold,
            grossRevenue: round2(metrics.grossRevenue),
            attendanceRate: round2(metrics.attendanceRate),
          },
          weeklyTrend: buildWeeklyTrend(purchases, event),
        };
      }),
    );

    const categoryId = events[0]?.category;
    const ownerId = events[0]?.user;
    const benchmarks = categoryId
      ? await getOwnerCategoryBenchmarks(ownerId, categoryId)
      : {
          averageTicketsSold: 0,
          averageRevenue: 0,
          averageAttendanceRate: 0,
          averageMarketingConversion: 0,
          eventCount: 0,
        };

    const yoyComparisons = buildYoYComparisons(events, metricsByEventId);

    return res.send({
      success: true,
      events: comparison,
      benchmarking: {
        scope: "owner_category",
        categoryId,
        averageTicketsSold: benchmarks.averageTicketsSold,
        averageRevenue: benchmarks.averageRevenue,
        averageAttendanceRate: benchmarks.averageAttendanceRate,
        averageMarketingConversion: benchmarks.averageMarketingConversion,
        eventCount: benchmarks.eventCount,
      },
      yoyComparisons,
      _meta: {
        refunds: "Not tracked; returns 0",
        conversionRate: "Proxy: unique purchases / event likes",
        yoyComparisons:
          yoyComparisons.length > 0
            ? "Paired by normalized event name"
            : "No name-matched event pairs found in selection",
      },
    });
  } catch (error) {
    return handleError(res, error);
  }
};

async function getHistoricalVelocities(ownerId, categoryId, excludeEventId) {
  const historicalEvents = await Event.find({
    user: ownerId,
    category: categoryId,
    start_Date: { $lt: new Date() },
    _id: { $ne: excludeEventId },
    status: "active",
  })
    .select("_id createdAt start_Date")
    .lean();

  const velocities = [];

  for (const historicalEvent of historicalEvents) {
    const purchases = await getEventPurchases(
      historicalEvent._id,
      "tickets createdAt",
    );
    if (!purchases.length) {
      continue;
    }

    const firstPurchase = purchases
      .filter((purchase) => purchase.createdAt)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0];
    const windowStart = firstPurchase?.createdAt || historicalEvent.createdAt;
    const windowEnd = historicalEvent.start_Date || new Date();
    const windowDays = Math.max(1, daysBetween(windowStart, windowEnd));
    const ticketsSold = sumTicketsSold(purchases);
    velocities.push(ticketsSold / windowDays);
  }

  return velocities;
}

exports.revenueForecast = async (req, res) => {
  try {
    const { eventId } = req.query;
    if (!eventId) {
      return res
        .status(400)
        .json({ success: false, message: "eventId is required" });
    }

    const event = await assertEventAccess(
      eventId,
      req.user._id,
      req.user.type,
    );
    const purchases = await getEventPurchases(eventId);

    const ticketsSold = sumTicketsSold(purchases);
    const revenueSoFar = sumRevenue(purchases);
    const averageTicketPrice = avgTicketPrice(purchases, event);
    const windowDays = 7;
    const windowStart = moment().subtract(windowDays - 1, "days").startOf("day");
    const windowEnd = moment().endOf("day");
    const recentTickets = ticketsSoldInWindow(
      purchases,
      windowStart,
      windowEnd,
    );

    let currentTicketsPerDay = recentTickets / windowDays;
    let velocityWindowDays = windowDays;

    if (recentTickets === 0) {
      const firstPurchase = purchases
        .filter((purchase) => purchase.createdAt)
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0];
      const salesStart = firstPurchase?.createdAt || event.createdAt;
      const daysElapsed = Math.max(1, daysBetween(salesStart, new Date()));
      currentTicketsPerDay = ticketsSold / daysElapsed;
      velocityWindowDays = Math.round(daysElapsed);
    }

    const historicalVelocities = await getHistoricalVelocities(
      event.user,
      event.category,
      event._id,
    );
    const historicalTicketsPerDay = median(historicalVelocities);
    const velocitySampleSize = historicalVelocities.length;

    const { historicalFinalTicketSales, sampleSize: finalSalesSampleSize } =
      await getHistoricalFinalTicketSales(
        event.user,
        event.category,
        event._id,
      );

    const daysUntilEvent = Math.max(
      0,
      moment(event.start_Date).diff(moment(), "days"),
    );
    const projectedTickets =
      ticketsSold + currentTicketsPerDay * daysUntilEvent;
    const expectedRevenue = projectedTickets * averageTicketPrice;

    let varianceScale = 0.2;
    if (velocitySampleSize < 3) {
      varianceScale = 0.35;
    }

    const revenueLowerBound = expectedRevenue * (1 - varianceScale);
    const revenueUpperBound = expectedRevenue * (1 + varianceScale);

    let confidenceScore = 50;
    if (historicalTicketsPerDay > 0) {
      const velocityDelta =
        Math.abs(currentTicketsPerDay - historicalTicketsPerDay) /
        Math.max(historicalTicketsPerDay, 1);
      confidenceScore = 100 - velocityDelta * 100;
    }
    if (velocitySampleSize < 3) {
      confidenceScore -= (3 - velocitySampleSize) * 10;
    }
    confidenceScore = Math.max(0, Math.min(100, confidenceScore));

    return res.send({
      success: true,
      eventId,
      currentStatus: {
        eventDate: event.start_Date,
        remainingDaysUntilEvent: daysUntilEvent,
        ticketsSold,
        revenueSoFar: round2(revenueSoFar),
      },
      historicalFinalTicketSales,
      currentVelocity: {
        ticketsPerDay: round2(currentTicketsPerDay),
        windowDays: velocityWindowDays,
      },
      historicalVelocity: {
        ticketsPerDay: round2(historicalTicketsPerDay),
        sampleSize: velocitySampleSize,
        finalTicketSalesSampleSize: finalSalesSampleSize,
      },
      forecast: {
        projectedTickets: round2(projectedTickets),
        expectedRevenue: round2(expectedRevenue),
        revenueLowerBound: round2(revenueLowerBound),
        revenueUpperBound: round2(revenueUpperBound),
      },
      confidenceScore: Math.round(confidenceScore),
      _meta: {
        method: "7-day velocity vs historical median (same owner + category)",
      },
    });
  } catch (error) {
    return handleError(res, error);
  }
};
