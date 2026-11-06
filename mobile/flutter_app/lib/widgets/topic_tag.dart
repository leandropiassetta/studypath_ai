import 'package:flutter/material.dart';

import '../utils/contrast.dart';

const List<Color> _palette = [
  Color(0xFF3F51B5), // indigo
  Color(0xFF00897B), // teal
  Color(0xFFEF6C00), // orange
  Color(0xFF8E24AA), // purple
  Color(0xFFC62828), // red
  Color(0xFF2E7D32), // green
  Color(0xFF6D4C41), // brown
  Color(0xFFC2185B), // pink
  Color(0xFF0277BD), // blue
  Color(0xFF827717), // olive
];

/// The known subjects each keep their own color; anything else falls back to the name hash below.
const Map<String, int> _subjectColor = {
  'Equações': 2, // orange
  'Geometria': 1, // teal
  'Geografia do Brasil': 5, // green
  'Geografia Mundial': 8, // blue
  'História do Brasil': 3, // purple
  'História Geral': 7, // pink
  'Vocabulário': 0, // indigo
  'Gramática': 4, // red
  'Biologia': 9, // olive
  'Física e Química': 6, // brown
};

/// Stable color per topic name (same topic, same color, on every screen and run).
Color topicColor(String name) {
  final fixed = _subjectColor[name];
  if (fixed != null) return _palette[fixed];
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
