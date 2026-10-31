# NaviAble AI 3.0 — Voice Command Catalogue & Semantic Schema

**Version:** 3.0.0  
**Supported Languages:** English, Hindi (हिन्दी), Hinglish (Romanized Hindi), Punjabi (ਪੰਜਾਬੀ)  
**Architecture:** Deterministic Command Registry + Normalised Semantic Matching + Gemini Live Conversational Nuance  

---

## 1. Overview

Navi Voice Assistant 3.0 supports a broad catalogue of natural voice commands across 10 functional domains. Users do not need to memorize exact phrases—the intent classifier incorporates text normalisation, conversational filler stripping, Hinglish phonetics, and token-overlap fuzzy matching.

---

## 2. Command Catalogue by Category

### Category A: Camera Control
Operates the active camera stream (`navigator.mediaDevices.getUserMedia`).

| Intent | Natural English Examples | Hindi / Hinglish Examples | Punjabi Examples | System Action | Spoken Feedback |
|---|---|---|---|---|---|
| `CAMERA_OPEN` | *"Open camera"*, *"Start camera"*, *"Turn on video feed"*, *"Activate camera"* | *"कैमरा चालू करो"*, *"Camera chalu karo"*, *"Camera khol do"* | *"ਕੈਮਰਾ ਚਾਲੂ ਕਰੋ"*, *"Camera kholo"* | Starts camera stream & model loop | *"Opening camera feed."* |
| `CAMERA_STOP` | *"Stop camera"*, *"Close camera"*, *"Turn off video"*, *"Shut camera"* | *"कैमरा बंद करो"*, *"Camera band karo"*, *"Camera roko"* | *"ਕੈਮਰਾ ਬੰਦ ਕਰੋ"* | Halts camera video tracks | *"Camera feed stopped."* |
| `CAMERA_SWITCH` | *"Switch camera"*, *"Flip camera"*, *"Use rear camera"*, *"Back camera"* | *"पिछला कैमरा चालू करो"*, *"Pichhla camera lagao"* | *"ਪਿਛਲਾ ਕੈਮਰਾ ਲਗਾਓ"* | Switches environment / user lens | *"Switched camera."* |
| `CAMERA_RESTART` | *"Restart camera"*, *"Reload camera"*, *"Reset video"* | *"कैमरा रीस्टार्ट करो"*, *"Camera restart karo"* | *"ਕੈਮਰਾ ਰੀਸਟਾਰਟ ਕਰੋ"* | Re-enumerates & re-inits stream | *"Restarting camera."* |
| `CAMERA_FULLSCREEN` | *"Fullscreen camera"*, *"Maximize view"*, *"Full screen"* | *"कैमरा बड़ा करो"*, *"Puri screen par karo"* | *"ਪੂਰੀ ਸਕ੍ਰੀਨ ਕਰੋ"* | Toggles full-viewport video layout | *"Toggled fullscreen camera."* |

---

### Category B: Live Scene Understanding
Generates verbal descriptions using real object detections from the camera.

| Intent | Natural English Examples | Hindi / Hinglish Examples | Punjabi Examples | System Action | Spoken Feedback |
|---|---|---|---|---|---|
| `SCENE_DESCRIBE` | *"Describe my surroundings"*, *"What is in front of me?"*, *"What do you see?"*, *"What's ahead?"* | *"सामने क्या है?"*, *"Mere saamne kya hai?"*, *"Aas paas kya dikh raha hai?"* | *"ਮੇਰੇ ਸਾਹਮਣੇ ਕੀ ਹੈ?"*, *"ਆਸ ਪਾਸ ਕੀ ਦਿਖ ਰਿਹਾ ਹੈ?"* | Queries COCO-SSD & Road Intelligence | Real scene description (e.g. *"A car on your left and a pedestrian ahead."*) |
| `SCENE_ROAD_CHECK` | *"Describe road conditions"*, *"Check road"*, *"What is on the road?"* | *"सड़क पर क्या है?"*, *"Sadak kaisi hai?"*, *"Rasta kaisa hai?"* | *"ਸੜਕ 'ਤੇ ਕੀ ਹੈ?"*, *"ਰਾਹ ਕਿਹੋ ਜਿਹਾ ਹੈ?"* | Inspects path obstacles & vehicles | *"The walking path in front of you appears clear of nearby vehicles."* |
| `SCENE_OBJECTS` | *"What objects are nearby?"*, *"List objects"*, *"Any objects around?"* | *"कौन-सी चीजें हैं?"*, *"Chizen batao"* | *"ਕਿਹੜੀਆਂ ਚੀਜ਼ਾਂ ਹਨ?"* | Lists unique detected object classes | *"Detected objects: bench, backpack, chair."* |
| `SCENE_PEOPLE` | *"Is there a person nearby?"*, *"Any pedestrians?"*, *"Anyone in front of me?"* | *"कोई इंसान है?"*, *"Koi khada hai kya?"* | *"ਕੋਈ ਇਨਸਾਨ ਹੈ?"* | Counts and locates `person` bounding boxes | *"There is 1 person visible nearby."* |
| `SCENE_VEHICLES` | *"Are there vehicles around me?"*, *"Check cars"*, *"Any traffic?"* | *"गाड़ियां हैं क्या?"*, *"Gadiyan check karo"* | *"ਕੋਈ ਗੱਡੀ ਹੈ?"* | Filters cars, buses, bikes, trucks | *"Detected 2 vehicles nearby."* |
| `SCENE_LEFT` | *"What is on my left?"*, *"Check left side"* | *"बाईं ओर क्या है?"*, *"Left me kya hai?"* | *"ਖੱਬੇ ਪਾਸੇ ਕੀ ਹੈ?"* | Reports objects with `position === 'LEFT'` | *"On your left: bicycle."* |
| `SCENE_RIGHT` | *"What is on my right?"*, *"Check right side"* | *"दाईं ओर क्या है?"*, *"Right me kya hai?"* | *"ਸੱਜੇ ਪਾਸੇ ਕੀ ਹੈ?"* | Reports objects with `position === 'RIGHT'` | *"On your right: parked car."* |

