// app.js — loads the CSV files and fills in the page. All math lives in ccc.js.
(function () {
  "use strict";

  const days2 = function (x) { return x.toFixed(2); };
  const money = function (x) {
    const r = Math.round(x);
    return (r < 0 ? "−$" : "$") + Math.abs(r).toLocaleString("en-US");
  };
  const signedDays = function (x) { return (x > 0 ? "+" : x < 0 ? "−" : "") + Math.abs(x).toFixed(2); };

  function cell(text, tag) {
    const el = document.createElement(tag || "td");
    el.textContent = text;
    return el;
  }
  function addRow(tbody, cells, className) {
    const tr = document.createElement("tr");
    if (className) tr.className = className;
    cells.forEach(function (c, i) { tr.appendChild(cell(c, i === 0 ? "th" : "td")); });
    if (tr.firstChild) tr.firstChild.setAttribute("scope", "row");
    tbody.appendChild(tr);
  }

  function render(st, as) {
    const y = as.days_in_year;
    const b = CCC.dayCounts(st.before, y);
    const a = CCC.dayCounts(st.after, y);
    document.getElementById("year-days").textContent = y;

    const dt = document.querySelector("#days-table tbody");
    dt.innerHTML = "";
    [["DIO (inventory days)", "dio"], ["DSO (collection days)", "dso"],
     ["DPO (payment days)", "dpo"], ["Cash conversion cycle", "ccc"]].forEach(function (m) {
      addRow(dt, [m[0], days2(b[m[1]]), days2(a[m[1]]), signedDays(a[m[1]] - b[m[1]])],
             m[1] === "ccc" ? "total" : "");
    });

    const f = CCC.cashFreed(st.before, st.after);
    const ct = document.querySelector("#cash-table tbody");
    ct.innerHTML = "";
    addRow(ct, ["Inventory", money(st.before.inventory), money(st.after.inventory), money(f.inventory)]);
    addRow(ct, ["Receivables", money(st.before.accounts_receivable), money(st.after.accounts_receivable), money(f.receivables)]);
    addRow(ct, ["Payables", money(st.before.accounts_payable), money(st.after.accounts_payable), money(f.payables)]);
    addRow(ct, ["Total cash freed", "", "", money(f.total)], "total");
  }

  function getText(path) {
    return fetch(path).then(function (r) {
      if (!r.ok) throw new Error("Could not load " + path);
      return r.text();
    });
  }

  Promise.all([getText("data/electromart.csv"), getText("data/assumptions.csv")])
    .then(function (texts) {
      const st = CCC.readStatements(CCC.parseCSV(texts[0]));
      const as = CCC.readAssumptions(CCC.parseCSV(texts[1]));
      render(st, as);
      document.getElementById("status").hidden = true;
    })
    .catch(function (err) {
      document.getElementById("status").textContent = err.message;
    });
})();
