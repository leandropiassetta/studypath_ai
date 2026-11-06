class Student {
  const Student({
    required this.id,
    required this.name,
    this.email,
    this.role = 'student',
  });

  factory Student.fromJson(Map<String, dynamic> json) => Student(
    id: json['id'] as String,
    name: json['name'] as String,
    email: json['email'] as String?,
    role: (json['role'] as String?) ?? 'student',
  );

  final String id;
  final String name;
  final String? email;

  /// `student` or `teacher` (teachers cannot sign up in the app; accounts are created by the school).
  final String role;

  bool get isTeacher => role == 'teacher';
}

/// A login session. Kept in memory only: nothing here is ever written to disk.
class AuthSession {
  const AuthSession({
    required this.token,
    required this.expiresAt,
    required this.student,
  });

  factory AuthSession.fromJson(Map<String, dynamic> json) => AuthSession(
    token: json['token'] as String,
    expiresAt: DateTime.parse(json['expiresAt'] as String),
    student: Student.fromJson(json['student'] as Map<String, dynamic>),
  );

  final String token;
  final DateTime expiresAt;
  final Student student;
}
