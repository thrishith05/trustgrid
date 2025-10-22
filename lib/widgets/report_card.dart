import 'package:flutter/material.dart';
import '../models/civic_issue.dart';

class ReportCard extends StatelessWidget {
  final CivicIssue report;

  const ReportCard({
    super.key,
    required this.report,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header row
            Row(
              children: [
                // Issue type icon
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: _getTypeColor(report.type).withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(
                    _getTypeIcon(report.type),
                    color: _getTypeColor(report.type),
                    size: 20,
                  ),
                ),
                const SizedBox(width: 12),
                
                // Issue details
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        report.typeDisplayName,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        report.address,
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey[600],
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                
                // Status badge
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: _getStatusColor(report.status).withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    report.statusDisplayName,
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w500,
                      color: _getStatusColor(report.status),
                    ),
                  ),
                ),
              ],
            ),
            
            const SizedBox(height: 12),
            
            // Description
            if (report.description != null) ...[
              Text(
                report.description!,
                style: const TextStyle(fontSize: 14),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 12),
            ],
            
            // Footer row
            Row(
              children: [
                // Severity indicator
                Row(
                  children: [
                    Icon(
                      Icons.flag,
                      size: 14,
                      color: _getSeverityColor(report.severity),
                    ),
                    const SizedBox(width: 4),
                    Text(
                      report.severityDisplayName,
                      style: TextStyle(
                        fontSize: 12,
                        color: _getSeverityColor(report.severity),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
                
                const Spacer(),
                
                // Timestamp
                Text(
                  _formatTimestamp(report.timestamp),
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey[500],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Color _getTypeColor(IssueType type) {
    switch (type) {
      case IssueType.pothole:
        return Colors.brown;
      case IssueType.streetlight:
        return Colors.yellow[700]!;
      case IssueType.trash:
        return Colors.green;
      case IssueType.graffiti:
        return Colors.purple;
      case IssueType.damagedSign:
        return Colors.blue;
      case IssueType.brokenSidewalk:
        return Colors.grey;
      case IssueType.waterLeak:
        return Colors.cyan;
      case IssueType.other:
        return Colors.orange;
    }
  }

  IconData _getTypeIcon(IssueType type) {
    switch (type) {
      case IssueType.pothole:
        return Icons.warning;
      case IssueType.streetlight:
        return Icons.lightbulb;
      case IssueType.trash:
        return Icons.delete;
      case IssueType.graffiti:
        return Icons.brush;
      case IssueType.damagedSign:
        return Icons.sign_language;
      case IssueType.brokenSidewalk:
        return Icons.directions_walk;
      case IssueType.waterLeak:
        return Icons.water_drop;
      case IssueType.other:
        return Icons.help;
    }
  }

  Color _getStatusColor(IssueStatus status) {
    switch (status) {
      case IssueStatus.reported:
        return Colors.blue;
      case IssueStatus.acknowledged:
        return Colors.orange;
      case IssueStatus.inProgress:
        return Colors.purple;
      case IssueStatus.resolved:
        return Colors.green;
      case IssueStatus.closed:
        return Colors.grey;
    }
  }

  Color _getSeverityColor(IssueSeverity severity) {
    switch (severity) {
      case IssueSeverity.low:
        return Colors.green;
      case IssueSeverity.medium:
        return Colors.yellow[700]!;
      case IssueSeverity.high:
        return Colors.orange;
      case IssueSeverity.critical:
        return Colors.red;
    }
  }

  String _formatTimestamp(DateTime timestamp) {
    final now = DateTime.now();
    final difference = now.difference(timestamp);

    if (difference.inDays > 0) {
      return '${difference.inDays}d ago';
    } else if (difference.inHours > 0) {
      return '${difference.inHours}h ago';
    } else if (difference.inMinutes > 0) {
      return '${difference.inMinutes}m ago';
    } else {
      return 'Just now';
    }
  }
}
