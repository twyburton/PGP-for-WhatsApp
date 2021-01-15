const MANIFEST = chrome.runtime.getManifest();
document.getElementById("version-number").innerHTML = `Exension Version ${MANIFEST.version}`;