---

### Category C: Currency Reading (Two-Stage Banknote Verification)
Runs the dedicated MobileNetV3 banknote model with false-positive screen rejection.

| Intent | Natural English Examples | Hindi / Hinglish Examples | System Action | Spoken Feedback |
|---|---|---|---|---|
| `CURRENCY_SCAN` | *"Check how much money this is"*, *"How much money is this?"*, *"Read this note"*, *"Scan this currency"*, *"What note is this?"* | *"पैसे चेक करो"*, *"Bhai yeh kitne rupaye ka note hai?"*, *"Yeh kitna hai?"*, *"Note padho"* | Stage A presence detection $\to$ Stage B denomination classification | *"This appears to be a 500-rupee note."* |
| `CURRENCY_SCAN_ANOTHER` | *"Scan another note"*, *"Check another note"*, *"Next note"* | *"दूसरा नोट चेक करो"*, *"Dusra note dekho"* | Refreshes canvas snapshot & re-evaluates | *"Detected 100 rupee note with 92 percent confidence."* |
| `CURRENCY_REPEAT` | *"Repeat the amount"*, *"How much was it?"* | *"कितना था?"*, *"Dobara batao kitna paisa"* | Retrieves cached denomination amount | *"The previous note was 500 rupees."* |
| `CURRENCY_STOP` | *"Stop currency scanning"*, *"Close currency reader"* | *"करेंसी स्कैनर बंद करो"*, *"Currency band karo"* | Silences currency auto-reader | *"Currency scanning stopped."* |

---

### Category D: OCR & Text Reading
Extracts text from live camera frames via Tesseract.js.

| Intent | Natural English Examples | Hindi / Hinglish Examples | System Action | Spoken Feedback |
|---|---|---|---|---|
| `OCR_READ_TEXT` | *"Read this"*, *"Read the board"*, *"Read document"*, *"What is written here?"* | *"यह पढ़ो"*, *"Kya likha hai?"*, *"Board padh kar batao"* | Navigates to `/ocr` and initiates OCR capture | *"Opening text reader. Hold text in front of camera."* |
| `OCR_READ_SLOWLY` | *"Read slowly"*, *"Slow down reading"* | *"धीमे पढ़ो"*, *"Dheere padho"* | Adjusts TTS speech rate to `0.80` | *"Reading speed reduced. Ready to read."* |
| `OCR_REPEAT` | *"Repeat the text"*, *"Read again"* | *"फिर से पढ़ो"*, *"Dobara padho"* | Re-speaks last parsed text | Speaks previous OCR buffer |
| `OCR_STOP` | *"Stop reading"*, *"Cancel reading"* | *"पढ़ना बंद करो"* | Halts text reading immediately | *"Reading stopped."* |

---

### Category E: Road Hazard Detection
Analyzes walking path road condition, cracks, and surface irregularities.

| Intent | Natural English Examples | Hindi / Hinglish Examples | System Action | Spoken Feedback |
|---|---|---|---|---|
| `HAZARD_START` | *"Start road detection"*, *"Detect potholes"*, *"Look for road cracks"*, *"Check obstacles"* | *"सड़क के गड्ढे देखो"*, *"Gaddhe check karo"*, *"Khadda dekho"* | Runs laplacian surface anomaly heuristic | *"Road alert: 85% likelihood of rough surface or pothole ahead. Walk carefully."* |
| `HAZARD_STOP` | *"Stop road detection"* | *"सड़क चेकिंग बंद करो"* | Stops surface monitoring loop | *"Road hazard detection stopped."* |
| `HAZARD_CHECK_TRAFFIC`| *"Tell me about nearby traffic"*, *"Check traffic"* | *"ट्रैफिक कैसा है?"*, *"Traffic batao"* | Analyzes vehicle approach vectors | *"Caution: 2 vehicles detected in surroundings."* |

