import 'package:flutter/material.dart';

import '../utils/contrast.dart';

const List<Color> _palette = [
  Color(0xFF3F51B5), // indigo
  Color(0xFF00897B), // teal
  Color(0xFFEF6C00), // orange
  Color(0xFF8E24AA), // purple
  Color(0xFFC62828), // red
  Color(0xFF2E7D32), // green
];

/// Stable color per topic name (same topic, same color, on every screen and run).
Color topicColor(String name) {
  var sum = 0;
  for (final unit in name.codeUnits) {
    sum += unit;
  }
  return _palette[sum % _palette.length];
}

/// Background tint and text color of a tag on [surface], with text contrast of at least 4.5:1.
({Color background, Color foreground}) topicTagColors(
  String name,
  Color surface,
) {
  final base = topicColor(name);
  final background = Color.alphaBlend(base.withValues(alpha: 0.14), surface);
  return (background: background, foreground: ensureContrast(base, background));
}

/// Small colored tag with the topic of a question.
class TopicTag extends StatelessWidget {
  const TopicTag({super.key, required this.name});

  final String name;

  @override
  Widget build(BuildContext context) {
    final colors = topicTagColors(name, Theme.of(context).colorScheme.surface);
    return Semantics(
      label: 'Assunto: $name',
      excludeSemantics: true,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: colors.background,
          border: Border.all(color: colors.foreground.withValues(alpha: 0.6)),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
          child: Text(
            name,
            style: TextStyle(
              color: colors.foreground,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ),
    );
  }
}
