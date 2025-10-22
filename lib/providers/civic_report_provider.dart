import 'package:flutter/foundation.dart';
import 'dart:async';
import '../models/civic_issue.dart';
import '../services/report_service.dart';

class CivicReportProvider with ChangeNotifier {
  List<CivicIssue> _reports = [];
  bool _isLoading = false;
  String? _error;
  Timer? _refreshTimer;

  List<CivicIssue> get reports => _reports;
  bool get isLoading => _isLoading;
  String? get error => _error;

  List<CivicIssue> get reportsByStatus {
    final Map<IssueStatus, List<CivicIssue>> grouped = {};
    for (final status in IssueStatus.values) {
      grouped[status] = _reports.where((r) => r.status == status).toList();
    }
    return grouped.values.expand((x) => x).toList();
  }

  List<CivicIssue> get reportsByType {
    final Map<IssueType, List<CivicIssue>> grouped = {};
    for (final type in IssueType.values) {
      grouped[type] = _reports.where((r) => r.type == type).toList();
    }
    return grouped.values.expand((x) => x).toList();
  }

  List<CivicIssue> get criticalReports {
    return _reports.where((r) => r.severity == IssueSeverity.critical).toList();
  }

  List<CivicIssue> get recentReports {
    final sortedReports = List<CivicIssue>.from(_reports);
    sortedReports.sort((a, b) => b.timestamp.compareTo(a.timestamp));
    return sortedReports;
  }

  int get totalReports => _reports.length;
  int get resolvedReports => _reports.where((r) => r.status == IssueStatus.resolved).length;
  int get pendingReports => _reports.where((r) => r.status != IssueStatus.resolved && r.status != IssueStatus.closed).length;

  Future<void> loadReports() async {
    _setLoading(true);
    _clearError();

    try {
      _reports = await ReportService.getReports();
      notifyListeners();
      
      // Start automatic refresh every 30 seconds
      _startAutoRefresh();
    } catch (e) {
      _setError('Failed to load reports: $e');
    } finally {
      _setLoading(false);
    }
  }

  void _startAutoRefresh() {
    _refreshTimer?.cancel();
    _refreshTimer = Timer.periodic(Duration(seconds: 30), (timer) async {
      try {
        final newReports = await ReportService.getReports();
        
        // Only update if data has changed
        if (_reports.length != newReports.length || 
            _reports.any((report) => !newReports.any((newReport) => newReport.id == report.id))) {
          _reports = newReports;
          notifyListeners();
        }
      } catch (e) {
        print('Auto-refresh error: $e');
      }
    });
  }

  void stopAutoRefresh() {
    _refreshTimer?.cancel();
    _refreshTimer = null;
  }

  Future<void> addReport(CivicIssue report) async {
    try {
      _reports.insert(0, report);
      notifyListeners();
    } catch (e) {
      _setError('Failed to add report: $e');
    }
  }

  Future<void> updateReportStatus(String reportId, IssueStatus status) async {
    try {
      await ReportService.updateReportStatus(reportId, status);
      
      final index = _reports.indexWhere((r) => r.id == reportId);
      if (index != -1) {
        _reports[index] = _reports[index].copyWith(
          status: status,
          acknowledgedAt: status == IssueStatus.acknowledged ? DateTime.now() : _reports[index].acknowledgedAt,
          resolvedAt: status == IssueStatus.resolved ? DateTime.now() : _reports[index].resolvedAt,
        );
        notifyListeners();
      }
    } catch (e) {
      _setError('Failed to update report status: $e');
    }
  }

  Future<void> refreshReports() async {
    await loadReports();
  }

  void _setLoading(bool loading) {
    _isLoading = loading;
    notifyListeners();
  }

  void _setError(String error) {
    _error = error;
    notifyListeners();
  }

  void _clearError() {
    _error = null;
  }

  void clearError() {
    _clearError();
    notifyListeners();
  }

  @override
  void dispose() {
    stopAutoRefresh();
    super.dispose();
  }
}
