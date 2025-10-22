import 'package:flutter/material.dart';
import '../models/civic_issue.dart';
import '../services/mediapipe_detection_service.dart';

class RealtimeAROverlay extends StatelessWidget {
  final List<DetectedIssue> detections;
  final VoidCallback onTap;

  const RealtimeAROverlay({
    super.key,
    required this.detections,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    if (detections.isEmpty) {
      return const SizedBox.shrink();
    }

    return Positioned.fill(
      child: GestureDetector(
        onTap: onTap,
        child: CustomPaint(
          painter: RealtimeARPainter(
            detections: detections,
          ),
          child: Container(),
        ),
      ),
    );
  }
}

class RealtimeARPainter extends CustomPainter {
  final List<DetectedIssue> detections;

  RealtimeARPainter({
    required this.detections,
  });

  @override
  void paint(Canvas canvas, Size size) {
    for (final detection in detections) {
      _drawDetection(canvas, size, detection);
    }

    // Draw detection count
    if (detections.isNotEmpty) {
      _drawDetectionCount(canvas, size);
    }
  }

  void _drawDetection(Canvas canvas, Size size, DetectedIssue detection) {
    final color = _getSeverityColor(detection.severity);
    
    // Scale bounding box to screen size
    final scaledBox = Rect.fromLTWH(
      detection.boundingBox.left * size.width / 1000,
      detection.boundingBox.top * size.height / 1000,
      detection.boundingBox.width * size.width / 1000,
      detection.boundingBox.height * size.height / 1000,
    );

    // Draw bounding box with glow effect
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3.0;

    final fillPaint = Paint()
      ..color = color.withValues(alpha: 0.2)
      ..style = PaintingStyle.fill;

    // Draw filled box
    canvas.drawRect(scaledBox, fillPaint);
    
    // Draw border
    canvas.drawRect(scaledBox, paint);

    // Draw corner markers
    _drawCornerMarkers(canvas, scaledBox, color);

    // Draw label
    _drawLabel(canvas, scaledBox, detection);

    // Draw confidence indicator
    _drawConfidenceBar(canvas, scaledBox, detection.confidence, color);
  }

  void _drawCornerMarkers(Canvas canvas, Rect rect, Color color) {
    final markerPaint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 4.0;

    final markerLength = 20.0;

    // Top-left
    canvas.drawLine(
      Offset(rect.left, rect.top),
      Offset(rect.left + markerLength, rect.top),
      markerPaint,
    );
    canvas.drawLine(
      Offset(rect.left, rect.top),
      Offset(rect.left, rect.top + markerLength),
      markerPaint,
    );

    // Top-right
    canvas.drawLine(
      Offset(rect.right, rect.top),
      Offset(rect.right - markerLength, rect.top),
      markerPaint,
    );
    canvas.drawLine(
      Offset(rect.right, rect.top),
      Offset(rect.right, rect.top + markerLength),
      markerPaint,
    );

    // Bottom-left
    canvas.drawLine(
      Offset(rect.left, rect.bottom),
      Offset(rect.left + markerLength, rect.bottom),
      markerPaint,
    );
    canvas.drawLine(
      Offset(rect.left, rect.bottom),
      Offset(rect.left, rect.bottom - markerLength),
      markerPaint,
    );

    // Bottom-right
    canvas.drawLine(
      Offset(rect.right, rect.bottom),
      Offset(rect.right - markerLength, rect.bottom),
      markerPaint,
    );
    canvas.drawLine(
      Offset(rect.right, rect.bottom),
      Offset(rect.right, rect.bottom - markerLength),
      markerPaint,
    );
  }

  void _drawLabel(Canvas canvas, Rect rect, DetectedIssue detection) {
    final textPainter = TextPainter(
      text: TextSpan(
        text: '${detection.label}\n${(detection.confidence * 100).toInt()}%',
        style: const TextStyle(
          color: Colors.white,
          fontSize: 14,
          fontWeight: FontWeight.bold,
          shadows: [
            Shadow(
              blurRadius: 3.0,
              color: Colors.black,
              offset: Offset(1.0, 1.0),
            ),
          ],
        ),
      ),
      textDirection: TextDirection.ltr,
      textAlign: TextAlign.center,
    );

    textPainter.layout();

    final labelRect = Rect.fromLTWH(
      rect.left,
      rect.top - textPainter.height - 12,
      textPainter.width + 20,
      textPainter.height + 12,
    );

    // Draw label background
    final labelPaint = Paint()
      ..color = _getSeverityColor(detection.severity).withValues(alpha: 0.9)
      ..style = PaintingStyle.fill;

    canvas.drawRRect(
      RRect.fromRectAndRadius(labelRect, const Radius.circular(6)),
      labelPaint,
    );

    // Draw label text
    textPainter.paint(
      canvas,
      Offset(labelRect.left + 10, labelRect.top + 6),
    );
  }

  void _drawConfidenceBar(Canvas canvas, Rect rect, double confidence, Color color) {
    final barWidth = rect.width * 0.8;
    final barHeight = 4.0;
    final barX = rect.left + (rect.width - barWidth) / 2;
    final barY = rect.bottom + 8;

    // Background bar
    final bgPaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.3)
      ..style = PaintingStyle.fill;

    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(barX, barY, barWidth, barHeight),
        const Radius.circular(2),
      ),
      bgPaint,
    );

    // Confidence bar
    final confidencePaint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;

    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(barX, barY, barWidth * confidence, barHeight),
        const Radius.circular(2),
      ),
      confidencePaint,
    );
  }

  void _drawDetectionCount(Canvas canvas, Size size) {
    final textPainter = TextPainter(
      text: TextSpan(
        text: '${detections.length} issue${detections.length > 1 ? 's' : ''} detected',
        style: const TextStyle(
          color: Colors.white,
          fontSize: 16,
          fontWeight: FontWeight.bold,
          shadows: [
            Shadow(
              blurRadius: 4.0,
              color: Colors.black,
              offset: Offset(1.0, 1.0),
            ),
          ],
        ),
      ),
      textDirection: TextDirection.ltr,
    );

    textPainter.layout();

    final rect = Rect.fromLTWH(
      (size.width - textPainter.width - 20) / 2,
      20,
      textPainter.width + 20,
      textPainter.height + 12,
    );

    // Draw background
    final bgPaint = Paint()
      ..color = Colors.black.withValues(alpha: 0.7)
      ..style = PaintingStyle.fill;

    canvas.drawRRect(
      RRect.fromRectAndRadius(rect, const Radius.circular(20)),
      bgPaint,
    );

    // Draw text
    textPainter.paint(
      canvas,
      Offset(rect.left + 10, rect.top + 6),
    );
  }

  Color _getSeverityColor(IssueSeverity severity) {
    switch (severity) {
      case IssueSeverity.low:
        return Colors.green;
      case IssueSeverity.medium:
        return Colors.yellow;
      case IssueSeverity.high:
        return Colors.orange;
      case IssueSeverity.critical:
        return Colors.red;
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) {
    return true;
  }
}

