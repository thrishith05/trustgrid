import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:camera/camera.dart';
import 'package:google_mlkit_object_detection/google_mlkit_object_detection.dart';
import 'package:google_mlkit_image_labeling/google_mlkit_image_labeling.dart';
import 'package:image/image.dart' as img;
import '../models/civic_issue.dart';

class DetectedIssue {
  final IssueType type;
  final IssueSeverity severity;
  final double confidence;
  final Rect boundingBox;
  final String label;

  DetectedIssue({
    required this.type,
    required this.severity,
    required this.confidence,
    required this.boundingBox,
    required this.label,
  });
}

class MediaPipeDetectionService {
  static ObjectDetector? _objectDetector;
  static ImageLabeler? _imageLabeler;
  static bool _isInitialized = false;

  // Enhanced civic issue keywords mapping with priorities
  static const Map<String, IssueType> _issueKeywords = {
    // Infrastructure - Roads (high priority)
    'pothole': IssueType.pothole,
    'hole': IssueType.pothole,
    'crack': IssueType.pothole,
    'damaged road': IssueType.pothole,
    'road damage': IssueType.pothole,
    'asphalt': IssueType.pothole,
    'concrete': IssueType.pothole,
    
    // Infrastructure - Sidewalks
    'pavement': IssueType.brokenSidewalk,
    'sidewalk': IssueType.brokenSidewalk,
    'pathway': IssueType.brokenSidewalk,
    'walkway': IssueType.brokenSidewalk,
    'footpath': IssueType.brokenSidewalk,
    
    // Utilities - Lighting
    'street light': IssueType.streetlight,
    'streetlight': IssueType.streetlight,
    'light': IssueType.streetlight,
    'lamp': IssueType.streetlight,
    'lamppost': IssueType.streetlight,
    'pole': IssueType.streetlight,
    'lighting': IssueType.streetlight,
    
    // Waste Management
    'trash': IssueType.trash,
    'garbage': IssueType.trash,
    'waste': IssueType.trash,
    'rubbish': IssueType.trash,
    'bin': IssueType.trash,
    'litter': IssueType.trash,
    'debris': IssueType.trash,
    'dump': IssueType.trash,
    'plastic': IssueType.trash,
    'bottle': IssueType.trash,
    'bag': IssueType.trash,
    
    // Vandalism
    'graffiti': IssueType.graffiti,
    'vandalism': IssueType.graffiti,
    'paint': IssueType.graffiti,
    'spray': IssueType.graffiti,
    'writing': IssueType.graffiti,
    'wall art': IssueType.graffiti,
    
    // Signs
    'sign': IssueType.damagedSign,
    'signage': IssueType.damagedSign,
    'signboard': IssueType.damagedSign,
    'board': IssueType.damagedSign,
    'traffic sign': IssueType.damagedSign,
    'stop sign': IssueType.damagedSign,
    
    // Water Issues
    'water': IssueType.waterLeak,
    'leak': IssueType.waterLeak,
    'pipe': IssueType.waterLeak,
    'flood': IssueType.waterLeak,
    'puddle': IssueType.waterLeak,
    'drain': IssueType.waterLeak,
    'sewer': IssueType.waterLeak,
  };

  static Future<void> initialize() async {
    if (_isInitialized) return;

    try {
      // Initialize object detector
      final options = ObjectDetectorOptions(
        mode: DetectionMode.stream,
        classifyObjects: true,
        multipleObjects: true,
      );
      _objectDetector = ObjectDetector(options: options);

      // Initialize image labeler for classification with lower threshold
      final labelerOptions = ImageLabelerOptions(
        confidenceThreshold: 0.3, // Lower threshold to detect more labels
      );
      _imageLabeler = ImageLabeler(options: labelerOptions);

      _isInitialized = true;
      print('MediaPipe Detection Service initialized successfully');
    } catch (e) {
      print('Failed to initialize MediaPipe: $e');
      _isInitialized = false;
    }
  }

