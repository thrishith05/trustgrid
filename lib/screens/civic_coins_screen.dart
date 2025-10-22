import 'package:flutter/material.dart';
import '../services/civic_coins_service.dart';

class CivicCoinsScreen extends StatefulWidget {
  const CivicCoinsScreen({super.key});

  @override
  State<CivicCoinsScreen> createState() => _CivicCoinsScreenState();
}

class _CivicCoinsScreenState extends State<CivicCoinsScreen> with TickerProviderStateMixin {
  late TabController _tabController;
  Map<String, dynamic> _coinsData = {'coins': {'current_balance': 0, 'total_earned': 0}, 'recent_transactions': []};
  List<Map<String, dynamic>> _vouchers = [];
  bool _isLoading = true;
  String? _userId;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    
    try {
      _userId = await CivicCoinsService.getUserId();
      final coinsData = await CivicCoinsService.getCivicCoins(_userId!);
      final vouchers = await CivicCoinsService.getVouchers();
      
      setState(() {
        _coinsData = coinsData;
        _vouchers = vouchers;
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error loading data: $e')),
      );
    }
  }

  Future<void> _redeemVoucher(Map<String, dynamic> voucher) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Redeem Voucher'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('${voucher['title']}', style: TextStyle(fontWeight: FontWeight.bold)),
            SizedBox(height: 8),
            Text('${voucher['description']}'),
            SizedBox(height: 8),
            Text('Cost: ${voucher['coin_cost']} civic coins', style: TextStyle(color: Colors.orange)),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: Text('Redeem'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      try {
        final result = await CivicCoinsService.redeemVoucher(voucher['id'].toString(), _userId!);
        
        if (result['success']) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Voucher redeemed successfully!'),
              backgroundColor: Colors.green,
            ),
          );
          
          await _loadData(); // Refresh data
          
