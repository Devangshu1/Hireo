// content.js — Hireo Job Content Extractor (v1.1 — SPA-aware)

(function () {

  // ── Helpers ──────────────────────────────────────────────────────
  function getText(selector) {
    try {
      const el = document.querySelector(selector);
      return el ? el.innerText.trim().substring(0, 3000) : "";
    } catch { return ""; }
  }

  function getTexts(selectors) {
    for (const sel of selectors) {
      const t = getText(sel);
      if (t) return t;
    }
    return "";
  }

  function getAttr(selector, attr) {
    try {
      const el = document.querySelector(selector);
      return el ? (el.getAttribute(attr) || "").trim() : "";
    } catch { return ""; }
  }

  function detectPlatform(hostname) {
    if (hostname.includes("linkedin"))   return "LinkedIn";
    if (hostname.includes("indeed"))     return "Indeed";
    if (hostname.includes("naukri"))     return "Naukri";
    if (hostname.includes("glassdoor")) return "Glassdoor";
    if (hostname.includes("monster"))   return "Monster";
    if (hostname.includes("shine"))     return "Shine";
    if (hostname.includes("internshala")) return "Internshala";
    if (hostname.includes("foundit"))   return "Foundit";
    if (hostname.includes("instahyre")) return "Instahyre";
    if (hostname.includes("wellfound")) return "Wellfound";
    if (hostname.includes("angellist")) return "AngelList";
    return "Web";
  }

  // ── LinkedIn Extractor (SPA-robust) ─────────────────────────────
  function extractLinkedIn() {
    const data = { title: "", company: "", location: "", salary: "", description: "" };

    // Title — try every known selector variant LinkedIn has shipped
    data.title = getTexts([
      ".job-details-jobs-unified-top-card__job-title h1",
      ".job-details-jobs-unified-top-card__job-title",
      ".jobs-unified-top-card__job-title h1",
      ".jobs-unified-top-card__job-title",
      ".topcard__title",
      "h1.t-24",
      "h1.jobs-top-card__title",
      '[data-test-id="job-title"]',
      "h1",
    ]);

    // Company
    data.company = getTexts([
      ".job-details-jobs-unified-top-card__company-name a",
      ".job-details-jobs-unified-top-card__company-name",
      ".jobs-unified-top-card__company-name a",
      ".jobs-unified-top-card__company-name",
      ".topcard__org-name-link",
      ".topcard__flavor a",
      '[data-test-id="top-card-company-name"]',
      ".t-16.t-black.t-bold",
    ]);

    // Location
    data.location = getTexts([
      ".job-details-jobs-unified-top-card__bullet",
      ".jobs-unified-top-card__bullet",
      ".topcard__flavor--bullet",
      ".jobs-unified-top-card__workplace-type",
      '[data-test-id="top-card-job-location"]',
    ]);

    // Description — the most important field
    data.description = getTexts([
      // New LinkedIn UI (2024-2025)
      ".jobs-description__content .jobs-description-content__text",
      ".jobs-description__content",
      ".jobs-description-content__text",
      // Older selectors
      ".jobs-box__html-content",
      ".jobs-description",
      ".description__text",
      // Article / section fallbacks
      "article.jobs-description",
      '[data-test-id="job-description"]',
      // Last resort: grab the main job detail pane
      ".jobs-search__job-details--wrapper",
      ".scaffold-layout__detail",
    ]);

    // If still empty, try grabbing all visible text from the right-hand detail pane
    if (!data.description) {
      const pane =
        document.querySelector(".jobs-search__job-details--wrapper") ||
        document.querySelector(".scaffold-layout__detail") ||
        document.querySelector(".job-view-layout");
      if (pane) {
        data.description = pane.innerText.trim().substring(0, 4000);
      }
    }

    return data;
  }

  // ── Indeed Extractor ─────────────────────────────────────────────
  function extractIndeed() {
    return {
      title: getTexts([
        '[data-testid="jobsearch-JobInfoHeader-title"]',
        ".jobsearch-JobInfoHeader-title",
        "h1.icl-u-xs-mb--xs",
        "h1",
      ]),
      company: getTexts([
        '[data-testid="inlineHeader-companyName"] a',
        '[data-testid="inlineHeader-companyName"]',
        ".icl-u-lg-mr--sm",
        '[data-company-name="true"]',
      ]),
      location: getTexts([
        '[data-testid="job-location"]',
        ".icl-u-xs-mt--xs",
        '[data-testid="inlineHeader-companyLocation"]',
      ]),
      salary: getTexts([
        '[data-testid="attribute_snippet_testid"]',
        ".js-match-insights-provider-hardcoded-compensation",
      ]),
      description: getTexts([
        "#jobDescriptionText",
        ".jobsearch-jobDescriptionText",
        '[data-testid="jobDescriptionText"]',
      ]),
    };
  }

  // ── Naukri Extractor ─────────────────────────────────────────────
  function extractNaukri() {
    return {
      title: getTexts([
        ".jd-header-title",
        "h1.title",
        ".job-tittle h1",
        "h1",
      ]),
      company: getTexts([
        ".jd-header-comp-name a",
        ".jd-header-comp-name",
        ".comp-name",
        "a.comp-name",
      ]),
      location: getTexts([
        ".loc span",
        ".location-container span",
        ".loc-info",
        '[data-automation="Location"]',
      ]),
      salary: getTexts([
        ".salary-container span",
        ".ctcDetail",
        '[data-automation="Salary"]',
      ]),
      description: getTexts([
        ".job-desc",
        ".dang-inner-html",
        ".jd-desc",
        "#job_description",
      ]),
    };
  }

  // ── Glassdoor Extractor ──────────────────────────────────────────
  function extractGlassdoor() {
    return {
      title: getTexts([
        '[data-test="job-title"]',
        ".e1tk4kwz1",
        "h1",
      ]),
      company: getTexts([
        '[data-test="employer-name"]',
        ".e1tk4kwz5",
        ".employerName",
      ]),
      location: getTexts([
        '[data-test="emp-location"]',
        ".location",
      ]),
      salary: getTexts([
        '[data-test="salary-estimate"]',
        ".salaryEstimate",
      ]),
      description: getTexts([
        ".jobDescriptionContent",
        '[data-test="description"]',
        ".desc",
        "#JobDesc",
      ]),
    };
  }

  // ── Generic Fallback ─────────────────────────────────────────────
  function extractGeneric() {
    // Smart body scrape: remove nav/footer/header noise
    function getBodyText() {
      const skip = ["nav", "header", "footer", "script", "style", "noscript", "[class*='nav']", "[class*='header']", "[class*='footer']", "[class*='menu']", "[class*='sidebar']"];
      const clone = document.body.cloneNode(true);
      skip.forEach(sel => {
        try { clone.querySelectorAll(sel).forEach(el => el.remove()); } catch {}
      });
      return clone.innerText.trim().substring(0, 5000);
    }

    return {
      title: getTexts([
        "h1",
        '[class*="job-title"]',
        '[class*="jobtitle"]',
        '[class*="position-title"]',
        '[id*="job-title"]',
        document.title,
      ]),
      company: getTexts([
        '[class*="company-name"]',
        '[class*="employer-name"]',
        '[class*="organisation"]',
        '[class*="company"]',
      ]),
      location: getTexts([
        '[class*="location"]',
        '[class*="city"]',
        '[class*="region"]',
      ]),
      salary: getTexts([
        '[class*="salary"]',
        '[class*="ctc"]',
        '[class*="compensation"]',
        '[class*="pay-range"]',
      ]),
      description: getTexts([
        '[class*="job-description"]',
        '[class*="jobDescription"]',
        '[class*="job-detail"]',
        '[id*="job-description"]',
        '[id*="description"]',
        "article",
        "main",
      ]) || getBodyText(),
    };
  }

  // ── Master Extractor ─────────────────────────────────────────────
  function extractJobContent() {
    const hostname = window.location.hostname;
    let fields;

    if (hostname.includes("linkedin.com"))   fields = extractLinkedIn();
    else if (hostname.includes("indeed.com")) fields = extractIndeed();
    else if (hostname.includes("naukri.com")) fields = extractNaukri();
    else if (hostname.includes("glassdoor.com")) fields = extractGlassdoor();
    else fields = extractGeneric();

    const data = {
      ...fields,
      url: window.location.href,
      platform: detectPlatform(hostname),
    };

    // Build fullText for analysis
    data.fullText = [
      data.title,
      data.company,
      data.location,
      data.salary,
      data.description,
    ].filter(Boolean).join("\n").substring(0, 6000);

    return data;
  }

  // ── Wait for SPA Content ─────────────────────────────────────────
  // LinkedIn renders content async — poll until description appears
  function waitForContent(maxWaitMs = 5000) {
    return new Promise((resolve) => {
      const start = Date.now();

      function attempt() {
        const data = extractJobContent();
        const hasContent = data.fullText && data.fullText.trim().length > 80;

        if (hasContent || Date.now() - start > maxWaitMs) {
          resolve(data);
        } else {
          setTimeout(attempt, 400);
        }
      }

      attempt();
    });
  }

  // ── Message Listener ─────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "extractJobContent") {
      waitForContent(5000)
        .then((data) => sendResponse({ success: true, data }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true; // keep channel open for async response
    }
  });

})();

