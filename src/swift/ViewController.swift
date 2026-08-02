// Swift iOS native code for pocketbank

import UIKit

class Transaction {
    let description: String
    let amount: Double
    let date: Date
    
    init(description: String, amount: Double, date: Date = Date()) {
        self.description = description
        self.amount = amount
        self.date = date
    }
    
    func toJson() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd HH:mm:ss"
        return "\(description)|\(amount)|\(formatter.string(from: date))"
    }
    
    static func fromJson(_ json: String) -> Transaction {
        let parts = json.split(separator: "|")
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd HH:mm:ss"
        return Transaction(
            description: parts[0],
            amount: Double(parts[1]) ?? 0.0,
            date: formatter.date(from: parts[2]) ?? Date()
        )
    }
}

class ViewController: UIViewController, UITableViewDataSource, UITableViewDelegate {
    
    @IBOutlet weak var balanceLabel: UILabel!
    @IBOutlet weak var tableView: UITableView!
    
    private var transactions: [Transaction] = []
    private var balance: Double = 0.0
    private let userDefaults = UserDefaults.standard
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        tableView.dataSource = self
        tableView.delegate = self
        
        loadData()
        
        navigationItem.rightBarButtonItem = UIBarButtonItem(
            barButtonSystemItem: .add,
            target: self,
            action:#selector(showAddTransactionDialog)
        )
    }
    
    private func loadData() {
        balance = userDefaults.double(forKey: "balance")
        balanceLabel.text = String(format: "$%.2f", balance)
        
        if let txList = userDefaults.stringArray(forKey: "transactions") {
            transactions = txList.map { Transaction.fromJson($0) }
        }
        
        tableView.reloadData()
    }
    
    private func saveData() {
        userDefaults.set(balance, forKey: "balance")
        userDefaults.set(transactions.map { $0.toJson() }, forKey: "transactions")
    }
    
    @objc private func showAddTransactionDialog() {
        let alert = UIAlertController(
            title: "Add Transaction",
            message: nil,
            preferredStyle: .alert
        )
        
        alert.addTextField { textField in
            textField.placeholder = "Description"
        }
        
        alert.addTextField { textField in
            textField.placeholder = "Amount"
            textField.keyboardType = .decimalPad
        }
        
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        
        alert.addAction(UIAlertAction(title: "Add", style: .default) { [weak self] _ in
            guard let self = self,
                  let description = alert.textFields?[0].text,
                  let amountText = alert.textFields?[1].text,
                  let amount = Double(amountText) else {
                return
            }
            
            let transaction = Transaction(
                description: description,
                amount: amount
            )
            
            self.transactions.append(transaction)
            self.balance += amount
            self.balanceLabel.text = String(format: "$%.2f", self.balance)
            
            let indexPath = IndexPath(row: self.transactions.count - 1, section: 0)
            self.tableView.insertRows(at: [indexPath], with: .automatic)
            
            self.saveData()
        })
        
        present(alert, animated: true)
    }
    
    // UITableViewDataSource
    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        return transactions.count
    }
    
    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "TransactionCell", for: indexPath)
        let transaction = transactions[indexPath.row]
        
        cell.textLabel?.text = transaction.description
        cell.detailTextLabel?.text = String(format: "$%.2f", transaction.amount)
        cell.detailTextLabel?.textColor = transaction.amount > 0 ? .systemGreen : .systemRed
        
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM dd, yyyy"
        cell.accessoryView = UILabel(text: formatter.string(from: transaction.date))
        
        return cell
    }
}
