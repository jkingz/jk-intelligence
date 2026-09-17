export const demoClients = [
  { id: "northstar", name: "Northstar Studio", domain: "northstar.example", initials: "NS", scale: 1, topic: "design" },
  { id: "evergreen", name: "Evergreen Goods", domain: "evergreen.example", initials: "EG", scale: 1.6, topic: "sustainable" },
  { id: "atlas", name: "Atlas Coffee", domain: "atlas.example", initials: "AC", scale: 0.65, topic: "coffee" },
];

export function getMockOverview(clientId: string, days: number) {
  const client = demoClients.find((item) => item.id === clientId);
  if (!client || ![7, 30, 90].includes(days)) throw new Error("Invalid dashboard selection");
  const end = Date.UTC(2026, 8, 17);
  const traffic = Array.from({ length: days }, (_, index) => {
    const date = new Date(end - (days - index - 1) * 86400000);
    const clicks = Math.round((280 + index * 6 + Math.sin(index * 1.7) * 62 + Math.cos(index * 0.6) * 34) * client.scale);
    return {
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
      clicks,
      previous: Math.round(clicks / (1.18 + Math.sin(index) * 0.08)),
      impressions: Math.round(clicks * 24.6),
      conversions: Math.round(clicks * 0.026),
      aiReferrals: Math.round(clicks * (0.12 + index / days * 0.06)),
      previousAiReferrals: Math.round(clicks * 0.1),
      previousImpressions: Math.round(clicks / (1.18 + Math.sin(index) * 0.08) * 23.8),
    };
  });
  const clicks = traffic.reduce((sum, day) => sum + day.clicks, 0);
  const previous = traffic.reduce((sum, day) => sum + day.previous, 0);
  const impressions = traffic.reduce((sum, day) => sum + day.impressions, 0);
  const conversions = traffic.reduce((sum, day) => sum + day.conversions, 0);
  const terms: Record<string, string[]> = {
    design: ["brand design studio", "creative agency", "visual identity design", "website design studio", "branding services", "packaging design"],
    sustainable: ["sustainable home goods", "eco friendly essentials", "reusable kitchen products", "organic cotton bedding", "zero waste store", "sustainable gifts"],
    coffee: ["specialty coffee beans", "single origin coffee", "coffee subscription", "fresh roasted coffee", "best espresso beans", "pour over coffee"],
  };
  const ranks = [2, 4, 3, 8, 6, 12];
  const changes = [3, 2, 5, -2, 1, 0];
  const keywords = terms[client.topic].map((keyword, index) => ({
    keyword,
    rank: ranks[index],
    change: changes[index],
    volume: Math.round((4200 - index * 580) * client.scale),
    clicks: Math.round(clicks * (0.16 - index * 0.02)),
  }));
  const aiReferrals = traffic.reduce((sum, day) => sum + day.aiReferrals, 0);
  const previousAiReferrals = traffic.reduce((sum, day) => sum + day.previousAiReferrals, 0);
  const previousImpressions = traffic.reduce((sum, day) => sum + day.previousImpressions, 0);
  const averagePosition = keywords.reduce((sum, keyword) => sum + keyword.rank, 0) / keywords.length;
  const positionChange = keywords.reduce((sum, keyword) => sum + keyword.change, 0) / keywords.length;
  const topThreeCount = keywords.filter((keyword) => keyword.rank <= 3).length;
  const gainedTopThree = keywords.filter((keyword) => keyword.rank <= 3 && keyword.rank + keyword.change > 3).length;
  const leadingKeyword = keywords.reduce((best, keyword) => keyword.change > best.change ? keyword : best);
  const decliningKeyword = keywords.find((keyword) => keyword.change < 0);
  const staleSource = client.id === "atlas";
  const lastUpdated = new Date(end).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  const citationCounts = [0.38, 0.31, 0.22].map((share) => Math.floor(aiReferrals * share));
  citationCounts.push(aiReferrals - citationCounts.reduce((sum, count) => sum + count, 0));
  const engines = ["Perplexity Pro", "Claude Search", "ChatGPT Search", "Google AI Overviews"];
  const sentiments = ["Strong authority", "Primary reference", "Technical citation", "Summary snippet"];
  const aiCitations = engines.map((engine, index) => ({
    engine,
    count: citationCounts[index],
    citationShare: `${(citationCounts[index] / aiReferrals * 100).toFixed(1)}%`,
    topSourceUrl: `/${client.topic}/${keywords[index].keyword.replaceAll(" ", "-")}`,
    sentiment: sentiments[index],
  }));
  const brief = [
    {
      title: "Keyword momentum",
      impact: "High Impact",
      description: `${leadingKeyword.keyword} gained ${leadingKeyword.change} positions to rank #${leadingKeyword.rank}. ${topThreeCount} tracked keywords now rank in the top 3.`,
    },
    {
      title: "Recommended focus",
      impact: "Actionable",
      description: decliningKeyword
        ? `Review content targeting ${decliningKeyword.keyword}: down ${Math.abs(decliningKeyword.change)} positions to #${decliningKeyword.rank}.`
        : "Maintain content quality across your highest-ranking keywords.",
    },
  ];
  return {
    client,
    days,
    previous,
    previousImpressions,
    aiReferrals,
    previousAiReferrals,
    aiGrowth: (aiReferrals / previousAiReferrals - 1) * 100,
    impressionsGrowth: (impressions / previousImpressions - 1) * 100,
    averagePosition,
    positionChange,
    topThreeCount,
    gainedTopThree,
    aiCitations,
    brief,
    lastUpdated,
    syncStatus: staleSource ? "Demo: cached data — sync failed" : "Demo: GSC & GA4 synced",
    freshness: staleSource ? "Stale demo snapshot" : "Current demo snapshot",
    traffic,
    keywords,
    clicks,
    impressions,
    conversions,
    ctr: clicks / impressions * 100,
    growth: (clicks / previous - 1) * 100,
    dateRange: `${traffic[0].date} – ${traffic[traffic.length - 1].date}, 2026`,
    staleSource: client.id === "atlas",
  };
}
