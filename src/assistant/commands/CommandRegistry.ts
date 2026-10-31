/**
 * NaviAble AI 3.0 — Command Registry & Schema Catalog
 * 
 * Defines all supported voice command schemas with validation rules,
 * required/optional parameters, confirmation flags, and localized responses.
 */

export interface CommandParameterDef {
  name: string
  type: 'string' | 'number' | 'boolean'
  required: boolean
  description: string
}

export interface CommandDefinition {
  intent: string
  category: 
    | 'CAMERA'
    | 'SCENE'
    | 'CURRENCY'
    | 'OCR'
    | 'ROAD_HAZARD'
    | 'PROXIMITY'
    | 'REMEMBER'
    | 'PEOPLE'
    | 'ASSISTANT'
    | 'NAVIGATION'
    | 'CONFIRMATION'
  description: string
  parameters: CommandParameterDef[]
  requiresConfirmation?: boolean
  confirmationPrompt?: { en: string; hi?: string; pa?: string }
  isEmergencyAction?: boolean // Instant high-priority bypass
  keywords: string[]
}

export const COMMAND_CATALOG: CommandDefinition[] = [
  // ─── A. CAMERA CONTROL ───
  {
    intent: 'CAMERA_OPEN',
    category: 'CAMERA',
    description: 'Start, enable, or open the camera video feed.',
    parameters: [],
    keywords: ['open camera', 'start camera', 'camera on', 'chalu karo', 'kholo', 'turn on camera', 'activate camera'],
  },
  {
    intent: 'CAMERA_STOP',
    category: 'CAMERA',
    description: 'Stop or close the camera stream.',
    parameters: [],
    isEmergencyAction: true,
    keywords: ['stop camera', 'close camera', 'camera off', 'band karo', 'roko', 'turn off camera', 'shut camera'],
  },
  {
    intent: 'CAMERA_SWITCH',
    category: 'CAMERA',
    description: 'Switch between front and rear environment cameras.',
    parameters: [
      { name: 'facing', type: 'string', required: false, description: 'rear, back, or front' }
    ],
    keywords: ['switch camera', 'flip camera', 'rear camera', 'back camera', 'front camera', 'piche ka camera'],
  },
  {
    intent: 'CAMERA_RESTART',
    category: 'CAMERA',
    description: 'Restart or reload camera feed.',
    parameters: [],
    keywords: ['restart camera', 'reload camera', 'refresh camera'],
  },
  {
    intent: 'CAMERA_FULLSCREEN',
    category: 'CAMERA',
    description: 'Toggle fullscreen camera view.',
    parameters: [],
    keywords: ['fullscreen camera', 'full screen', 'bada karo'],
  },

  // ─── B. LIVE SCENE UNDERSTANDING ───
  {
    intent: 'SCENE_DESCRIBE',
    category: 'SCENE',
    description: 'Describe the scene, road objects, and pedestrian obstacles.',
    parameters: [],
    keywords: ['describe surroundings', 'what is in front of me', 'what do you see', 'what is around me', 'kya hai', 'samne kya hai', 'dekho'],
  },
  {
    intent: 'SCENE_ROAD_CHECK',
    category: 'SCENE',
    description: 'Describe road conditions and walking path ahead.',
    parameters: [],
    keywords: ['describe road', 'road condition', 'check road', 'sadak kaisi hai', 'rasta kaisa hai', 'path condition'],
  },
  {
    intent: 'SCENE_OBJECTS',
    category: 'SCENE',
    description: 'List detected nearby objects.',
    parameters: [],
    keywords: ['what objects are nearby', 'list objects', 'any objects', 'chizen batao', 'objects near me'],
  },
  {
    intent: 'SCENE_PEOPLE',
    category: 'SCENE',
    description: 'Check if people or pedestrians are nearby.',
    parameters: [],
    keywords: ['is there a person', 'any people nearby', 'pedestrians', 'koi insan hai', 'log hain'],
  },
  {
    intent: 'SCENE_VEHICLES',
    category: 'SCENE',
    description: 'Check for cars, motorcycles, buses, or vehicles.',
    parameters: [],
    keywords: ['are there vehicles', 'check cars', 'any traffic', 'gadiyan', 'vehicles around me'],
  },
  {
    intent: 'SCENE_LEFT',
    category: 'SCENE',
    description: 'Announce objects specifically on the user\'s left.',
    parameters: [],
    keywords: ['what is on my left', 'left side', 'bayen kya hai', 'khabbe ki hai'],
  },
  {
    intent: 'SCENE_RIGHT',
    category: 'SCENE',
    description: 'Announce objects specifically on the user\'s right.',
    parameters: [],
    keywords: ['what is on my right', 'right side', 'dayen kya hai', 'sajje ki hai'],
  },

  // ─── C. CURRENCY READING ───
  {
    intent: 'CURRENCY_SCAN',
    category: 'CURRENCY',
    description: 'Scan camera image to recognize Indian currency banknotes.',
    parameters: [],
    keywords: [
      'check how much money this is', 'how much money is this', 'scan this note',
      'read this currency', 'how many rupees', 'check this note', 'what note is this',
      'tell me the value', 'paise check karo', 'kitne rupaye hain', 'note check karo', 'yeh kitna hai'
    ],
  },
  {
    intent: 'CURRENCY_SCAN_ANOTHER',
    category: 'CURRENCY',
    description: 'Scan another banknote.',
    parameters: [],
    keywords: ['scan another note', 'check another note', 'dusra note', 'next note'],
  },
  {
    intent: 'CURRENCY_REPEAT',
    category: 'CURRENCY',
    description: 'Repeat the last recognized currency amount.',
    parameters: [],
    keywords: ['repeat the amount', 'how much was it', 'kitna tha', 'repeat money'],
  },
  {
    intent: 'CURRENCY_STOP',
    category: 'CURRENCY',
    description: 'Stop currency scanner.',
    parameters: [],
    keywords: ['stop currency scanning', 'stop currency reader', 'close currency'],
  },

  // ─── D. OCR AND TEXT READING ───
  {
    intent: 'OCR_READ_TEXT',
    category: 'OCR',
    description: 'Read printed text, signs, labels, or documents.',
    parameters: [],
    keywords: ['read this', 'read the board', 'read document', 'read text in front of me', 'read label', 'yeh padho', 'likha kya hai'],
  },
  {
    intent: 'OCR_READ_SLOWLY',
    category: 'OCR',
    description: 'Read the text at a slower speaking rate.',
    parameters: [],
    keywords: ['read slowly', 'dheere padho', 'slow down reading'],
  },
  {
    intent: 'OCR_REPEAT',
    category: 'OCR',
    description: 'Repeat the last recognized OCR text.',
    parameters: [],
    keywords: ['repeat the text', 'repeat reading', 'dobara padho'],
  },
  {
    intent: 'OCR_STOP',
    category: 'OCR',
    description: 'Stop text reading.',
    parameters: [],
    isEmergencyAction: true,
    keywords: ['stop reading', 'padhna band karo', 'quiet reading'],
  },

  // ─── E. ROAD HAZARD DETECTION ───
  {
    intent: 'HAZARD_START',
    category: 'ROAD_HAZARD',
    description: 'Detect road hazards like potholes, cracks, and obstacles.',
    parameters: [],
    keywords: ['start road detection', 'detect potholes', 'look for road cracks', 'broken pavement', 'check obstacles', 'gaddhe dekho'],
  },
  {
    intent: 'HAZARD_STOP',
    category: 'ROAD_HAZARD',
    description: 'Stop road hazard detection.',
    parameters: [],
    keywords: ['stop road detection', 'stop pothole detection'],
  },
  {
    intent: 'HAZARD_CHECK_TRAFFIC',
    category: 'ROAD_HAZARD',
    description: 'Check nearby moving road traffic.',
    parameters: [],
    keywords: ['tell me about nearby traffic', 'traffic check', 'traffic batao'],
  },

  // ─── F. PROXIMITY AND AUDIO ALERTS ───
  {
    intent: 'PROXIMITY_ENABLE',
    category: 'PROXIMITY',
    description: 'Enable proximity alerts and obstacle warnings.',
    parameters: [],
    keywords: ['enable proximity alerts', 'turn on proximity', 'alerts on', 'proximity chalu karo'],
  },
  {
    intent: 'PROXIMITY_DISABLE',
    category: 'PROXIMITY',
    description: 'Disable proximity alerts.',
    parameters: [],
    keywords: ['disable proximity alerts', 'turn off proximity', 'alerts off', 'proximity band karo'],
  },
  {
    intent: 'PROXIMITY_BEEP_ENABLE',
    category: 'PROXIMITY',
    description: 'Enable obstacle warning beep tone.',
    parameters: [],
    keywords: ['enable beep', 'turn on beep', 'beep chalu karo'],
  },
  {
    intent: 'PROXIMITY_BEEP_DISABLE',
    category: 'PROXIMITY',
    description: 'Disable obstacle warning beep tone.',
    parameters: [],
    keywords: ['disable beep', 'turn off beep', 'beep band karo'],
  },
  {
    intent: 'PROXIMITY_TEST_ALARM',
    category: 'PROXIMITY',
    description: 'Test collision alarm sound.',
    parameters: [],
    keywords: ['test alarm', 'test beep', 'alarm bajao'],
  },
  {
    intent: 'PROXIMITY_VOLUME_UP',
    category: 'PROXIMITY',
    description: 'Increase alert volume.',
    parameters: [],
    keywords: ['increase alert volume', 'alert volume up', 'alarm aawaz badhao'],
  },
  {
    intent: 'PROXIMITY_VOLUME_DOWN',
    category: 'PROXIMITY',
    description: 'Reduce alert volume.',
    parameters: [],
    keywords: ['reduce alert volume', 'alert volume down', 'alarm aawaz kam karo'],
  },

  // ─── G. REMEMBER FEATURE ───
  {
    intent: 'REMEMBER_SAVE_PLACE',
    category: 'REMEMBER',
    description: 'Save current GPS location as a named place.',
    parameters: [
      { name: 'placeName', type: 'string', required: false, description: 'Name of the place' }
    ],
    keywords: ['save this place', 'remember this place', 'save location', 'yeh jagah yaad rakho'],
  },
  {
    intent: 'REMEMBER_ROUTE_START',
    category: 'REMEMBER',
    description: 'Start recording a new walking route with GPS breadcrumbs.',
    parameters: [
      { name: 'routeName', type: 'string', required: false, description: 'Name of the route' }
    ],
    keywords: ['remember this route', 'start route recording', 'record this route', 'rasta yaad rakho', 'rasta record karo'],
  },
  {
    intent: 'REMEMBER_ROUTE_STOP',
    category: 'REMEMBER',
    description: 'Stop route recording and save to memory.',
    parameters: [
      { name: 'routeName', type: 'string', required: false, description: 'Route name' }
    ],
    keywords: ['stop route recording', 'save this route', 'save route', 'rasta save karo', 'reached destination'],
  },
  {
    intent: 'REMEMBER_SHOW_ROUTES',
    category: 'REMEMBER',
    description: 'List saved walking routes.',
    parameters: [],
    keywords: ['show saved routes', 'list routes', 'what routes do i have', 'mere raste batao'],
  },
  {
    intent: 'REMEMBER_TAG_LANDMARK',
    category: 'REMEMBER',
    description: 'Tag a landmark along the active recording route.',
    parameters: [
      { name: 'landmarkName', type: 'string', required: false, description: 'Landmark name' }
    ],
    keywords: ['remember this landmark', 'tag landmark', 'add landmark', 'landmark lagao'],
  },
  {
    intent: 'REMEMBER_SHOW_MEMORIES',
    category: 'REMEMBER',
    description: 'Show or summarize personal memories.',
    parameters: [
      { name: 'query', type: 'string', required: false, description: 'Keywords or time filter' }
    ],
    keywords: ['show my saved memories', 'what did i save', 'what did i save yesterday', 'meri yaadein batao'],
  },
  {
    intent: 'REMEMBER_DELETE_MEMORY',
    category: 'REMEMBER',
    description: 'Delete a saved memory or route.',
    parameters: [
      { name: 'targetName', type: 'string', required: false, description: 'Name of memory to delete' }
    ],
    requiresConfirmation: true,
    confirmationPrompt: {
      en: 'Are you sure you want to delete this memory? Say yes to confirm.',
      hi: 'क्या आप वाकई इस याद को हटाना चाहते हैं? पुष्टि के लिए हाँ कहें।',
      pa: 'ਕੀ ਤੁਸੀਂ ਵਾਕਈ ਇਸ ਯਾਦ ਨੂੰ ਹਟਾਉਣਾ ਚਾਹੁੰਦੇ ਹੋ? ਪੁਸ਼ਟੀ ਲਈ ਹਾਂ ਕਹੋ।',
    },
    keywords: ['delete this memory', 'delete route', 'remove memory', 'yaad mitao'],
  },

  // ─── H. PEOPLE MEMORY ───
  {
    intent: 'PEOPLE_OPEN',
    category: 'PEOPLE',
    description: 'Open People & Contacts memory.',
    parameters: [],
    keywords: ['open people memory', 'contacts kholo', 'people memory'],
  },
  {
    intent: 'PEOPLE_ADD_CONTACT',
    category: 'PEOPLE',
    description: 'Add a trusted contact profile.',
    parameters: [
      { name: 'name', type: 'string', required: false, description: 'Contact name' }
    ],
    keywords: ['add a contact', 'save contact', 'naya contact jodo'],
  },
  {
    intent: 'PEOPLE_SCAN_BADGE',
    category: 'PEOPLE',
    description: 'Scan companion\'s voluntary cryptographic QR identity badge.',
    parameters: [],
    keywords: ['scan a shared identity code', 'scan badge', 'scan contact qr', 'badge scan karo'],
  },
  {
    intent: 'PEOPLE_SHOW_CONTACTS',
    category: 'PEOPLE',
    description: 'Show verified contacts.',
    parameters: [],
    keywords: ['show saved contacts', 'list contacts', 'mere contacts batao'],
  },
  {
    intent: 'PEOPLE_REMOVE_CONTACT',
    category: 'PEOPLE',
    description: 'Remove a saved contact.',
    parameters: [
      { name: 'contactName', type: 'string', required: false, description: 'Name to remove' }
    ],
    requiresConfirmation: true,
    confirmationPrompt: {
      en: 'Are you sure you want to remove this contact? Say yes to confirm.',
      hi: 'क्या आप इस संपर्क को हटाना चाहते हैं? पुष्टि के लिए हाँ कहें।',
      pa: 'ਕੀ ਤੁਸੀਂ ਇਸ ਸੰਪਰਕ ਨੂੰ ਹਟਾਉਣਾ ਚਾਹੁੰਦੇ ਹੋ? ਪੁਸ਼ਟੀ ਲਈ ਹਾਂ ਕਹੋ।',
    },
    keywords: ['remove a saved contact', 'delete contact', 'contact hatao'],
  },

  // ─── I. ASSISTANT AND VOICE CONTROLS ───
  {
    intent: 'ASSISTANT_SPEAK_SLOWER',
    category: 'ASSISTANT',
    description: 'Reduce speech playback rate.',
    parameters: [],
    keywords: ['speak slower', 'talk slower', 'dheere bolo', 'slow down speech'],
  },
  {
    intent: 'ASSISTANT_SPEAK_FASTER',
    category: 'ASSISTANT',
    description: 'Increase speech playback rate.',
    parameters: [],
    keywords: ['speak faster', 'talk faster', 'jaldi bolo', 'speed up speech'],
  },
  {
    intent: 'ASSISTANT_VOLUME_UP',
    category: 'ASSISTANT',
    description: 'Increase assistant voice volume.',
    parameters: [],
    keywords: ['increase volume', 'volume up', 'louder', 'aawaz badhao'],
  },
  {
    intent: 'ASSISTANT_VOLUME_DOWN',
    category: 'ASSISTANT',
    description: 'Decrease assistant voice volume.',
    parameters: [],
    keywords: ['decrease volume', 'volume down', 'softer', 'aawaz kam karo'],
  },
  {
    intent: 'ASSISTANT_LANG_HINDI',
    category: 'ASSISTANT',
    description: 'Change assistant language to Hindi.',
    parameters: [],
    keywords: ['change language to hindi', 'switch to hindi', 'hindi me bolo', 'hindi karo'],
  },
  {
    intent: 'ASSISTANT_LANG_ENGLISH',
    category: 'ASSISTANT',
    description: 'Change assistant language to English.',
    parameters: [],
    keywords: ['change language to english', 'switch to english', 'speak in english', 'english karo'],
  },
  {
    intent: 'ASSISTANT_LANG_PUNJABI',
    category: 'ASSISTANT',
    description: 'Change assistant language to Punjabi.',
    parameters: [],
    keywords: ['change language to punjabi', 'switch to punjabi', 'punjabi vich bolo', 'punjabi karo'],
  },
  {
    intent: 'ASSISTANT_REPEAT',
    category: 'ASSISTANT',
    description: 'Repeat the last assistant response.',
    parameters: [],
    keywords: ['repeat', 'say that again', 'what did you say', 'phir se bolo', 'dobara batao'],
  },
  {
    intent: 'ASSISTANT_STOP_SPEAKING',
    category: 'ASSISTANT',
    description: 'Immediately stop all speech output.',
    parameters: [],
    isEmergencyAction: true,
    keywords: ['stop speaking', 'be quiet', 'shut up', 'chup raho', 'shant', 'silence', 'stop talking'],
  },
  {
    intent: 'ASSISTANT_HELP',
    category: 'ASSISTANT',
    description: 'Describe available features and commands.',
    parameters: [],
    keywords: ['help', 'what can you do', 'madad', 'commands', 'kya kar sakte ho'],
  },

  // ─── J. NAVIGATION AND SETTINGS ───
  {
    intent: 'NAV_HOME',
    category: 'NAVIGATION',
    description: 'Navigate to Home page.',
    parameters: [],
    keywords: ['open home', 'go to home', 'main page', 'ghar'],
  },
  {
    intent: 'NAV_CURRENCY',
    category: 'NAVIGATION',
    description: 'Navigate to Currency reader page.',
    parameters: [],
    keywords: ['open currency reader', 'go to currency', 'currency page'],
  },
  {
    intent: 'NAV_CAMERA',
    category: 'NAVIGATION',
    description: 'Navigate to Vision dashboard.',
    parameters: [],
    keywords: ['open camera', 'go to dashboard', 'vision page'],
  },
  {
    intent: 'NAV_REMEMBER',
    category: 'NAVIGATION',
    description: 'Navigate to Remember dashboard.',
    parameters: [],
    keywords: ['open remember', 'go to remember', 'memories page'],
  },
  {
    intent: 'NAV_STATUS',
    category: 'NAVIGATION',
    description: 'Navigate to AI Status dashboard.',
    parameters: [],
    keywords: ['show ai status', 'ai status', 'system status'],
  },
  {
    intent: 'NAV_CAMERA_STATUS',
    category: 'NAVIGATION',
    description: 'Show camera diagnostics.',
    parameters: [],
    keywords: ['show camera status', 'camera diagnostics'],
  },

  // ─── L. REAL PEDESTRIAN VOICE NAVIGATION ───
  {
    intent: 'navigation.start',
    category: 'NAVIGATION',
    description: 'Start live GPS walking navigation.',
    parameters: [],
    keywords: ['start navigation', 'start walking', 'start route', 'navigation shuru karo', 'chalu karo navigation', 'rasta chalu karo'],
  },
  {
    intent: 'navigation.stop',
    category: 'NAVIGATION',
    description: 'Stop active walking navigation.',
    parameters: [],
    isEmergencyAction: true,
    keywords: ['stop navigation', 'cancel navigation', 'stop route', 'navigation band karo', 'roko navigation'],
  },
  {
    intent: 'navigation.pause',
    category: 'NAVIGATION',
    description: 'Pause active walking navigation.',
    parameters: [],
    keywords: ['pause navigation', 'pause route', 'ruk jao', 'pause walking'],
  },
  {
    intent: 'navigation.resume',
    category: 'NAVIGATION',
    description: 'Resume paused walking navigation.',
    parameters: [],
    keywords: ['resume navigation', 'continue navigation', 'continue route', 'aage badho', 'shuru karo dobara'],
  },
  {
    intent: 'navigation.setDestination',
    category: 'NAVIGATION',
    description: 'Set a walking destination and compute a pedestrian route.',
    parameters: [
      { name: 'destination', type: 'string', required: true, description: 'Destination place name or landmark' }
    ],
    keywords: ['navigate to', 'take me to', 'find a walking route to', 'walking route to', 'rasta batao', 'le chalo'],
  },
  {
    intent: 'navigation.repeatInstruction',
    category: 'NAVIGATION',
    description: 'Repeat the last navigation instruction or direction.',
    parameters: [],
    keywords: ['repeat the last direction', 'what is my next instruction', 'repeat direction', 'phir se batao rasta', 'agla mod kya hai'],
  },
  {
    intent: 'navigation.currentLocation',
    category: 'NAVIGATION',
    description: 'Report current location and GPS accuracy.',
    parameters: [],
    keywords: ['where am i according to gps', 'where am i', 'what is my location', 'meri location kya hai', 'mai kahan hu'],
  },
  {
    intent: 'navigation.remainingDistance',
    category: 'NAVIGATION',
    description: 'Report remaining walking distance to destination.',
    parameters: [],
    keywords: ['how much distance is remaining', 'remaining distance', 'how far is destination', 'kitni door hai', 'kitna bacha hai'],
  },
  {
    intent: 'navigation.nextTurn',
    category: 'NAVIGATION',
    description: 'Report the next upcoming turn and distance.',
    parameters: [],
    keywords: ['how far is the next turn', 'next turn', 'agla mod kitni door hai', 'when is next turn', 'next turn distance'],
  },
  {
    intent: 'navigation.recalculateRoute',
    category: 'NAVIGATION',
    description: 'Recalculate the pedestrian route from current position.',
    parameters: [],
    keywords: ['recalculate my route', 'recalculate route', 'rasta badlo', 'dobara rasta banao', 'recalculate'],
  },
  {
    intent: 'navigation.help',
    category: 'NAVIGATION',
    description: 'List available pedestrian navigation voice commands.',
    parameters: [],
    keywords: ['navigation help', 'how to navigate', 'navigation commands', 'rasta madad'],
  },


  // ─── K. CONFIRMATION & AMBIGUOUS CONTROLS ───
  {
    intent: 'CONFIRM_YES',
    category: 'CONFIRMATION',
    description: 'Affirmative response to a clarification or confirmation prompt.',
    parameters: [],
    keywords: ['yes', 'yeah', 'yep', 'confirm', 'proceed', 'haan', 'ha', 'sahi hai'],
  },
  {
    intent: 'CONFIRM_NO',
    category: 'CONFIRMATION',
    description: 'Negative response to a clarification or confirmation prompt.',
    parameters: [],
    keywords: ['no', 'nope', 'cancel', 'don\'t', 'stop', 'nahi', 'mat karo', 'rok do'],
  },
  {
    intent: 'AMBIGUOUS_STOP',
    category: 'CONFIRMATION',
    description: 'Ambiguous stop request requiring clarification.',
    parameters: [],
    keywords: ['stop it', 'stop', 'cancel it', 'bas'],
  },
]
