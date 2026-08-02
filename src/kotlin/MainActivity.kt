// Kotlin Android native code for pocketbank

package com.pocketbank

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import kotlinx.coroutines.*
import java.text.SimpleDateFormat
import java.util.*

class MainActivity : AppCompatActivity() {
    private lateinit var balanceView: TextView
    private lateinit var transactionAdapter: TransactionAdapter
    private val transactions = mutableListOf<Transaction>()
    private var balance = 0.0
    private val scope = CoroutineScope(Dispatchers.Main)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        balanceView = findViewById(R.id.balanceView)
        val recyclerView = findViewById<RecyclerView>(R.id.transactionList)
        
        transactionAdapter = TransactionAdapter(transactions)
        recyclerView.adapter = transactionAdapter
        recyclerView.layoutManager = LinearLayoutManager(this)

        findViewById<Button>(R.id.addButton).setOnClickListener {
            showAddTransactionDialog()
        }

        loadData()
    }

    private fun loadData() {
        scope.launch {
            val prefs = getSharedPreferences("PocketBank", MODE_PRIVATE)
            balance = prefs.getFloat("balance", 0f).toDouble()
            balanceView.text = String.format("$%.2f", balance)
            
            val txList = prefs.getStringSet("transactions", emptySet()) ?: emptySet()
            transactions.clear()
            transactions.addAll(txList.map { Transaction.fromJson(it) })
            transactionAdapter.notifyDataSetChanged()
        }
    }

    private fun saveData() {
        scope.launch {
            val prefs = getSharedPreferences("PocketBank", MODE_PRIVATE)
            with(prefs.edit()) {
                putFloat("balance", balance.toFloat())
                putStringSet("transactions", transactions.map { it.toJson() }.toSet())
                apply()
            }
        }
    }

    private fun showAddTransactionDialog() {
        val dialog = AlertDialog.Builder(this)
            .setTitle("Add Transaction")
            .setView(R.layout.dialog_add_transaction)
            .setPositiveButton("Add") { _, _ ->
                val description = findViewById<EditText>(R.id.descriptionInput).text.toString()
                val amount = findViewById<EditText>(R.id.amountInput).text.toString().toDouble()
                
                val transaction = Transaction(
                    description = description,
                    amount = amount,
                    date = Date()
                )
                
                transactions.add(transaction)
                balance += amount
                balanceView.text = String.format("$%.2f", balance)
                transactionAdapter.notifyItemInserted(transactions.size - 1)
                saveData()
            }
            .setNegativeButton("Cancel", null)
            .create()
        
        dialog.show()
    }

    override fun onDestroy() {
        super.onDestroy()
        scope.cancel()
    }
}

data class Transaction(
    val description: String,
    val amount: Double,
    val date: Date
) {
    companion object {
        fun fromJson(json: String): Transaction {
            val parts = json.split("|")
            return Transaction(
                description = parts[0],
                amount = parts[1].toDouble(),
                date = SimpleDateFormat("yyyy-MM-dd HH:mm:ss").parse(parts[2])
            )
        }
    }
    
    fun toJson(): String {
        val dateFormat = SimpleDateFormat("yyyy-MM-dd HH:mm:ss")
        return "$description|$amount|${dateFormat.format(date)}"
    }
}

class TransactionAdapter(
    private val transactions: List<Transaction>
) : RecyclerView.Adapter<TransactionAdapter.ViewHolder>() {
    
    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val description: TextView = view.findViewById(R.id.description)
        val amount: TextView = view.findViewById(R.id.amount)
        val date: TextView = view.findViewById(R.id.date)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_transaction, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val transaction = transactions[position]
        holder.description.text = transaction.description
        holder.amount.text = String.format("$%.2f", transaction.amount)
        holder.amount.setTextColor(
            if (transaction.amount > 0) Color.GREEN else Color.RED
        )
        
        val dateFormat = SimpleDateFormat("MMM dd, yyyy")
        holder.date.text = dateFormat.format(transaction.date)
    }

    override fun getItemCount() = transactions.size
}
