// -----------------------------------------------------------------------------
// Texts of the integration, in English, French, German and Spanish (English
// fallback).
//
// The manifest carries its own labels; these are the texts the code writes at
// runtime: connection statuses, the results of the buttons, the widget.
// German says "du", Spanish "usted", like Gladys. Voice and family names are
// never translated.
// -----------------------------------------------------------------------------

const LANGUAGES = ['en', 'fr', 'de', 'es'];

const TEXTS = {
  // connection status and buttons
  statusNoKey: {
    en: 'No Gemini API key: create one in Google AI Studio (Get API key) and paste it in the configuration.',
    fr: 'Pas de clé d’API Gemini : créez-en une dans Google AI Studio (Get API key) et collez-la dans la configuration.',
    de: 'Kein Gemini-API-Schlüssel: Erstelle einen in Google AI Studio (Get API key) und füge ihn in die Konfiguration ein.',
    es: 'No hay clave de API de Gemini: cree una en Google AI Studio (Get API key) y péguela en la configuración.',
  },
  statusBadKey: {
    en: 'Google refused the API key: check it, that its restrictions allow the Gemini API, and that the Gemini API is offered in your country.',
    fr: 'Google a refusé la clé d’API : vérifiez-la, que ses restrictions autorisent l’API Gemini, et que l’API Gemini est proposée dans votre pays.',
    de: 'Google hat den API-Schlüssel abgelehnt: Prüfe ihn, ob seine Einschränkungen die Gemini API erlauben und ob die Gemini API in deinem Land angeboten wird.',
    es: 'Google ha rechazado la clave de API: compruébela, que sus restricciones permitan la API de Gemini, y que la API de Gemini se ofrezca en su país.',
  },
  statusDisabled: {
    en: 'The Gemini API (Generative Language API) is not enabled on the project of this key: enable it, or create the key in Google AI Studio.',
    fr: 'L’API Gemini (Generative Language API) n’est pas activée sur le projet de cette clé : activez-la, ou créez la clé dans Google AI Studio.',
    de: 'Die Gemini API (Generative Language API) ist im Projekt dieses Schlüssels nicht aktiviert: Aktiviere sie oder erstelle den Schlüssel in Google AI Studio.',
    es: 'La API de Gemini (Generative Language API) no está habilitada en el proyecto de esta clave: habilítela, o cree la clave en Google AI Studio.',
  },
  statusBilling: {
    en: 'Google refuses for billing: prepaid credit used up or billing not set up on the project of this key. Add credit in Google AI Studio, or choose the free tier.',
    fr: 'Google refuse pour une raison de facturation : crédit prépayé épuisé ou facturation non configurée sur le projet de cette clé. Ajoutez du crédit dans Google AI Studio, ou choisissez l’offre gratuite.',
    de: 'Google lehnt wegen der Abrechnung ab: Guthaben aufgebraucht oder Abrechnung im Projekt dieses Schlüssels nicht eingerichtet. Lade Guthaben in Google AI Studio auf oder nutze die kostenlose Stufe.',
    es: 'Google lo rechaza por la facturación: crédito prepago agotado o facturación no configurada en el proyecto de esta clave. Añada crédito en Google AI Studio, o elija el nivel gratuito.',
  },
  statusQuota: {
    en: 'Daily quota of the Gemini API reached (free tier): speech comes back tomorrow. The clip cache keeps repeated sentences free.',
    fr: 'Quota quotidien de l’API Gemini atteint (offre gratuite) : la voix revient demain. Le cache des clips garde les phrases répétées gratuites.',
    de: 'Tageskontingent der Gemini API erreicht (kostenlose Stufe): Die Stimme kommt morgen zurück. Der Clip-Cache hält wiederholte Sätze kostenlos.',
    es: 'Se ha alcanzado la cuota diaria de la API de Gemini (nivel gratuito): la voz vuelve mañana. La caché de clips mantiene gratis las frases repetidas.',
  },
  statusModel: {
    en: 'Google does not know the model {model}: it may have been retired. Choose another model in the configuration.',
    fr: 'Google ne connaît pas le modèle {model} : il a peut-être été retiré. Choisissez un autre modèle dans la configuration.',
    de: 'Google kennt das Modell {model} nicht: Es wurde vielleicht eingestellt. Wähle ein anderes Modell in der Konfiguration.',
    es: 'Google no conoce el modelo {model}: puede que se haya retirado. Elija otro modelo en la configuración.',
  },
  statusNoVoice: {
    en: 'Voice refused: {detail}. Check the voice typed in the configuration with the “List the voices” button.',
    fr: 'Voix refusée : {detail}. Vérifiez la voix saisie dans la configuration avec le bouton « Lister les voix ».',
    de: 'Stimme abgelehnt: {detail}. Prüfe die in der Konfiguration eingegebene Stimme mit der Schaltfläche „Stimmen auflisten“.',
    es: 'Voz rechazada: {detail}. Compruebe la voz escrita en la configuración con el botón «Listar las voces».',
  },
  statusRateLimited: {
    en: 'Gemini rate limit reached: try again in a moment.',
    fr: 'Limite de requêtes de Gemini atteinte : réessayez dans un instant.',
    de: 'Anfragelimit von Gemini erreicht: Versuche es gleich noch einmal.',
    es: 'Se ha alcanzado el límite de solicitudes de Gemini: inténtelo de nuevo en un momento.',
  },
  statusLimit: {
    en: 'Monthly budget of the integration reached: clips are refused until the 1st of next month (Pacific time), or raise the budget in the configuration.',
    fr: 'Budget mensuel de l’intégration atteint : les clips sont refusés jusqu’au 1er du mois prochain (heure du Pacifique), ou relevez le budget dans la configuration.',
    de: 'Monatsbudget der Integration erreicht: Clips werden bis zum 1. des nächsten Monats (pazifische Zeit) abgelehnt, oder erhöhe das Budget in der Konfiguration.',
    es: 'Se ha alcanzado el presupuesto mensual de la integración: los clips se rechazan hasta el día 1 del mes que viene (hora del Pacífico), o aumente el presupuesto en la configuración.',
  },
  statusUnreachable: {
    en: 'Cannot reach generativelanguage.googleapis.com: check the internet access of Gladys.',
    fr: 'Impossible de joindre generativelanguage.googleapis.com : vérifiez l’accès Internet de Gladys.',
    de: 'generativelanguage.googleapis.com ist nicht erreichbar: Prüfe den Internetzugang von Gladys.',
    es: 'No se puede acceder a generativelanguage.googleapis.com: compruebe el acceso a Internet de Gladys.',
  },
  statusApiError: {
    en: 'Gemini TTS error: {detail}',
    fr: 'Erreur de Gemini TTS : {detail}',
    de: 'Fehler von Gemini TTS: {detail}',
    es: 'Error de Gemini TTS: {detail}',
  },
  statusInitFailed: {
    en: 'Initialization failed, check the integration logs.',
    fr: 'L’initialisation a échoué, consultez les journaux de l’intégration.',
    de: 'Die Initialisierung ist fehlgeschlagen, prüfe die Protokolle der Integration.',
    es: 'La inicialización ha fallado, consulte los registros de la integración.',
  },
  warnUnknownVoice: {
    en: 'The voice {voice} typed in the configuration is not in your voices nor in the catalog: clips will fail until it is fixed or removed.',
    fr: 'La voix {voice} saisie dans la configuration n’est ni dans vos voix ni dans le catalogue : les clips échoueront tant qu’elle n’est pas corrigée ou retirée.',
    de: 'Die in der Konfiguration eingegebene Stimme {voice} ist weder in deinen Stimmen noch im Katalog: Clips schlagen fehl, bis sie korrigiert oder entfernt ist.',
    es: 'La voz {voice} escrita en la configuración no está ni en sus voces ni en el catálogo: los clips fallarán hasta que se corrija o se quite.',
  },
  warnVoiceKey: {
    en: 'The voice key {voice} is stateless: Google forgets it after 7 days.',
    fr: 'La clé de voix {voice} est sans état : Google l’oublie au bout de 7 jours.',
    de: 'Der Stimmschlüssel {voice} ist zustandslos: Google vergisst ihn nach 7 Tagen.',
    es: 'La clave de voz {voice} no tiene estado: Google la olvida a los 7 días.',
  },
  testSentence: {
    en: 'Hello, I am the voice of Gladys. Everything is fine at home.',
    fr: 'Bonjour, je suis la voix de Gladys. Tout va bien à la maison.',
    de: 'Hallo, ich bin die Stimme von Gladys. Zu Hause ist alles in Ordnung.',
    es: 'Hola, soy la voz de Gladys. Todo está bien en casa.',
  },
  testSpoken: {
    en: '{voice} spoke {seconds} s of audio in {time} s ({kb} KB).',
    fr: '{voice} a prononcé {seconds} s d’audio en {time} s ({kb} Ko).',
    de: '{voice} hat {seconds} s Audio in {time} s gesprochen ({kb} KB).',
    es: '{voice} ha pronunciado {seconds} s de audio en {time} s ({kb} KB).',
  },
  testCached: {
    en: '{voice}: this sentence was already in the clip cache, nothing asked from Google ({kb} KB).',
    fr: '{voice} : cette phrase était déjà dans le cache des clips, rien demandé à Google ({kb} Ko).',
    de: '{voice}: Dieser Satz war schon im Clip-Cache, nichts bei Google angefragt ({kb} KB).',
    es: '{voice}: esta frase ya estaba en la caché de clips, nada pedido a Google ({kb} KB).',
  },
  testMonthPaid: {
    en: 'This month: about ${used} of ${budget}.',
    fr: 'Ce mois-ci : environ {used} $ sur {budget} $.',
    de: 'Diesen Monat: etwa {used} $ von {budget} $.',
    es: 'Este mes: unos {used} $ de {budget} $.',
  },
  testMonthFree: {
    en: 'This month: {minutes} min of audio, {clips} clips (free tier).',
    fr: 'Ce mois-ci : {minutes} min d’audio, {clips} clips (offre gratuite).',
    de: 'Diesen Monat: {minutes} Min. Audio, {clips} Clips (kostenlose Stufe).',
    es: 'Este mes: {minutes} min de audio, {clips} clips (nivel gratuito).',
  },
  listHeaderCustom: {
    en: 'Your voices ({count}):',
    fr: 'Vos voix ({count}) :',
    de: 'Deine Stimmen ({count}):',
    es: 'Sus voces ({count}):',
  },
  listHeader: {
    en: '{count} voices of the catalog for “{language}”:',
    fr: '{count} voix du catalogue pour « {language} » :',
    de: '{count} Stimmen des Katalogs für „{language}“:',
    es: '{count} voces del catálogo para «{language}»:',
  },
  listNone: {
    en: 'No voice of the catalog is marked for “{language}”: the 30 voices of the configuration speak every language.',
    fr: 'Aucune voix du catalogue n’est marquée pour « {language} » : les 30 voix de la configuration parlent toutes les langues.',
    de: 'Keine Stimme des Katalogs ist für „{language}“ markiert: Die 30 Stimmen der Konfiguration sprechen alle Sprachen.',
    es: 'Ninguna voz del catálogo está marcada para «{language}»: las 30 voces de la configuración hablan todos los idiomas.',
  },
  listMore: {
    en: '… and {count} more.',
    fr: '… et {count} de plus.',
    de: '… und {count} weitere.',
    es: '… y {count} más.',
  },
  listHint: {
    en: 'Type a name or an id in “Other voice”. The 30 voices of the list speak every language.',
    fr: 'Saisissez un nom ou un identifiant dans « Autre voix ». Les 30 voix de la liste parlent toutes les langues.',
    de: 'Gib einen Namen oder eine ID unter „Andere Stimme“ ein. Die 30 Stimmen der Liste sprechen alle Sprachen.',
    es: 'Escriba un nombre o un identificador en «Otra voz». Las 30 voces de la lista hablan todos los idiomas.',
  },
  cacheCleared: {
    en: '{count} clips removed from the cache.',
    fr: '{count} clips retirés du cache.',
    de: '{count} Clips aus dem Cache entfernt.',
    es: '{count} clips eliminados de la caché.',
  },
  gender_female: { en: 'female', fr: 'féminine', de: 'weiblich', es: 'femenina' },
  gender_male: { en: 'male', fr: 'masculine', de: 'männlich', es: 'masculina' },
  gender_neutral: { en: 'neutral', fr: 'neutre', de: 'neutral', es: 'neutra' },

  // widget
  widgetNoKey: {
    en: 'No Gemini API key yet: add it in the configuration of the integration, then choose it as the voice in Settings, Artificial Intelligence.',
    fr: 'Pas encore de clé d’API Gemini : ajoutez-la dans la configuration de l’intégration, puis choisissez-la comme voix dans Paramètres, Intelligence artificielle.',
    de: 'Noch kein Gemini-API-Schlüssel: Füge ihn in der Konfiguration der Integration hinzu und wähle sie dann als Stimme unter Einstellungen, Künstliche Intelligenz.',
    es: 'Todavía no hay clave de API de Gemini: añádala en la configuración de la integración y luego elíjala como voz en Ajustes, Inteligencia artificial.',
  },
  gaugeBudget: {
    en: 'Budget of the month',
    fr: 'Budget du mois',
    de: 'Budget des Monats',
    es: 'Presupuesto del mes',
  },
  tileSpent: {
    en: 'Spent (month)',
    fr: 'Dépensé (mois)',
    de: 'Ausgaben (Monat)',
    es: 'Gastado (mes)',
  },
  tileAudioMonth: {
    en: 'Audio (month)',
    fr: 'Audio (mois)',
    de: 'Audio (Monat)',
    es: 'Audio (mes)',
  },
  tileClipsToday: { en: 'Clips today', fr: 'Clips du jour', de: 'Clips heute', es: 'Clips hoy' },
  tileCachedMonth: {
    en: 'From cache (month)',
    fr: 'Du cache (mois)',
    de: 'Aus Cache (Monat)',
    es: 'De caché (mes)',
  },
  chartTitle: {
    en: 'Seconds of audio per day',
    fr: 'Secondes d’audio par jour',
    de: 'Sekunden Audio pro Tag',
    es: 'Segundos de audio por día',
  },
  chartSeries: { en: 'Seconds', fr: 'Secondes', de: 'Sekunden', es: 'Segundos' },
  rowState: { en: 'Gemini', fr: 'Gemini', de: 'Gemini', es: 'Gemini' },
  stateOk: { en: 'Speaking', fr: 'Parle', de: 'Spricht', es: 'Habla' },
  stateNoKey: {
    en: 'No API key',
    fr: 'Pas de clé d’API',
    de: 'Kein API-Schlüssel',
    es: 'Sin clave de API',
  },
  stateLimit: {
    en: 'Monthly budget reached',
    fr: 'Budget du mois atteint',
    de: 'Monatsbudget erreicht',
    es: 'Presupuesto del mes alcanzado',
  },
  stateFailing: {
    en: 'Failing since {time}',
    fr: 'En erreur depuis {time}',
    de: 'Fehler seit {time}',
    es: 'Con errores desde {time}',
  },
  rowTier: { en: 'Tier', fr: 'Offre', de: 'Stufe', es: 'Nivel' },
  tier_free: { en: 'Free', fr: 'Gratuite', de: 'Kostenlos', es: 'Gratuito' },
  tier_paid: { en: 'Paid', fr: 'Payante', de: 'Kostenpflichtig', es: 'De pago' },
  rowLastClip: { en: 'Last clip', fr: 'Dernier clip', de: 'Letzter Clip', es: 'Último clip' },
  valueLastClip: {
    en: '{seconds} s, {ago}',
    fr: '{seconds} s, {ago}',
    de: '{seconds} s, {ago}',
    es: '{seconds} s, {ago}',
  },
  valueLastCached: {
    en: 'cache, {ago}',
    fr: 'cache, {ago}',
    de: 'Cache, {ago}',
    es: 'caché, {ago}',
  },
  rowLastError: {
    en: 'Last error',
    fr: 'Dernière erreur',
    de: 'Letzter Fehler',
    es: 'Último error',
  },
  buttonUsage: {
    en: 'AI Studio usage',
    fr: 'Usage AI Studio',
    de: 'AI-Studio-Nutzung',
    es: 'Uso de AI Studio',
  },
  kind_auth: {
    en: 'key refused',
    fr: 'clé refusée',
    de: 'Schlüssel abgelehnt',
    es: 'clave rechazada',
  },
  kind_disabled: {
    en: 'API disabled',
    fr: 'API désactivée',
    de: 'API deaktiviert',
    es: 'API deshabilitada',
  },
  kind_billing: {
    en: 'billing',
    fr: 'facturation',
    de: 'Abrechnung',
    es: 'facturación',
  },
  kind_quota: {
    en: 'daily quota',
    fr: 'quota du jour',
    de: 'Tageskontingent',
    es: 'cuota diaria',
  },
  kind_model: {
    en: 'model unknown',
    fr: 'modèle inconnu',
    de: 'Modell unbekannt',
    es: 'modelo desconocido',
  },
  kind_voice: {
    en: 'voice unknown',
    fr: 'voix inconnue',
    de: 'Stimme unbekannt',
    es: 'voz desconocida',
  },
  kind_rate_limit: {
    en: 'rate limit',
    fr: 'limite de requêtes',
    de: 'Anfragelimit',
    es: 'límite de solicitudes',
  },
  kind_limit: {
    en: 'monthly budget',
    fr: 'budget du mois',
    de: 'Monatsbudget',
    es: 'presupuesto del mes',
  },
  kind_request: {
    en: 'text refused',
    fr: 'texte refusé',
    de: 'Text abgelehnt',
    es: 'texto rechazado',
  },
  kind_server: {
    en: 'Google error',
    fr: 'erreur Google',
    de: 'Google-Fehler',
    es: 'error de Google',
  },
  kind_unreachable: {
    en: 'unreachable',
    fr: 'injoignable',
    de: 'nicht erreichbar',
    es: 'inaccesible',
  },
  kind_timeout: { en: 'too slow', fr: 'trop lent', de: 'zu langsam', es: 'demasiado lento' },

  // durations
  never: { en: 'Never', fr: 'Jamais', de: 'Nie', es: 'Nunca' },
  justNow: { en: 'just now', fr: 'à l’instant', de: 'gerade eben', es: 'ahora mismo' },
  minutesAgo: {
    en: '{n} min ago',
    fr: 'il y a {n} min',
    de: 'vor {n} Min.',
    es: 'hace {n} min',
  },
  hoursAgo: { en: '{n} h ago', fr: 'il y a {n} h', de: 'vor {n} Std.', es: 'hace {n} h' },
  daysAgo: {
    en: '{n} days ago',
    fr: 'il y a {n} jours',
    de: 'vor {n} Tagen',
    es: 'hace {n} días',
  },
};

