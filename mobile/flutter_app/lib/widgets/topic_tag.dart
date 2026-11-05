import 'package:flutter/material.dart';

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

/// Small colored tag with the topic of a question.
class TopicTag extends StatelessWidget {
  const TopicTag({super.key, required this.name});

  final String name;

  @override
  Widget build(BuildContext context) {
    final color = topicColor(name);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        border: Border.all(color: color.withValues(alpha: 0.6)),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
        child: Text(
          name,
          style: TextStyle(
            color: color,
            fontSize: 12,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}
