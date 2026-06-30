// IVAE Marketing — Metadata de recurso protegido (RFC 9728) para el conector MCP.
// claude.ai llega aquí desde el header WWW-Authenticate del endpoint /api/mcp.
export function onRequestOptions() {
  return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,OPTIONS', 'Access-Control-Allow-Headers': '*' } });
}
export function onRequestGet({ request }) {
  const origin = new URL(request.url).origin;
  return new Response(JSON.stringify({
    resource: `${origin}/api/mcp`,
    authorization_servers: [origin],
  }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' } });
}
