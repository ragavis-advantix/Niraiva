import type { UpdateInstruction } from '@/components/VoiceCommand';
import { findRouteByCommand } from './routes';

interface HealthParameterValue {
  id: string;
  name: string;
  value: string | number;
  unit: string;
  status: 'normal' | 'warning' | 'critical';
  timestamp: string;
}

interface MedicationValue {
  name: string;
  dosage?: string;
  frequency?: string;
  startDate?: string;
}

interface ChronicConditionValue {
  id: string;
  name: string;
  diagnosedDate: string;
  severity: 'mild' | 'moderate' | 'severe';
  currentStatus: 'controlled' | 'uncontrolled' | 'improving' | 'worsening';
  relatedParameters: string[];
}

interface TimelineEventValue {
  id: string;
  date: string;
  title: string;
  description: string;
  type: 'test' | 'diagnosis' | 'treatment' | 'medication' | 'appointment';
  status: 'completed' | 'pending' | 'missed' | 'active';
}

// Helper function to capitalize first letter of each word
function capitalizeWords(str: string): string {
  return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

// Parse a command string for allergy-related actions
export function parseAllergyCommand(command: string): UpdateInstruction | null {
  console.log('[Allergy Command] Processing:', command);
  const words = command.toLowerCase().split(' ');
  const isAdd = ['add', 'new'].includes(words[0]);
  const isRemove = ['remove', 'delete'].includes(words[0]);
  const allergyIndex = words.indexOf('allergy');
  
  if (allergyIndex >= 0 && (isAdd || isRemove)) {
    const allergyName = words.slice(allergyIndex + 1).join(' ').trim();
    if (!allergyName) return null;

    return {
      op: isAdd ? 'add' : 'delete',
      section: 'allergies',
      value: capitalizeWords(allergyName)
    };
  }

  return null;
}

// Parse profile updates (BMI, Height, Weight)
export function parseProfileCommand(command: string): UpdateInstruction | null {
  console.log('[Profile Command] Processing:', command);
  const lower = command.toLowerCase();
  const words = lower.split(/\s+/);

  // Known numeric metrics
  const numericMetrics: Record<string, { unit?: string }> = {
    bmi: { unit: '' },
    height: { unit: 'cm' },
    weight: { unit: 'kg' }
  };

  // Check numeric metrics anywhere in the phrase and find the nearest number after the metric
  for (const metric of Object.keys(numericMetrics)) {
    const idx = words.indexOf(metric);
    if (idx !== -1) {
      // Search for the first numeric token after the metric
      for (let i = idx + 1; i < words.length; i++) {
        const numMatch = words[i].match(/[-+]?[0-9]*\.?[0-9]+/);
        if (numMatch) {
          const value = parseFloat(numMatch[0]);
          if (!isNaN(value)) {
            return {
              op: 'update',
              section: 'profile',
              key: metric,
              value
            };
          }
        }
      }
      return null;
    }
  }

  // Blood type and other string profile fields
  // e.g., "blood type O positive" or "blood type o+"
  if (lower.includes('blood type') || lower.includes('bloodtype')) {
    // find token after 'blood' or 'blood type'
    const bIndex = words.indexOf('blood');
    let valTokens: string[] = [];
    if (bIndex !== -1) {
      if (words[bIndex + 1] === 'type') {
        valTokens = words.slice(bIndex + 2);
      } else {
        valTokens = words.slice(bIndex + 1);
      }
    }

    const raw = valTokens.join(' ').trim();
    if (!raw) return null;

    return {
      op: 'update',
      section: 'profile',
      key: 'blood_type',
      value: capitalizeWords(raw)
    };
  }

  // Fallback: if phrase contains 'add' or 'set' and then a key/value pattern
  // try to extract patterns like "add <field> <value>"
  const verbs = ['add', 'set', 'update'];
  if (verbs.includes(words[0]) && words.length >= 3) {
    // take second token as key and rest as value
    const key = words[1].replace(/[^a-z0-9_]/g, '_');
    const val = words.slice(2).join(' ');
    if (!val) return null;

    return {
      op: 'update',
      section: 'profile',
      key,
      value: capitalizeWords(val)
    };
  }

  return null;
}

// Parse medication commands
export function parseMedicationCommand(command: string): UpdateInstruction | null {
  console.log('[Medication Command] Processing:', command);
  const words = command.toLowerCase().split(' ');
  const isAdd = ['add', 'new'].includes(words[0]);
  const isRemove = ['remove', 'delete'].includes(words[0]);
  const isUpdate = words[0] === 'update';
  const medicationIndex = words.indexOf('medication');
  
  if (medicationIndex < 0) return null;
  
  const medicationName = capitalizeWords(words[medicationIndex + 1]);
  if (!medicationName) return null;

  if (isAdd) {
    const dosageIndex = words.indexOf('mg');
    const frequency = words.slice(dosageIndex + 1).join(' ').trim();
    
    return {
      op: 'add',
      section: 'medications',
      value: {
        name: medicationName,
        dosage: dosageIndex > -1 ? `${words[dosageIndex - 1]}mg` : undefined,
        frequency: frequency || undefined,
        startDate: new Date().toISOString().split('T')[0]
      }
    };
  } else if (isRemove) {
    return {
      op: 'delete',
      section: 'medications',
      value: medicationName
    };
  } else if (isUpdate) {
    const dosageIndex = words.indexOf('dosage');
    if (dosageIndex > -1) {
      const newDosage = words[dosageIndex + 2] + 'mg';
      return {
        op: 'update',
        section: 'medications',
        key: medicationName,
        value: { dosage: newDosage }
      };
    }
  }

  return null;
}

// Parse health parameter commands
export function parseHealthCommand(command: string): UpdateInstruction | null {
  console.log('[Health Command] Processing:', command);
  const words = command.toLowerCase().split(' ');
  // Accept multiple verbs: add, record, edit, set, update
  if (!['add', 'record', 'edit', 'set', 'update'].includes(words[0])) return null;

  const parameters = {
    'blood pressure': {
      name: 'Blood Pressure',
      unit: 'mmHg',
      parseValue: (val: string) => val
    },
    'heart rate': {
      name: 'Heart Rate',
      unit: 'bpm',
      parseValue: (val: string) => parseInt(val)
    },
    'blood glucose': {
      name: 'Blood Glucose',
      unit: 'mg/dL',
      parseValue: (val: string) => parseInt(val)
    },
    'temperature': {
      name: 'Temperature',
      unit: 'C',
      parseValue: (val: string) => parseFloat(val)
    },
    'oxygen': {
      name: 'Oxygen Saturation',
      unit: '%',
      parseValue: (val: string) => parseInt(val)
    }
  };

  for (const [param, config] of Object.entries(parameters)) {
    if (command.includes(param)) {
      const valueIndex = words.findIndex(w => !isNaN(parseInt(w)));
      if (valueIndex === -1) return null;

      const value = config.parseValue(words[valueIndex]);
      const status = getParameterStatus(param, value);
      // Determine operation: editing verbs should result in 'update'
      const verb = words[0];
      const op: UpdateInstruction['op'] = ['edit', 'set', 'update'].includes(verb) ? 'update' : 'add';

      return {
        op,
        section: 'healthParameters',
        // Do not include an id here. For updates where no explicit id (key)
        // is provided, DataContext will resolve the latest parameter record
        // by name and perform the update.
        value: {
          name: config.name,
          value,
          unit: config.unit,
          status,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  return null;
}

// Parse chronic condition commands
export function parseChronicConditionCommand(command: string): UpdateInstruction | null {
  console.log('[Chronic Condition Command] Processing:', command);
  const words = command.toLowerCase().split(' ');
  const isAdd = words[0] === 'add' && words.includes('condition');
  const isRemove = words[0] === 'remove' && words.includes('condition');
  const isUpdate = words[0] === 'update' && words.includes('condition');
  
  if (!isAdd && !isRemove && !isUpdate) return null;
  
  const startIndex = words.indexOf('condition') + 1;
  if (startIndex >= words.length) return null;
  
  const conditionName = capitalizeWords(words.slice(startIndex).join(' '));
  
  if (isAdd) {
    return {
      op: 'add',
      section: 'chronicConditions',
      value: {
        name: conditionName,
        diagnosedDate: new Date().toISOString().split('T')[0],
        severity: 'moderate',
        currentStatus: 'controlled',
        relatedParameters: []
      }
    };
  } else if (isRemove) {
    return {
      op: 'delete',
      section: 'chronicConditions',
      value: conditionName
    };
  } else if (isUpdate) {
    const severityIndex = words.indexOf('severity');
    const statusIndex = words.indexOf('status');
    
    if (severityIndex > -1) {
      const severity = words[severityIndex + 1] as ChronicConditionValue['severity'];
      return {
        op: 'update',
        section: 'chronicConditions',
        key: conditionName,
        value: { severity }
      };
    } else if (statusIndex > -1) {
      const status = words[statusIndex + 1] as ChronicConditionValue['currentStatus'];
      return {
        op: 'update',
        section: 'chronicConditions',
        key: conditionName,
        value: { currentStatus: status }
      };
    }
  }

  return null;
}

// Parse timeline event commands
export function parseTimelineEventCommand(command: string): UpdateInstruction | null {
  console.log('[Timeline Event Command] Processing:', command);
  const words = command.toLowerCase().split(' ');
  if (words[0] !== 'add') return null;

  const types = {
    appointment: ['appointment'],
    test: ['lab test', 'blood work', 'test'],
    diagnosis: ['diagnosis'],
    treatment: ['treatment'],
    medication: ['medication change']
  };

  let eventType: TimelineEventValue['type'] | null = null;
  let typeIndex = -1;

  for (const [type, aliases] of Object.entries(types)) {
    for (const alias of aliases) {
      const index = command.toLowerCase().indexOf(alias);
      if (index !== -1) {
        eventType = type as TimelineEventValue['type'];
        typeIndex = index;
        break;
      }
    }
    if (eventType) break;
  }

  if (!eventType || typeIndex === -1) return null;

  const dateIndex = command.toLowerCase().indexOf(' on ');
  if (dateIndex === -1) return null;

  const dateStr = words.slice(dateIndex + 2).join(' ');
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;

  const title = capitalizeWords(command.slice(typeIndex, dateIndex));

  return {
    op: 'add',
    section: 'timelineEvents',
    value: {
      date: date.toISOString().split('T')[0],
      title,
      description: `Scheduled ${title.toLowerCase()}`,
      type: eventType,
      status: 'pending'
    }
  };
}

// Debug logger
function logCommand(parser: string, input: string, result: any) {
  console.log(`[Voice Command Debug] ${parser}:`);
  console.log('  Input:', input);
  console.log('  Result:', result);
  console.log('  Timestamp:', new Date().toISOString());
}

// Parse voice command to determine action type
export function parseVoiceCommand(command: string): { 
  type: 'profile' | 'allergy' | 'medication' | 'health' | 'condition' | 'timeline' | 'navigation', 
  command: string 
} | null {
  console.log('\n[Voice Command] Received:', command);
  const words = command.toLowerCase().split(' ');
  
  // Profile updates
  const metricWords = ['bmi', 'height', 'weight'];
  const hasMetric = metricWords.some(m => words.includes(m));
  const hasNumber = /\d/.test(command);
  // Accept both explicit "set/update" commands and shorthand like "height 175 cm"
  if ((['set', 'update'].includes(words[0]) && hasMetric) || (hasMetric && hasNumber)) {
    const result = { type: 'profile' as const, command };
    logCommand('Profile Parser', command, result);
    return result;
  }
  
  // Allergies
  if (words.includes('allergy')) {
    const result = { type: 'allergy' as const, command };
    logCommand('Allergy Parser', command, result);
    return result;
  }
  
  // Medications
  if (words.includes('medication')) {
    const result = { type: 'medication' as const, command };
    logCommand('Medication Parser', command, result);
    return result;
  }
  
  // Health parameters
  const healthParams = ['blood pressure', 'heart rate', 'blood glucose', 'temperature', 'oxygen'];
  for (const param of healthParams) {
    if (command.toLowerCase().includes(param)) {
      const result = { type: 'health' as const, command };
      logCommand('Health Parameter Parser', command, result);
      return result;
    }
  }
  
  // Chronic conditions
  if (words.includes('condition')) {
    const result = { type: 'condition' as const, command };
    logCommand('Chronic Condition Parser', command, result);
    return result;
  }
  
  // Timeline events
  const timelineEvents = ['appointment', 'test', 'diagnosis', 'treatment', 'medication change'];
  if (timelineEvents.some(e => command.includes(e)) && command.includes(' on ')) {
    const result = { type: 'timeline' as const, command };
    logCommand('Timeline Event Parser', command, result);
    return result;
  }
  
  // Navigation (check last as it's the fallback)
  const route = findRouteByCommand(command);
  if (route) {
    const result = { type: 'navigation' as const, command };
    logCommand('Navigation Parser', command, { ...result, route });
    return result;
  }
  
  console.log('[Voice Command] No matching parser found');
  return null;
}

// Helper function to determine parameter status
function getParameterStatus(parameter: string, value: string | number): 'normal' | 'warning' | 'critical' {
  type RangeChecker = {
    normal: (v: string | number) => boolean;
    warning: (v: string | number) => boolean;
  };

  const ranges: Record<string, RangeChecker> = {
    'blood pressure': {
      normal: (v: string | number) => {
        if (typeof v !== 'string') return false;
        const [sys, dia] = v.split('/').map(Number);
        return sys >= 90 && sys <= 120 && dia >= 60 && dia <= 80;
      },
      warning: (v: string | number) => {
        if (typeof v !== 'string') return false;
        const [sys, dia] = v.split('/').map(Number);
        return (sys > 120 && sys <= 140) || (dia > 80 && dia <= 90);
      }
    },
    'heart rate': {
      normal: (v: string | number) => {
        const val = typeof v === 'string' ? parseInt(v) : v;
        return val >= 60 && val <= 100;
      },
      warning: (v: string | number) => {
        const val = typeof v === 'string' ? parseInt(v) : v;
        return (val > 100 && val <= 120) || (val >= 50 && val < 60);
      }
    },
    'blood glucose': {
      normal: (v: string | number) => {
        const val = typeof v === 'string' ? parseInt(v) : v;
        return val >= 70 && val <= 140;
      },
      warning: (v: string | number) => {
        const val = typeof v === 'string' ? parseInt(v) : v;
        return (val > 140 && val <= 200) || (val >= 50 && val < 70);
      }
    },
    'temperature': {
      normal: (v: string | number) => {
        const val = typeof v === 'string' ? parseFloat(v) : v;
        return val >= 36.1 && val <= 37.2;
      },
      warning: (v: string | number) => {
        const val = typeof v === 'string' ? parseFloat(v) : v;
        return (val > 37.2 && val <= 38) || (val >= 35 && val < 36.1);
      }
    },
    'oxygen': {
      normal: (v: string | number) => {
        const val = typeof v === 'string' ? parseInt(v) : v;
        return val >= 95 && val <= 100;
      },
      warning: (v: string | number) => {
        const val = typeof v === 'string' ? parseInt(v) : v;
        return val >= 90 && val < 95;
      }
    }
  };

  const range = ranges[parameter as keyof typeof ranges];
  if (!range) return 'normal';

  if (range.normal(value)) return 'normal';
  if (range.warning(value)) return 'warning';
  return 'critical';
}