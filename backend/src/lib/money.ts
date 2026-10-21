import { Prisma } from '../generated/prisma/client.js';

export const Decimal = Prisma.Decimal;
export type Dec = Prisma.Decimal;
type Value = string | number | Prisma.Decimal;

export const dec = (value: Value) => new Prisma.Decimal(value);
export const toMoney = (value: Value) => new Prisma.Decimal(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_EVEN);
export const num = (value: Value | null | undefined) => (value === null || value === undefined ? 0 : Number(new Prisma.Decimal(value).toFixed(2)));
export const qty = (value: Value) => Number(new Prisma.Decimal(value).toFixed(8));
