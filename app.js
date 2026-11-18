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

  const pct = function (x) { return (x * 100).toFixed(2) + "%"; };

  // Wire up the three sliders and the two preset buttons.
  function setupLevers(st, as) {
    const y = as.days_in_year;
    const b = CCC.dayCounts(st.before, y);
    const a = CCC.dayCounts(st.after, y);
    const ids = ["dio", "dso", "dpo"];
    const inputs = {};
    ids.forEach(function (k) {
      inputs[k] = document.getElementById(k);
      // Make sure the slider's range covers both periods' values.
      const need = Math.ceil(Math.max(b[k], a[k]) * 1.5);
      if (Number(inputs[k].max) < need) inputs[k].max = need;
      inputs[k].addEventListener("input", update);
    });

    function setDays(d) {
      // Range inputs with step="any" keep the exact value, e.g. 32.85.
      ids.forEach(function (k) { inputs[k].value = d[k]; });
      update();
    }
    document.getElementById("set-before").addEventListener("click", function () { setDays(b); });
    document.getElementById("set-after").addEventListener("click", function () { setDays(a); });

    function update() {
      const days = { dio: Number(inputs.dio.value), dso: Number(inputs.dso.value), dpo: Number(inputs.dpo.value) };
      ids.forEach(function (k) { document.getElementById(k + "-out").textContent = days2(days[k]) + " days"; });

      const r = CCC.leverResults(days, st.before, as);
      document.getElementById("lever-ccc").textContent = days2(r.ccc) + " days";
      document.getElementById("lever-ccc-change").textContent =
        signedDays(r.ccc - b.ccc) + " days vs Before (" + days2(b.ccc) + ")";

      const lt = document.querySelector("#lever-table tbody");
      lt.innerHTML = "";
      addRow(lt, ["Inventory", money(st.before.inventory), money(r.balances.inventory), money(r.cashFreed.inventory)]);
      addRow(lt, ["Receivables", money(st.before.accounts_receivable), money(r.balances.receivables), money(r.cashFreed.receivables)]);
      addRow(lt, ["Payables", money(st.before.accounts_payable), money(r.balances.payables), money(r.cashFreed.payables)]);
      addRow(lt, ["Total cash freed", "", "", money(r.cashFreed.total)], "total");

      const et = document.querySelector("#lever-extra tbody");
      et.innerHTML = "";
      addRow(et, ["Interest saved per year (if freed cash pays down the bank line at " + pct(as.bank_rate) + ")",
                  money(r.interestSaved)]);
      addRow(et, ["Days paid past the net-" + as.net_days + " due date", days2(r.daysPastDue)]);
      addRow(et, ["Annual cost of skipping the " + pct(as.supplier_discount) + " discount",
                  r.takesDiscount ? "Takes the discount" : pct(r.discountCost)]);
    }

    setDays(b);
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
      setupLevers(st, as);
      document.getElementById("status").hidden = true;
    })
    .catch(function (err) {
      document.getElementById("status").textContent = err.message;
    });

  // Register the service worker so the app installs and works offline.
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () { /* app still works online */ });
    });
  }
})();
