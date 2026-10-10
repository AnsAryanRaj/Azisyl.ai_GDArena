export interface Topic {
  text: string;
  kind: "Current affairs" | "Abstract" | "Business" | "Tech" | "Social";
}

export const TOPICS: Topic[] = [
  { text: "Should AI tools be allowed in campus placement tests?", kind: "Tech" },
  { text: "Work from home is here to stay", kind: "Business" },
  { text: "Is social media doing more harm than good for students?", kind: "Social" },
  { text: "India should move to a four-day work week", kind: "Business" },
  { text: "Startups or MNCs: which is better for a fresher?", kind: "Business" },
  { text: "Electric vehicles are the future of Indian roads", kind: "Current affairs" },
  { text: "Red is better than blue", kind: "Abstract" },
  { text: "Zero", kind: "Abstract" },
  { text: "Should attendance be compulsory in college?", kind: "Social" },
  { text: "Will AI create more jobs than it takes away?", kind: "Tech" },
];
