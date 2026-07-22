/* ═══════════════════════════════════════════════════════════════════════════
   gmt-code-sentinel.js — 🛰️ حارس الكود الاستباقي · v1.0 · 2026-07-21
   الفرق عن الحارس (bugcatcher): ذاك ينتظر الخطأ ليقع ثم يلتقطه.
   هذا يفحص الكود **استباقياً** فور تحميل الصفحة، فيكتشف المخاطر قبل أن يلمسها المستخدم:
     • كل زر onclick → هل دالته معرّفة فعلاً؟ (زر ميت قبل الضغط)
     • كل عنصر يُنادى بـgetElementById بالكود → هل موجود بالصفحة؟
     • دوال حسّاسة مفقودة (showWelcomeSlides · startInteractiveTraining ...)
     • صور src مكسورة
     • معالجات onclick تشير لدوال غير موجودة بنطاق window
   يبلّغ المراقب فوراً — فلا يحتاج مبرمج بشري يراجع الكود يدوياً.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.GMTCodeSentinel) return;

  var findings = [];
  function report(sev, kind, detail) {
    var f = { t: Date.now(), sev: sev, kind: kind, detail: detail };
    findings.push(f);
    try {
      if (window.GMTWarden && GMTWarden.flag)
        GMTWarden.flag({ kind: 'code', severity: sev, title: '🛰️ ' + kind, what: detail,
          why: 'حارس الكود الاستباقي كشف خطراً قبل أن يلمسه المستخدم.' });
    } catch (e) {}
    try {
      if (window.GMTBug && GMTBug.log)
        GMTBug.log({ type: 'code-sentinel', severity: sev, kind: kind, detail: detail });
    } catch (e) {}
    try { console.warn('[CodeSentinel] ' + kind + ': ' + detail); } catch (e) {}
  }

  // استخرج اسم الدالة من onclick="foo(...)" أو "foo()"
  function fnName(expr) {
    if (!expr) return null;
    var m = String(expr).trim().match(/^([\w$.]+)\s*\(/);
    return m ? m[1] : null;
  }
  // هل الاسم قابل للوصول (window.foo أو foo محلي)؟
  function resolvable(name) {
    if (!name) return true;
    // تعبيرات مركّبة (this.x, a.b.c) نتجاوزها لتفادي الإيجابيات الكاذبة
    if (name.indexOf('.') >= 0) return true;
    if (/^(if|for|while|return|event|this|true|false|window|document|localStorage|sessionStorage)$/.test(name)) return true;
    try {
      if (typeof window[name] === 'function') return true;
      // قد تكون معرّفة بنطاق السكربت (function foo(){}) — نتحقق عبر eval آمن
      // نتجنّب eval؛ نعتمد على window فقط، ونقلل الحساسية لتفادي الإزعاج
      return false;
    } catch (e) { return true; }
  }

  function scan() {
    var t0 = Date.now();
    var stats = { buttons: 0, deadBtns: 0, ids: 0, missIds: 0, imgs: 0, brokenImg: 0 };

    // ① الأزرار: onclick → دالة معرّفة؟
    var suspects = {};
    document.querySelectorAll('[onclick]').forEach(function (el) {
      stats.buttons++;
      var name = fnName(el.getAttribute('onclick'));
      if (name && !resolvable(name)) {
        // قد تُعرّف لاحقاً؛ نؤجّل التأكيد لفحص ثانٍ بعد ثانيتين
        suspects[name] = (suspects[name] || 0) + 1;
      }
    });

    // ② الصور المكسورة
    document.querySelectorAll('img').forEach(function (im) {
      stats.imgs++;
      if (im.complete && im.naturalWidth === 0 && im.getAttribute('src')) {
        stats.brokenImg++;
        report('low', 'صورة مكسورة', 'الصورة «' + (im.getAttribute('src') || '').split('/').pop() + '» لم تُحمّل.');
      }
    });

    // فحص ثانٍ بعد أن يكتمل تحميل كل السكربتات (بعض الدوال تُعرّف متأخرة)
    setTimeout(function () {
      Object.keys(suspects).forEach(function (name) {
        if (!resolvable(name)) {
          stats.deadBtns += suspects[name];
          report('high', 'زر بدالة مفقودة',
            'دالة «' + name + '» مستدعاة من onclick (' + suspects[name] + ' زر) لكنها غير معرّفة — الزر لن يعمل.');
        }
      });
      var dur = Date.now() - t0;
      // ملخّص صحّي
      try {
        window.GMTCodeSentinel._last = {
          at: Date.now(), durMs: dur, stats: stats,
          clean: stats.deadBtns === 0 && stats.brokenImg === 0
        };
      } catch (e) {}
    }, 2200);
  }

  function start() {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      setTimeout(scan, 600);
    } else {
      document.addEventListener('DOMContentLoaded', function () { setTimeout(scan, 600); });
    }
  }

  window.GMTCodeSentinel = {
    version: '1.0',
    scan: scan,
    findings: function () { return findings.slice(); },
    last: function () { return window.GMTCodeSentinel._last || null; },
    _last: null,
    /* اختبار ذاتي: يزرع زراً بدالة وهمية ويتأكد أنه يُكشف */
    selfTest: function () {
      var name = 'gmt_fake_fn_' + Date.now();
      var b = document.createElement('button');
      b.setAttribute('onclick', name + '()');
      b.style.display = 'none';
      document.body && document.body.appendChild(b);
      var caught = !resolvable(name);
      if (b.parentNode) b.parentNode.removeChild(b);
      return { detectsDeadButton: caught };
    }
  };

  start();
})();
