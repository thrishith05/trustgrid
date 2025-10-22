import 'package:flutter/material.dart';

/// AR Overlay widget for displaying AR guidance
/// This would be enhanced with actual AR rendering in production
class AROverlay extends StatelessWidget {
  final Widget child;
  final bool showGuide;

  const AROverlay({
    super.key,
    required this.child,
    this.showGuide = true,
  });

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        child,
        if (showGuide)
          Positioned(
            top: 100,
            left: 20,
            right: 20,
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.black54,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.auto_awesome,
                    color: Colors.yellow,
                    size: 20,
                  ),
                  const SizedBox(width: 8),
                  const Expanded(
                    child: Text(
                      'AI is scanning for civic issues...',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 14,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}


