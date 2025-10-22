import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'screens/camera_screen.dart';
import 'screens/home_screen.dart';
import 'screens/citizen_map_screen.dart';
import 'services/location_service.dart';
import 'services/ai_service.dart';
import 'services/report_service.dart';
import 'providers/civic_report_provider.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize services
  await LocationService.initialize();
  await AIService.initialize();
  await ReportService.initialize();
  
  runApp(const CivicFixApp());
}

class CivicFixApp extends StatelessWidget {
  const CivicFixApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => CivicReportProvider()),
      ],
      child: MaterialApp(
        title: 'CivicFix',
        theme: ThemeData(
          primarySwatch: Colors.blue,
          visualDensity: VisualDensity.adaptivePlatformDensity,
          appBarTheme: const AppBarTheme(
            backgroundColor: Color(0xFF1976D2),
            foregroundColor: Colors.white,
            elevation: 0,
          ),
        ),
        home: const PermissionScreen(),
        routes: {
          '/home': (context) => const HomeScreen(),
          '/camera': (context) => const CameraScreen(),
          '/citizen-map': (context) => const CitizenMapScreen(),
        },
      ),
    );
  }
}

class PermissionScreen extends StatefulWidget {
  const PermissionScreen({super.key});

  @override
  State<PermissionScreen> createState() => _PermissionScreenState();
}

class _PermissionScreenState extends State<PermissionScreen> {
  bool _isLoading = true;
  String _status = 'Initializing...';

  @override
  void initState() {
    super.initState();
    _requestPermissions();
  }

  Future<void> _requestPermissions() async {
    setState(() {
      _status = 'Requesting camera permission...';
    });
    
    final cameraStatus = await Permission.camera.request();
    if (cameraStatus != PermissionStatus.granted) {
      setState(() {
        _status = 'Camera permission is required for CivicFix to work';
        _isLoading = false;
      });
      return;
    }

    setState(() {
      _status = 'Requesting location permission...';
    });
    
    final locationStatus = await Permission.locationWhenInUse.request();
    if (locationStatus != PermissionStatus.granted) {
      setState(() {
        _status = 'Location permission is required for automatic issue tagging';
        _isLoading = false;
      });
      return;
    }

    setState(() {
      _status = 'Requesting storage permission...';
    });
    
    final storageStatus = await Permission.storage.request();
    
    setState(() {
      _status = 'Permissions granted!';
      _isLoading = false;
    });

    // Navigate to home screen after a short delay
    Future.delayed(const Duration(seconds: 1), () {
      if (mounted) {
        Navigator.of(context).pushReplacementNamed('/home');
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF1976D2),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.location_city,
              size: 100,
              color: Colors.white,
            ),
            const SizedBox(height: 30),
            const Text(
              'CivicFix',
              style: TextStyle(
                fontSize: 32,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 10),
            const Text(
              'AI-Powered Civic Issue Reporting',
              style: TextStyle(
                fontSize: 16,
                color: Colors.white70,
              ),
            ),
            const SizedBox(height: 50),
            if (_isLoading) ...[
              const CircularProgressIndicator(
                valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
              ),
              const SizedBox(height: 20),
            ],
            Text(
              _status,
              style: const TextStyle(
                fontSize: 16,
                color: Colors.white,
              ),
              textAlign: TextAlign.center,
            ),
            if (!_isLoading && _status.contains('required')) ...[
              const SizedBox(height: 20),
              ElevatedButton(
                onPressed: _requestPermissions,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.white,
                  foregroundColor: const Color(0xFF1976D2),
                ),
                child: const Text('Retry'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