  /// Process camera image for real-time detection
  static Future<List<DetectedIssue>> processCameraImage(CameraImage cameraImage) async {
    if (!_isInitialized) {
      await initialize();
    }

    if (_objectDetector == null || _imageLabeler == null) {
      return [];
    }

    try {
      // Convert CameraImage to InputImage
      final inputImage = _convertCameraImage(cameraImage);
      if (inputImage == null) return [];

      // Detect objects
      final objects = await _objectDetector!.processImage(inputImage);
      
      // Get image labels
      final labels = await _imageLabeler!.processImage(inputImage);

      // Convert to civic issues
      final detectedIssues = <DetectedIssue>[];

      // Process detected objects
      for (final object in objects) {
        for (final label in object.labels) {
          final issueType = _classifyAsCivicIssue(label.text.toLowerCase());
          if (issueType != null) {
            final severity = _determineSeverity(label.confidence);
            
            detectedIssues.add(DetectedIssue(
              type: issueType,
              severity: severity,
              confidence: label.confidence,
              boundingBox: object.boundingBox,
              label: label.text,
            ));
          }
        }
      }

      // Also check image labels
      for (final label in labels) {
        final issueType = _classifyAsCivicIssue(label.label.toLowerCase());
        if (issueType != null && !_isDuplicate(detectedIssues, issueType)) {
          final severity = _determineSeverity(label.confidence);
          
          detectedIssues.add(DetectedIssue(
            type: issueType,
            severity: severity,
            confidence: label.confidence,
            boundingBox: const Rect.fromLTWH(0, 0, 100, 100), // Full frame
            label: label.label,
          ));
        }
      }

      return detectedIssues;
    } catch (e) {
      print('Error processing camera image: $e');
      return [];
    }
  }

  /// Process static image file for classification with enhanced detection
  static Future<Map<String, dynamic>> analyzeStaticImage(String imagePath) async {
    if (!_isInitialized) {
      await initialize();
    }

    try {
      final inputImage = InputImage.fromFilePath(imagePath);
      
      // Get ML Kit labels
      final labels = await _imageLabeler!.processImage(inputImage);
      
      print('ML Kit detected ${labels.length} labels:');
      for (var label in labels.take(10)) {
        print('  - ${label.label}: ${(label.confidence * 100).toStringAsFixed(1)}%');
      }
      
      // Smart detection: combine multiple labels for better accuracy
      Map<IssueType, double> issueScores = {};
      Map<IssueType, List<String>> matchedLabels = {};
      
      for (final label in labels) {
        final labelText = label.label.toLowerCase();
        final issueType = _classifyAsCivicIssue(labelText);
        
        if (issueType != null) {
          // Accumulate scores for each issue type
          issueScores[issueType] = (issueScores[issueType] ?? 0.0) + label.confidence;
          matchedLabels.putIfAbsent(issueType, () => []).add(label.label);
          print('  ✓ Matched: ${label.label} → ${issueType.toString().split('.').last}');
        }
      }
      
      // Contextual analysis - look for related labels
      issueScores = _enhanceScoresWithContext(labels, issueScores);
      
      // Find best match
      IssueType? detectedType;
      double maxScore = 0.0;
      List<String> detectedLabels = [];
      
      if (issueScores.isNotEmpty) {
        issueScores.forEach((type, score) {
          if (score > maxScore) {
            maxScore = score;
            detectedType = type;
            detectedLabels = matchedLabels[type] ?? [];
          }
        });
      }
      
      // Set confidence based on score and number of matching labels
      double confidence = maxScore;
      if (detectedLabels.length > 1) {
        confidence = (confidence * 1.2).clamp(0.0, 1.0); // Boost for multiple matches
      }
      
      // Use intelligent defaults if nothing detected
      if (detectedType == null) {
        detectedType = _intelligentFallback(labels);
        confidence = 0.6;
        detectedLabels = ['Contextual detection'];
      }

      final severity = _determineSeverity(confidence);
      final labelString = detectedLabels.join(', ');

      print('Final detection: ${detectedType.toString().split('.').last} (${(confidence * 100).toStringAsFixed(1)}%)');

      return {
        'type': detectedType,
        'severity': severity,
        'confidence': confidence,
        'label': labelString.isNotEmpty ? labelString : 'Civic Issue',
        'allLabels': labels.take(10).map((l) => {
          'label': l.label,
          'confidence': l.confidence,
        }).toList(),
      };
    } catch (e) {
      print('Error analyzing static image: $e');
      return {
        'type': IssueType.other,
        'severity': IssueSeverity.medium,
        'confidence': 0.5,
        'label': 'Unidentified Issue',
        'allLabels': [],
      };
    }
  }
  
