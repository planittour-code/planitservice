export function coverLetter(homeownerName: string, trade: string) {
  const first = homeownerName.trim().split(/\s+/)[0] || "there";
  const work = trade.replace(/-/g, " ").trim() || "home";
  return `${first},
Thank you for the opportunity to help with your ${work}. Below is our Estimate including the labor, materials and related product warranties. Please add any notes if this differs from your preferences. If it looks correct, please accept the line items so we can get you on our schedule to start work.`;
}
