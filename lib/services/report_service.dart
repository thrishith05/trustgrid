import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';
import '../models/civic_issue.dart';
import 'ai_service.dart';
import 'location_service.dart';
import 'civic_coins_service.dart';

class ReportService {
  static const String _baseUrl = 'http://10.0.2.2:3000'; // Android emulator localhost (10.0.2.2 maps to host machine)
  static const String _reportsEndpoint = '/api/reports';
  static const String _duplicatesEndpoint = '/api/duplicates';
  
  static bool _isInitialized = false;
  static SharedPreferences? _prefs;

  static Future<void> initialize() async {
    if (_isInitialized) return;
    
    _prefs = await SharedPreferences.getInstance();
    _isInitialized = true;
  }

  // Clear all local reports and force re-sync with backend
  static Future<void> clearLocalStorage() async {
    if (!_isInitialized) {
      await initialize();
    }
    
    await _prefs!.remove('local_reports');
    print('🗑️ Local storage cleared');
  }

  static Future<CivicIssue> createReport({
    required String imagePath,
    String? description,
    String? voiceNotePath,
  }) async {
    if (!_isInitialized) {
      await initialize();
    }

    try {
      // Get current location
      final position = await LocationService.getCurrentPosition();
      final address = await LocationService.getAddressFromCoordinates(
        position.latitude, 
        position.longitude
      );

      // Analyze image with AI
      final aiAnalysis = await AIService.analyzeImage(imagePath);
      
      // Compute perceptual hash for duplicate detection
      final perceptualHash = AIService.computePerceptualHash(imagePath);

      // Check for duplicates
      final isDuplicate = await _checkForDuplicates(perceptualHash, position.latitude, position.longitude);
      
      if (isDuplicate) {
        throw Exception('Similar issue already reported in this area');
      }

      // Create the civic issue
      final issue = CivicIssue(
        id: const Uuid().v4(),
        type: aiAnalysis['type'] as IssueType,
        severity: aiAnalysis['severity'] as IssueSeverity,
        status: IssueStatus.reported,
        latitude: position.latitude,
        longitude: position.longitude,
        address: address,
        timestamp: DateTime.now(),
        description: description,
        voiceNotePath: voiceNotePath,
        imagePath: imagePath,
        perceptualHash: perceptualHash,
      );

      // Submit to backend
      await _submitReport(issue);
      
      // Save locally
      await _saveReportLocally(issue);

      return issue;
    } catch (e) {
      print('Error creating report: $e');
      rethrow;
    }
  }

  static Future<bool> _checkForDuplicates(String perceptualHash, double latitude, double longitude) async {
    try {
      // For now, we'll use a simple local check
      // In production, this would query the backend API
      final localReports = await _getLocalReports();
      
      for (final report in localReports) {
        final distance = await LocationService.calculateDistance(
          latitude, longitude, 
          report.latitude, report.longitude
        );
        
        // Check if within 100 meters and similar hash
        if (distance < 100) {
          final similarity = AIService.calculateHashSimilarity(perceptualHash, report.perceptualHash);
          final percentage = (similarity / perceptualHash.length) * 100;
          
          if (percentage >= 80) {
            return true;
          }
        }
      }
      
      return false;
    } catch (e) {
      print('Error checking duplicates: $e');
      return false;
    }
  }

  static Future<void> _submitReport(CivicIssue issue) async {
    try {
      print('Submitting report to API: ${issue.id}');
      
      // Create multipart request for file upload
      final request = http.MultipartRequest(
        'POST',
        Uri.parse('$_baseUrl$_reportsEndpoint'),
      );
      
      // Get user ID for civic coins
      final userId = await CivicCoinsService.getUserId();
      
      // Add fields
      request.fields['type'] = issue.type.toString().split('.').last;
      request.fields['severity'] = issue.severity.toString().split('.').last;
      request.fields['latitude'] = issue.latitude.toString();
      request.fields['longitude'] = issue.longitude.toString();
      request.fields['address'] = issue.address;
      request.fields['description'] = issue.description ?? '';
      request.fields['perceptual_hash'] = issue.perceptualHash;
      request.fields['reporter_id'] = userId;
      
      // Add image file
      final imageFile = File(issue.imagePath);
      request.files.add(await http.MultipartFile.fromPath(
        'image',
        imageFile.path,
        filename: imageFile.path.split('/').last,
      ));
      
      // Send request
      final streamedResponse = await request.send();
      final response = await http.Response.fromStream(streamedResponse);
      
      if (response.statusCode != 201) {
        throw Exception('Failed to submit report: ${response.body}');
      }
      
      print('Report submitted successfully');
    } catch (e) {
      print('Error submitting report: $e');
      rethrow;
    }
  }

  static Future<void> _saveReportLocally(CivicIssue issue) async {
    try {
      final reportsJson = _prefs!.getStringList('local_reports') ?? [];
      reportsJson.add(jsonEncode(issue.toJson()));
      await _prefs!.setStringList('local_reports', reportsJson);
    } catch (e) {
      print('Error saving report locally: $e');
    }
  }

