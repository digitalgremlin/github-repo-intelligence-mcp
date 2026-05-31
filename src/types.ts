export type DimensionVerdict = "Healthy" | "Moderate" | "At-Risk";
export type ActivityVerdict = DimensionVerdict | "Likely abandoned";
export type OverallVerdict =
  | "Actively maintained" | "Slowing" | "At-risk" | "Likely abandoned";

export interface RawRepoPayload {
  owner: string;
  name: string;
  isPrivate: boolean;
  stars: number;
  forks: number;
  commitDates: string[];        // ISO-8601, default branch, last 365d (newest first)
  releaseDates: string[];       // ISO-8601 publishedAt, last 365d
  issues: IssueRecord[];        // last analysisWindowDays
  pulls: PullRecord[];          // last analysisWindowDays
  contributors: ContributorRecord[];
}

export interface IssueRecord {
  createdAt: string;
  closedAt: string | null;
  firstResponseAt: string | null; // first comment by anyone other than author
  lastActivityAt: string;
  state: "OPEN" | "CLOSED";
}

export interface PullRecord {
  createdAt: string;
  mergedAt: string | null;
  closedAt: string | null;
  state: "OPEN" | "MERGED" | "CLOSED";
}

export interface ContributorRecord {
  login: string;
  commits: number;            // commits within window
  firstCommitAt: string;      // earliest commit seen in fetched history
}
