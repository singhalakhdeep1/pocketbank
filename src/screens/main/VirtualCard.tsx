import React from 'react';
import { CardManager } from '@/components/CardManager';

/** Virtual cards for online shopping: instant issue, own limits, freeze/unfreeze. */
export default function VirtualCard() {
  return <CardManager kind="VIRTUAL" />;
}