          // Show redemption code
          showDialog(
            context: context,
            builder: (context) => AlertDialog(
              title: Text('Redemption Successful!'),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('Your redemption code:'),
                  SizedBox(height: 8),
                  Container(
                    padding: EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.grey[100],
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      result['data']['redemption_code'],
                      style: TextStyle(
                        fontFamily: 'monospace',
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                    ),
                  ),
                  SizedBox(height: 8),
                  Text('Show this code to redeem your voucher'),
                ],
              ),
              actions: [
                ElevatedButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: Text('OK'),
                ),
              ],
            ),
          );
        }
      } catch (e) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Civic Coins'),
        backgroundColor: Colors.orange,
        foregroundColor: Colors.white,
        bottom: TabBar(
          controller: _tabController,
          tabs: [
            Tab(icon: Icon(Icons.account_balance_wallet), text: 'My Coins'),
            Tab(icon: Icon(Icons.card_giftcard), text: 'Vouchers'),
          ],
        ),
      ),
      body: _isLoading
          ? Center(child: CircularProgressIndicator())
          : TabBarView(
              controller: _tabController,
              children: [
                _buildCoinsTab(),
                _buildVouchersTab(),
              ],
            ),
    );
  }

  Widget _buildCoinsTab() {
    final coins = _coinsData['coins'];
    final transactions = _coinsData['recent_transactions'] as List;
    
    return RefreshIndicator(
      onRefresh: _loadData,
      child: SingleChildScrollView(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Coins Balance Card
            Card(
              elevation: 4,
              child: Container(
                width: double.infinity,
                padding: EdgeInsets.all(24),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Colors.orange, Colors.deepOrange],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  children: [
                    Icon(Icons.account_balance_wallet, size: 48, color: Colors.white),
                    SizedBox(height: 16),
                    Text(
                      '${coins['current_balance'] ?? 0}',
                      style: TextStyle(
                        fontSize: 36,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                    Text(
                      'Civic Coins',
                      style: TextStyle(
                        fontSize: 18,
                        color: Colors.white70,
                      ),
                    ),
                    SizedBox(height: 16),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceAround,
                      children: [
                        Column(
                          children: [
                            Text(
                              '${coins['total_earned'] ?? 0}',
                              style: TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                              ),
                            ),
                            Text('Total Earned', style: TextStyle(color: Colors.white70)),
                          ],
                        ),
                        Column(
                          children: [
                            Text(
                              '${transactions.length}',
                              style: TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                              ),
                            ),
                            Text('Transactions', style: TextStyle(color: Colors.white70)),
                          ],
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            SizedBox(height: 24),
            
            // How to Earn Section
            Card(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'How to Earn Civic Coins',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    SizedBox(height: 12),
                    _buildEarningMethod(Icons.report, 'Report Issues', '10 coins per resolved report'),
                    _buildEarningMethod(Icons.verified, 'Verify Reports', '2 coins per verification'),
                    _buildEarningMethod(Icons.thumb_up, 'Upvote Issues', '1 coin per upvote'),
                    _buildEarningMethod(Icons.star, 'Bonus Rewards', 'Extra coins for quality reports'),
                  ],
                ),
              ),
            ),
            SizedBox(height: 24),
            
            // Recent Transactions
            Text(
              'Recent Transactions',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            SizedBox(height: 12),
            
            if (transactions.isEmpty)
              Card(
                child: Padding(
                  padding: EdgeInsets.all(24),
                  child: Column(
                    children: [
                      Icon(Icons.history, size: 48, color: Colors.grey),
                      SizedBox(height: 12),
                      Text(
                        'No transactions yet',
                        style: TextStyle(
                          fontSize: 16,
                          color: Colors.grey[600],
                        ),
                      ),
                      Text(
                        'Start reporting issues to earn civic coins!',
                        style: TextStyle(
                          color: Colors.grey[500],
                        ),
                      ),
                    ],
                  ),
                ),
              )
            else
              ...transactions.map((transaction) => _buildTransactionCard(transaction)),
          ],
        ),
      ),
    );
  }

  Widget _buildEarningMethod(IconData icon, String title, String description) {
    return Padding(
      padding: EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Container(
            padding: EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Colors.orange.withOpacity(0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: Colors.orange, size: 20),
          ),
          SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(fontWeight: FontWeight.w500),
                ),
                Text(
                  description,
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey[600],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTransactionCard(Map<String, dynamic> transaction) {
    final isEarned = transaction['transaction_type'] == 'earned';
    final amount = transaction['amount'] ?? 0;
    
    return Card(
      margin: EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: Container(
          padding: EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: isEarned ? Colors.green.withOpacity(0.1) : Colors.red.withOpacity(0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(
            isEarned ? Icons.add : Icons.remove,
            color: isEarned ? Colors.green : Colors.red,
          ),
        ),
        title: Text(transaction['description'] ?? 'Transaction'),
        subtitle: Text(
          DateTime.parse(transaction['created_at']).toString().split('.')[0],
          style: TextStyle(fontSize: 12),
        ),
        trailing: Text(
          '${isEarned ? '+' : '-'}$amount',
          style: TextStyle(
            fontWeight: FontWeight.bold,
            color: isEarned ? Colors.green : Colors.red,
          ),
        ),
      ),
    );
  }

  Widget _buildVouchersTab() {
    final currentBalance = _coinsData['coins']['current_balance'] ?? 0;
    
    return RefreshIndicator(
      onRefresh: _loadData,
      child: SingleChildScrollView(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Available Balance
            Card(
              color: Colors.orange.withOpacity(0.1),
              child: Padding(
                padding: EdgeInsets.all(16),
                child: Row(
                  children: [
                    Icon(Icons.account_balance_wallet, color: Colors.orange),
                    SizedBox(width: 12),
                    Text(
                      'Available Balance: $currentBalance coins',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: Colors.orange[800],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            SizedBox(height: 16),
            
            Text(
              'Available Vouchers',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            SizedBox(height: 12),
            
            if (_vouchers.isEmpty)
              Card(
                child: Padding(
                  padding: EdgeInsets.all(24),
                  child: Column(
                    children: [
                      Icon(Icons.card_giftcard, size: 48, color: Colors.grey),
                      SizedBox(height: 12),
                      Text(
                        'No vouchers available',
                        style: TextStyle(
                          fontSize: 16,
                          color: Colors.grey[600],
                        ),
                      ),
                    ],
                  ),
                ),
              )
            else
              ..._vouchers.map((voucher) => _buildVoucherCard(voucher)),
          ],
        ),
      ),
    );
  }

  Widget _buildVoucherCard(Map<String, dynamic> voucher) {
    final coinCost = voucher['coin_cost'] ?? 0;
    final currentBalance = _coinsData['coins']['current_balance'] ?? 0;
    final canAfford = currentBalance >= coinCost;
    
    return Card(
      margin: EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.blue.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(Icons.card_giftcard, color: Colors.blue),
                ),
                SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        voucher['title'] ?? 'Voucher',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Text(
                        voucher['description'] ?? '',
                        style: TextStyle(
                          color: Colors.grey[600],
                          fontSize: 14,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.orange,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Text(
                    '$coinCost coins',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 12,
                    ),
                  ),
                ),
              ],
            ),
            SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: canAfford ? () => _redeemVoucher(voucher) : null,
                style: ElevatedButton.styleFrom(
                  backgroundColor: canAfford ? Colors.green : Colors.grey,
                  foregroundColor: Colors.white,
                ),
                child: Text(
                  canAfford ? 'Redeem' : 'Insufficient Coins',
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
