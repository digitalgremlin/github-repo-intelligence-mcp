export interface RepoRef {
    owner: string;
    name: string;
}

export function parseRepo(input: string): RepoRef | null {
    const normalized = input
        .trim()
        .replace(/^https?:\/\//i, "")
        .replace(/^www\./i, "")
        .replace(/^github\.com\//i, "");

    const [owner, rawName] = normalized.split("/").filter(Boolean);
    if (!owner || !rawName) return null;

    const name = rawName.endsWith(".git") ? rawName.slice(0, -4) : rawName;
    if (!name) return null;

    return { owner, name };
}
