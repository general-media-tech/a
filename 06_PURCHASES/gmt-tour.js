/* ═══════════════════════════════════════════════════════════════════════
   gmt-tour.js — 🪦 شاهدة توافق (إصدار 2026-07-12)
   الجولة القديمة أُلغيت (TOUR-1): كانت تضع نافذة صغيرة فوق عنصر هدف بحساب موقعه،
   فإذا كان مخفياً أو خارج الشاشة أو لم يُرسم بعد ⇒ تطير لمكان عشوائي أو تُجمّد الصفحة.
   بديلها: gmt-guide.js (شاشات كاملة + دليل زرّاً بزرّ).
   هذا الملف يبقى فقط كي لا تنكسر الصفحات التي ما تزال تستدعيه — وكل نداء يُحوَّل للنظام الجديد.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const jump = () => { if (window.GMTGuide) window.GMTGuide.start(); };
  window.GMTTour = function GMTTour() {
    return { start: jump, restart: jump, stop() {}, next() {}, prev() {}, goTo() {} };
  };
  window.GMTTour.disabled = true;

  // (2026-07-20) جسور توافق: بعض الصفحات تستدعي هذه الأسماء القديمة.
  // نوفّرها كي لا يظهر خطأ «startInteractiveTraining is not defined» بالكونسول.
  if (typeof window.startInteractiveTraining !== 'function') {
    window.startInteractiveTraining = function () { jump(); };
  }
  if (!window._gmtTour) {
    window._gmtTour = { start: jump, restart: jump, stop() {}, next() {}, prev() {} };
  }
})();
