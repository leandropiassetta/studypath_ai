/// "1 tentativa", "2 tentativas": picks the singular only for exactly one.
String plural(int count, String singular, String plural) =>
    '$count ${count == 1 ? singular : plural}';
