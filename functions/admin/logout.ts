export const onRequest = async () => new Response(null, { status: 303, headers: { location: '/', 'set-cookie': 'kt_admin=; Path=/; Max-Age=0' } });
