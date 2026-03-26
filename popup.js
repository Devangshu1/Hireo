// popup.js — Hireo Popup Controller

const LOADING_STEPS = [
  "Waiting for page content to load…",
  "Running scam pattern checks…",
  "Sending to AI for deep analysis…",
  "Building your report…",
];

let currentJobData = null;
let currentResult = null;

// ─── State Management ───────────────────────────────────────────
function showState(id) {
  ["idle", "loading", "result", "error", "no-content"].forEach((s) => {
    const el = document.getElementById(`state-${s}`);
    if (el) el.classList.toggle("hidden", s !== id);
  });
}

function setLoadingStep(index) {
  const el = document.getElementById("loadingStep");
  if (el) el.textContent = LOADING_STEPS[index] || "";
}

// ─── Main Analysis Flow ─────────────────────────────────────────
async function runAnalysis() {
  showState("loading");
  setLoadingStep(0);

  try {
    // 1. Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Update platform info
    document.getElementById("platformName").textContent = getPlatformFromUrl(tab.url);
    document.getElementById("pageTitle").textContent = truncate(tab.title || "—", 30);

    // 2. Extract content from page
    let jobData;
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: "extractJobContent" });
      if (response && response.success) {
        jobData = response.data;
      } else {
        throw new Error("Content extraction failed");
      }
    } catch (e) {
      // Try injecting content script if not loaded
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["src/content.js"] });
      const response2 = await chrome.tabs.sendMessage(tab.id, { action: "extractJobContent" });
      if (response2 && response2.success) {
        jobData = response2.data;
      } else {
        throw new Error("Could not extract content from this page.");
      }
    }

    if (!jobData || !jobData.fullText || jobData.fullText.trim().length < 50) {
      showState("no-content");
      return;
    }

    currentJobData = jobData;
    setLoadingStep(1);

    // 3. Rule-based detection
    const ruleResult = window.HireoDetector.runRuleBasedDetection(jobData);
    setLoadingStep(2);

    // 4. AI analysis (if enabled & API key exists)
    const settings = await getSettings();
    let aiResult = null;
    let usedAI = false;

    if (settings.aiEnabled && settings.apiKey) {
      try {
        aiResult = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage(
            { action: "analyzeWithAI", jobData, apiKey: settings.apiKey },
            (resp) => {
              if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
              if (resp && resp.success) resolve(resp.result);
              else reject(new Error(resp?.error || "AI analysis failed"));
            }
          );
        });
        usedAI = true;
      } catch (err) {
        console.warn("AI analysis failed, using rules only:", err);
      }
    }

    setLoadingStep(3);

    // 5. Merge results
    const finalResult = mergeResults(ruleResult, aiResult, jobData);
    currentResult = { ...finalResult, usedAI, jobData };

    // Small delay for UX polish
    await sleep(400);

    // 6. Render result
    renderResult(currentResult);
    showState("result");

  } catch (err) {
    console.error("Analysis error:", err);
    showError(err.message || "An unexpected error occurred.");
  }
}

// ─── Result Merging ──────────────────────────────────────────────
function mergeResults(ruleResult, aiResult, jobData) {
  let finalScore, redFlags, greenFlags, summary, recommendation, confidence;

  if (aiResult) {
    // Weight: 40% rules, 60% AI
    finalScore = Math.round(ruleResult.ruleScore * 0.4 + aiResult.score * 0.6);
    redFlags = [...new Set([...ruleResult.redFlags, ...(aiResult.redFlags || [])])];
    greenFlags = [...new Set([...ruleResult.greenFlags, ...(aiResult.greenFlags || [])])];
    summary = aiResult.summary || "";
    recommendation = aiResult.recommendation || "";
    confidence = aiResult.confidence || "Medium";
  } else {
    finalScore = ruleResult.ruleScore;
    redFlags = ruleResult.redFlags;
    greenFlags = ruleResult.greenFlags;
    summary = generateRuleSummary(ruleResult, finalScore);
    recommendation = generateRecommendation(finalScore);
    confidence = finalScore > 60 ? "High" : finalScore > 30 ? "Medium" : "Medium";
  }

  finalScore = Math.max(0, Math.min(100, finalScore));
  const verdict = window.HireoDetector.getVerdict(finalScore);

  return { score: finalScore, verdict, redFlags, greenFlags, summary, recommendation, confidence };
}