  /// Enhance scores based on contextual labels
  static Map<IssueType, double> _enhanceScoresWithContext(
    List<ImageLabel> labels, 
    Map<IssueType, double> currentScores
  ) {
    final scores = Map<IssueType, double>.from(currentScores);
    final labelTexts = labels.map((l) => l.label.toLowerCase()).toList();
    
    // Road/asphalt + damage indicators = likely pothole
    if (_hasAny(labelTexts, ['road', 'asphalt', 'street', 'pavement']) &&
        _hasAny(labelTexts, ['crack', 'hole', 'damage', 'broken', 'rough'])) {
      scores[IssueType.pothole] = (scores[IssueType.pothole] ?? 0.0) + 0.3;
    }
    
    // Outdoor + trash/waste indicators
    if (_hasAny(labelTexts, ['outdoor', 'street', 'public']) &&
        _hasAny(labelTexts, ['plastic', 'bottle', 'bag', 'container', 'packaging'])) {
      scores[IssueType.trash] = (scores[IssueType.trash] ?? 0.0) + 0.25;
    }
    
    // Wall + colorful = possible graffiti
    if (_hasAny(labelTexts, ['wall', 'building', 'surface']) &&
        _hasAny(labelTexts, ['art', 'paint', 'colorful', 'text', 'writing'])) {
      scores[IssueType.graffiti] = (scores[IssueType.graffiti] ?? 0.0) + 0.25;
    }
    
    // Night + light/pole = streetlight issue
    if (_hasAny(labelTexts, ['night', 'dark', 'evening']) &&
        _hasAny(labelTexts, ['pole', 'light', 'lamp'])) {
      scores[IssueType.streetlight] = (scores[IssueType.streetlight] ?? 0.0) + 0.3;
    }
    
    return scores;
  }
  
  static bool _hasAny(List<String> labels, List<String> keywords) {
    return labels.any((label) => keywords.any((keyword) => label.contains(keyword)));
  }
  
  /// Intelligent fallback based on common outdoor/infrastructure labels
  static IssueType _intelligentFallback(List<ImageLabel> labels) {
    final labelTexts = labels.map((l) => l.label.toLowerCase()).toList();
    
    print('Intelligent fallback analyzing labels: ${labelTexts.take(5).join(", ")}');
    
    // Check for outdoor infrastructure context (expanded detection)
    if (_hasAny(labelTexts, ['road', 'street', 'asphalt', 'highway', 'lane', 'path'])) {
      print('  → Detected road context, classifying as pothole');
      return IssueType.pothole; // Road-related
    }
    if (_hasAny(labelTexts, ['sidewalk', 'pavement', 'walkway', 'footpath', 'concrete'])) {
      print('  → Detected sidewalk context');
      return IssueType.brokenSidewalk;
    }
    if (_hasAny(labelTexts, ['trash', 'garbage', 'waste', 'litter', 'debris'])) {
      print('  → Detected waste materials');
      return IssueType.trash;
    }
    // Look for common trash items
    if (_hasAny(labelTexts, ['bottle', 'plastic', 'bag', 'container', 'wrapper', 'can'])) {
      print('  → Detected trash items');
      return IssueType.trash;
    }
    if (_hasAny(labelTexts, ['outdoor', 'public', 'urban', 'street']) && 
        _hasAny(labelTexts, ['object', 'item', 'thing', 'material'])) {
      print('  → Generic outdoor object, likely trash');
      return IssueType.trash; // Generic outdoor object = likely trash
    }
    if (_hasAny(labelTexts, ['wall', 'building', 'surface']) && 
        _hasAny(labelTexts, ['color', 'paint', 'art', 'text'])) {
      print('  → Wall with markings, possible graffiti');
      return IssueType.graffiti;
    }
    if (_hasAny(labelTexts, ['night', 'dark', 'evening']) || 
        _hasAny(labelTexts, ['light', 'lighting', 'lamp', 'pole'])) {
      print('  → Lighting related');
      return IssueType.streetlight;
    }
    if (_hasAny(labelTexts, ['sign', 'signage', 'board', 'signpost'])) {
      print('  → Sign detected');
      return IssueType.damagedSign;
    }
    if (_hasAny(labelTexts, ['water', 'wet', 'liquid', 'puddle', 'flood'])) {
      print('  → Water related issue');
      return IssueType.waterLeak;
    }
    
    // If outdoor/urban context, default to infrastructure issue
    if (_hasAny(labelTexts, ['outdoor', 'outside', 'urban', 'city', 'public'])) {
      print('  → Outdoor context detected, defaulting to pothole');
      return IssueType.pothole;
    }
    
    print('  → No specific context found');
    return IssueType.other;
  }

