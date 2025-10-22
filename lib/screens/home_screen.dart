import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/civic_report_provider.dart';
import '../models/civic_issue.dart';
import '../widgets/report_card.dart';
import '../widgets/stats_card.dart';
import '../services/report_service.dart';
import 'camera_screen.dart';
import 'citizen_map_screen.dart';
import 'civic_coins_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<CivicReportProvider>(context, listen: false).loadReports();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('CivicFix'),
        actions: [
          IconButton(
            onPressed: () async {
              final provider = Provider.of<CivicReportProvider>(context, listen: false);
              
              // Clear local storage to force full sync
              await ReportService.clearLocalStorage();
              
              // Refresh from backend
              await provider.refreshReports();
              
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('✅ Synced with backend!'),
                  backgroundColor: Colors.green,
                  duration: Duration(seconds: 2),
                ),
              );
            },
            icon: const Icon(Icons.sync),
            tooltip: 'Sync with Backend',
          ),
        ],
      ),
      body: Consumer<CivicReportProvider>(
        builder: (context, provider, child) {
          return RefreshIndicator(
            onRefresh: () async {
              await provider.refreshReports();
            },
            child: provider.isLoading
                ? const Center(
                    child: CircularProgressIndicator(),
                  )
                : _buildBody(provider),
          );
        },
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          Navigator.of(context).push(
            MaterialPageRoute(
              builder: (context) => const CameraScreen(),
            ),
          );
        },
        icon: const Icon(Icons.camera_alt),
        label: const Text('Report Issue'),
        backgroundColor: const Color(0xFF1976D2),
      ),
    );
  }

  Widget _buildBody(CivicReportProvider provider) {
    if (provider.error != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error, size: 64, color: Colors.red),
            const SizedBox(height: 16),
            Text(
              provider.error!,
              style: const TextStyle(fontSize: 16),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () {
                provider.clearError();
                provider.refreshReports();
              },
              child: const Text('Retry'),
            ),
          ],
        ),
      );
    }

    return SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Welcome section
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF1976D2), Color(0xFF1565C0)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Welcome to CivicFix',
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Report and track civic issues in your community',
                  style: TextStyle(
                    fontSize: 16,
                    color: Colors.white.withOpacity(0.9),
                  ),
                ),
                const SizedBox(height: 20),
                Row(
                  children: [
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: () {
                          Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (context) => const CameraScreen(),
                            ),
                          );
                        },
                        icon: const Icon(Icons.camera_alt),
                        label: const Text('Report Issue'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.white,
                          foregroundColor: const Color(0xFF1976D2),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 12,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: () {
                          Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (context) => const CitizenMapScreen(),
                            ),
                          );
                        },
                        icon: const Icon(Icons.map),
                        label: const Text('Citizen Map'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.white.withOpacity(0.2),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 12,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                // Civic Coins Button
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (context) => const CivicCoinsScreen(),
                        ),
                      );
                    },
                    icon: const Icon(Icons.account_balance_wallet),
                    label: const Text('Civic Coins & Vouchers'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.orange,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 12,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // Stats section
          const Text(
            'Overview',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 16),
          GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 2,
            crossAxisSpacing: 16,
            mainAxisSpacing: 16,
            childAspectRatio: 1.3,
            children: [
              StatsCard(
                title: 'Total Reports',
                value: provider.totalReports.toString(),
                icon: Icons.assignment,
                color: const Color(0xFF1976D2),
              ),
              StatsCard(
                title: 'Pending',
                value: provider.pendingReports.toString(),
                icon: Icons.pending,
                color: const Color(0xFFFF9800),
              ),
              StatsCard(
                title: 'Resolved',
                value: provider.resolvedReports.toString(),
                icon: Icons.check_circle,
                color: const Color(0xFF4CAF50),
              ),
              StatsCard(
                title: 'Critical',
                value: provider.criticalReports.length.toString(),
                icon: Icons.warning,
                color: const Color(0xFFF44336),
              ),
            ],
          ),
          const SizedBox(height: 24),

          // Recent reports section
          const Text(
            'Recent Reports',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              boxShadow: [
                BoxShadow(
                  color: Colors.grey.withOpacity(0.1),
                  spreadRadius: 1,
                  blurRadius: 5,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: provider.recentReports.isEmpty
                ? Padding(
                    padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.assignment_outlined,
                          size: 48,
                          color: Colors.grey[400],
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'No reports yet',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w500,
                            color: Colors.grey[600],
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'Tap the camera button to report your first civic issue',
                          style: TextStyle(
                            fontSize: 13,
                            color: Colors.grey[500],
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  )
                : ListView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: provider.recentReports.take(5).length,
                    itemBuilder: (context, index) {
                      final report = provider.recentReports[index];
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: ReportCard(report: report),
                      );
                    },
                  ),
          ),
          const SizedBox(height: 80), // Add space for floating action button
        ],
      ),
    );
  }
}