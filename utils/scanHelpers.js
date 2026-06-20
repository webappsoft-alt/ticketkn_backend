function normalizeSubUserId(subUser) {
  if (!subUser) return null;
  if (typeof subUser === "object" && subUser._id) return subUser._id;
  return subUser;
}

function buildScanActorInfo({ scannedby, scannedBy, subUser } = {}) {
  const subUserId = normalizeSubUserId(subUser);
  const name = scannedby || scannedBy || "Owner";
  if (subUserId) {
    return {
      scannedByType: "subUser",
      scannedByName: name,
      subUserId,
    };
  }
  return {
    scannedByType: "owner",
    scannedByName: name,
    subUserId: null,
  };
}

function enrichScannedAtLogEntry(entry) {
  if (!entry) return null;
  return {
    ...entry,
    ...buildScanActorInfo(entry),
  };
}

function enrichPurchaseScanInfo(purchase) {
  const p =
    purchase && typeof purchase.toObject === "function"
      ? purchase.toObject()
      : { ...purchase };
  const tts = p.tickets_type_sale;
  if (!tts) return p;

  const codes = Array.isArray(tts.code) ? tts.code : [];
  const scannedArr = Array.isArray(tts.scanned)
    ? tts.scanned.map((c) => String(c))
    : [];
  const log = Array.isArray(tts.scannedAtLog) ? tts.scannedAtLog : [];
  const latestLogByCode = {};

  for (const row of log) {
    if (row == null) continue;
    const key = String(row.code);
    const rowTime = row.scannedAt ? new Date(row.scannedAt).getTime() : 0;
    const prev = latestLogByCode[key];
    const prevTime = prev?.scannedAt ? new Date(prev.scannedAt).getTime() : 0;
    if (!prev || rowTime >= prevTime) {
      latestLogByCode[key] = row;
    }
  }

  p.ticketCodes = codes.map((code) => {
    const latestLog = latestLogByCode[String(code)];
    return {
      code,
      scanned: scannedArr.includes(String(code)),
      scannedAt: latestLog?.scannedAt ?? null,
      ...(latestLog
        ? buildScanActorInfo(latestLog)
        : {
            scannedByType: null,
            scannedByName: null,
            subUserId: null,
          }),
    };
  });

  p.tickets_type_sale = {
    ...tts,
    scannedAtLog: log.map(enrichScannedAtLogEntry),
  };

  return p;
}

function enrichPrintTicketScanInfo(ticket) {
  if (!ticket) return ticket;
  const t =
    ticket && typeof ticket.toObject === "function"
      ? ticket.toObject()
      : { ...ticket };
  if (!t.scanned) {
    return {
      ...t,
      scannedByType: null,
      scannedByName: null,
      subUserId: null,
    };
  }
  return {
    ...t,
    ...buildScanActorInfo({ scannedBy: t.scannedBy, subUser: t.subUser }),
  };
}

module.exports = {
  buildScanActorInfo,
  enrichScannedAtLogEntry,
  enrichPurchaseScanInfo,
  enrichPrintTicketScanInfo,
};
