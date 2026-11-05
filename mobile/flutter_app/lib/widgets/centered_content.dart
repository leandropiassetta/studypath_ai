import 'package:flutter/material.dart';

/// Keeps content readable on wide windows (e.g. Flutter web) by capping its width.
class CenteredContent extends StatelessWidget {
  const CenteredContent({super.key, required this.child});

  static const double maxWidth = 720;

  final Widget child;

  @override
  Widget build(BuildContext context) => Align(
    alignment: Alignment.topCenter,
    child: ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: maxWidth),
      child: child,
    ),
  );
}
