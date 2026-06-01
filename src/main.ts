import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { Actor, log } from 'apify';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { parseRepo } from './repo.js';
import { DEFAULTS } from './config.js';
import { TtlLruCache } from './cache.js';
import { fetchRepoPayload, GithubError } from './github/client.js';
import type { RawRepoPayload } from './types.js';
import {
    buildRepoHealth, buildActivity, buildIssues, buildPulls, buildContributors,
} from './tools.js';

interface ActorInput {
    githubToken?: string;
    cacheTtlMinutes?: number;
    analysisWindowDays?: number;
}

await Actor.init();

// All input is optional — Standby boots with no INPUT.json (no crash loop).
const input = (await Actor.getInput<ActorInput>()) ?? {};
const token = input.githubToken?.trim() || process.env.GITHUB_TOKEN || null;
const ttlMs = (input.cacheTtlMinutes ?? DEFAULTS.cacheTtlMinutes) * 60_000;
const windowDays = input.analysisWindowDays ?? DEFAULTS.analysisWindowDays;

// One raw payload per repo, shared across all five tools (LRU + TTL).
const cache = new TtlLruCache<RawRepoPayload>(100, ttlMs);

type LoadResult = { payload: RawRepoPayload } | { error: Record<string, unknown> };

async function load(repoArg: string): Promise<LoadResult> {
    const ref = parseRepo(repoArg);
    if (!ref) return { error: { error: "Invalid repo argument; expected 'owner/name' or a GitHub URL" } };
    const key = `${ref.owner}/${ref.name}`.toLowerCase();
    const cached = cache.get(key);
    if (cached) return { payload: cached };
    try {
        const payload = await fetchRepoPayload(ref, token, windowDays);
        cache.set(key, payload);
        return { payload };
    } catch (e) {
        if (e instanceof GithubError) {
            if (e.kind === 'NOT_FOUND')
                return { error: { error: 'Repository not found or private. Add a githubToken to analyze private repos.', repo: key } };
            if (e.kind === 'RATE_LIMITED')
                return { error: { error: 'GitHub rate limit reached. Add a githubToken (or wait) to continue.', resetAt: e.resetAt, repo: key } };
        }
        return { error: { error: String((e as Error).message), repo: repoArg } };
    }
}

const repoInput = { repo: z.string().describe("Repository as 'owner/name' or a GitHub URL") };

function asJson(value: unknown) {
    return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] };
}

// A fresh server per request keeps the stateless transport isolated (no session bleed).
function buildMcpServer(): McpServer {
    const server = new McpServer({ name: 'github-repo-intelligence-mcp', version: '0.1.0' });

    server.registerTool('get_repo_health', {
        title: 'Get repository health',
        description: 'Opinionated health verdict (Actively maintained / Slowing / At-risk / Likely abandoned) for a GitHub repo, with per-dimension verdicts, supporting metrics, and a plain-language rationale.',
        inputSchema: repoInput,
    }, async ({ repo }) => {
        const r = await load(repo);
        return asJson('error' in r ? r.error : buildRepoHealth(r.payload, new Date(), !!token));
    });

    server.registerTool('get_activity_metrics', {
        title: 'Get activity metrics',
        description: 'Commit cadence, recency, and momentum for a GitHub repo, with an activity verdict.',
        inputSchema: repoInput,
    }, async ({ repo }) => {
        const r = await load(repo);
        return asJson('error' in r ? r.error : buildActivity(r.payload, new Date()));
    });

    server.registerTool('get_issue_health', {
        title: 'Get issue health',
        description: 'Issue responsiveness and backlog staleness for a GitHub repo, with an issue verdict.',
        inputSchema: repoInput,
    }, async ({ repo }) => {
        const r = await load(repo);
        return asJson('error' in r ? r.error : buildIssues(r.payload, new Date()));
    });

    server.registerTool('get_pr_health', {
        title: 'Get pull request health',
        description: 'Pull request merge rate and oldest-open age for a GitHub repo, with a PR verdict.',
        inputSchema: repoInput,
    }, async ({ repo }) => {
        const r = await load(repo);
        return asJson('error' in r ? r.error : buildPulls(r.payload, new Date()));
    });

    server.registerTool('get_contributor_insights', {
        title: 'Get contributor insights',
        description: 'Active contributors and bus-factor concentration for a GitHub repo, with a contributor verdict.',
        inputSchema: repoInput,
    }, async ({ repo }) => {
        const r = await load(repo);
        return asJson('error' in r ? r.error : buildContributors(r.payload, new Date()));
    });

    return server;
}

function readBody(req: IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
        let raw = '';
        req.on('data', (chunk) => { raw += chunk; });
        req.on('end', () => {
            if (!raw) return resolve(undefined);
            try { resolve(JSON.parse(raw)); } catch (e) { reject(e); }
        });
        req.on('error', reject);
    });
}

const PORT = process.env.APIFY_CONTAINER_PORT ? parseInt(process.env.APIFY_CONTAINER_PORT, 10) : 3000;

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = (req.url ?? '').split('?')[0];

    // Apify Standby readiness probe at GET /.
    if (req.method === 'GET' && (url === '/' || url === '')) {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(req.headers['x-apify-container-server-readiness-probe'] ? 'Readiness probe OK\n' : 'Actor is ready\n');
        return;
    }

    // MCP transport (stateless: one server + transport per request).
    if (url === '/mcp') {
        try {
            const body = req.method === 'POST' ? await readBody(req) : undefined;
            const mcp = buildMcpServer();
            const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
            res.on('close', () => { transport.close(); mcp.close(); });
            await mcp.connect(transport);
            await transport.handleRequest(req, res, body);
        } catch (err) {
            log.exception(err as Error, 'MCP request handling failed');
            if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null }));
            }
        }
        return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => log.info(`Standby MCP server listening on port ${PORT}`, {
    mcpPath: '/mcp', cacheTtlMinutes: ttlMs / 60_000, analysisWindowDays: windowDays, authenticated: !!token,
}));

Actor.on('aborting', async () => {
    server.close();
    await Actor.exit();
});
