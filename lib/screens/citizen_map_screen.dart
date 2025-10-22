import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'dart:async';
import 'package:geolocator/geolocator.dart';
import 'package:geocoding/geocoding.dart';
// import 'package:url_launcher/url_launcher.dart'; // Not needed for this implementation

class CitizenMapScreen extends StatefulWidget {
  const CitizenMapScreen({super.key});
  
  @override
  _CitizenMapScreenState createState() => _CitizenMapScreenState();
}

class _CitizenMapScreenState extends State<CitizenMapScreen> {
  Position? currentPosition;
  List<Map<String, dynamic>> nearbyReports = [];
  bool isLoading = true;
  Timer? locationTimer;
  Timer? notificationTimer;
  String? errorMessage;
  Set<String> votedReports = {}; // Track which reports user has voted on

  // API Configuration
  static const String API_BASE_URL = 'http://10.0.2.2:3000/api';
  
  // Verification radius (450m as per admin panel)
  static const double VERIFICATION_RADIUS = 450.0;

  @override
  void initState() {
    super.initState();
    _initializeLocationAndMap();
  }

  @override
  void dispose() {
    locationTimer?.cancel();
    notificationTimer?.cancel();
    super.dispose();
  }

  Future<void> _initializeLocationAndMap() async {
    try {
      // Get current location
      await _getCurrentLocation();
      
      // Load nearby reports
      await _loadNearbyReports();
      
      // Start periodic location checks for notifications
      _startLocationMonitoring();
      
      setState(() {
        isLoading = false;
      });
    } catch (e) {
      setState(() {
        errorMessage = 'Failed to initialize map: $e';
        isLoading = false;
      });
    }
  }

  Future<void> _getCurrentLocation() async {
    try {
      // Check permissions
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          throw Exception('Location permission denied');
        }
      }

      if (permission == LocationPermission.deniedForever) {
        throw Exception('Location permission permanently denied');
      }

