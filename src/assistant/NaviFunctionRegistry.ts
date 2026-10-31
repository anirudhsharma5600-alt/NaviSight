/**
 * NaviAble AI — Function & Tool Registry for Gemini Multimodal Live Assistant
 * 
 * Standard Gemini tool/function declaration schema.
 * All tools correspond to real capabilities implemented in NaviToolRouter.
 */

export interface ToolParameterProperty {
  type: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'ARRAY' | 'OBJECT'
  description: string
  enum?: string[]
}

export interface NaviToolDeclaration {
  name: string
  description: string
  parameters: {
    type: 'OBJECT'
    properties: Record<string, ToolParameterProperty>
    required?: string[]
  }
}

export const NAVI_TOOLS: NaviToolDeclaration[] = [
  {
    name: 'startRouteRecording',
    description: 'Start recording a new walking route with GPS coordinates and timestamps.',
    parameters: {
      type: 'OBJECT',
      properties: {
        routeName: {
          type: 'STRING',
          description: 'Descriptive name for the route (e.g. "College to Library", "Home to Bus Stop").'
        },
        startLocation: {
          type: 'STRING',
          description: 'Name of the departure point (e.g. "Main Gate", "Apartment").'
        }
      },
      required: ['routeName']
    }
  },
  {
    name: 'stopAndSaveRoute',
    description: 'Stop the active route recording and save the path and landmarks to memory.',
    parameters: {
      type: 'OBJECT',
      properties: {
        routeName: {
          type: 'STRING',
          description: 'Final name of the route.'
        },
        endLocation: {
          type: 'STRING',
          description: 'Destination reached (e.g. "Library entrance", "Bus Stand").'
        }
      }
    }
  },
  {
    name: 'addRouteLandmark',
    description: 'Tag a landmark with voice note along the currently recording route.',
    parameters: {
      type: 'OBJECT',
      properties: {
        landmarkName: {
          type: 'STRING',
          description: 'Name of the landmark (e.g. "Speed breaker", "Cafeteria door", "Pedestrian crossing").'
        },
        voiceNote: {
          type: 'STRING',
          description: 'Optional additional voice note about this landmark.'
        }
      },
      required: ['landmarkName']
    }
  },
  {
    name: 'recallRoute',
    description: 'Retrieve details, landmarks, distance, and safety reminder for a saved route.',
    parameters: {
      type: 'OBJECT',
      properties: {
        routeName: {
          type: 'STRING',
          description: 'Name or query of the saved route.'
        }
      },
      required: ['routeName']
    }
  },
  {
    name: 'getSavedRoutes',
    description: 'List all routes saved in personal memory.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'savePlace',
    description: 'Save a named place (e.g. "Home", "Office", "Clinic") with current GPS position.',
    parameters: {
      type: 'OBJECT',
      properties: {
        placeName: {
          type: 'STRING',
          description: 'Name of the place.'
        },
        description: {
          type: 'STRING',
          description: 'Optional description or instructions for this place.'
        }
      },
      required: ['placeName']
    }
  },
  {
    name: 'saveVisualMemory',
    description: 'Capture and save a visual memory of the current scene/room/doorway for future recognition.',
    parameters: {
      type: 'OBJECT',
      properties: {
        memoryName: {
          type: 'STRING',
          description: 'Name of the visual landmark or scene (e.g. "College Entrance", "My Desk", "Metro Turnstile").'
        },
        description: {
          type: 'STRING',
          description: 'Detailed description of the scene.'
        }
      },
      required: ['memoryName']
    }
  },
  {
    name: 'checkSceneResemblance',
    description: 'Check if the current camera view matches or resembles any saved visual memory.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'scanCurrency',
    description: 'Trigger two-stage banknote detection on the current camera feed to recognize Indian Rupee denominations.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'describeScene',
    description: 'Describe objects, people, road hazards, and layout in front of the camera.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'saveContact',
    description: 'Save a contact profile into People Memory (without biometric facial recognition).',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: {
          type: 'STRING',
          description: 'Full name of the contact.'
        },
        nickname: {
          type: 'STRING',
          description: 'Short name or nickname.'
        },
        relationship: {
          type: 'STRING',
          description: 'Relationship category.',
          enum: ['Friend', 'Family', 'Colleague', 'Caregiver', 'Doctor', 'Acquaintance', 'Other']
        }
      },
      required: ['name']
    }
  },
  {
    name: 'searchMemories',
    description: 'Search across all saved routes, places, people, and visual memories.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: {
          type: 'STRING',
          description: 'Keywords to search in personal memory.'
        }
      },
      required: ['query']
    }
  }
]
