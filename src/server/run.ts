export async function run(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    console.error(e);
    return Response.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}
