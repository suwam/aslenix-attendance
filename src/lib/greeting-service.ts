/** Shared content and selection helpers for the ASLENIX Smart Welcome modal. */

export type GreetingMode = "welcome" | "goodbye";
export type QuoteCategory =
  | "Innovation" | "Excellence" | "Leadership" | "Teamwork" | "Creativity"
  | "Personal Growth" | "Dedication" | "Determination" | "Productivity" | "Achievement";

export interface GreetingMessage {
  id: string;
  text: string;
  category: QuoteCategory;
  mode: GreetingMode | "both";
}

const quote = (id: string, category: QuoteCategory, mode: GreetingMessage["mode"], text: string): GreetingMessage => ({ id, category, mode, text });

export const MOTIVATIONAL_QUOTES: GreetingMessage[] = [
  quote("innovation-1", "Innovation", "welcome", "Your ideas have the power to create something extraordinary. Never stop innovating."),
  quote("innovation-2", "Innovation", "both", "Innovation begins when curiosity is matched with purposeful action."),
  quote("innovation-3", "Innovation", "welcome", "Look for the better way, then take the first step toward building it."),
  quote("innovation-4", "Innovation", "goodbye", "The progress made today becomes the foundation for tomorrow's better ideas."),
  quote("innovation-5", "Innovation", "both", "Meaningful change is created by people willing to improve what already works."),
  quote("excellence-1", "Excellence", "welcome", "Every great achievement begins with the decision to give your best. Make today meaningful."),
  quote("excellence-2", "Excellence", "both", "Excellence is the result of thoughtful work repeated with care."),
  quote("excellence-3", "Excellence", "welcome", "The quality of your work reflects the commitment you bring to it."),
  quote("excellence-4", "Excellence", "goodbye", "Take pride in the quality you brought to every task today."),
  quote("excellence-5", "Excellence", "both", "Small details handled well create work that people can trust."),
  quote("leadership-1", "Leadership", "welcome", "Leadership starts with ownership: bring clarity, care, and purpose to your work."),
  quote("leadership-2", "Leadership", "both", "Lead by making progress visible, decisions thoughtful, and support dependable."),
  quote("leadership-3", "Leadership", "welcome", "The strongest leadership is shown through consistent example."),
  quote("leadership-4", "Leadership", "goodbye", "Every responsible decision made today helps the whole team move forward."),
  quote("leadership-5", "Leadership", "both", "Confidence grows when preparation meets the courage to act."),
  quote("teamwork-1", "Teamwork", "welcome", "Great teams turn individual strengths into shared progress."),
  quote("teamwork-2", "Teamwork", "both", "Collaboration makes complex work clearer, stronger, and more achievable."),
  quote("teamwork-3", "Teamwork", "welcome", "Bring your perspective, listen with intent, and help the team do its best work."),
  quote("teamwork-4", "Teamwork", "goodbye", "Your contribution today helped turn collective effort into real progress."),
  quote("teamwork-5", "Teamwork", "both", "Trust is built when people follow through for one another."),
  quote("creativity-1", "Creativity", "welcome", "A fresh perspective can turn an ordinary task into a meaningful solution."),
  quote("creativity-2", "Creativity", "both", "Creativity grows when you give good questions the time they deserve."),
  quote("creativity-3", "Creativity", "welcome", "Make room for ideas that challenge assumptions and improve the result."),
  quote("creativity-4", "Creativity", "goodbye", "The ideas explored today may become the solutions that matter tomorrow."),
  quote("creativity-5", "Creativity", "both", "Useful creativity is imagination guided by purpose."),
  quote("growth-1", "Personal Growth", "welcome", "Keep learning, keep improving, and keep moving forward."),
  quote("growth-2", "Personal Growth", "both", "Growth is built through reflection, practice, and the willingness to learn."),
  quote("growth-3", "Personal Growth", "welcome", "Every challenge is an opportunity to strengthen a skill or discover a better approach."),
  quote("growth-4", "Personal Growth", "goodbye", "What you learned today is progress worth carrying into tomorrow."),
  quote("growth-5", "Personal Growth", "both", "Professional growth comes from steady improvement, not perfect beginnings."),
  quote("dedication-1", "Dedication", "welcome", "Progress does not happen by chance. It happens when dedication meets action."),
  quote("dedication-2", "Dedication", "both", "Consistency turns intention into results that last."),
  quote("dedication-3", "Dedication", "welcome", "Bring focus to the work in front of you and let the results speak over time."),
  quote("dedication-4", "Dedication", "goodbye", "Your dedication today becomes your strength tomorrow."),
  quote("dedication-5", "Dedication", "both", "Reliable effort is one of the most valuable contributions you can make."),
  quote("determination-1", "Determination", "welcome", "Do not wait for opportunities. Create them through your actions."),
  quote("determination-2", "Determination", "both", "Difficult work becomes manageable when you keep moving with intention."),
  quote("determination-3", "Determination", "welcome", "Stay focused on your goals. Every small achievement moves you closer to something bigger."),
  quote("determination-4", "Determination", "goodbye", "Every challenge you worked through today has made you more capable."),
  quote("determination-5", "Determination", "both", "Momentum is built by continuing, especially when the path is demanding."),
  quote("productivity-1", "Productivity", "welcome", "Begin with what matters most, then give it your full attention."),
  quote("productivity-2", "Productivity", "both", "Thoughtful priorities turn busy days into productive ones."),
  quote("productivity-3", "Productivity", "welcome", "Clear focus is a professional advantage. Protect it and use it well."),
  quote("productivity-4", "Productivity", "goodbye", "A day of focused effort is progress, even when the work is still in motion."),
  quote("productivity-5", "Productivity", "both", "Meaningful output comes from doing the right work with steady attention."),
  quote("achievement-1", "Achievement", "welcome", "A new day brings new opportunities to think bigger, work smarter, and achieve more."),
  quote("achievement-2", "Achievement", "both", "Great things are built through small steps, consistent effort, and the courage to keep going."),
  quote("achievement-3", "Achievement", "welcome", "Set a meaningful standard for today, then let your actions meet it."),
  quote("achievement-4", "Achievement", "goodbye", "Success is built through the effort you put into every day."),
  quote("achievement-5", "Achievement", "goodbye", "Every effort you make today contributes to something greater tomorrow."),
];

