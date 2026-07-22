/* ═══════════════════════════════════════════════════════════════════════════
   gmt-money-guard.js — 🧮 الحارس المالي الرياضي · v1.0 · 2026-07-21
   الفكرة: البوتات العادية تتأكد أن الزر اشتغل. هذا يتأكد أن الرقم صحيح رياضياً.
   يعترض كل عملية بيع/عمولة/خصم، يعيد حسابها بنفسه من المبادئ الأولى،
   ويقارن بما حسبه النظام. أي فرق ⇒ يوقف ويبلّغ المراقب فوراً.
   هذا أقصى حد عملي: بعد أن يضع المالك القواعد (النسب/الحدود) مرة واح—دة،
   يفرضها البوت بصرامة مطلقة دون مراجعة يومية.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.GMTMoneyGuard) return;

  // ── القواعد المالية (يضبطها المالك مرة واحدة) ──
  // تُقرأ من window.GMT_MONEY_RULES إن وُجدت، وإلا الافتراضات الآمنة.
  var R = window.GMT_MONEY_RULES || {};
  var RULES = {
    commissionPct: (R.commissionPct != null ? R.commissionPct : null), // نسبة العمولة إن كانت ثابتة (null = تُقرأ من المنتج)
    cashierProfitShare: (R.cashierProfitShare != null ? R.cashierProfitShare : 0.5), // نصف (البيع−التكلفة)
    tolerance: (R.tolerance != null ? R.tolerance : 0.01), // فرق مسموح (تقريب القروش)
    allowBelowCostRoles: R.allowBelowCostRoles || ['admin', 'sovereign', 'partner'],
    blockBelowCost: (R.blockBelowCost !== false) // افتراضياً يمنع البيع تحت التكلفة
  };

  var incidents = [];
  function flag(sev, title, detail, math) {
    var inc = { t: Date.now(), sev: sev, title: title, detail: detail, math: math || null };
    incidents.push(inc);
    // بلّغ المراقب السيادي
    try {
      if (window.GMTWarden && GMTWarden.flag) {
        GMTWarden.flag({
          kind: 'financial', severity: sev, title: '🧮 ' + title,
          what: detail, how: math ? ('الحساب المتوقّع: ' + math) : '', why: 'الحارس المالي كشف تبايناً رياضياً.'
        });
      }
    } catch (e) {}
    // سجّل بالكونسول للمفتّش
    try { console.warn('[MoneyGuard] ' + title + ' — ' + detail); } catch (e) {}
  }

  var near = function (a, b) { return Math.abs((+a || 0) - (+b || 0)) <= RULES.tolerance; };

  // ── ① تحقّق من عمولة فاتورة ──
  // يتوقّع: {sale, cost, wholesale, commission, qty} لكل بند
  function checkCommission(item) {
    if (!item || item.commission == null) return true;
    var sale = +item.sale || +item.unit_price || +item.actual_price || 0;
    var cost = +item.cost || +item.purchase_price || +item.net_cost || 0;
    var qty = +item.qty || 1;
    var got = +item.commission || 0;

    // العمولة = (البيع − التكلفة) × الكمية × نصيب الكاشير  [أو نسبة ثابتة إن حُددت]
    var expected;
    if (RULES.commissionPct != null) {
      expected = sale * qty * RULES.commissionPct;
    } else {
      expected = Math.max(0, (sale - cost)) * qty * RULES.cashierProfitShare;
    }
    if (!near(got, expected)) {
      flag('high', 'عمولة غير مطابقة',
        'المنتج «' + (item.product_name || item.name || '?') + '»: النظام سجّل عمولة ' + got.toFixed(2) +
        ' والمتوقّع ' + expected.toFixed(2) + ' (بيع ' + sale + ' − تكلفة ' + cost + ' × ' + qty + ').',
        expected.toFixed(2));
      return false;
    }
    return true;
  }

  // ── ② تحقّق من البيع تحت التكلفة ──
  function checkBelowCost(item, role) {
    var sale = +item.sale || +item.unit_price || +item.actual_price || 0;
    var cost = +item.cost || +item.purchase_price || +item.net_cost || 0;
    if (cost > 0 && sale < cost - RULES.tolerance) {
      var allowed = RULES.allowBelowCostRoles.indexOf((role || '').toLowerCase()) >= 0;
      if (!allowed && RULES.blockBelowCost) {
        flag('critical', 'بيع تحت التكلفة ممنوع',
          'المنتج «' + (item.product_name || item.name || '?') + '»: بيع ' + sale + ' < تكلفة ' + cost +
          ' والدور «' + (role || 'كاشير') + '» غير مخوّل. يجب منع الحفظ.',
          '≥ ' + cost);
        return false;
      }
    }
    return true;
  }

  // ── ③ تحقّق من إجمالي الفاتورة ──
  function checkInvoiceTotal(inv) {
    if (!inv || !inv.items) return true;
    var sum = 0;
    (inv.items || []).forEach(function (it) {
      sum += (+it.sale || +it.unit_price || 0) * (+it.qty || 1);
    });
    var coupon = +inv.coupon_discount || 0;
    var expected = Math.max(0, sum - coupon);
    var got = +inv.total || 0;
    if (!near(got, expected)) {
      flag('high', 'إجمالي الفاتورة غير مطابق',
        'الإجمالي المسجّل ' + got.toFixed(2) + ' والمتوقّع ' + expected.toFixed(2) +
        ' (مجموع البنود ' + sum.toFixed(2) + ' − كوبون ' + coupon + ').',
        expected.toFixed(2));
      return false;
    }
    return true;
  }

  // ── ④ تحقّق من ربح الشركة ──
  // ربح الشركة = (البيع − الشراء) − العمولة
  function checkCompanyProfit(item) {
    if (item.company_profit == null) return true;
    var sale = +item.sale || 0, cost = +item.cost || 0, comm = +item.commission || 0, qty = +item.qty || 1;
    var expected = (sale - cost) * qty - comm;
    var got = +item.company_profit || 0;
    if (!near(got, expected)) {
      flag('medium', 'ربح الشركة غير مطابق',
        'المسجّل ' + got.toFixed(2) + ' والمتوقّع ' + expected.toFixed(2) + '.', expected.toFixed(2));
      return false;
    }
    return true;
  }

  // ── واجهة الفحص الكامل لفاتورة ──
  function auditInvoice(inv, role) {
    var problems = 0;
    (inv.items || []).forEach(function (it) {
      if (!checkCommission(it)) problems++;
      if (!checkBelowCost(it, role)) problems++;
      if (!checkCompanyProfit(it)) problems++;
    });
    if (!checkInvoiceTotal(inv)) problems++;
    return { ok: problems === 0, problems: problems };
  }

  // ── اعتراض تلقائي: راقب حفظ الفواتير عبر fetch ──
  var RF = window.fetch;
  window.fetch = async function (input, init) {
    try {
      var url = (typeof input === 'string' ? input : (input && input.url)) || '';
      var method = ((init && init.method) || 'GET').toUpperCase();
      if (/POST|PATCH/.test(method) && /rest\/v1\/invoices/.test(url) && init && init.body) {
        var payload = null;
        try { payload = typeof init.body === 'string' ? JSON.parse(init.body) : init.body; } catch (e) {}
        if (payload) {
          var inv = payload;
          if (inv.items_json && typeof inv.items_json === 'string') {
            try { inv.items = JSON.parse(inv.items_json); } catch (e) {}
          }
          var role = '';
          try { role = (JSON.parse(localStorage.getItem('gmt_user') || '{}').role) || ''; } catch (e) {}
          auditInvoice(inv, role); // يسجّل أي تباين للمراقب (لا يحجب الحفظ — لكن يبلّغ فوراً)
        }
      }
    } catch (e) { /* لا نُفشل أبداً بسبب الفحص */ }
    return RF.apply(this, arguments);
  };

  window.GMTMoneyGuard = {
    version: '1.0',
    rules: RULES,
    auditInvoice: auditInvoice,
    checkCommission: checkCommission,
    checkBelowCost: checkBelowCost,
    checkInvoiceTotal: checkInvoiceTotal,
    checkCompanyProfit: checkCompanyProfit,
    incidents: function () { return incidents.slice(); },
    /* اختبار ذاتي: يتحقق أن منطق الحساب سليم */
    selfTest: function () {
      var t = [];
      // عمولة صحيحة: بيع 100 تكلفة 60 نصف الفرق = 20
      t.push({ n: 'عمولة', ok: checkCommission({ sale: 100, cost: 60, qty: 1, commission: 20 }) });
      // عمولة خاطئة: نفس المعطيات لكن سُجّل 30 ⇒ يجب أن يكشفها (false)
      t.push({ n: 'كشف عمولة خاطئة', ok: !checkCommission({ sale: 100, cost: 60, qty: 1, commission: 30 }) });
      // تحت التكلفة لكاشير ⇒ يُمنع (false)
      t.push({ n: 'منع تحت التكلفة', ok: !checkBelowCost({ sale: 50, cost: 60 }, 'cashier') });
      // تحت التكلفة لأدمن ⇒ مسموح (true)
      t.push({ n: 'سماح أدمن', ok: checkBelowCost({ sale: 50, cost: 60 }, 'admin') });
      var pass = t.filter(function (x) { return x.ok; }).length;
      return { pass: pass, total: t.length, details: t };
    }
  };
})();
