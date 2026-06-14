/** 从请求头取客户端 IP（Cloudflare 注入 cf-connecting-ip）。 */
export function clientIp(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

/** 从请求头取匿名 pid（阅读进度归属键）。 */
export function pidFromRequest(request: Request): string | null {
  const pid = request.headers.get('x-sy-id')?.trim();
  return pid && /^[0-9a-f]{8,32}$/.test(pid) ? pid : null;
}