  static InputImage? _convertCameraImage(CameraImage cameraImage) {
    try {
      // Determine image format based on platform
      InputImageFormat? inputImageFormat;
      
      if (Platform.isAndroid) {
        inputImageFormat = InputImageFormat.nv21;
      } else if (Platform.isIOS) {
        inputImageFormat = InputImageFormat.bgra8888;
      } else {
        return null;
      }

      // Build the byte buffer properly without extra padding
      final int width = cameraImage.width;
      final int height = cameraImage.height;
      
      // For NV21: Y plane + UV plane
      // Expected size: width * height * 1.5 (Y is full size, UV is half)
      final WriteBuffer buffer = WriteBuffer();
      
      // Add Y plane (first plane)
      final yPlane = cameraImage.planes[0];
      final int yRowStride = yPlane.bytesPerRow;
      
      for (int y = 0; y < height; y++) {
        final int offset = y * yRowStride;
        buffer.putUint8List(yPlane.bytes.sublist(offset, offset + width));
      }
      
      // Add UV plane (second and third planes combined, or second plane if interleaved)
      if (cameraImage.planes.length > 1) {
        final uvPlane = cameraImage.planes[1];
        final int uvRowStride = uvPlane.bytesPerRow;
        final int uvHeight = height ~/ 2;
        
        for (int y = 0; y < uvHeight; y++) {
          final int offset = y * uvRowStride;
          buffer.putUint8List(uvPlane.bytes.sublist(offset, offset + width));
        }
      }
      
      final bytes = buffer.done().buffer.asUint8List();

      // Rotation is typically 90 degrees on mobile, but start with 0 for testing
      final InputImageRotation imageRotation = InputImageRotation.rotation0deg;

      final metadata = InputImageMetadata(
        size: Size(width.toDouble(), height.toDouble()),
        rotation: imageRotation,
        format: inputImageFormat,
        bytesPerRow: width, // Use actual width, not bytesPerRow with padding
      );

      return InputImage.fromBytes(
        bytes: bytes,
        metadata: metadata,
      );
    } catch (e) {
      print('Error converting camera image: $e');
      print('Image details - Width: ${cameraImage.width}, Height: ${cameraImage.height}, Planes: ${cameraImage.planes.length}');
      return null;
    }
  }

  static IssueType? _classifyAsCivicIssue(String label) {
    // Check for keyword matches
    for (final entry in _issueKeywords.entries) {
      if (label.contains(entry.key)) {
        return entry.value;
      }
    }
    return null;
  }

  static bool _isDuplicate(List<DetectedIssue> issues, IssueType type) {
    return issues.any((issue) => issue.type == type);
  }

  static IssueSeverity _determineSeverity(double confidence) {
    if (confidence >= 0.9) {
      return IssueSeverity.critical;
    } else if (confidence >= 0.75) {
      return IssueSeverity.high;
    } else if (confidence >= 0.6) {
      return IssueSeverity.medium;
    } else {
      return IssueSeverity.low;
    }
  }

  static Future<void> dispose() async {
    await _objectDetector?.close();
    await _imageLabeler?.close();
    _objectDetector = null;
    _imageLabeler = null;
    _isInitialized = false;
  }
}

// Helper class for camera image conversion
class WriteBuffer {
  final List<int> _buffer = [];

  void putUint8List(List<int> list) {
    _buffer.addAll(list);
  }

  ByteData done() {
    final byteData = ByteData.view(Uint8List.fromList(_buffer).buffer);
    return byteData;
  }
}

