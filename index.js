// BillRemind Host 端：注册 agent 工具与 /billremind Web 路由（供 Client 面板读写同一份数据）。

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import { Store } from './store.js';
import { BillService } from './service.js';
import { createBillTool } from './tools.js';

const MAX_JSON = 64 * 1024;

export const name = 'dsh-billremind';

export const inject = ['webServer', 'connection', 'tools'];

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(payload);
}

async function readJson(req, max = MAX_JSON) {
  if (req.method !== 'POST') {
    const err = new Error('仅支持 POST');
    err.status = 405;
    throw err;
  }
  const contentType = String(req.headers['content-type'] || '');
  if (!contentType.includes('application/json')) {
    const err = new Error('Content-Type 必须是 application/json');
    err.status = 415;
    throw err;
  }
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > max) {
      const err = new Error('请求体过大');
      err.status = 413;
      throw err;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    const err = new Error('请求体不是合法 JSON');
    err.status = 400;
    throw err;
  }
}

/** Host/Origin 与登录校验；webServer 不代为鉴权，插件路由必须自行检查。 */
function requestRejection(ctx, req) {
  const connection = ctx.get('connection');
  if (typeof connection?.requestRejection !== 'function') return 403;
  return connection.requestRejection({ headers: req.headers });
}

async function route(ctx, service, req, res) {
  const rejection = requestRejection(ctx, req);
  if (rejection) {
    sendJson(res, rejection, { ok: false, error: '未授权' });
    return;
  }
  const url = new URL(req.url || '/', 'http://localhost');
  const path = url.pathname.replace(/^\/billremind\/?/, '');
  let operationResult;

  try {
    if (req.method === 'GET' && path === 'state') {
      sendJson(res, 200, { ok: true, ...(operationResult?.restoreToken ? { restoreToken: operationResult.restoreToken, expiresAt: operationResult.expiresAt } : {}), state: await service.snapshot() });
      return;
    }
    if (req.method === 'GET' && path === 'backup') {
      sendJson(res, 200, { ok: true, backup: await service.exportBackup() });
      return;
    }
    if (req.method === 'POST' && path === 'backup') {
      const body = await readJson(req);
      const backup = body?.backup ?? body;
      const state = await service.importBackup(backup);
      sendJson(res, 200, { ok: true, revision: state.revision, state: await service.snapshot() });
      return;
    }
    if (req.method === 'POST' && path === 'ops') {
      const body = await readJson(req);
      const { op, ...args } = body || {};
       switch (op) {
        case 'add': await service.addCard(args); break;
        case 'update': await service.updateCard(args.id, args); break;
        case 'remove': operationResult = await service.removeCard(args.id, args); break;
        case 'restore': operationResult = await service.restoreCard(args.restoreToken || args.restore_token, args); break;
        case 'setAdvance': await service.setAdvance(args.global ? null : (args.id || null), args); break;
        case 'clear':
          if (args.confirm !== true) {
            const err = new Error('清空全部数据是危险操作，必须显式传入 confirm=true');
            err.status = 400;
            throw err;
          }
          await service.clearAll(args);
          break;
        default: {
          sendJson(res, 404, { ok: false, error: `未知操作：${op}` });
          return;
        }
      }
      sendJson(res, 200, { ok: true, ...(operationResult?.restoreToken ? { restoreToken: operationResult.restoreToken, expiresAt: operationResult.expiresAt } : {}), state: await service.snapshot() });
      return;
    }
    sendJson(res, 404, { ok: false, error: '接口不存在' });
  } catch (err) {
    if (res.headersSent) { res.end(); return; }
    const status = err.status || 500;
    const message = status >= 500 ? '服务暂时不可用，请稍后重试' : err.message;
    sendJson(res, status, {
      ok: false,
      error: message,
      code: err.code || undefined,
      expectedRevision: err.expectedRevision,
      currentRevision: err.currentRevision,
      forceRequired: err.forceRequired,
    });
  }
}

export function apply(ctx) {
  const store = new Store();
  const service = new BillService(store);

  ctx.tools.register(createBillTool(service));

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: '/billremind',
    handler: (req, res) => route(ctx, service, req, res).catch((err) => {
      if (!res.headersSent) sendJson(res, err.status || 500, { ok: false, error: err.message });
    }),
  }), 'dsh-billremind: /billremind routes');

  // 预热：启动时读一次，确保存储目录与初始状态就绪。
  service.snapshot().catch(() => {});
}