/**
 * @description Whether a value is a language of the integration.
 * @param {unknown} value - The value.
 * @returns {boolean} True for en, fr, de, es.
 */
function isLanguage(value) {
  return LANGUAGES.includes(value);
}

/**
 * @description A text in a language, with its values.
 * @param {string} key - A TEXTS key.
 * @param {string} language - The language (English when unknown).
 * @param {object} [values] - The values of the `{placeholders}`.
 * @returns {string} The text, the key itself when unknown.
 */
function t(key, language, values = {}) {
  const entry = TEXTS[key];
  if (!entry) {
    return key;
  }
  const template = entry[isLanguage(language) ? language : 'en'] ?? entry.en;
  return template.replace(/\{(\w+)\}/g, (whole, name) =>
    values[name] === undefined || values[name] === null ? '' : String(values[name]),
  );
}

/**
 * @description A text in the four languages.
 * @param {string|Function} key - A TEXTS key, or `(language) => text`.
 * @param {object|Function} [values] - The values, or `(language) => values`.
 * @returns {object} `{ en, fr, de, es }`.
 */
function all(key, values = {}) {
  return Object.fromEntries(
    LANGUAGES.map((language) => [
      language,
      typeof key === 'function'
        ? key(language)
        : t(key, language, typeof values === 'function' ? values(language) : values),
    ]),
  );
}

/**
 * @description How long ago an instant was: "just now", "12 min ago", "3 h ago".
 * @param {number} at - The instant, in ms (0: never).
 * @param {number} now - Now, in ms.
 * @param {string} language - The language.
 * @returns {string} The text.
 */
function ago(at, now, language) {
  if (!at) {
    return t('never', language);
  }
  const minutes = Math.floor((now - at) / 60000);
  if (minutes < 1) {
    return t('justNow', language);
  }
  if (minutes < 60) {
    return t('minutesAgo', language, { n: minutes });
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    return t('hoursAgo', language, { n: hours });
  }
  return t('daysAgo', language, { n: Math.floor(hours / 24) });
}

/**
 * @description A number in the format of a language.
 * @param {number} value - The number.
 * @param {string} language - The language.
 * @param {number} [decimals] - The decimals at most.
 * @returns {string} "12,5" in French.
 */
function formatNumber(value, language, decimals = 1) {
  if (!Number.isFinite(value)) {
    return '–';
  }
  return new Intl.NumberFormat(isLanguage(language) ? language : 'en', {
    maximumFractionDigits: decimals,
  }).format(value);
}

export { LANGUAGES, TEXTS, isLanguage, t, all, ago, formatNumber };
