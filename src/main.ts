import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { Actor, log } from 'apify';

// Scaffold placeholder. The MCP server + tool transport are wired in Task 14;
// this stub exists only to give a clean-building Standby baseline.

interface ActorInput {
    githubToken?: string;
    cacheTtlMinutes?: number;
    analysisWindowDays?: number;
}

await Actor.init();

// Standby actors must boot with NO required input (no INPUT.json on Standby boot).
const input = (await Actor.getInput<ActorInput>()) ?? {};
const cacheTtlMinutes = input.cacheTtlMinutes ?? 20;
const analysisWindowDays = input.analysisWindowDays ?? 90;
const authenticated = Boolean(input.githubToken);

log.info('github-repo-intelligence-mcp booting (scaffold placeholder)', {
    cacheTtlMinutes,
    analysisWindowDays,
    authenticated,
});

const PORT = process.env.APIFY_CONTAINER_PORT ? parseInt(process.env.APIFY_CONTAINER_PORT, 10) : 3000;

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    // Apify Standby readiness probe at GET /.
    if (req.method === 'GET' && (req.url === '/' || req.url === '')) {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(req.headers['x-apify-container-server-readiness-probe'] ? 'Readiness probe OK\n' : 'Actor is ready\n');
        return;
    }
    // The /mcp transport is implemented in Task 14.
    res.writeHead(501, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not implemented yet (scaffold).' }));
});

server.listen(PORT, () => log.info(`Standby server listening on port ${PORT}`));

Actor.on('aborting', async () => {
    server.close();
    await Actor.exit();
});
