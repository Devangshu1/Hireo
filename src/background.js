// background.js — Hireo Service Worker

chrome.runtime.onInstalled.addListener(() => {
  console.log("Hireo extension installed.");
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "analyzeWithAI") {
    analyzeJobWithAI(request.jobData, request.apiKey)
      .then((result) => sendResponse({ success: true, result }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

async function analyzeJobWithAI(jobData, apiKey) {
  const prompt = `You are a job scam detection expert. Analyze this job posting and determine if it is legitimate or a scam.

JOB DETAILS:
Title: ${jobData.title || "Unknown"}
Company: ${jobData.company || "Unknown"}
Location: ${jobData.location || "Unknown"}
Salary: ${jobData.salary || "Not mentioned"}
Platform: ${jobData.platform || "Unknown"}
URL: ${jobData.url || "Unknown"}

FULL JOB CONTENT:
${jobData.fullText?.substring(0, 3000) || "No content extracted"}

Analyze for these scam indicators:
1. Requests for payment/registration fees
2. Unrealistic salary promises ("earn $5000/week from home")
3. Vague job descriptions with no real skills required
4. Urgency tactics ("apply in the next 24 hours!")
5. Personal information requests (SSN, bank details early in process)
6. Work-from-home with extremely high pay and no experience needed
7. Poor grammar or unprofessional language
8. Unverified or suspicious company name
9. Too-good-to-be-true benefits
10. Pyramid scheme or MLM indicators
11. Requires purchasing starter kits or training materials
12. No company website or verifiable contact info

Respond ONLY with a valid JSON object in this exact format:
{
  "score": <number 0-100>,
  "verdict": "<Safe|Suspicious|Likely Scam>",
  "confidence": "<Low|Medium|High>",
  "redFlags": ["<flag1>", "<flag2>"],
  "greenFlags": ["<positive1>", "<positive2>"],
  "summary": "<2-3 sentence analysis>",
  "recommendation": "<what the user should do>"
}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-opus-4-5",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || `API Error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.content[0].text.trim();

  // Clean and parse JSON
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Invalid AI response format");

  return JSON.parse(jsonMatch[0]);
}
