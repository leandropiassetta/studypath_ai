import 'package:flutter/material.dart';

import '../services/theme_controller.dart';

/// One tap switches the theme. The icon shows where the tap goes: the moon while the app is
/// light (tap for dark) and the sun while it is dark (tap for light). Hidden without a [ThemeScope].
class ThemeModeButton extends StatelessWidget {
  const ThemeModeButton({super.key});

  @override
  Widget build(BuildContext context) {
    final controller = ThemeScope.maybeOf(context);
    if (controller == null) return const SizedBox.shrink();
    final dark = controller.isDark;
    return IconButton(
      key: const Key('theme-button'),
      tooltip: dark ? 'Mudar para o tema claro' : 'Mudar para o tema escuro',
      icon: Icon(dark ? Icons.light_mode : Icons.dark_mode),
      onPressed: controller.toggle,
    );
  }
}
