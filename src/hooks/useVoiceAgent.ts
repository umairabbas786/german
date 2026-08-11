import { useRef, useState } from "react";
import { UserTracker } from "../utils/userTracking";

/**
 * Simplified Voice Agent Hook
 * 
 * The frontend now acts as a simple audio router:
 * - Captures microphone audio and streams it to backend (LINEAR16 PCM, 16kHz)
 * - Backend handles ALL processing: STT, turn detection (RMS-based), LLM, TTS
 * - Receives audio chunks and status updates from backend
 * - Plays received audio
 * 
 * This architecture ensures compatibility across ALL devices and browsers.
 */

interface UseVoiceAgentOptions {
  onCreditsUpdate?: (creditsLeft: number) => void;
  onLimitReached?: (message: string) => void;
  onDurationUpdate?: (seconds: number) => void;
  onSuggestion?: (suggestion: string) => void;
}

interface StartAgentOptions {
  useV2Tracking?: boolean;
  roadmapItemKey?: string;
}

export function useVoiceAgent(apiUrl: string, options?: UseVoiceAgentOptions) {
  const { onCreditsUpdate, onLimitReached, onDurationUpdate, onSuggestion } = options || {};
  // UI State
  const [aiText, setAiText] = useState("");
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const isMutedRef = useRef(false); // Track if user is muted (during AI states)
  const userMutedRef = useRef(false); // Track if user has manually muted (persists across turns)

  // Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null);
  const agentActiveRef = useRef(false);
  const levelRef = useRef("A1");
  const scenarioRef = useRef("At the Cafe");

  // MediaSource refs for JIT audio playback
  const mediaSourceRef = useRef<MediaSource | null>(null);
  const sourceBufferRef = useRef<SourceBuffer | null>(null);
  const audioQueueRef = useRef<Uint8Array[]>([]);
  const isPlaybackInitialized = useRef(false);
  const pendingAiTextRef = useRef(""); // Buffer for AI text until audio starts
  const isDoneReceivedRef = useRef(false); // Track if 'done' message received

  // Audio playback state
  const currentAudioChunks = useRef<Uint8Array[]>([]);

  const stopAgent = () => {
    console.log("[useVoiceAgent] Stopping agent...");
    agentActiveRef.current = false;

    // Stop microphone
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    // Disconnect audio worklet
    if (audioWorkletNodeRef.current) {
      audioWorkletNodeRef.current.disconnect();
      audioWorkletNodeRef.current = null;
    }

    // Close AudioContext fully so the next call gets a fresh pipeline.
    // Without this, the old worklet node graph stays half-alive and the new
    // call's source node connects to a broken destination.
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    // Close WebSocket
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    // Stop audio playback and cleanup MediaSource
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current.load();
    }

    // Clean up MediaSource
    if (mediaSourceRef.current && mediaSourceRef.current.readyState === "open") {
      try {
        mediaSourceRef.current.endOfStream();
      } catch {
        // Ignore errors during cleanup
      }
    }
    mediaSourceRef.current = null;
    sourceBufferRef.current = null;
    audioQueueRef.current = [];
    isPlaybackInitialized.current = false;
    isDoneReceivedRef.current = false;
    pendingAiTextRef.current = "";

    // CRITICAL: always reset mute flags here.
    // If the user stops mid-turn while AI is speaking, audio.onended never fires,
    // which would leave isMutedRef=true and silently drop all mic audio on the next call.
    isMutedRef.current = false;
    userMutedRef.current = false;

    setIsAiSpeaking(false);
    setIsAiThinking(false);
    setIsUserSpeaking(false);
    setAiText("");
    setTranscript("");

    console.log("[useVoiceAgent] Agent stopped");
  };

  const startAgent = async (level: string, scenario: string, startOptions?: StartAgentOptions) => {
    console.log("[useVoiceAgent] Starting agent...");

    // Always create a fresh AudioContext for each call.
    // stopAgent closes and nulls it, so this is always a new context.
    // Reusing an old context leaves the worklet node graph in a broken state.
    const audioContext = new AudioContext({ sampleRate: 16000 });
    audioContextRef.current = audioContext;

    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    agentActiveRef.current = true;
    levelRef.current = level;
    scenarioRef.current = scenario;
    setAiText("");

    // Connect WebSocket
    const wsPath = startOptions?.useV2Tracking ? "/ws/voice_agent_google_v2" : "/ws/voice_agent_google";
    const wsUrl = apiUrl.replace("http", "ws") + wsPath;
    console.log("[useVoiceAgent] Connecting to WebSocket:", wsUrl);

    const socket = new WebSocket(wsUrl);
    socket.binaryType = "arraybuffer";
    socketRef.current = socket;

    // Setup audio ended handler for MediaSource playback
    if (audioRef.current) {
      audioRef.current.onended = () => {
        console.log("[useVoiceAgent] 🔇 Audio playback ended, user unmuted");
        setIsAiSpeaking(false);
        isMutedRef.current = false;

        // Clean up MediaSource for next turn
        if (mediaSourceRef.current) {
          mediaSourceRef.current = null;
          sourceBufferRef.current = null;
          audioQueueRef.current = [];
          isPlaybackInitialized.current = false;
        }
      };

      // Reveal AI text only when audio actually starts playing
      audioRef.current.onplaying = () => {
        console.log("[useVoiceAgent] ▶️ Audio actually playing, revealing text");
        setAiText(pendingAiTextRef.current);
      };
    }

    // Setup WebSocket handlers
    socket.onopen = async () => {
      console.log("[useVoiceAgent] ✅ WebSocket connected");

      // Request microphone access
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: 16000,
            channelCount: 1,
            echoCancellation: true, // Crucial for mobile - prevents AI voice feedback
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        mediaStreamRef.current = stream;
        console.log("[useVoiceAgent] 🎤 Microphone access granted");

        // Load AudioWorklet module for thread-isolated audio processing
        await audioContext.audioWorklet.addModule('/vop-processor.js');
        const source = audioContext.createMediaStreamSource(stream);
        const workletNode = new AudioWorkletNode(audioContext, 'vop-processor');

        // Handle audio data from worklet
        workletNode.port.onmessage = (event) => {
          if (!agentActiveRef.current || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
            return;
          }

          // Don't send audio if user is muted (during AI speaking/thinking OR manually muted)
          if (isMutedRef.current || userMutedRef.current) {
            return;
          }

          // Send the Int16Array buffer directly to the backend
          socketRef.current.send(event.data);
        };

        source.connect(workletNode);
        workletNode.connect(audioContext.destination); // Required to keep worklet alive
        audioWorkletNodeRef.current = workletNode;

        console.log("[useVoiceAgent] 🎙️ Audio streaming started (AudioWorklet)");

        // Send initial metadata
        socket.send(
          JSON.stringify({
            type: "start",
            level: level,
            scenario: scenario,
            consumer_id: UserTracker.getConsumerId() || UserTracker.getOrCreateConsumerId(),
            email: UserTracker.getGoogleEmail(),
            roadmap_item_key: startOptions?.roadmapItemKey,
          })
        );

      } catch (err) {
        console.error("[useVoiceAgent] ❌ Microphone error:", err);
        stopAgent();
      }
    };

    socket.onmessage = async (event) => {
      if (typeof event.data === "string") {
        // JSON message
        const msg = JSON.parse(event.data);
        console.log("[useVoiceAgent] 📨 Message:", msg);

        if (msg.type === "status") {
          // Update UI based on status
          if (msg.state === "ready") {
            // Clear UI states
            setIsAiThinking(false);
            setIsUserSpeaking(false);
            // Safety: if we are ready, we should generally be unmuted unless audio is playing
            // if (!isAiSpeaking) {
            //   isMutedRef.current = false;
            // }
          } else if (msg.state === "user_speaking") {
            setIsUserSpeaking(true);
            setIsAiThinking(false);
            // Only unmute if we aren't in a state where we should be muted
            if (!isAiSpeaking && !isAiThinking) {
              isMutedRef.current = false;
            }
            setTranscript(""); 
          } else if (msg.state === "thinking") {
            setIsUserSpeaking(false);
            setIsAiThinking(true);
            // Do NOT touch isAiSpeaking here — audio.onended owns it.
            // thinking always follows a ready (no audio playing), so this is safe.
            pendingAiTextRef.current = ""; // Reset pending text buffer
            isMutedRef.current = true; // Mute user during AI thinking
            console.log("[useVoiceAgent] 🔇 User muted during AI thinking");
          } else if (msg.state === "speaking") {
            setIsUserSpeaking(false);
            setIsAiThinking(false);
            setIsAiSpeaking(true);
            isMutedRef.current = true; // Mute user during AI speaking
            isDoneReceivedRef.current = false; // Reset done flag for new turn
            console.log("[useVoiceAgent] 🔇 User muted during AI speaking");

            // Initialize MediaSource for streaming audio playback
            if (!isPlaybackInitialized.current && audioRef.current) {
              if ("MediaSource" in window && MediaSource.isTypeSupported("audio/mpeg")) {
                console.log("[useVoiceAgent] 🎵 Initializing MediaSource for streaming playback");

                const mediaSource = new MediaSource();
                mediaSourceRef.current = mediaSource;
                audioRef.current.src = URL.createObjectURL(mediaSource);

                // When audio element finishes playing: reset MediaSource state so the
                // next AI turn creates a fresh one, then tell backend to open VAD.
                audioRef.current.onended = () => {
                  setIsAiSpeaking(false);
                  isMutedRef.current = false;
                  // Tear down refs so next `speaking` event re-initializes MediaSource
                  mediaSourceRef.current = null;
                  sourceBufferRef.current = null;
                  audioQueueRef.current = [];
                  isPlaybackInitialized.current = false;
                  isDoneReceivedRef.current = false;
                  if (audioRef.current) {
                    audioRef.current.src = "";
                    audioRef.current.load();
                  }
                  console.log("[useVoiceAgent] 🔇 Audio playback ended, MediaSource reset");
                  if (socketRef.current?.readyState === WebSocket.OPEN) {
                    socketRef.current.send(JSON.stringify({ type: "playback_done" }));
                  }
                };

                mediaSource.addEventListener("sourceopen", () => {
                  if (mediaSource.sourceBuffers.length > 0) return;
                  console.log("[useVoiceAgent] 📂 MediaSource opened");
                  const sourceBuffer = mediaSource.addSourceBuffer("audio/mpeg");
                  sourceBufferRef.current = sourceBuffer;

                  // Process queued chunks when buffer is ready
                  sourceBuffer.addEventListener("updateend", () => {
                    if (audioRef.current?.paused && sourceBuffer.buffered.length > 0) {
                      audioRef.current.play().catch((error) => {
                        console.error("[useVoiceAgent] ❌ MediaSource playback error:", error);
                      });
                    }

                    if (audioQueueRef.current.length > 0 && !sourceBuffer.updating) {
                      const nextChunk = audioQueueRef.current.shift()!;
                      sourceBuffer.appendBuffer(nextChunk.buffer as ArrayBuffer);
                    } else if (isDoneReceivedRef.current && !sourceBuffer.updating && audioQueueRef.current.length === 0) {
                      if (mediaSource.readyState === "open") {
                        try {
                          mediaSource.endOfStream();
                          console.log("[useVoiceAgent] 🏁 MediaSource stream ended via updateend");
                        } catch (e) {
                          console.warn("[useVoiceAgent] MediaSource endOfStream warning in updateend:", e);
                        }
                      }
                    }
                  });

                  if (audioQueueRef.current.length > 0) {
                    const firstChunk = audioQueueRef.current.shift()!;
                    sourceBuffer.appendBuffer(firstChunk.buffer as ArrayBuffer);
                  }
                });

                isPlaybackInitialized.current = true;
              } else {
                console.log("[useVoiceAgent] ⚠️ MediaSource not supported, using fallback");
                // Fallback: will accumulate chunks and play as blob
                currentAudioChunks.current = [];
              }
            }
          }
        } else if (msg.type === "text") {
          // LLM text chunk - buffer it until audio starts playing
          pendingAiTextRef.current += msg.content;
          // Text will be revealed in onplaying event only
        } else if (msg.type === "transcript") {
          // User transcript from backend STT
          setTranscript(msg.content);
          setIsUserSpeaking(true); // Fallback: if we have a transcript, the user is speaking
          console.log("[useVoiceAgent] 📝 Transcript:", msg.content);
        } else if (msg.type === "credits_update") {
          onCreditsUpdate?.(msg.credits_left ?? 0);
        } else if (msg.type === "limit_reached") {
          onLimitReached?.(msg.message || "You've used your daily credits.");
          stopAgent();
        } else if (msg.type === "done") {
          // Turn complete
          console.log("[useVoiceAgent] ✅ Turn complete");
          isDoneReceivedRef.current = true;

          // If using MediaSource, signal end of stream
          if (mediaSourceRef.current && mediaSourceRef.current.readyState === "open") {
            // Wait for pending updates before ending
            if (sourceBufferRef.current && !sourceBufferRef.current.updating && audioQueueRef.current.length === 0) {
              try {
                mediaSourceRef.current.endOfStream();
                console.log("[useVoiceAgent] 🏁 MediaSource stream ended");
              } catch (e) {
                console.warn("[useVoiceAgent] MediaSource endOfStream warning:", e);
              }
            } else {
              console.log("[useVoiceAgent] ⏳ MediaSource still busy, will end later via updateend");
            }
          } else if (currentAudioChunks.current.length > 0 && audioRef.current) {
            // Fallback: Play accumulated chunks as blob
            console.log("[useVoiceAgent] 🔊 Playing accumulated audio (fallback mode)");
            const blob = new Blob(currentAudioChunks.current as BlobPart[], { type: "audio/mpeg" });
            const url = URL.createObjectURL(blob);
            audioRef.current.src = url;

            audioRef.current.onended = () => {
              setIsAiSpeaking(false);
              isMutedRef.current = false;
              console.log("[useVoiceAgent] 🔇 Audio playback ended");
              if (socketRef.current?.readyState === WebSocket.OPEN) {
                socketRef.current.send(JSON.stringify({ type: "playback_done" }));
              }
            };

            audioRef.current.play().catch((err) => {
              console.error("[useVoiceAgent] ❌ Audio playback error:", err);
              setIsAiSpeaking(false);
              isMutedRef.current = false;
              // Playback failed, still need to open VAD
              if (socketRef.current?.readyState === WebSocket.OPEN) {
                socketRef.current.send(JSON.stringify({ type: "playback_done" }));
              }
            });
          } else {
            // No audio to play, open VAD immediately
            setIsAiSpeaking(false);
            isMutedRef.current = false;
            if (socketRef.current?.readyState === WebSocket.OPEN) {
              socketRef.current.send(JSON.stringify({ type: "playback_done" }));
            }
          }
        } else if (msg.type === "duration_update") {
          onDurationUpdate?.(msg.seconds);
        } else if (msg.type === "suggestion") {
          onSuggestion?.(msg.content || "");
        } else if (msg.type === "error") {
          console.error("[useVoiceAgent] ❌ Error:", msg.message);
          setIsAiThinking(false);
          setIsAiSpeaking(false);
          isMutedRef.current = false; // Unmute user on error
        }
      } else {
        // Binary audio chunk - stream to MediaSource with Jitter Buffer
        const chunk = new Uint8Array(event.data);

        const sourceBuffer = sourceBufferRef.current;
        const mediaSource = mediaSourceRef.current;
        const hasActiveSourceBuffer = Boolean(
          sourceBuffer &&
          mediaSource?.readyState === "open" &&
          Array.from(mediaSource.sourceBuffers).includes(sourceBuffer)
        );

        if (mediaSource && isPlaybackInitialized.current && !sourceBuffer) {
          audioQueueRef.current.push(chunk);
          return;
        }

        if (sourceBuffer && mediaSource && hasActiveSourceBuffer) {
          // Always add to the queue first to maintain order
          audioQueueRef.current.push(chunk);

          try {
            // Check if we can append to the buffer
            if (!sourceBuffer.updating && audioQueueRef.current.length > 0) {
              const nextChunk = audioQueueRef.current.shift()!;
              sourceBuffer.appendBuffer(nextChunk.buffer as ArrayBuffer);
              console.log(`[useVoiceAgent] 🎵 Audio chunk appended to SourceBuffer (${nextChunk.length} bytes)`);
            }
          } catch (e) {
            console.warn("[useVoiceAgent] SourceBuffer no longer available:", e);
          }
        } else {
          // Fallback mode: Accumulate chunks for blob playback
          currentAudioChunks.current.push(chunk);
          console.log(`[useVoiceAgent] 🔊 Audio chunk accumulated (${chunk.length} bytes)`);
        }
      }
    };

    socket.onerror = (error) => {
      console.error("[useVoiceAgent] ❌ WebSocket error:", error);
    };

    socket.onclose = () => {
      console.log("[useVoiceAgent] ❌ WebSocket closed");
      stopAgent();
    };
  };

  const setMuted = (muted: boolean) => {
    console.log("[useVoiceAgent] User manual mute:", muted);
    userMutedRef.current = muted;
    // When user manually mutes, also hide user speaking indicator
    if (muted) {
      setIsUserSpeaking(false);
    }
  };

  const requestSuggestion = () => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "suggest" }));
    }
  };

  return {
    isListening: agentActiveRef.current,
    isUserSpeaking,
    liveTranscript: "",
    finalTranscript: transcript,
    aiText,
    isAiSpeaking,
    isAiThinking,
    audioRef,
    audioContextRef,
    startAgent,
    stopAgent,
    setMuted,
    requestSuggestion,
    startRecognition: () => { }, // Not used in new architecture
    stopRecognition: () => { },  // Not used in new architecture
  };
}
