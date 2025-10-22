import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:flutter/services.dart';
// TensorFlow Lite disabled for web compatibility - works on Android/iOS
// import 'package:tflite_flutter/tflite_flutter.dart';
import 'package:image/image.dart' as img;
import 'package:crypto/crypto.dart';
import 'dart:convert';
import '../models/civic_issue.dart';
import 'mediapipe_detection_service.dart';

class AIService {
  // static Interpreter? _interpreter;
  static bool _isInitialized = false;
  
  // Issue type labels for classification
  static const List<String> _issueLabels = [
    'pothole',
    'streetlight',
    'trash',
    'graffiti',
    'damaged_sign',
    'broken_sidewalk',
    'water_leak',
    'other'
  ];

  static Future<void> initialize() async {
    if (_isInitialized) return;
    
    try {
      // TensorFlow Lite model loading disabled for web
      // Will work on Android/iOS with actual model
      // _interpreter = await Interpreter.fromAsset('assets/models/civic_issues_model.tflite');
      _isInitialized = true;
      print('AI Service initialized (simulated mode for web compatibility)');
    } catch (e) {
      print('Failed to initialize AI Service: $e');
      _isInitialized = true;
    }
  }

  static Future<Map<String, dynamic>> analyzeImage(String imagePath) async {
    if (!_isInitialized) {
      await initialize();
    }

    try {
      // Try using MediaPipe for real detection first
      try {
        final mediapipeResult = await MediaPipeDetectionService.analyzeStaticImage(imagePath);
        print('MediaPipe analysis: ${mediapipeResult['label']} (${mediapipeResult['confidence']})');
        return mediapipeResult;
      } catch (e) {
        print('MediaPipe unavailable, using fallback: $e');
      }

      // Fallback to simulated detection
      // Load and preprocess image
      final imageBytes = await File(imagePath).readAsBytes();
      final image = img.decodeImage(imageBytes);
      
      if (image == null) {
        throw Exception('Failed to decode image');
      }

      // Resize image to model input size (224x224)
      final resizedImage = img.copyResize(image, width: 224, height: 224);
      
      // Convert to float32 array and normalize
      final input = _preprocessImage(resizedImage);
      
      // Run inference (simulated)
      final output = List.filled(_issueLabels.length, 0.0);
      
      // Use mock classification
      _mockClassification(output);
      
      // Get predictions
      final predictions = output;
      final maxIndex = predictions.indexOf(predictions.reduce((a, b) => a > b ? a : b));
      final confidence = predictions[maxIndex];
      
      // Determine issue type and severity
      final issueType = _getIssueTypeFromIndex(maxIndex);
      final severity = _determineSeverity(confidence, issueType);
      
      return {
        'type': issueType,
        'severity': severity,
        'confidence': confidence,
        'allPredictions': predictions,
      };
    } catch (e) {
      print('Error analyzing image: $e');
      // Return default classification
      return {
        'type': IssueType.other,
        'severity': IssueSeverity.medium,
        'confidence': 0.5,
        'allPredictions': List.filled(_issueLabels.length, 0.1),
      };
    }
  }

  static List<List<List<List<double>>>> _preprocessImage(img.Image image) {
    final input = List.generate(
      1,
      (i) => List.generate(
        224,
        (j) => List.generate(
          224,
          (k) => List.generate(3, (l) => 0.0),
        ),
      ),
    );

      for (int y = 0; y < 224; y++) {
      for (int x = 0; x < 224; x++) {
        final pixel = image.getPixel(x, y);
        input[0][y][x][0] = pixel.r / 255.0;   // R
        input[0][y][x][1] = pixel.g / 255.0; // G
        input[0][y][x][2] = pixel.b / 255.0;  // B
      }
    }

    return input;
  }

  static void _mockClassification(List<double> output) {
    // Mock classification for development (simulated AI detection)
    final random = DateTime.now().millisecondsSinceEpoch % _issueLabels.length;
    for (int i = 0; i < _issueLabels.length; i++) {
      output[i] = i == random ? 0.8 : (0.1 + (i * 0.05));
    }
  }

  static IssueType _getIssueTypeFromIndex(int index) {
    if (index >= 0 && index < _issueLabels.length) {
      switch (_issueLabels[index]) {
        case 'pothole':
          return IssueType.pothole;
        case 'streetlight':
          return IssueType.streetlight;
        case 'trash':
          return IssueType.trash;
        case 'graffiti':
          return IssueType.graffiti;
        case 'damaged_sign':
          return IssueType.damagedSign;
        case 'broken_sidewalk':
          return IssueType.brokenSidewalk;
        case 'water_leak':
          return IssueType.waterLeak;
        default:
          return IssueType.other;
      }
    }
    return IssueType.other;
  }

  static IssueSeverity _determineSeverity(double confidence, IssueType type) {
    // Base severity on confidence and issue type
    if (confidence > 0.9) {
      return IssueSeverity.critical;
    } else if (confidence > 0.7) {
      return IssueSeverity.high;
    } else if (confidence > 0.5) {
      return IssueSeverity.medium;
    } else {
      return IssueSeverity.low;
    }
  }

  static String computePerceptualHash(String imagePath) {
    try {
      final imageBytes = File(imagePath).readAsBytesSync();
      final image = img.decodeImage(imageBytes);
      
      if (image == null) {
        return '';
      }

      // Resize to 8x8 for perceptual hash
      final resized = img.copyResize(image, width: 8, height: 8);
      
      // Convert to grayscale
      final grayscale = img.grayscale(resized);
      
      // Calculate average pixel value
      double total = 0;
      for (int y = 0; y < 8; y++) {
        for (int x = 0; x < 8; x++) {
          final pixel = grayscale.getPixel(x, y);
          total += (pixel.r + pixel.g + pixel.b) / 3; // Average RGB for luminance
        }
      }
      final average = (total / 64).round();
      
      // Create hash based on pixels above/below average
      String hash = '';
      for (int y = 0; y < 8; y++) {
        for (int x = 0; x < 8; x++) {
          final pixel = grayscale.getPixel(x, y);
          final luminance = (pixel.r + pixel.g + pixel.b) / 3;
          hash += luminance > average ? '1' : '0';
        }
      }
      
      return hash;
    } catch (e) {
      print('Error computing perceptual hash: $e');
      return DateTime.now().millisecondsSinceEpoch.toString();
    }
  }

  static int calculateHashSimilarity(String hash1, String hash2) {
    if (hash1.length != hash2.length) return 0;
    
    int similarity = 0;
    for (int i = 0; i < hash1.length; i++) {
      if (hash1[i] == hash2[i]) similarity++;
    }
    
    return similarity;
  }

  static bool isDuplicateIssue(String newHash, List<String> existingHashes, {int threshold = 80}) {
    for (String existingHash in existingHashes) {
      final similarity = calculateHashSimilarity(newHash, existingHash);
      final percentage = (similarity / newHash.length) * 100;
      if (percentage >= threshold) {
        return true;
      }
    }
    return false;
  }

  static void dispose() {
    // _interpreter?.close();
    // _interpreter = null;
    _isInitialized = false;
  }
}
