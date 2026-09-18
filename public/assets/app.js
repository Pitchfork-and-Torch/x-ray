/* X-Ray v3 entry shim.
   Kept for cache/legacy references; loads main-v302.js if this file is used as classic script. */
(function () {
  if (document.querySelector('script[data-xray-main]')) return;
  var s = document.createElement("script");
  s.type = "module";
  s.src = "/assets/app/main-v302.js";
  s.dataset.xrayMain = "1";
  document.head.appendChild(s);
})();
