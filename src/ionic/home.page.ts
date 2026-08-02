// Ionic/Capacitor mobile app for pocketbank

import { Component } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { Storage } from '@ionic/storage-angular';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [IonicModule],
})
export class HomePage {
  balance: number = 0;
  transactions: Transaction[] = [];

  constructor(private storage: Storage) {
    this.init();
  }

  async init() {
    await this.storage.create();
    await this.loadData();
  }

  async loadData() {
    this.balance = (await this.storage.get('balance')) || 0;
    const txList = (await this.storage.get('transactions')) || [];
    this.transactions = txList.map((tx: any) => Transaction.fromJson(tx));
  }

  async saveData() {
    await this.storage.set('balance', this.balance);
    await this.storage.set('transactions', this.transactions.map(tx => tx.toJson()));
  }

  async addTransaction(description: string, amount: number) {
    const transaction = new Transaction(description, amount, new Date());
    this.transactions.push(transaction);
    this.balance += amount;
    await this.saveData();
  }

  async deleteTransaction(index: number) {
    this.balance -= this.transactions[index].amount;
    this.transactions.splice(index, 1);
    await this.saveData();
  }
}

export class Transaction {
  constructor(
    public description: string,
    public amount: number,
    public date: Date
  ) {}

  static fromJson(json: string): Transaction {
    const parts = json.split('|');
    return new Transaction(
      parts[0],
      parseFloat(parts[1]),
      new Date(parts[2])
    );
  }

  toJson(): string {
    return `${this.description}|${this.amount}|${this.date.toISOString()}`;
  }
}