function generateRuleSummary(ruleResult, score) {
  if (score <= 30) return "No major red flags detected. This job posting appears to follow standard practices.";
  if (score <= 70) return `${ruleResult.redFlags.length} suspicious pattern(s) detected. Review the red flags carefully before proceeding.`;
  return `Multiple serious red flags found. This posting shows strong indicators of a scam job. Do not share personal information or make any payments.`;
}

function generateRecommendation(score) {
  if (score <= 30) return "This job appears legitimate. Still verify the company on LinkedIn and their official website before sharing personal details.";
  if (score <= 70) return "Proceed cautiously. Research the company independently, verify the recruiter's identity, and never pay any fees to apply.";
  return "Avoid this job posting. Do not respond, share personal information, or make any payments. Report it to the job platform.";
}

// ─── Render Result ───────────────────────────────────────────────
function renderResult(result) {
  const { score, verdict, redFlags, greenFlags, summary, recommendation, confidence, usedAI } = result;

  // Score card tier
  const card = document.getElementById("scoreCard");
  card.className = `score-card ${verdict.tier}`;

  // Verdict badge
  const badge = document.getElementById("verdictBadge");
  badge.textContent = `${verdict.emoji} ${verdict.label}`;

  // Score number
  document.getElementById("scoreNumber").textContent = score;

  // Confidence
  const confRow = document.getElementById("confidenceRow");
  confRow.innerHTML = `
    <div class="conf-dot conf-${confidence}"></div>
    <span>${confidence} confidence</span>
  `;

  // Score bar (animate after small delay)
  setTimeout(() => {
    document.getElementById("scoreBarFill").style.width = score + "%";
  }, 100);

  // Summary
  document.getElementById("summaryText").textContent = summary;

  // Analysis badges
  const badgeContainer = document.getElementById("analysisBadges");
  badgeContainer.innerHTML = `
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      <div class="source-pill">📋 Rule-based scan</div>
      ${usedAI ? `<div class="source-pill ai-pill"><div class="ai-dot"></div> AI analysis</div>` : ''}
    </div>
    <div style="font-size:11px;color:var(--muted)">${new Date().toLocaleTimeString()}</div>
  `;

  // Red flags
  const redSection = document.getElementById("redFlagsSection");
  const redList = document.getElementById("redFlagsList");
  if (redFlags.length > 0) {
    redSection.style.display = "block";
    redList.innerHTML = redFlags.slice(0, 5).map(f =>
      `<div class="flag-item red"><span class="flag-icon">🚩</span>${f}</div>`
    ).join("");
  } else {
    redSection.style.display = "none";
  }

  // Green flags
  const greenSection = document.getElementById("greenFlagsSection");
  const greenList = document.getElementById("greenFlagsList");
  if (greenFlags.length > 0) {
    greenSection.style.display = "block";
    greenList.innerHTML = greenFlags.slice(0, 4).map(f =>
      `<div class="flag-item green"><span class="flag-icon">✅</span>${f}</div>`
    ).join("");
  } else {
    greenSection.style.display = "none";
  }

  // Recommendation
  const recBox = document.getElementById("recommendationBox");
  if (recommendation) {
    recBox.style.display = "block";
    document.getElementById("recommendationText").textContent = recommendation;
  } else {
    recBox.style.display = "none";
  }
}

