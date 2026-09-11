export type SceneForClient = {
  dayNumber: number;
  playDate: string;
  sentences: string[];
  serverNow: string;
};

export type GuessResponse = {
  correct: boolean;
  anomalyIndex: number;
  revealText: string;
  currentStreak: number;
  alreadyPlayed: boolean;
};

export type StatsResponse = {
  totalPlays: number;
  totalCorrect: number;
  percentCorrect: number;
};

export type DailyResult = {
  playDate: string;
  dayNumber: number;
  chosenIndex: number;
  correct: boolean;
  anomalyIndex: number;
  revealText: string;
  timeTakenSeconds: number;
  streakAfter: number;
};
