import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:camera/camera.dart';
import 'package:provider/provider.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import '../providers/civic_report_provider.dart';
import '../services/ai_service.dart';
import '../services/mediapipe_detection_service.dart';
import '../services/location_service.dart';
import '../services/report_service.dart';
import '../models/civic_issue.dart';
import '../widgets/ar_overlay.dart';
import '../widgets/issue_detection_overlay.dart';
import '../widgets/realtime_ar_overlay.dart';

class CameraScreen extends StatefulWidget {
  const CameraScreen({super.key});

  @override
  State<CameraScreen> createState() => _CameraScreenState();
}

class _CameraScreenState extends State<CameraScreen> with WidgetsBindingObserver {
  CameraController? _cameraController;
  List<CameraDescription>? _cameras;
  bool _isInitialized = false;
  bool _isCapturing = false;
  bool _isProcessing = false;
  String? _error;
  
  // AI Detection
  Map<String, dynamic>? _currentDetection;
  List<DetectedIssue> _detectedIssues = [];
  bool _isDetecting = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initializeCamera();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _cameraController?.stopImageStream();
    _cameraController?.dispose();
    MediaPipeDetectionService.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (_cameraController == null || !_cameraController!.value.isInitialized) {
      return;
    }

    if (state == AppLifecycleState.inactive) {
      _cameraController?.dispose();
    } else if (state == AppLifecycleState.resumed) {
      _initializeCamera();
    }
  }

  Future<void> _initializeCamera() async {
    try {
      _cameras = await availableCameras();
      if (_cameras == null || _cameras!.isEmpty) {
        setState(() {
          _error = 'No cameras available';
        });
        return;
      }

      _cameraController = CameraController(
        _cameras![0],
        ResolutionPreset.high,
        enableAudio: false,
        imageFormatGroup: ImageFormatGroup.nv21, // For ML Kit processing on Android
      );

      await _cameraController!.initialize();
      
      if (mounted) {
        setState(() {
          _isInitialized = true;
          _error = null;
        });
        
        // Start continuous AI detection
        _startAIDetection();
      }
    } catch (e) {
      setState(() {
        _error = 'Failed to initialize camera: $e';
      });
    }
  }

  void _startAIDetection() {
    // Start real-time MediaPipe detection
    _processFramesContinuously();
  }

  void _processFramesContinuously() async {
    if (!_isInitialized || _isDetecting || _cameraController == null) {
      return;
    }

    _isDetecting = true;

    try {
      await MediaPipeDetectionService.initialize();

      // Start image stream
      await _cameraController!.startImageStream((CameraImage cameraImage) async {
        if (_isCapturing || _isProcessing) return;

        try {
          // Process frame with MediaPipe for real-time detection
          final detected = await MediaPipeDetectionService.processCameraImage(cameraImage);
          
          if (mounted && detected.isNotEmpty) {
            setState(() {
              _detectedIssues = detected;
              
              // Set primary detection (highest confidence)
              final primary = detected.reduce((a, b) => 
                a.confidence > b.confidence ? a : b
              );
              
              _currentDetection = {
                'type': primary.type,
                'confidence': primary.confidence,
                'boundingBox': primary.boundingBox,
                'severity': primary.severity,
                'label': primary.label,
              };
            });
          }
        } catch (e) {
          print('Error in frame processing: $e');
        }
      });
    } catch (e) {
      print('Error starting AI detection: $e');
      _isDetecting = false;
      // Fallback to simulation if MediaPipe fails
      _simulateDetection();
    }
  }

  void _simulateDetection() {
    // Fallback simulation if MediaPipe not available
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted && _isInitialized && !_isDetecting) {
        setState(() {
          _currentDetection = {
            'type': IssueType.pothole,
            'confidence': 0.85,
            'boundingBox': const Rect.fromLTWH(100, 200, 150, 100),
            'severity': IssueSeverity.high,
            'label': 'Pothole (Simulated)',
          };
        });
        _simulateDetection(); // Continue detection
      }
    });
  }

  Future<void> _captureImage() async {
    if (_cameraController == null || !_cameraController!.value.isInitialized) {
      return;
    }

    setState(() {
      _isCapturing = true;
    });

    try {
      // Stop image stream before capture
      if (_isDetecting) {
        await _cameraController!.stopImageStream();
        _isDetecting = false;
        await Future.delayed(const Duration(milliseconds: 500));
      }

      final XFile image = await _cameraController!.takePicture();
      
      setState(() {
        _isProcessing = true;
      });

      // Analyze captured image with MediaPipe for accurate classification
      final analysis = await MediaPipeDetectionService.analyzeStaticImage(image.path);

      // Create civic issue report
      final report = await ReportService.createReport(
        imagePath: image.path,
        description: 'AI detected: ${analysis['label']} '
            '(${(analysis['confidence'] * 100).toInt()}% confidence) - '
            'Real-time MediaPipe detection',
      );

      // Add to provider
      if (mounted) {
        final provider = Provider.of<CivicReportProvider>(context, listen: false);
        await provider.addReport(report);
        
        // Show success message
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Issue reported successfully! ID: ${report.id.substring(0, 8)}'),
            backgroundColor: Colors.green,
            duration: const Duration(seconds: 3),
          ),
        );
        
        // Navigate back to home
        Navigator.of(context).pop();
      }
    } catch (e) {
      setState(() {
        _error = 'Failed to capture image: $e';
      });
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to report issue: $e'),
            backgroundColor: Colors.red,
            duration: const Duration(seconds: 3),
          ),
        );
      }
    } finally {
      setState(() {
        _isCapturing = false;
        _isProcessing = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Camera Error')),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error, size: 64, color: Colors.red),
              const SizedBox(height: 16),
              Text(
                _error!,
                style: const TextStyle(fontSize: 16),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () {
                  setState(() {
                    _error = null;
                  });
                  _initializeCamera();
                },
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    if (!_isInitialized) {
      return const Scaffold(
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              CircularProgressIndicator(),
              SizedBox(height: 16),
              Text('Initializing camera...'),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          // Camera preview
          Positioned.fill(
            child: CameraPreview(_cameraController!),
          ),
          
          // Real-time AR Overlay with MediaPipe detections
          if (_detectedIssues.isNotEmpty)
            RealtimeAROverlay(
              detections: _detectedIssues,
              onTap: _captureImage,
            )
          else if (_currentDetection != null)
            IssueDetectionOverlay(
              detection: _currentDetection!,
              onTap: _captureImage,
            ),
          
          // Top controls
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: Container(
              padding: const EdgeInsets.only(top: 50, left: 16, right: 16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.close, color: Colors.white),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: Colors.black54,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (_isDetecting)
                          const Padding(
                            padding: EdgeInsets.only(right: 8.0),
                            child: SizedBox(
                              width: 12,
                              height: 12,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                valueColor: AlwaysStoppedAnimation<Color>(Colors.greenAccent),
                              ),
                            ),
                          ),
                        Text(
                          _detectedIssues.isNotEmpty
                              ? 'MediaPipe: ${_detectedIssues.length} issue${_detectedIssues.length > 1 ? 's' : ''} detected'
                              : _currentDetection != null
                                  ? 'AI Detected: ${_currentDetection!['label'] ?? _currentDetection!['type'].toString().split('.').last}'
                                  : _isDetecting
                                      ? 'Scanning with MediaPipe...'
                                      : 'Point camera at issue',
                          style: const TextStyle(color: Colors.white, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: _captureImage,
                    icon: const Icon(Icons.flash_on, color: Colors.white),
                  ),
                ],
              ),
            ),
          ),
          
          // Bottom controls
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: Container(
              padding: const EdgeInsets.all(20),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Real-time MediaPipe Detection Status
                  if (_detectedIssues.isNotEmpty)
                    Container(
                      padding: const EdgeInsets.all(12),
                      margin: const EdgeInsets.only(bottom: 20),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.7),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.greenAccent, width: 2),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Row(
                            children: [
                              const Icon(
                                Icons.auto_awesome,
                                color: Colors.greenAccent,
                                size: 20,
                              ),
                              const SizedBox(width: 8),
                              const Text(
                                'MediaPipe Real-Time Detection',
                                style: TextStyle(
                                  color: Colors.greenAccent,
                                  fontSize: 14,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          ..._detectedIssues.take(3).map((issue) => Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Text(
                              '• ${issue.label}: ${(issue.confidence * 100).toInt()}% confidence',
                              style: const TextStyle(color: Colors.white, fontSize: 12),
                            ),
                          )),
                        ],
                      ),
                    )
                  else if (_currentDetection != null)
                    Container(
                      padding: const EdgeInsets.all(12),
                      margin: const EdgeInsets.only(bottom: 20),
                      decoration: BoxDecoration(
                        color: Colors.black54,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.auto_awesome,
                            color: Colors.yellow,
                            size: 20,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'AI detected ${_currentDetection!['label'] ?? _currentDetection!['type'].toString().split('.').last} '
                              '(${(_currentDetection!['confidence'] * 100).toInt()}% confidence)',
                              style: const TextStyle(color: Colors.white, fontSize: 14),
                            ),
                          ),
                        ],
                      ),
                    ),
                  
                  // Capture button
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: [
                      // Gallery button
                      Container(
                        width: 50,
                        height: 50,
                        decoration: BoxDecoration(
                          color: Colors.black54,
                          borderRadius: BorderRadius.circular(25),
                        ),
                        child: const Icon(Icons.photo_library, color: Colors.white),
                      ),
                      
                      // Main capture button
                      GestureDetector(
                        onTap: _isCapturing || _isProcessing ? null : _captureImage,
                        child: Container(
                          width: 80,
                          height: 80,
                          decoration: BoxDecoration(
                            color: _isCapturing || _isProcessing 
                                ? Colors.grey 
                                : Colors.white,
                            borderRadius: BorderRadius.circular(40),
                            border: Border.all(color: Colors.white, width: 4),
                          ),
                          child: _isProcessing
                              ? const CircularProgressIndicator(color: Colors.black)
                              : const Icon(Icons.camera_alt, color: Colors.black, size: 32),
                        ),
                      ),
                      
                      // Settings button
                      Container(
                        width: 50,
                        height: 50,
                        decoration: BoxDecoration(
                          color: Colors.black54,
                          borderRadius: BorderRadius.circular(25),
                        ),
                        child: const Icon(Icons.settings, color: Colors.white),
                      ),
                    ],
                  ),
                  
                  const SizedBox(height: 20),
                  
                  // Instructions
                  const Text(
                    'Point your camera at a civic issue and tap to capture',
                    style: TextStyle(color: Colors.white70, fontSize: 12),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