      // Get current position
      currentPosition = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: Duration(seconds: 10),
      );
    } catch (e) {
      throw Exception('Failed to get location: $e');
    }
  }

  Future<void> _loadNearbyReports() async {
    if (currentPosition == null) return;

    try {
      final response = await http.get(
        Uri.parse('$API_BASE_URL/reports'),
        headers: {'Content-Type': 'application/json'},
      );

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final reports = data['reports'] ?? data; // Handle v2 API format
        
        // Filter reports within verification radius
        final nearby = reports.where((report) {
          if (report['latitude'] == null || report['longitude'] == null) return false;
          
          final distance = Geolocator.distanceBetween(
            currentPosition!.latitude,
            currentPosition!.longitude,
            report['latitude'].toDouble(),
            report['longitude'].toDouble(),
          );
          
          return distance <= VERIFICATION_RADIUS;
        }).toList();

        // Check for deleted reports and remove them
        _removeDeletedReports(nearby);

        setState(() {
          nearbyReports = List<Map<String, dynamic>>.from(nearby);
        });

        // Check for new reports that need verification
        _checkForVerificationNotifications();
      }
    } catch (e) {
      print('Error loading nearby reports: $e');
    }
  }

  void _startLocationMonitoring() {
    // Check location every 30 seconds
    locationTimer = Timer.periodic(Duration(seconds: 30), (timer) async {
      try {
        final newPosition = await Geolocator.getCurrentPosition(
          desiredAccuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 5),
        );
        
        // Check if user moved significantly (more than 100m)
        if (currentPosition != null) {
          final distance = Geolocator.distanceBetween(
            currentPosition!.latitude,
            currentPosition!.longitude,
            newPosition.latitude,
            newPosition.longitude,
          );
          
          if (distance > 100) {
            setState(() {
              currentPosition = newPosition;
            });
            await _loadNearbyReports();
          }
        }
      } catch (e) {
        print('Error monitoring location: $e');
      }
    });

    // Check for notifications every 2 minutes
    notificationTimer = Timer.periodic(Duration(minutes: 2), (timer) {
      _checkForVerificationNotifications();
    });
  }

  void _checkForVerificationNotifications() {
    if (currentPosition == null || nearbyReports.isEmpty) return;

    // Find reports that need verification (low verification count)
    final reportsNeedingVerification = nearbyReports.where((report) {
      final verificationCount = report['verification_count'] ?? 0;
      final upvotes = report['upvotes'] ?? 0;
      
      // Notify if verification count is low (less than 3 verifications)
      return verificationCount < 3 && upvotes < 5;
    }).toList();

    if (reportsNeedingVerification.isNotEmpty) {
      _showVerificationNotification(reportsNeedingVerification);
    }
  }

  // Check for deleted reports and remove them from the list
  void _removeDeletedReports(List<Map<String, dynamic>> newReports) {
    final newReportIds = newReports.map((report) => report['id'] as String).toSet();
    
    setState(() {
      nearbyReports.removeWhere((report) {
        final reportId = report['id'] as String;
        final wasRemoved = !newReportIds.contains(reportId);
        
        if (wasRemoved) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Issue "${report['type']}" has been removed by admin'),
              backgroundColor: Colors.orange,
              duration: Duration(seconds: 3),
            ),
          );
        }
        
        return wasRemoved;
      });
    });
  }

  void _showVerificationNotification(List<Map<String, dynamic>> reports) {
    if (!mounted) return;

    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          title: Row(
            children: [
              Icon(Icons.location_on, color: Colors.blue),
              SizedBox(width: 8),
              Text('Nearby Issues Need Your Input!'),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'You are near ${reports.length} issue(s) that need community verification:',
                style: TextStyle(fontSize: 16),
              ),
              SizedBox(height: 12),
              ...reports.take(3).map((report) => Padding(
                padding: EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  children: [
                    Icon(_getIssueIcon(report['type']), size: 20, color: Colors.orange),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        '${report['type']} - ${report['severity']}',
                        style: TextStyle(fontSize: 14),
                      ),
                    ),
                  ],
                ),
              )),
              if (reports.length > 3)
                Text('... and ${reports.length - 3} more'),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: Text('Later'),
            ),
            ElevatedButton(
              onPressed: () {
                Navigator.of(context).pop();
                _showVotingInterface();
              },
              child: Text('Verify Now'),
            ),
          ],
        );
      },
    );
  }

  void _showVotingInterface() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (BuildContext context) {
        return Container(
          height: MediaQuery.of(context).size.height * 0.8,
          child: Column(
            children: [
              Container(
                padding: EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.blue,
                  borderRadius: BorderRadius.only(
                    topLeft: Radius.circular(20),
                    topRight: Radius.circular(20),
                  ),
                ),
                child: Row(
                  children: [
                    Icon(Icons.how_to_vote, color: Colors.white),
                    SizedBox(width: 8),
                    Text(
                      'Verify Nearby Issues',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    Spacer(),
                    IconButton(
                      onPressed: () => Navigator.of(context).pop(),
                      icon: Icon(Icons.close, color: Colors.white),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: ListView.builder(
                  padding: EdgeInsets.all(16),
                  itemCount: nearbyReports.length,
                  itemBuilder: (context, index) {
                    final report = nearbyReports[index];
                    return _buildReportCard(report);
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildReportCard(Map<String, dynamic> report) {
    final distance = currentPosition != null
        ? Geolocator.distanceBetween(
            currentPosition!.latitude,
            currentPosition!.longitude,
            report['latitude'].toDouble(),
            report['longitude'].toDouble(),
          )
        : 0.0;

    return Card(
      margin: EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(_getIssueIcon(report['type']), color: _getSeverityColor(report['severity'])),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    report['type'] ?? 'Unknown Issue',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                ),
                Container(
                  padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: _getSeverityColor(report['severity']).withOpacity(0.2),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    report['severity'] ?? 'Unknown',
                    style: TextStyle(
                      color: _getSeverityColor(report['severity']),
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
            SizedBox(height: 8),
            Text(
              report['description'] ?? 'No description available',
              style: TextStyle(fontSize: 14, color: Colors.grey[600]),
            ),
            SizedBox(height: 8),
            Row(
              children: [
                Icon(Icons.location_on, size: 16, color: Colors.grey),
                SizedBox(width: 4),
                Text(
                  '${distance.toStringAsFixed(0)}m away',
                  style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                ),
                Spacer(),
                Icon(Icons.how_to_vote, size: 16, color: Colors.grey),
                SizedBox(width: 4),
                Text(
                  '${report['verification_count'] ?? 0} verifications',
                  style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                ),
              ],
            ),
            SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: votedReports.contains(report['id']) ? null : () => _voteOnReport(report['id'], 'upvote'),
                    icon: Icon(votedReports.contains(report['id']) ? Icons.check : Icons.thumb_up, size: 16),
                    label: Text(votedReports.contains(report['id']) ? 'Voted' : 'Upvote'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: votedReports.contains(report['id']) ? Colors.green : Colors.blue,
                      side: BorderSide(color: votedReports.contains(report['id']) ? Colors.green : Colors.blue),
                    ),
                  ),
                ),
                SizedBox(width: 8),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: votedReports.contains(report['id']) ? null : () => _voteOnReport(report['id'], 'verify'),
                    icon: Icon(votedReports.contains(report['id']) ? Icons.check_circle : Icons.verified, size: 16),
                    label: Text(votedReports.contains(report['id']) ? 'Verified' : 'Verify'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: votedReports.contains(report['id']) ? Colors.green.shade300 : Colors.green,
                      foregroundColor: Colors.white,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _voteOnReport(String reportId, String voteType) async {
    // Check if user already voted on this report
    if (votedReports.contains(reportId)) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('You have already voted on this issue!'),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    try {
      final response = await http.post(
        Uri.parse('$API_BASE_URL/reports/$reportId/$voteType'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'user_id': 'citizen_${DateTime.now().millisecondsSinceEpoch}',
        }),
      );

      if (response.statusCode == 200) {
        // Mark as voted
        setState(() {
          votedReports.add(reportId);
        });

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${voteType == 'upvote' ? 'Upvoted' : 'Verified'} successfully!'),
            backgroundColor: Colors.green,
          ),
        );
        
        // Reload nearby reports to update counts and remove highly verified issues
        await _loadNearbyReports();
        
        // Check if this issue should be removed from the list
        _checkAndRemoveVerifiedIssues();
      } else {
        final responseData = json.decode(response.body);
        if (responseData['error'] == 'Already verified by this user') {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('You have already voted on this issue!'),
              backgroundColor: Colors.orange,
            ),
          );
          setState(() {
            votedReports.add(reportId);
          });
        } else {
          throw Exception('Failed to vote');
        }
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to vote: $e'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  IconData _getIssueIcon(String? type) {
    switch (type?.toLowerCase()) {
      case 'pothole':
        return Icons.warning;
      case 'streetlight':
        return Icons.lightbulb;
      case 'trash':
        return Icons.delete;
      case 'water':
        return Icons.water_drop;
      default:
        return Icons.warning;
    }
  }

  Color _getSeverityColor(String? severity) {
    switch (severity?.toLowerCase()) {
      case 'low':
        return Colors.green;
      case 'medium':
        return Colors.orange;
      case 'high':
        return Colors.red;
      case 'critical':
        return Colors.purple;
      default:
        return Colors.grey;
    }
  }

  void _checkAndRemoveVerifiedIssues() {
    // Remove issues that have high verification count (5+ verifications)
    setState(() {
      nearbyReports.removeWhere((report) {
        final verificationCount = report['verification_count'] ?? 0;
        final upvotes = report['upvotes'] ?? 0;
        
        // Remove if it has 5+ verifications OR 10+ upvotes
        if (verificationCount >= 5 || upvotes >= 10) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Issue "${report['type']}" has been verified by the community!'),
              backgroundColor: Colors.green,
              duration: Duration(seconds: 3),
            ),
          );
          return true; // Remove this report
        }
        return false; // Keep this report
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    if (isLoading) {
      return Scaffold(
        appBar: AppBar(
          title: Text('Citizen Map'),
          backgroundColor: Colors.blue,
        ),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              CircularProgressIndicator(),
              SizedBox(height: 16),
              Text('Loading nearby issues...'),
            ],
          ),
        ),
      );
    }

    if (errorMessage != null) {
      return Scaffold(
        appBar: AppBar(
          title: Text('Citizen Map'),
          backgroundColor: Colors.blue,
        ),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.error, size: 64, color: Colors.red),
              SizedBox(height: 16),
              Text(
                errorMessage!,
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 16),
              ),
              SizedBox(height: 16),
              ElevatedButton(
                onPressed: () {
                  setState(() {
                    errorMessage = null;
                    isLoading = true;
                  });
                  _initializeLocationAndMap();
                },
                child: Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text('Citizen Map'),
        backgroundColor: Colors.blue,
        actions: [
          IconButton(
            onPressed: _showVotingInterface,
            icon: Icon(Icons.how_to_vote),
            tooltip: 'Vote on Issues',
          ),
        ],
      ),
      body: Column(
        children: [
          // Status Banner
          Container(
            width: double.infinity,
            padding: EdgeInsets.all(16),
            color: Colors.blue.shade50,
            child: Column(
              children: [
                Row(
                  children: [
                    Icon(Icons.location_on, color: Colors.blue),
                    SizedBox(width: 8),
                    Text(
                      'Location: ${currentPosition?.latitude.toStringAsFixed(4)}, ${currentPosition?.longitude.toStringAsFixed(4)}',
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
                SizedBox(height: 4),
                Text(
                  '${nearbyReports.length} issues within ${VERIFICATION_RADIUS}m radius',
                  style: TextStyle(color: Colors.grey[600]),
                ),
              ],
            ),
          ),
          
          // Reports List
          Expanded(
            child: nearbyReports.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.check_circle, size: 64, color: Colors.green),
                        SizedBox(height: 16),
                        Text(
                          'No issues nearby!',
                          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                        ),
                        SizedBox(height: 8),
                        Text(
                          'You are in a clean area within ${VERIFICATION_RADIUS}m radius.',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: Colors.grey[600]),
                        ),
                      ],
                    ),
                  )
                : ListView.builder(
                    padding: EdgeInsets.all(16),
                    itemCount: nearbyReports.length,
                    itemBuilder: (context, index) {
                      return _buildReportCard(nearbyReports[index]);
                    },
                  ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () async {
          await _loadNearbyReports();
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Refreshed nearby issues')),
          );
        },
        child: Icon(Icons.refresh),
        tooltip: 'Refresh',
      ),
    );
  }
}
