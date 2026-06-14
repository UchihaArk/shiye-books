import { json, jsonError } from '../../_lib/response';
import type { Env } from '../../_lib/types';

// DELETE /api/comments/<id>  （仅超管：请求头 X-Sy-Admin === env.ADMIN_TOKEN）
// 软删：status → 'deleted'，列表/计数不再计入。
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (!env.ADMIN_TOKEN) return jsonError(403, '未配置管理员');
  if (request.headers.get('x-sy-admin') !== env.ADMIN_TOKEN) return jsonError(403, '无权限');

  const id = parseInt((context.params.id as string) || '0', 10);
  if (!id) return jsonError(400, '无效 id');

  await env.DB.prepare(`UPDATE sy_comments SET status='deleted' WHERE id=?`).bind(id).run();
  return json({ ok: true });
};
