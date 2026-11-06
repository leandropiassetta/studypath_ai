import 'dart:math' as math;

import 'package:flutter/material.dart';

/// WCAG contrast ratio between two opaque colors (1 to 21).
double contrastRatio(Color a, Color b) {
  final la = a.computeLuminance();
  final lb = b.computeLuminance();
  return (math.max(la, lb) + 0.05) / (math.min(la, lb) + 0.05);
}

/// Returns [foreground], or the closest lightness shift of it that reaches [minRatio] against
/// [background]: darker on light backgrounds, lighter on dark ones (4.5 is WCAG AA for text).
Color ensureContrast(
  Color foreground,
  Color background, {
  double minRatio = 4.5,
}) {
  if (contrastRatio(foreground, background) >= minRatio) return foreground;
  final hsl = HSLColor.fromColor(foreground);
  final darkBackground = background.computeLuminance() < 0.5;
  for (var step = 1; step <= 50; step++) {
    final lightness = (hsl.lightness + (darkBackground ? 1 : -1) * step * 0.02)
        .clamp(0.0, 1.0);
    final candidate = hsl.withLightness(lightness).toColor();
    if (contrastRatio(candidate, background) >= minRatio) return candidate;
  }
  return darkBackground ? Colors.white : Colors.black;
}
