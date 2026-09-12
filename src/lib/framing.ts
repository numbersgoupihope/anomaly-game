export const FRAMING_LINES = [
  "These aren't stories. They're what's left after something went wrong. Find what doesn't belong.",
  "Someone wrote this down because they needed another person to see it. Read carefully.",
  "Everything here happened. Almost everything here makes sense.",
  "This is a record, not a story. One line in it isn't true.",
];

export function framingLineForDay(dayNumber: number): string {
  return FRAMING_LINES[dayNumber % FRAMING_LINES.length];
}
