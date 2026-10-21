import { compareCloud } from '../lib/compare-cloud.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Only POST is supported.' });
  }
  if (!req.headers['content-type']?.startsWith('application/json')) {
    return res.status(415).json({ error: 'Expected application/json.' });
  }
  const payload = req.body;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return res.status(400).json({ error: 'Expected baseline and revised OpenAPI text.' });
  }
  try {
    const result = await compareCloud(payload);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(400).json({ error: error?.message || 'Unable to compare these contracts.' });
  }
}