---

### Category F: Proximity & Audio Alerts
Controls real-time collision warning beeps and sensitivity.

| Intent | Natural English Examples | Hindi / Hinglish Examples | System Action | Spoken Feedback |
|---|---|---|---|---|
| `PROXIMITY_ENABLE` | *"Enable proximity alerts"*, *"Turn on proximity"* | *"प्रॉक्सिमिटी चालू करो"*, *"Alerts chalu karo"* | Activates obstacle proximity engine | *"Proximity collision alerts enabled."* |
| `PROXIMITY_DISABLE` | *"Disable proximity alerts"*, *"Turn off proximity"* | *"प्रॉक्सिमिटी बंद करो"* | Deactivates proximity engine | *"Proximity alerts disabled."* |
| `PROXIMITY_BEEP_ENABLE` | *"Enable beep"*, *"Turn on warning tone"* | *"बीप चालू करो"*, *"Beep on karo"* | Unmutes collision warning tone | *"Obstacle warning beep enabled."* |
| `PROXIMITY_BEEP_DISABLE`| *"Disable beep"*, *"Mute warning tone"* | *"बीप बंद करो"*, *"Beep off karo"* | Mutes collision warning tone | *"Warning beep muted."* |
| `PROXIMITY_TEST_ALARM` | *"Test alarm"*, *"Test beep sound"* | *"अलार्म टेस्ट करो"*, *"Beep test karo"* | Emits 440Hz test sine tone | *"Testing collision alarm tone."* |
| `PROXIMITY_VOLUME_UP` | *"Increase alert volume"*, *"Alerts louder"* | *"अलार्म की आवाज़ बढ़ाओ"* | Increments audio alert gain | *"Alert volume increased."* |
| `PROXIMITY_VOLUME_DOWN` | *"Reduce alert volume"*, *"Alerts softer"* | *"अलार्म की आवाज़ कम करो"* | Decrements audio alert gain | *"Alert volume reduced."* |

---

### Category G: Remember Feature (Personal Memory)
Records GPS routes, places, and landmarks with spatial safety notices.

| Intent | Natural English Examples | Hindi / Hinglish Examples | System Action | Spoken Feedback |
|---|---|---|---|---|
| `REMEMBER_ROUTE_START` | *"Remember this route"*, *"Start route recording"*, *"Track this route"* | *"यह रास्ता याद रखो"*, *"Rasta record karo"* | Starts GPS breadcrumbs with 2.5m filter | *"Route recording started. Walk your route and tell me when you reach your destination."* |
| `REMEMBER_ROUTE_STOP` | *"Save this route"*, *"Stop route recording"*, *"Save route as College to Library"* | *"रास्ता सेव करो"*, *"Rasta save karo"* | Computes distance & saves to IndexedDB | *"Route saved as College to Library. Total distance is 420 meters."* |
| `REMEMBER_SAVE_PLACE` | *"Save this place"*, *"Remember this place as Home"* | *"यह जगह याद रखो"*, *"Yeh jagah save karo"* | Marks current GPS fix with name | *"Place Home saved at your current GPS location."* |
| `REMEMBER_SHOW_ROUTES` | *"Show saved routes"*, *"List routes"* | *"मेरे रस्ते बताओ"*, *"Saved routes dikhao"* | Queries personal route store | *"You have 3 saved routes: College to Library, Home to Metro..."* |
| `REMEMBER_TAG_LANDMARK` | *"Remember this landmark"*, *"Tag landmark main gate"* | *"लैंडमार्क लगाओ"*, *"Landmark tag karo"* | Attaches named landmark to active route | *"Landmark main gate recorded at 50 meters."* |
| `REMEMBER_SHOW_MEMORIES`| *"Show my saved memories"*, *"What did I save yesterday?"* | *"मेरी यादें बताओ"* | Multi-domain memory search | Speaks summary of matching memories |
| `REMEMBER_DELETE_MEMORY`| *"Delete this memory"*, *"Delete route"* | *"यह याद हटाओ"* | **Requires confirmation!** | *"Are you sure you want to delete this memory? Say yes to confirm."* |

---

### Category H: People Memory (Zero Biometrics)
Manages voluntary cryptographic identity tokens (HMAC-SHA256).

