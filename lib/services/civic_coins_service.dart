import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class CivicCoinsService {
  static const String _baseUrl = 'http://10.0.2.2:3000';
  
  // Get civic coins balance for a user
  static Future<Map<String, dynamic>> getCivicCoins(String userId) async {
    try {
      final response = await http.get(
        Uri.parse('$_baseUrl/api/civic-coins/$userId'),
        headers: {'Content-Type': 'application/json'},
      );

      if (response.statusCode == 200) {
        final responseData = jsonDecode(response.body);
        return responseData['data'];
      }
      
      return {
        'coins': {'current_balance': 0, 'total_earned': 0},
        'recent_transactions': []
      };
    } catch (e) {
      print('Error fetching civic coins: $e');
      return {
        'coins': {'current_balance': 0, 'total_earned': 0},
        'recent_transactions': []
      };
    }
  }

  // Get available vouchers
  static Future<List<Map<String, dynamic>>> getVouchers() async {
    try {
      final response = await http.get(
        Uri.parse('$_baseUrl/api/vouchers'),
        headers: {'Content-Type': 'application/json'},
      );

      if (response.statusCode == 200) {
        final responseData = jsonDecode(response.body);
        return List<Map<String, dynamic>>.from(responseData['data']['vouchers']);
      }
      
      return [];
    } catch (e) {
      print('Error fetching vouchers: $e');
      return [];
    }
  }

  // Redeem a voucher
  static Future<Map<String, dynamic>> redeemVoucher(String voucherId, String userId) async {
    try {
      final response = await http.post(
        Uri.parse('$_baseUrl/api/vouchers/$voucherId/redeem'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'userId': userId}),
      );

      if (response.statusCode == 200) {
        final responseData = jsonDecode(response.body);
        return responseData;
      } else {
        final errorData = jsonDecode(response.body);
        throw Exception(errorData['error'] ?? 'Failed to redeem voucher');
      }
    } catch (e) {
      print('Error redeeming voucher: $e');
      rethrow;
    }
  }

  // Get or create user ID (for anonymous users)
  static Future<String> getUserId() async {
    final prefs = await SharedPreferences.getInstance();
    String? userId = prefs.getString('user_id');
    
    if (userId == null) {
      userId = 'user_${DateTime.now().millisecondsSinceEpoch}';
      await prefs.setString('user_id', userId);
    }
    
    return userId;
  }

  // Save user ID
  static Future<void> saveUserId(String userId) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('user_id', userId);
  }

  // Get transaction history
  static Future<List<Map<String, dynamic>>> getTransactionHistory(String userId) async {
    try {
      final response = await http.get(
        Uri.parse('$_baseUrl/api/civic-coins/$userId'),
        headers: {'Content-Type': 'application/json'},
      );

      if (response.statusCode == 200) {
        final responseData = jsonDecode(response.body);
        return List<Map<String, dynamic>>.from(responseData['data']['recent_transactions']);
      }
      
      return [];
    } catch (e) {
      print('Error fetching transaction history: $e');
      return [];
    }
  }
}
