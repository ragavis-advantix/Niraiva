export interface RouteDefinition {
  path: string;
  aliases: string[];
  section?: string;
  action?: string;
}

export const routes: RouteDefinition[] = [

  {
    path: '/dashboard',
    aliases: ['dashboard', 'home', 'main', 'go to dashboard', 'show dashboard', 'take me to dashboard']
  },
  {
    path: '/dashboard',
    aliases: ['health parameters', 'key health', 'show health parameters', 'view health parameters'],
    section: 'parameters'
  },
  {
    path: '/dashboard',
    aliases: ['chronic conditions', 'show conditions', 'view conditions', 'medical conditions'],
    section: 'conditions'
  },
  {
    path: '/dashboard',
    aliases: ['profile information', 'show profile', 'view profile', 'my profile'],
    section: 'profile'
  },
  {
    path: '/dashboard',
    aliases: ['medications', 'current medications', 'show medications', 'view medications'],
    section: 'medications'
  },
  {
    path: '/timeline',
    aliases: ['timeline', 'history', 'go to timeline', 'show timeline', 'show history', 'view timeline']
  },
  {
    path: '/timeline',
    aliases: ['show tests', 'filter tests', 'view tests', 'show test results'],
    action: 'filter',
    section: 'test'
  },
  {
    path: '/timeline',
    aliases: ['show treatments', 'filter treatments', 'view treatments'],
    action: 'filter',
    section: 'treatment'
  },
  {
    path: '/timeline',
    aliases: ['show medications', 'filter medications', 'view medications', 'show medicine'],
    action: 'filter',
    section: 'medication'
  },
  {
    path: '/timeline',
    aliases: ['show appointments', 'filter appointments', 'view appointments'],
    action: 'filter',
    section: 'appointment'
  },
  {
    path: '/timeline',
    aliases: ['show diagnoses', 'filter diagnoses', 'view diagnoses', 'show diagnosis'],
    action: 'filter',
    section: 'diagnosis'
  },
  {
    path: '/diagnostic',
    aliases: ['diagnostic', 'diagnosis', 'go to diagnostic', 'show diagnostic', 'medical diagnostic', 'view diagnostic']
  },
  {
    path: '/diagnostic',
    aliases: ['show pathway', 'view pathway', 'condition pathway', 'diagnostic pathway'],
    section: 'pathway'
  },
  {
    path: '/diagnostic',
    aliases: ['diabetes', 'type 2 diabetes', 'show diabetes', 'view diabetes'],
    section: 'condition-cond-001'
  },
  {
    path: '/diagnostic',
    aliases: ['hypertension', 'blood pressure', 'show hypertension', 'view hypertension'],
    section: 'condition-cond-002'
  },
  {
    path: '/diagnostic',
    aliases: ['hyperlipidemia', 'cholesterol', 'show hyperlipidemia', 'view hyperlipidemia'],
    section: 'condition-cond-003'
  },
  {
    path: '/diagnostic',
    aliases: ['treatment', 'current treatment', 'show treatment', 'view treatment'],
    section: 'treatment'
  },
  {
    path: '/diagnostic',
    aliases: ['clinical notes', 'show notes', 'view notes', 'medical notes'],
    section: 'clinical-notes'
  },
  {
    path: '/login',
    aliases: ['login', 'sign in', 'go to login', 'show login']
  },
  {
    path: '/login',
    aliases: ['start', 'landing', 'go to start', 'main page', 'home page']
  },
  {
    path: '/login',
    aliases: ['logout', 'sign out', 'log out', 'exit', 'sign me out', 'end session']
  }
];

export interface RouteResult {
  path: string;
  section?: string;
  action?: string;
}

export function findRouteByCommand(command: string): RouteResult | null {
  const normalizedCommand = command.toLowerCase().trim();
  
  for (const route of routes) {
    if (route.aliases.some(alias => 
      normalizedCommand.includes(alias.toLowerCase()) ||
      normalizedCommand === alias.toLowerCase()
    )) {
      return {
        path: route.path,
        section: route.section,
        action: route.action
      };
    }
  }
  
  return null;
}