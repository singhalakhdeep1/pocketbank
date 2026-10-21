import { Router, type Request } from 'express';
import { z } from 'zod';
import { badRequest } from '../lib/errors.js';
import { logger, prisma } from '../lib/infra.js';
import * as serialize from '../lib/serialize.js';
import { userId } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { body } from '../middleware/validate.js';
import { mailEnabled, sendMail } from '../services/mail.service.js';
import { annualReport, monthlyReport, reportCsv, reportPdf, taxReport, type Report } from '../services/report.service.js';
import { param } from './helpers.js';

export const reportsRouter = Router();

const periodSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).default(new Date().getFullYear()),
  month: z.coerce.number().int().min(1).max(12).default(new Date().getMonth() + 1),
});

async function build(req: Request, source: unknown): Promise<Report> {
  const type = param(req.params.type);
  const { year, month } = periodSchema.parse(source);
  const uid = userId(req);
  if (type === 'monthly') return monthlyReport(uid, year, month);
  if (type === 'annual') return annualReport(uid, year);
  if (type === 'tax') return taxReport(uid, year);
  throw badRequest('Report type must be monthly, annual or tax');
}

const fileName = (r: Report, ext: string) => `pocketbank-${r.type}-${r.period.label.replace(/\s+/g, '-').toLowerCase()}.${ext}`;

reportsRouter.get('/reports/:type', async (req, res) => {
  const report = await build(req, req.query);
  res.json({ ...report, transactions: report.transactions.map(serialize.transaction) });
});

reportsRouter.get('/reports/:type/export/:format', async (req, res) => {
  const format = param(req.params.format);
  const report = await build(req, req.query);
  if (format === 'csv') {
    res.setHeader('content-type', 'text/csv; charset=utf-8');
    res.setHeader('content-disposition', `attachment; filename="${fileName(report, 'csv')}"`);
    return res.send(reportCsv(report));
  }
  if (format === 'pdf') {
    res.setHeader('content-type', 'application/pdf');
    res.setHeader('content-disposition', `attachment; filename="${fileName(report, 'pdf')}"`);
    return res.send(await reportPdf(report));
  }
  throw badRequest('Format must be csv or pdf');
});

reportsRouter.post('/reports/:type/email', rateLimit('email', { capacity: 5, refillPerSecond: 0.01 }), async (req, res) => {
  const input = body(req, periodSchema.extend({ format: z.enum(['pdf', 'csv']).default('pdf') }));
  const report = await build(req, input);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId(req) } });
  const content = input.format === 'pdf' ? await reportPdf(report) : Buffer.from(reportCsv(report));
  const messageId = await sendMail(user.email, `Your PocketBank ${report.period.label} ${report.type} report`, `Hi ${user.firstName},\n\nYour report is attached.\n\nPocketBank`, [
    { filename: fileName(report, input.format), content },
  ]);
  logger.logAuditEvent('ReportEmailed', `${report.type} report emailed`, { userId: user.id });
  res.json({ sent: true, to: user.email, messageId });
});

reportsRouter.get('/reports-meta', (_req, res) => {
  res.json({ emailEnabled: mailEnabled(), types: ['monthly', 'annual', 'tax'], formats: ['csv', 'pdf'] });
});
