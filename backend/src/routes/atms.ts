import { Router } from 'express';
import { z } from 'zod';
import { cache, prisma } from '../lib/infra.js';

export const atmsRouter = Router();

/** Great-circle distance in metres. */
export function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

atmsRouter.get('/atms', async (req, res) => {
  const q = z
    .object({
      lat: z.coerce.number().min(-90).max(90),
      lng: z.coerce.number().min(-180).max(180),
      type: z.enum(['all', 'atm', 'branch']).default('all'),
      radiusKm: z.coerce.number().min(0.1).max(500).default(50),
      q: z.string().trim().max(60).optional(),
      limit: z.coerce.number().int().min(1).max(100).default(30),
    })
    .parse(req.query);
  const all = await cache.getOrSetJson('locations:all', () => prisma.location.findMany(), 3600);
  const results = all
    .filter((l) => q.type === 'all' || l.type === q.type.toUpperCase())
    .filter((l) => !q.q || `${l.name} ${l.address}`.toLowerCase().includes(q.q.toLowerCase()))
    .map((l) => ({
      id: l.id,
      name: l.name,
      type: l.type === 'ATM' ? 'atm' : 'branch',
      address: l.address,
      hours: l.hours,
      services: l.services,
      coordinates: { lat: l.lat, lng: l.lng },
      distance: Math.round(haversine(q.lat, q.lng, l.lat, l.lng)),
    }))
    .filter((l) => l.distance <= q.radiusKm * 1000)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, q.limit);
  res.json(results);
});
