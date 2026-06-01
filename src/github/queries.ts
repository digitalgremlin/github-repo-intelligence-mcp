export function repoQuery(owner: string, name: string, sinceISO: string): string {
  return JSON.stringify({
    query: `query($owner:String!,$name:String!,$since:GitTimestamp!){
      repository(owner:$owner,name:$name){
        isPrivate stargazerCount forkCount
        defaultBranchRef{ target{ ... on Commit{ history(since:$since,first:100){ nodes{ committedDate } } } } }
        releases(first:50,orderBy:{field:CREATED_AT,direction:DESC}){ nodes{ publishedAt } }
        issues(first:100,orderBy:{field:UPDATED_AT,direction:DESC}){ nodes{
          createdAt closedAt updatedAt state
          comments(first:1){ nodes{ createdAt } } } }
        pullRequests(first:100,orderBy:{field:UPDATED_AT,direction:DESC}){ nodes{
          createdAt mergedAt closedAt state } }
      }
    }`,
    variables: { owner, name, since: sinceISO },
  });
}