// ─── Share / Copy Report ─────────────────────────────────────────
function copyReport() {
  if (!currentResult) return;
  const { score, verdict, redFlags, greenFlags, summary, recommendation, jobData } = currentResult;

  const lines = [
    `🔍 Hireo – Job Scam Analysis Report`,
    `═══════════════════════════════`,
    `Job: ${jobData?.title || "Unknown"}`,
    `Company: ${jobData?.company || "Unknown"}`,
    `Platform: ${jobData?.platform || "Unknown"}`,
    `URL: ${jobData?.url || "Unknown"}`,
    ``,
    `Verdict: ${verdict.emoji} ${verdict.label}`,
    `Risk Score: ${score}/100`,
    ``,
    redFlags.length ? `Red Flags:\n${redFlags.map(f => `  • ${f}`).join("\n")}` : null,
    greenFlags.length ? `\nPositive Signals:\n${greenFlags.map(f => `  ✓ ${f}`).join("\n")}` : null,
    ``,
    `Summary: ${summary}`,
    ``,
    `Recommendation: ${recommendation}`,
    ``,
    `Generated by Hireo Chrome Extension`,
  ].filter(l => l !== null).join("\n");

  navigator.clipboard.writeText(lines).then(() => {
    const btn = document.getElementById("shareBtn");
    const orig = btn.textContent;
    btn.textContent = "✓ Copied!";
    setTimeout(() => btn.textContent = orig, 2000);
  });
}

// ─── Helpers ────────────────────────────────────────────────────
function showError(msg) {
  const known = {
    "Could not establish connection": "Extension couldn't connect to the page. Try refreshing the page and re-opening Hireo.",
    "401": "Invalid API key. Please check your Anthropic API key in Settings.",
    "429": "API rate limit reached. Please wait a moment and try again.",
    "API key": "Your API key appears to be invalid. Go to Settings to update it.",
  };

  let displayMsg = msg;
  for (const [key, val] of Object.entries(known)) {
    if (msg.includes(key)) { displayMsg = val; break; }
  }

  document.getElementById("errorTitle").textContent = "Analysis Failed";
  document.getElementById("errorMsg").textContent = displayMsg;
  showState("error");
}

async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["apiKey", "aiEnabled", "autoAnalyze"], (data) => {
      resolve({
        apiKey: data.apiKey || "",
        aiEnabled: data.aiEnabled !== false,
        autoAnalyze: data.autoAnalyze === true,
      });
    });
  });
}

function getPlatformFromUrl(url = "") {
  if (url.includes("linkedin")) return "LinkedIn";
  if (url.includes("indeed")) return "Indeed";
  if (url.includes("naukri")) return "Naukri";
  if (url.includes("glassdoor")) return "Glassdoor";
  if (url.includes("monster")) return "Monster";
  if (url.includes("shine")) return "Shine";
  if (url.includes("internshala")) return "Internshala";
  if (url.includes("foundit")) return "Foundit";
  return "Web";
}

function truncate(str, len) {
  return str.length > len ? str.substring(0, len) + "…" : str;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Event Listeners ─────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  // Init platform info
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    document.getElementById("platformName").textContent = getPlatformFromUrl(tab.url);
    document.getElementById("pageTitle").textContent = truncate(tab.title || "—", 30);
  } catch {}

  // Buttons
  document.getElementById("analyzeBtn")?.addEventListener("click", runAnalysis);
  document.getElementById("refreshBtn")?.addEventListener("click", runAnalysis);
  document.getElementById("resultRefreshBtn")?.addEventListener("click", runAnalysis);
  document.getElementById("retryNoContent")?.addEventListener("click", runAnalysis);
  document.getElementById("errorRetryBtn")?.addEventListener("click", runAnalysis);
  document.getElementById("shareBtn")?.addEventListener("click", copyReport);

  document.getElementById("settingsBtn")?.addEventListener("click", () =>
    chrome.runtime.openOptionsPage ? chrome.runtime.openOptionsPage()
      : chrome.tabs.create({ url: "settings.html" })
  );
  document.getElementById("settingsLink")?.addEventListener("click", () =>
    chrome.tabs.create({ url: "settings.html" })
  );
  document.getElementById("errorSettingsBtn")?.addEventListener("click", () =>
    chrome.tabs.create({ url: "settings.html" })
  );

  // Auto-analyze
  const settings = await getSettings();
  if (settings.autoAnalyze) {
    runAnalysis();
  }
});
