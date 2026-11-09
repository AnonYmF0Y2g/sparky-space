(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const yes = $("privacy-test-yes");
  const no = $("privacy-test-no");
  const run = $("run-privacy-tests");
  const dns = $("open-dns-test");
  const status = $("privacy-test-status");
  const results = $("privacy-test-results");
  let consentGiven = false;
  yes.addEventListener("click", () => {
    consentGiven = true;
    run.disabled = false;
    dns.disabled = false;
    yes.setAttribute("aria-pressed", "true");
    no.setAttribute("aria-pressed", "false");
    status.textContent = "You chose Yes. No checks have run yet; select a test button when ready.";
  });
  no.addEventListener("click", () => {
    consentGiven = false;
    run.disabled = true;
    dns.disabled = true;
    results.replaceChildren();
    yes.setAttribute("aria-pressed", "false");
    no.setAttribute("aria-pressed", "true");
    status.textContent = "You chose No. No tests will run.";
  });

  function addResult(title, detail, state="checking") {
    const card = document.createElement("article");
    card.className = "status-item";
    const heading = document.createElement("strong");
    heading.textContent = title;
    const body = document.createElement("p");
    body.textContent = detail;
    const label = document.createElement("span");
    label.className = "status-state" + (state === "issue" ? " issue" : "");
    label.textContent = state === "issue" ? "Needs attention / review" : state === "ok" ? "Checked" : "Informational";
    card.append(heading, body, label);
    results.append(card);
  }

  async function publicIpCheck() {
    const response = await fetch("https://api.ipify.org?format=json", {
      method: "GET",
      mode: "cors",
      cache: "no-store",
      credentials: "omit"
    });
    if (!response.ok) throw new Error("IP provider returned an error.");
    const data = await response.json();
    if (typeof data.ip !== "string" || data.ip.length > 64) throw new Error("Unexpected response from IP provider.");
    return data.ip;
  }

  async function webRtcCheck() {
    if (!window.RTCPeerConnection) return {supported:false, host:false, srflx:false, relay:false, mDNS:false};
    const pc = new RTCPeerConnection({iceServers:[{urls:"stun:stun.l.google.com:19302"}]});
    const found = {supported:true,host:false,srflx:false,relay:false,mDNS:false};
    pc.createDataChannel("privacy-check");
    const finished = new Promise(resolve => {
      const timeout = setTimeout(() => resolve(), 7000);
      pc.onicecandidate = event => {
        if (!event.candidate) { clearTimeout(timeout); resolve(); return; }
        const candidate = event.candidate.candidate || "";
        if (/ typ host\b/.test(candidate)) found.host = true;
        if (/ typ srflx\b/.test(candidate)) found.srflx = true;
        if (/ typ relay\b/.test(candidate)) found.relay = true;
        if (/\.local\b/i.test(candidate)) found.mDNS = true;
      };
    });
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await finished;
    } finally {
      pc.onicecandidate = null;
      pc.close();
    }
    return found;
  }

  run.addEventListener("click", async () => {
    if (!consentGiven) return;
    run.disabled = true;
    results.replaceChildren();
    status.textContent = "Running the checks you approved...";
    addResult("HTTPS / secure context", location.protocol === "https:" && window.isSecureContext
      ? "This page is loaded in a secure browser context over HTTPS."
      : "This page is not in a secure HTTPS browser context.", location.protocol === "https:" && window.isSecureContext ? "ok" : "issue");
    const gpc = navigator.globalPrivacyControl === true;
    const dnt = navigator.doNotTrack === "1" || window.doNotTrack === "1";
    addResult("Browser privacy signals",
      "Global Privacy Control: " + (gpc ? "enabled" : "not reported") + ". Do Not Track: " + (dnt ? "enabled" : "not reported") + ". Websites are not required to honor these signals.",
      gpc || dnt ? "ok" : "checking");
    try {
      const ip = await publicIpCheck();
      addResult("Public IP seen by ipify", ip + " (the IP-check provider received this request). This is the address seen by that provider, not proof about every app or route.", "checking");
    } catch (error) {
      addResult("Public IP check", "The external IP provider could not be reached. No conclusion can be drawn.", "issue");
    }
    try {
      const rtc = await webRtcCheck();
      if (!rtc.supported) {
        addResult("WebRTC", "This browser does not expose the WebRTC peer-connection API, so this check could not run.");
      } else {
        const visible = [rtc.host ? "host candidate" : "", rtc.srflx ? "server-reflexive candidate" : "", rtc.relay ? "relay candidate" : "", rtc.mDNS ? "mDNS-obfuscated host candidate" : ""].filter(Boolean);
        addResult("WebRTC candidate check",
          visible.length ? "Candidate types observed: " + visible.join(", ") + ". A server-reflexive candidate is visible to the STUN provider; compare the public IP result with your expected route. A non-mDNS host candidate may reveal local network details to page scripts. Raw addresses were not displayed or sent to Sparky's Space." : "No candidates were observed before the check ended. This is inconclusive, not proof of a leak-free setup.",
          rtc.host && !rtc.mDNS ? "issue" : "checking");
      }
    } catch (error) {
      addResult("WebRTC candidate check", "The browser could not complete the check. This may be caused by browser settings or network restrictions.", "issue");
    }
    addResult("Data handling", "The page did not send results to Sparky's Space or save them in an account. The IP and STUN providers received network requests as explained above.", "ok");
    status.textContent = "Checks finished. Results exist only in this page until you leave or refresh.";
    run.disabled = false;
  });

  dns.addEventListener("click", () => {
    if (!consentGiven) return;
    window.open("https://www.dnsleaktest.com/", "_blank", "noopener,noreferrer");
  });
})();