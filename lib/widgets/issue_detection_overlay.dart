import 'package:flutter/material.dart';
import '../models/civic_issue.dart';

class IssueDetectionOverlay extends StatelessWidget {
  final Map<String, dynamic> detection;
  final VoidCallback onTap;

  const IssueDetectionOverlay({
    super.key,
    required this.detection,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final boundingBox = detection['boundingBox'] as Rect?;
    final confidence = detection['confidence'] as double;
    final issueType = detection['type'] as IssueType;
    final severity = detection['severity'] as IssueSeverity;

    if (boundingBox == null) {
      return const SizedBox.shrink();
    }

    return Positioned.fill(
      child: GestureDetector(
        onTap: onTap,
        child: CustomPaint(
          painter: IssueDetectionPainter(
            boundingBox: boundingBox,
            confidence: confidence,
            issueType: issueType,
            severity: severity,
          ),
          child: Container(),
        ),
      ),
    );
  }
}

class IssueDetectionPainter extends CustomPainter {
  final Rect boundingBox;
  final double confidence;
  final IssueType issueType;
  final IssueSeverity severity;

  IssueDetectionPainter({
    required this.boundingBox,
    required this.confidence,
    required this.issueType,
    required this.severity,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = _getSeverityColor(severity)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3.0;

    final fillPaint = Paint()
      ..color = _getSeverityColor(severity).withOpacity(0.2)
      ..style = PaintingStyle.fill;

    // Draw bounding box
    canvas.drawRect(boundingBox, fillPaint);
    canvas.drawRect(boundingBox, paint);

    // Draw corner indicators
    _drawCornerIndicators(canvas, boundingBox, _getSeverityColor(severity));

    // Draw label
    _drawLabel(canvas, boundingBox, size);
  }

  void _drawCornerIndicators(Canvas canvas, Rect rect, Color color) {
    final cornerPaint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;

    final cornerSize = 20.0;
    final strokePaint = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.0;

    // Top-left corner
    canvas.drawRect(
      Rect.fromLTWH(rect.left - 2, rect.top - 2, cornerSize, 4),
      cornerPaint,
    );
    canvas.drawRect(
      Rect.fromLTWH(rect.left - 2, rect.top - 2, 4, cornerSize),
      cornerPaint,
    );

    // Top-right corner
    canvas.drawRect(
      Rect.fromLTWH(rect.right - cornerSize + 2, rect.top - 2, cornerSize, 4),
      cornerPaint,
    );
    canvas.drawRect(
      Rect.fromLTWH(rect.right - 2, rect.top - 2, 4, cornerSize),
      cornerPaint,
    );

    // Bottom-left corner
    canvas.drawRect(
      Rect.fromLTWH(rect.left - 2, rect.bottom - 2, cornerSize, 4),
      cornerPaint,
    );
    canvas.drawRect(
      Rect.fromLTWH(rect.left - 2, rect.bottom - cornerSize + 2, 4, cornerSize),
      cornerPaint,
    );

    // Bottom-right corner
    canvas.drawRect(
      Rect.fromLTWH(rect.right - cornerSize + 2, rect.bottom - 2, cornerSize, 4),
      cornerPaint,
    );
    canvas.drawRect(
      Rect.fromLTWH(rect.right - 2, rect.bottom - cornerSize + 2, 4, cornerSize),
      cornerPaint,
    );
  }

  void _drawLabel(Canvas canvas, Rect rect, Size size) {
    final textPainter = TextPainter(
      text: TextSpan(
        text: '${issueType.toString().split('.').last}\n${(confidence * 100).toInt()}%',
        style: const TextStyle(
          color: Colors.white,
          fontSize: 14,
          fontWeight: FontWeight.bold,
        ),
      ),
      textDirection: TextDirection.ltr,
    );

    textPainter.layout();

    final labelRect = Rect.fromLTWH(
      rect.left,
      rect.top - textPainter.height - 8,
      textPainter.width + 16,
      textPainter.height + 8,
    );

    // Draw label background
    final labelPaint = Paint()
      ..color = _getSeverityColor(severity)
      ..style = PaintingStyle.fill;

    canvas.drawRRect(
      RRect.fromRectAndRadius(labelRect, const Radius.circular(4)),
      labelPaint,
    );

    // Draw label text
    textPainter.paint(
      canvas,
      Offset(labelRect.left + 8, labelRect.top + 4),
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
