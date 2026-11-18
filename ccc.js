// ccc.js — the finance math for the ElectroMart CCC app.
// Plain functions only: nothing here touches the page, so every number can
// be checked with Node, e.g.  node -e "const c=require('./ccc.js'); ..."

(function (root) {
  "use strict";

  // Turn CSV text into an array of objects keyed by the header row.
  function parseCSV(text) {
    const lines = text.replace(/\r/g, "").split("\n").filter(function (l) { return l.trim() !== ""; });
    const header = lines[0].split(",").map(function (h) { return h.trim(); });
    return lines.slice(1).map(function (line) {
      // Only the first header.length - 1 commas split fields; anything after
      // belongs to the last column (the notes in assumptions.csv can hold commas).
      const parts = line.split(",");
      const row = {};
      header.forEach(function (h, i) {
        row[h] = (i === header.length - 1 ? parts.slice(i).join(",") : parts[i] || "").trim();
      });
      return row;
    });
  }

  // Statements CSV (section,item,before,after) -> { before: {...}, after: {...}, sections: {...} }
  function readStatements(rows) {
    const out = { before: {}, after: {}, sections: {} };
    rows.forEach(function (r) {
      out.before[r.item] = Number(r.before);
      out.after[r.item] = Number(r.after);
      out.sections[r.item] = r.section;
    });
    return out;
  }

  // Assumptions CSV (assumption,value,note) -> { days_in_year: 365, bank_rate: 0.08, ... }
  function readAssumptions(rows) {
    const out = {};
    rows.forEach(function (r) { out[r.assumption] = Number(r.value); });
    return out;
  }

  // Day counts for one period's figures. No rounding: round only when displaying.
  function dayCounts(p, daysInYear) {
    const dio = p.inventory / p.cogs * daysInYear;            // days inventory outstanding
    const dso = p.accounts_receivable / p.revenue * daysInYear; // days sales outstanding
    const dpo = p.accounts_payable / p.cogs * daysInYear;      // days payables outstanding
    return { dio: dio, dso: dso, dpo: dpo, ccc: dio + dso - dpo };
  }

  // Cash freed by each lever, from the balance sheet change.
  // A drop in an asset frees cash; a rise in accounts payable frees cash.
  function cashFreed(before, after) {
    const inventory = before.inventory - after.inventory;
    const receivables = before.accounts_receivable - after.accounts_receivable;
    const payables = after.accounts_payable - before.accounts_payable;
    return { inventory: inventory, receivables: receivables, payables: payables,
             total: inventory + receivables + payables };
  }

  // The same cash freed, worked out from the day changes instead:
  // days changed x annual COGS (or revenue) / days in year. Used as a cross-check.
  function cashFreedFromDays(beforeDays, afterDays, p, daysInYear) {
    const inventory = (beforeDays.dio - afterDays.dio) * p.cogs / daysInYear;
    const receivables = (beforeDays.dso - afterDays.dso) * p.revenue / daysInYear;
    const payables = (afterDays.dpo - beforeDays.dpo) * p.cogs / daysInYear;
    return { inventory: inventory, receivables: receivables, payables: payables,
             total: inventory + receivables + payables };
  }

  // Nominal annual cost of skipping the supplier discount when paying on day `daysPaid`.
  // d / (1 - d) x daysInYear / (daysPaid - discountDays). Returns null if the
  // payment falls inside the discount period, because then ElectroMart takes the discount.
  function discountCost(daysPaid, a) {
    if (daysPaid <= a.discount_days) return null;
    const d = a.supplier_discount;
    return d / (1 - d) * a.days_in_year / (daysPaid - a.discount_days);
  }

  // Everything the levers show, for chosen days { dio, dso, dpo }.
  // Revenue and COGS stay at their Before values; balances are what the days imply.
  function leverResults(days, before, a) {
    const y = a.days_in_year;
    const inventory = days.dio * before.cogs / y;
    const receivables = days.dso * before.revenue / y;
    const payables = days.dpo * before.cogs / y;

    const freedInventory = before.inventory - inventory;
    const freedReceivables = before.accounts_receivable - receivables;
    const freedPayables = payables - before.accounts_payable;
    const freedTotal = freedInventory + freedReceivables + freedPayables;

    // Freed cash pays down the bank line, but only up to what was owed Before.
    // Negative freed cash means more borrowing, shown as a negative saving.
    const paidDown = Math.min(freedTotal, before.notes_payable);
    const interestSaved = paidDown * a.bank_rate;

    return {
      ccc: days.dio + days.dso - days.dpo,
      balances: { inventory: inventory, receivables: receivables, payables: payables },
      cashFreed: { inventory: freedInventory, receivables: freedReceivables,
                   payables: freedPayables, total: freedTotal },
      bankPaidDown: paidDown,
      interestSaved: interestSaved,
      daysPastDue: Math.max(0, days.dpo - a.net_days),
      takesDiscount: days.dpo <= a.discount_days,
      discountCost: discountCost(days.dpo, a)
    };
  }

  const api = { parseCSV: parseCSV, readStatements: readStatements, readAssumptions: readAssumptions,
                dayCounts: dayCounts, cashFreed: cashFreed, cashFreedFromDays: cashFreedFromDays,
                discountCost: discountCost, leverResults: leverResults };

  if (typeof module !== "undefined" && module.exports) { module.exports = api; }
  else { root.CCC = api; }
})(this);
