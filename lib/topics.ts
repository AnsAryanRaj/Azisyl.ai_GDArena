import type { GdFormat } from "./types";

export interface Topic {
  text: string;
  kind: "Current affairs" | "Abstract" | "Business" | "Tech" | "Social" | "Regional" | "Controversial" | "Case";
  brief?: string; // case details the moderator reads out
}

export const TOPICS: Topic[] = [
  { text: "Should AI tools be allowed in campus placement tests?", kind: "Tech" },
  { text: "Work from home is here to stay", kind: "Business" },
  { text: "Is social media doing more harm than good for students?", kind: "Social" },
  { text: "India should move to a four-day work week", kind: "Business" },
  { text: "Startups or MNCs: which is better for a fresher?", kind: "Business" },
  { text: "Electric vehicles are the future of Indian roads", kind: "Current affairs" },
  { text: "Will AI create more jobs than it takes away?", kind: "Tech" },
  { text: "Should attendance be compulsory in college?", kind: "Social" },
  { text: "Red is better than blue", kind: "Abstract" },
  { text: "Zero", kind: "Abstract" },
  { text: "A blank sheet of paper", kind: "Abstract" },
  { text: "UPI has changed small-town India more than big cities", kind: "Regional" },
  { text: "Should Indian metro cities limit private cars in the city centre?", kind: "Regional" },
  { text: "Is the Kota coaching model good for students?", kind: "Regional" },
  { text: "Should engineering be taught in regional languages?", kind: "Regional" },
  { text: "Reservation in private sector jobs", kind: "Controversial" },
  { text: "Should social media be banned for children under 16?", kind: "Controversial" },
  { text: "Unpaid internships should be illegal", kind: "Controversial" },
  { text: "Moonlighting should be allowed for IT employees", kind: "Controversial" },
  {
    text: "Case: Quick-commerce startup losing money",
    kind: "Case",
    brief:
      "A 10-minute grocery delivery startup in 6 Indian cities is growing 30 percent every quarter, but loses money on most orders. Investors want profit in 12 months. Should it slow down, raise prices, or cut cities?",
  },
  {
    text: "Case: College canteen versus food delivery apps",
    kind: "Case",
    brief:
      "A college canteen has lost half its customers since students started ordering from food delivery apps. The college wants to ban outside food deliveries on campus. Is the ban the right move, or should the canteen change?",
  },
  {
    text: "Case: A layoff at a mid-size IT company",
    kind: "Case",
    brief:
      "A mid-size IT services company must cut costs by 15 percent after losing its biggest client. Options are laying off 10 percent of staff, freezing salaries for everyone, or moving to cheaper offices in a tier-2 city. What should the leadership do?",
  },
];

export const FORMATS: { id: GdFormat; label: string; hint: string }[] = [
  { id: "standard", label: "Standard", hint: "A normal topic GD" },
  { id: "case", label: "Case", hint: "Solve a business case together" },
  { id: "controversial", label: "Controversial", hint: "Sharper disagreement, stay calm" },
  { id: "fishbowl", label: "Fishbowl", hint: "Watch first, then join" },
];
