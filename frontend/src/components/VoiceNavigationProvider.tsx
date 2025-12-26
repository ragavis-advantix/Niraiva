'use client';

import React from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { findRouteByCommand } from '@/utils/routes';
import { toast } from '@/hooks/use-toast';

// Silence detection configuration
const SILENCE_CONFIG = {
  fftSize: 2048,          
  minDecibels: -90,       
  maxDecibels: -10,       
  smoothingTime: 0.8,     
  silenceThreshold: -50,  
  maxSilenceLength: 1500, 
  volumeThreshold: 0.2    
} as const;

interface VoiceCommandProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  webhookUrl: string;
}

export const VoiceCommand = React.memo(({ className, webhookUrl, ...props }: VoiceCommandProps) => {
  // State
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Navigation
  const navigate = useNavigate();
  
  // Refs for audio processing
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const silenceStartRef = useRef<number>(0);
  const volumeCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Audio cleanup
  const cleanup = useCallback(() => {
    if (volumeCheckIntervalRef.current) {
      clearInterval(volumeCheckIntervalRef.current);
      volumeCheckIntervalRef.current = null;
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }

    if (audioContextRef.current?.state === 'running') {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
    }

    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      const stream = mediaRecorderRef.current.stream;
      stream.getTracks().forEach(track => track.stop());
    }

    setIsRecording(false);
    silenceStartRef.current = 0;
  }, []);

  // Audio analysis setup
  const setupAudioAnalysis = useCallback(async (stream: MediaStream) => {
    try {
      // Initialize audio context
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioContext({ latencyHint: 'interactive' });
      await audioContextRef.current.resume();

      // Create and configure nodes
      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      
      analyserRef.current.fftSize = SILENCE_CONFIG.fftSize;
      analyserRef.current.minDecibels = SILENCE_CONFIG.minDecibels;
      analyserRef.current.maxDecibels = SILENCE_CONFIG.maxDecibels;
      analyserRef.current.smoothingTimeConstant = SILENCE_CONFIG.smoothingTime;

      // Connect nodes
      sourceRef.current.connect(analyserRef.current);

      // Setup volume monitoring
      const processAudio = () => {
        if (!analyserRef.current) return;

        const analyser = analyserRef.current;
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        
        // Calculate average volume
        const average = dataArray.reduce((acc, value) => acc + value, 0) / dataArray.length;
        const normalizedVolume = average / 255;
        
        // Check for silence
        if (normalizedVolume < SILENCE_CONFIG.volumeThreshold) {
          if (silenceStartRef.current === 0) {
            silenceStartRef.current = Date.now();
          } else if (Date.now() - silenceStartRef.current >= SILENCE_CONFIG.maxSilenceLength) {
            cleanup();
            return;
          }
        } else {
          silenceStartRef.current = 0;
        }
      };

      volumeCheckIntervalRef.current = setInterval(processAudio, 100);

    } catch (error) {
      console.error('Error setting up audio analysis:', error);
      cleanup();
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to set up audio processing"
      });
    }
  }, [cleanup]);

  // Recording start handler
  const startRecording = useCallback(async () => {
    try {
      cleanup();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      await setupAudioAnalysis(stream);

      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        setIsProcessing(true);
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });

        try {
          const formData = new FormData();
          formData.append('audio', audioBlob);

          const response = await fetch(webhookUrl, {
            method: 'POST',
            body: formData
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const data = await response.json();

          if (data.command) {
            const targetRoute = findRouteByCommand(data.command);
            if (targetRoute) {
              if (data.command.toLowerCase().includes('login')) {
                navigate('/login');
              } else {
                navigate(targetRoute);
              }
              toast({
                title: "Success",
                description: `Navigating to ${targetRoute}`,
              });
            } else {
              toast({
                variant: "destructive",
                title: "Error",
                description: "Command not recognized"
              });
            }
          }
        } catch (error) {
          console.error('Error processing audio:', error);
          toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to process audio"
          });
        } finally {
          audioChunksRef.current = [];
          cleanup();
          setIsProcessing(false);
        }
      };

      mediaRecorderRef.current.start(1000);
      setIsRecording(true);

    } catch (error) {
      console.error('Error starting recording:', error);
      cleanup();
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to start recording"
      });
    }
  }, [cleanup, setupAudioAnalysis, webhookUrl, navigate]);

  // Recording stop handler
  const stopRecording = useCallback(() => {
    if (!isRecording) return;
    
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    cleanup();
  }, [isRecording, cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return React.createElement('div', { className, ...props },
    React.createElement(AnimatePresence, { mode: 'wait' },
      isProcessing ? (
        React.createElement(motion.div, {
          key: 'processing',
          initial: { scale: 0.8, opacity: 0 },
          animate: { scale: 1, opacity: 1 },
          exit: { scale: 0.8, opacity: 0 },
          transition: { type: 'spring', duration: 0.3 }
        }, [
          React.createElement('div', {
            key: 'processing-text',
            className: 'text-xs text-gray-500 dark:text-gray-400 mb-1'
          }, 'Processing...'),
          React.createElement('div', {
            key: 'processing-dots',
            className: 'flex justify-center space-x-1'
          }, [
            React.createElement(motion.div, {
              key: 'processing-dot',
              animate: { scale: [1, 1.2, 1] },
              transition: { repeat: Infinity, duration: 1.5 },
              className: 'w-2 h-2 rounded-full bg-blue-500'
            })
          ])
        ])
      ) : (
        React.createElement(motion.button, {
          key: 'record',
          whileHover: { scale: 1.1 },
          whileTap: { scale: 0.9 },
          onClick: isRecording ? stopRecording : startRecording,
          className: `p-3 rounded-full transition-colors ${
            isRecording
              ? 'bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/20 dark:text-red-400'
              : 'bg-blue-100 text-blue-600 hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-400'
          }`
        }, [
          React.createElement(isRecording ? MicOff : Mic, {
            key: 'mic-icon',
            className: 'w-6 h-6'
          })
        ])
      )
    )
  );
});