export function getKathmanduHour(date = new Date()): number {
  const hour = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kathmandu", hour: "numeric", hourCycle: "h23" })
    .formatToParts(date)
    .find((part) => part.type === "hour")?.value;
  return Number(hour ?? date.getHours());
}

export function getWelcomeGreeting(date = new Date()): "GOOD MORNING!" | "GOOD AFTERNOON!" | "GOOD EVENING!" | "WELCOME BACK!" {
  const hour = getKathmanduHour(date);
  if (hour >= 5 && hour < 12) return "GOOD MORNING!";
  if (hour < 17) return "GOOD AFTERNOON!";
  if (hour < 21) return "GOOD EVENING!";
  return "WELCOME BACK!";
}

/** Selects a random quote while preventing an immediate repeat for each employee. */
export function getSmartGreetingMessage(mode: GreetingMode, employeeId = "anonymous"): GreetingMessage {
  const pool = MOTIVATIONAL_QUOTES.filter((quote) => quote.mode === mode || quote.mode === "both");
  const storageKey = `aslenix_last_greeting_quote_${employeeId}_${mode}`;
  const lastId = typeof window === "undefined" ? null : window.localStorage.getItem(storageKey);
  const choices = pool.filter((quote) => quote.id !== lastId);
  const candidates = choices.length ? choices : pool;
  const selected = candidates[Math.floor(Math.random() * candidates.length)] ?? MOTIVATIONAL_QUOTES[0];
  if (typeof window !== "undefined") window.localStorage.setItem(storageKey, selected.id);
  return selected;
}