  static Future<List<CivicIssue>> getReports() async {
    if (!_isInitialized) {
      await initialize();
    }

    try {
      // Fetch from API - this is the single source of truth
      final apiReports = await _fetchReportsFromAPI();
      
      // Clean up local storage to match backend (remove deleted reports)
      await _syncLocalWithBackend(apiReports);
      
      return apiReports;
    } catch (e) {
      print('Error getting reports: $e');
      // If API fails, fall back to local reports
      return await _getLocalReports();
    }
  }

  static Future<void> _syncLocalWithBackend(List<CivicIssue> backendReports) async {
    try {
      final localReports = await _getLocalReports();
      final backendIds = backendReports.map((r) => r.id).toSet();
      
      // Filter local reports to only keep ones that exist on backend
      final syncedReports = localReports.where((r) => backendIds.contains(r.id)).toList();
      
      // Save synced reports back to local storage
      final reportsJson = syncedReports
          .map((report) => jsonEncode(report.toJson()))
          .toList();
      await _prefs!.setStringList('local_reports', reportsJson);
      
      print('✅ Local storage synced with backend: ${backendReports.length} reports');
    } catch (e) {
      print('Error syncing local with backend: $e');
    }
  }

  static Future<List<CivicIssue>> _getLocalReports() async {
    try {
      final reportsJson = _prefs!.getStringList('local_reports') ?? [];
      return reportsJson
          .map((json) => CivicIssue.fromJson(jsonDecode(json)))
          .toList();
    } catch (e) {
      print('Error getting local reports: $e');
      return [];
    }
  }

  static Future<List<CivicIssue>> _fetchReportsFromAPI() async {
    try {
      final response = await http.get(
        Uri.parse('$_baseUrl$_reportsEndpoint'),
        headers: {'Content-Type': 'application/json'},
      );

      if (response.statusCode == 200) {
        final responseData = jsonDecode(response.body);
        
        // Handle v2 API response format
        List<dynamic> reports;
        if (responseData is Map<String, dynamic> && responseData.containsKey('reports')) {
          reports = responseData['reports'];
        } else if (responseData is List) {
          reports = responseData;
        } else {
          print('Unexpected API response format: $responseData');
          return [];
        }
        
        return reports.map((json) => _convertApiReportToCivicIssue(json)).toList();
      }
      
      print('API request failed with status: ${response.statusCode}');
      return [];
    } catch (e) {
      print('Error fetching reports from API: $e');
      return [];
    }
  }

  static CivicIssue _convertApiReportToCivicIssue(Map<String, dynamic> json) {
    return CivicIssue(
      id: json['id'],
      type: IssueType.values.firstWhere(
        (e) => e.toString().split('.').last == json['type'],
        orElse: () => IssueType.other,
      ),
      severity: IssueSeverity.values.firstWhere(
        (e) => e.toString().split('.').last == json['severity'],
        orElse: () => IssueSeverity.medium,
      ),
      status: IssueStatus.values.firstWhere(
        (e) => e.toString().split('.').last == json['status'],
        orElse: () => IssueStatus.reported,
      ),
      latitude: (json['latitude'] ?? 0.0).toDouble(),
      longitude: (json['longitude'] ?? 0.0).toDouble(),
      address: json['address'] ?? '',
      timestamp: DateTime.parse(json['created_at'] ?? json['timestamp']),
      description: json['description'],
      voiceNotePath: json['voice_note_path'],
      imagePath: json['image_path'],
      perceptualHash: json['perceptual_hash'] ?? '',
      assignedDepartment: json['assigned_department'],
      assignedTo: json['assigned_to'],
      acknowledgedAt: json['acknowledged_at'] != null 
          ? DateTime.parse(json['acknowledged_at']) 
          : null,
      resolvedAt: json['resolved_at'] != null 
          ? DateTime.parse(json['resolved_at']) 
          : null,
      resolutionNotes: json['resolution_notes'],
      beforeImagePath: json['before_image_path'],
      afterImagePath: json['after_image_path'],
      verificationCount: json['verification_count'] ?? 0,
      verifiedBy: List<String>.from(json['verified_by']?.split(',') ?? []),
      civicCoinsAwarded: json['civic_coins_awarded'] ?? 0,
    );
  }

  static Future<void> updateReportStatus(String reportId, IssueStatus status) async {
    try {
      final reports = await _getLocalReports();
      final reportIndex = reports.indexWhere((r) => r.id == reportId);
      
      if (reportIndex != -1) {
        final updatedReport = reports[reportIndex].copyWith(
          status: status,
          acknowledgedAt: status == IssueStatus.acknowledged ? DateTime.now() : reports[reportIndex].acknowledgedAt,
          resolvedAt: status == IssueStatus.resolved ? DateTime.now() : reports[reportIndex].resolvedAt,
        );
        
        reports[reportIndex] = updatedReport;
        await _saveReportsLocally(reports);
      }
    } catch (e) {
      print('Error updating report status: $e');
    }
  }

  static Future<void> _saveReportsLocally(List<CivicIssue> reports) async {
    try {
      final reportsJson = reports.map((r) => jsonEncode(r.toJson())).toList();
      await _prefs!.setStringList('local_reports', reportsJson);
    } catch (e) {
      print('Error saving reports locally: $e');
    }
  }

  static Future<void> clearLocalReports() async {
    try {
      await _prefs!.remove('local_reports');
    } catch (e) {
      print('Error clearing local reports: $e');
    }
  }
}
