import 'package:flutter/material.dart';

/// The theme the student picked: light or dark (there is no "automatic" option).
/// Kept in memory only, like the session: reopening the app starts from the system theme again.
class ThemeController extends ChangeNotifier {
  ThemeController(ThemeMode initial)
    : assert(initial != ThemeMode.system, 'only light or dark'),
      _mode = initial;

  /// Starts from whatever the device is using right now, then stays on the student's choice.
  factory ThemeController.fromSystem() => ThemeController(
    WidgetsBinding.instance.platformDispatcher.platformBrightness ==
            Brightness.dark
        ? ThemeMode.dark
        : ThemeMode.light,
  );

  ThemeMode _mode;

  /// Always [ThemeMode.light] or [ThemeMode.dark].
  ThemeMode get mode => _mode;

  bool get isDark => _mode == ThemeMode.dark;

  /// Flips between light and dark in one step.
  void toggle() => select(isDark ? ThemeMode.light : ThemeMode.dark);

  void select(ThemeMode mode) {
    assert(mode != ThemeMode.system, 'only light or dark');
    if (mode == _mode) return;
    _mode = mode;
    notifyListeners();
  }
}

/// Makes the [ThemeController] reachable from every screen without passing it around.
class ThemeScope extends InheritedNotifier<ThemeController> {
  const ThemeScope({
    super.key,
    required ThemeController controller,
    required super.child,
  }) : super(notifier: controller);

  /// Null when there is no scope (e.g. a screen shown alone in a test): the button hides itself.
  static ThemeController? maybeOf(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<ThemeScope>()?.notifier;
}
