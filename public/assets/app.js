/* X-Ray v3 entry shim - prefers ES modules (see assets/app/main.js).
   Kept for cache/legacy references; loads main as module if this file is used as classic script. */
(function () {
  if (document.querySelector('script[data-xray-main]')) return;
  var s = document.createElement("script");
  s.type = "module";
  s.src = "/assets/app/main-v302.js";
  s.dataset.xrayMain = "1";
  document.head.appendChild(s);
})();
