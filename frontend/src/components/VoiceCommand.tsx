'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { addAllergy, removeAllergy } from '@/utils/profileUpdates';
import { 
  parseVoiceCommand, 
  parseAllergyCommand, 
  parseHealthCommand, 
  parseMedicationCommand,
  parseProfileCommand,
  parseChronicConditionCommand,
  parseTimelineEventCommand,
} from '@/utils/voiceCommands';
import { addHealthParameter } from '@/utils/healthData';
import { findRouteByCommand } from '@/utils/routes';

const SILENCE_CONFIG = {
  minDecibels: -65,
  silenceThreshold: -40,
  maxSilenceLength: 2000,
};

export interface UpdateInstruction {
  op: 'add' | 'delete' | 'update';
  section: string;
  key?: string;
  value: any;
  subsection?: string;
}

interface VoiceCommandProps {
  className?: string;
}

declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

export function VoiceCommand({ className }: VoiceCommandProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const navigate = useNavigate();
  const { applyUpdate, refreshUserData } = useData();
  const { user } = useAuth();

  // Speech recognition ref
  const recognitionRef = useRef<any>(null);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.stop?.();
      } catch (e) {
        // ignore
      }
      recognitionRef.current = null;
    }
    setIsRecording(false);
    setIsProcessing(false);
  }, []);

  // Effect for cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  // Start recording function
  const startRecording = useCallback(async () => {
    cleanup(); // ensure clean state

    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          recognitionRef.current = recognition;
          setIsRecording(true);
          console.log('🎤 Speech recognition started');
        };

        recognition.onerror = (e: any) => {
          console.error('SpeechRecognition error', e);
          toast({ variant: 'destructive', title: 'Speech error', description: 'Speech recognition failed' });
          setIsRecording(false);
          recognitionRef.current = null;
        };

        recognition.onresult = async (event: any) => {
          setIsProcessing(true);
          try {
            const text = event.results[0][0].transcript.trim();
            console.log('🗣️ Transcribed text:', text);

            if (!user?.id) {
              toast({ variant: 'destructive', description: 'Please sign in to use voice commands' });
              return;
            }

            const parsedCommand = parseVoiceCommand(text);
            if (!parsedCommand) {
              toast({ description: 'Command not recognized' });
              return;
            }

            // Unified parser -> UpdateInstruction flow. Each parseX function
            // returns an UpdateInstruction or null. We apply it via applyUpdate
            // so DB mutations are handled centrally in DataContext.
            try {
              let instruction: UpdateInstruction | null = null;

              switch (parsedCommand.type) {
                case 'allergy':
                  instruction = parseAllergyCommand(text);
                  break;
                case 'profile':
                  instruction = parseProfileCommand(text);
                  break;
                case 'health':
                  instruction = parseHealthCommand(text);
                  break;
                case 'medication':
                  instruction = parseMedicationCommand(text);
                  break;
                case 'condition':
                  instruction = parseChronicConditionCommand(text);
                  break;
                case 'timeline':
                  instruction = parseTimelineEventCommand(text);
                  break;
                case 'navigation': {
                  const route = findRouteByCommand(text);
                  console.log('[Navigation] Found route:', route);
                  if (route && route.path) {
                    console.log('[Navigation] Navigating to:', route.path);
                    navigate(route.path);
                    toast({ description: `Navigating to ${route.path}` });
                  } else {
                    console.error('[Navigation] Invalid route:', route);
                    toast({ variant: 'destructive', description: 'Invalid navigation route' });
                  }
                  break;
                }
                default:
                  instruction = null;
              }

              if (instruction) {
                await applyUpdate(instruction as any);
                await refreshUserData();

                // Friendly toast message
                const section = instruction.section ?? 'profile';
                const opText = instruction.op === 'add' ? 'Added' : instruction.op === 'delete' ? 'Removed' : 'Updated';
                let valueText = '';
                try {
                  valueText = typeof instruction.value === 'string' ? instruction.value : JSON.stringify(instruction.value);
                } catch { valueText = String(instruction.value); }

                toast({ description: `${opText} ${section}: ${valueText}` });
              } else if (parsedCommand.type !== 'navigation') {
                toast({ description: 'Invalid command format or unsupported action' });
              }
            } catch (error) {
              console.error('Error processing voice command:', error);
              toast({ variant: 'destructive', description: 'Failed to process command' });
            }
          } catch (error) {
            console.error('Error processing voice command:', error);
            toast({ variant: 'destructive', description: 'Failed to process command' });
          } finally {
            cleanup();
          }
        };

        recognition.onend = () => {
          setIsRecording(false);
          recognitionRef.current = null;
        };

        recognition.start();
      } else {
        toast({ variant: 'destructive', description: 'Speech recognition not supported in this browser' });
      }
    } catch (err) {
      console.error('Failed to start speech recognition', err);
      toast({ variant: 'destructive', description: 'Failed to start speech recognition' });
      cleanup();
    }
  }, [cleanup, user, navigate, applyUpdate, refreshUserData]);

  // Stop recording function
  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    cleanup();
  }, [cleanup]);

  return (
    <motion.div className={className}>
      <AnimatePresence mode="wait">
        {isProcessing ? (
          <motion.div
            key="processing"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', duration: 0.25 }}
          >
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Processing...</div>
            <div className="flex justify-center space-x-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <motion.div
                  key={i}
                  animate={{ scale: [1, 1.4, 1] }}
                  transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.15 }}
                  className="w-2 h-2 rounded-full bg-blue-500"
                />
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.button
            key="record"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => (isRecording ? stopRecording() : startRecording())}
            className={`p-3 rounded-full transition-colors ${
              isRecording
                ? 'bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/20 dark:text-red-400'
                : 'bg-blue-100 text-blue-600 hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-400'
            }`}
          >
            {isRecording ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}