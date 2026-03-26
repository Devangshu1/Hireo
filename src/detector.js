// detector.js — Rule-Based Scam Detection Engine

const SCAM_PATTERNS = {
  // Financial red flags (high weight)
  financial: {
    weight: 25,
    patterns: [
      /registration\s*fee/i,
      /joining\s*fee/i,
      /training\s*fee/i,
      /security\s*deposit/i,
      /pay\s*(to|for)\s*(apply|join|work|start)/i,
      /investment\s*required/i,
      /buy\s*(starter|kit|package|product)/i,
      /refundable\s*deposit/i,
      /upfront\s*payment/i,
      /advance\s*payment/i,
    ],
  },

  // Unrealistic earnings (high weight)
  earnings: {
    weight: 20,
    patterns: [
      /earn\s*(upto|up to|₹|rs\.?|inr)?\s*[\d,]+\s*(per\s*day|daily|\/day)/i,
      /\$\s*[\d,]+\s*per\s*(week|day|hour)/i,
      /earn\s*(fast|quick|easy|unlimited)/i,
      /unlimited\s*(income|earnings|earning)/i,
      /passive\s*income/i,
      /financial\s*freedom\s*guaranteed/i,
      /make\s*money\s*(fast|quick|easy|online|from home)/i,
      /get\s*rich\s*quick/i,
      /double\s*your\s*(income|salary|earnings)/i,
    ],
  },

  // Urgency tactics (medium weight)
  urgency: {
    weight: 10,
    patterns: [
      /urgent(ly)?\s*(hiring|required|need|vacancy)/i,
      /apply\s*(immediately|now|asap|today)/i,
      /limited\s*(seats|positions|vacancies|slots)/i,
      /last\s*date\s*today/i,
      /only\s*\d+\s*(seats|positions|slots)\s*left/i,
      /don.t\s*miss\s*this\s*opportunity/i,
      /once\s*in\s*a\s*lifetime/i,
      /immediate\s*joiners?\s*only/i,
    ],
  },

  // Vague requirements (medium weight)
  vagueRequirements: {
    weight: 12,
    patterns: [
      /no\s*experience\s*(required|needed)/i,
      /freshers?\s*welcome/i,
      /anyone\s*can\s*(apply|do\s*this|join)/i,
      /no\s*qualification\s*required/i,
      /work\s*from\s*home.{0,30}(no|without)\s*experience/i,
      /part[\s-]?time.{0,20}earn.{0,20}(lakh|thousand|\d{4,})/i,
      /simple\s*(task|work|job)\s*(earn|income)/i,
      /data\s*entry\s*(earn|income|\d{3,})/i,
    ],
  },

  // Personal info requests (high weight)
  personalInfo: {
    weight: 18,
    patterns: [
      /aadhar\s*card\s*number/i,
      /pan\s*card\s*(number|copy)\s*(required|mandatory)/i,
      /bank\s*account\s*(details?|number)\s*(required|upfront)/i,
      /send\s*(photos|selfie|picture)\s*(immediately|now|first)/i,
      /whatsapp\s*(your|us|the)\s*(resume|cv|photo)/i,
      /personal\s*(loan|finance)\s*(assistance|help)/i,
    ],
  },

  // MLM / Pyramid indicators (high weight)
  mlm: {
    weight: 20,
    patterns: [
      /multi[\s-]?level\s*marketing/i,
      /mlm/i,
      /network\s*marketing/i,
      /recruit\s*(others|friends|people|members)/i,
      /build\s*(your\s*)?network/i,
      /downline/i,
      /upline/i,
      /referral\s*bonus\s*per\s*(person|head|member)/i,
      /pyramid/i,
    ],
  },

  // Suspicious contact (medium weight)
  contact: {
    weight: 8,
    patterns: [
      /contact\s*(on|via|through)?\s*whatsapp/i,
      /whatsapp\s*(only|me|us|for\s*details)/i,
      /telegram\s*(group|channel|only)/i,
      /call\s*(or\s*whatsapp|immediately|now)/i,
      /gmail\.com\s*(is\s*our)?\s*(official|company)/i,
      /yahoo\.com\s*(hr|recruiter|hiring)/i,
    ],
  },
};

const GREEN_FLAGS = [
  { pattern: /glassdoor|linkedin|naukri|indeed|monster/i, label: "Listed on reputed job portal", weight: -10 },
  { pattern: /\.(com|in|org|co\.in)\/(careers|jobs|hiring)/i, label: "Official company careers page", weight: -12 },
  { pattern: /equal\s*opportunity\s*employer/i, label: "Equal opportunity employer statement", weight: -8 },
  { pattern: /background\s*(check|verification)/i, label: "Mentions background verification", weight: -6 },
  { pattern: /CTC|cost\s*to\s*company|LPA|lakhs?\s*per\s*annum/i, label: "Standard Indian salary terminology", weight: -5 },
  { pattern: /interview\s*(process|rounds?|schedule)/i, label: "Structured interview process", weight: -7 },
  { pattern: /provident\s*fund|pf|gratuity|esic/i, label: "Mentions statutory benefits", weight: -8 },
];

function runRuleBasedDetection(jobData) {
  const text = (jobData.fullText || "").toLowerCase();
  let score = 0;
  const redFlags = [];
  const greenFlags = [];
  const flagDetails = [];

  // Check scam patterns
  for (const [category, config] of Object.entries(SCAM_PATTERNS)) {
    let matched = false;
    for (const pattern of config.patterns) {
      if (pattern.test(text)) {
        if (!matched) {
          score += config.weight;
          matched = true;
        }
        const matchText = text.match(pattern)?.[0] || "";
        const flag = getCategoryLabel(category);
        if (!redFlags.includes(flag)) {
          redFlags.push(flag);
          flagDetails.push({ type: "red", category, match: matchText.substring(0, 60) });
        }
      }
    }
  }

  // Check green flags
  for (const gf of GREEN_FLAGS) {
    if (gf.pattern.test(text)) {
      score += gf.weight;
      greenFlags.push(gf.label);
    }
  }

  // Bonus: no job title or company name = suspicious
  if (!jobData.title || jobData.title.length < 3) score += 10;
  if (!jobData.company || jobData.company.length < 2) score += 10;

  // Clamp score 0–100
  score = Math.max(0, Math.min(100, score));

  return {
    ruleScore: score,
    redFlags,
    greenFlags,
    flagDetails,
  };
}

function getCategoryLabel(category) {
  const labels = {
    financial: "Requests payment or fees from candidates",
    earnings: "Promises unrealistic earnings",
    urgency: "Uses suspicious urgency tactics",
    vagueRequirements: "Vague role with no real skill requirements",
    personalInfo: "Asks for personal/financial info too early",
    mlm: "Possible MLM or pyramid scheme structure",
    contact: "Uses unofficial/personal contact methods",
  };
  return labels[category] || category;
}

function getVerdict(score) {
  if (score <= 30) return { label: "Safe", emoji: "✅", color: "#22c55e", bg: "#dcfce7", tier: "safe" };
  if (score <= 70) return { label: "Suspicious", emoji: "⚠️", color: "#f59e0b", bg: "#fef3c7", tier: "suspicious" };
  return { label: "Likely Scam", emoji: "🚨", color: "#ef4444", bg: "#fee2e2", tier: "scam" };
}

// Export
window.HireoDetector = { runRuleBasedDetection, getVerdict };
