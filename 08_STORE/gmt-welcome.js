/* ═══════════════════════════════════════════════════════════════════════
   gmt-welcome.js — 🪦 شاهدة توافق (إصدار 2026-07-12)
   شاشات الترحيب القديمة استُبدلت بشاشات gmt-guide.js الكاملة (موشن + هوية + تقليب).
   يبقى الملف لتوافق الصفحات القديمة: كل نداء يفتح النظام الجديد.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  // (2026-07-21) الدوال تُرجع false دائماً حتى يعمل منطق «if(!shown) tour» بالصفحات،
  // وتُعرّف بقوّة (لا شرط) كي لا يظهر «... is not defined» مهما كان ترتيب التحميل.
  const jump = function () { try { if (window.GMTGuide) window.GMTGuide.start(); } catch (_) {} return false; };
  ['showWelcomeSlides', 'showWelcomeSlidesForce', 'gmtWelcomeNext', 'gmtWelcomePrev',
   'gmtWelcomeGoTo', 'gmtWelcomeClose', 'gmtWelcomeDone', 'gmtWelcomeTouchStart', 'gmtWelcomeTouchEnd',
   'startInteractiveTraining']
    .forEach((n) => { try { window[n] = jump; } catch (_) {} });
})();