| Intent | Natural English Examples | System Action | Spoken Feedback |
|---|---|---|---|
| `PEOPLE_OPEN` | *"Open people memory"*, *"Contacts"* | Navigates to People Memory | *"Opening People Memory. Navi uses voluntary identity badges with zero facial biometrics."* |
| `PEOPLE_ADD_CONTACT` | *"Add a contact Rahul"* | Saves trusted contact profile | *"Saved Rahul to your contacts."* |
| `PEOPLE_SCAN_BADGE` | *"Scan a shared identity code"*, *"Scan badge"* | Activates camera QR scanner | *"Opening camera scanner. Hold your companion's signed QR badge in view."* |
| `PEOPLE_SHOW_CONTACTS` | *"Show saved contacts"* | Lists verified contacts | *"You have 2 contacts: Friend Rahul, Doctor Sunita."* |
| `PEOPLE_REMOVE_CONTACT` | *"Remove a saved contact"* | **Requires confirmation!** | *"Are you sure you want to remove this contact? Say yes to confirm."* |

---

### Category I: Assistant & Voice Controls
Controls assistant speech rate, volume, language, and emergency silence.

| Intent | Natural English Examples | Hindi / Hinglish Examples | System Action | Spoken Feedback |
|---|---|---|---|---|
| `ASSISTANT_SPEAK_SLOWER`| *"Speak slower"*, *"Talk slower"*, *"Slow down"* | *"धीमे बोलो"*, *"Dheere bolo"* | Decreases TTS rate | *"Speaking slower now."* |
| `ASSISTANT_SPEAK_FASTER`| *"Speak faster"*, *"Talk faster"*, *"Speed up"* | *"तेज़ बोलो"*, *"Jaldi bolo"* | Increases TTS rate | *"Speaking faster now."* |
| `ASSISTANT_VOLUME_UP` | *"Increase volume"*, *"Louder"* | *"आवाज़ बढ़ाओ"*, *"Aawaz badhao"* | Increases TTS volume | *"Volume increased."* |
| `ASSISTANT_VOLUME_DOWN` | *"Decrease volume"*, *"Softer"* | *"आवाज़ कम करो"*, *"Aawaz kam karo"* | Decreases TTS volume | *"Volume decreased."* |
| `ASSISTANT_LANG_HINDI` | *"Change language to Hindi"*, *"Speak in Hindi"* | *"हिंदी में बोलो"*, *"Hindi me bolo"* | Switches recognition & TTS to Hindi | *"भाषा बदलकर हिंदी कर दी गई है।"* |
| `ASSISTANT_LANG_ENGLISH`| *"Change language to English"*, *"Speak in English"* | *"अंग्रेज़ी में बोलो"*, *"English me bolo"* | Switches recognition & TTS to English | *"Language switched to English."* |
| `ASSISTANT_LANG_PUNJABI`| *"Change language to Punjabi"* | *"ਪੰਜਾਬੀ ਵਿੱਚ ਬੋਲੋ"*, *"Punjabi vich bolo"* | Switches recognition & TTS to Punjabi | *"ਭਾਸ਼ਾ ਬਦਲ ਕੇ ਪੰਜਾਬੀ ਕਰ ਦਿੱਤੀ ਗਈ ਹੈ।"* |
| `ASSISTANT_REPEAT` | *"Repeat"*, *"Say that again"*, *"What did you say?"* | *"फिर से बोलो"*, *"Dobara batao"* | Re-announces last assistant response | Repeats cached response |
| `ASSISTANT_STOP_SPEAKING`| *"Stop speaking"*, *"Be quiet"*, *"Shut up"*, *"Silence"* | *"चुप रहो"*, *"शांत हो जाओ"*, *"Chup raho"* | **Instant Emergency Silence Fast-Path** | Immediately halts all audio output |
| `ASSISTANT_HELP` | *"Help"*, *"What can you do?"* | *"मदद"*, *"Kya kar sakte ho?"* | Summarizes core capabilities | *"You can say: open camera, check currency, describe surroundings..."* |

---

### Category J: Navigation & App Settings
Hands-free routing across application views.

| Intent | Voice Command | System Action | Spoken Feedback |
|---|---|---|---|
| `NAV_HOME` | *"Open home"*, *"Go to home"* | Navigates to `/` | *"Navigating to Home."* |
| `NAV_CURRENCY` | *"Open currency reader"*, *"Go to currency"* | Navigates to `/currency` | *"Opening currency reader."* |
| `NAV_CAMERA` | *"Open camera page"*, *"Go to dashboard"* | Navigates to `/dashboard` | *"Opening vision camera."* |
| `NAV_REMEMBER` | *"Open remember"*, *"Go to remember"* | Navigates to `/remember` | *"Opening Remember dashboard."* |
| `NAV_STATUS` | *"Show AI status"*, *"System status"* | Navigates to `/status` | *"Opening AI Status."* |
| `NAV_CAMERA_STATUS` | *"Show camera status"*, *"Camera diagnostics"* | Navigates to `/dashboard#diagnostics`| *"Showing camera status on dashboard."* |
