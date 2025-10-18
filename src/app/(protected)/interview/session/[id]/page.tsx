// @ts-nocheck
'use client';
import React, { useEffect, useRef, useState, Suspense } from 'react';
import Link from 'next/link';
import { Mic, MicOff, MessageSquare, Circle, Loader2 } from 'lucide-react';
import { Canvas } from '@react-three/fiber';
import { InterviewAvatar } from '@/components/meta/InterviewAvatar';
import ConversationHistory from '@/components/meta/ConversationHistory';
import { useParams } from 'next/navigation';
import axios from 'axios';
import ExpressionAnalyzerPage, {
  clearLastExpression,
  getDominantExpression,
} from '@/components/meta/UserVideo';

const VIDEO_WIDTH = 640;
const VIDEO_HEIGHT = 480;

export default function InterviewSessionPage() {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isRecognitionActiveRef = useRef(false);
  const sessionId = useParams().id;

  // UI + logic state
  const [isMuted, setIsMuted] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');
  const [typedInput, setTypedInput] = useState('');
  const [avatarSpeech, setAvatarSpeech] = useState("Hello! Let's begin your interview. Please introduce yourself.");
  const [avatarEmotion, setAvatarEmotion] = useState(null);
  const [phase, setPhase] = useState<'avatarSpeaking' | 'userSpeaking'>('avatarSpeaking');
  const [fullTranscript, setFullTranscript] = useState([
    { speaker: 'avatar', text: "Hello! Let's begin your interview. Please introduce yourself.", timestamp: new Date() },
  ]);
  const [userExpression, setUserExpression] = useState('Neutral');

  // End-of-interview modal state
  const [showEndModal, setShowEndModal] = useState(false);
  const [finalSummary, setFinalSummary] = useState('');
  const [finalSatisfaction, setFinalSatisfaction] = useState<number | null>(null);

  const calculateSpeechDuration = (text: string) => Math.max(2000, text.length * 80);

  // === Initialize Media ===
  useEffect(() => {
    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: VIDEO_WIDTH, height: VIDEO_HEIGHT },
          audio: true,
        });
        streamRef.current = stream;
        setPhase('avatarSpeaking');
        setTimeout(avatarFinishedSpeaking, calculateSpeechDuration(avatarSpeech));
      } catch (err) {
        console.error('Mic/camera access failed:', err);
        setError('Microphone or camera access denied. You can still type answers.');
        setPhase('userSpeaking');
      }
    };
    init();

    return () => {
      stopSpeechRecognition();
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // === Speech Recognition Setup ===
  const startSpeechRecognition = () => {
    if (isRecognitionActiveRef.current) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Speech recognition not supported on this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      isRecognitionActiveRef.current = true;
    };

    recognition.onerror = (e) => {
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        setError(`Speech recognition error: ${e.error}`);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      isRecognitionActiveRef.current = false;
      if (phase === 'userSpeaking' && !isMuted) {
        setTimeout(() => startSpeechRecognition(), 600);
      }
    };

    recognition.onresult = (event) => {
      let text = '';
      for (let i = event.resultIndex; i < event.results.length; ++i)
        text += event.results[i][0].transcript + ' ';
      const trimmed = text.trim();
      if (trimmed) setTranscript((prev) => (prev ? prev + ' ' + trimmed : trimmed));
    };

    recognition.start();
  };

const stopSpeechRecognition = async () => {
  return new Promise<string>((resolve) => {
    const recognition = recognitionRef.current;
    if (!recognition || !isRecognitionActiveRef.current) return resolve(transcript);

    let finalTranscript = transcript;

    // Capture any remaining results
    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; ++i)
        finalTranscript += ' ' + event.results[i][0].transcript;
    };

    recognition.onend = () => {
      isRecognitionActiveRef.current = false;
      setIsListening(false);
      resolve(finalTranscript.trim());
    };

    recognition.stop();
  });
};

  // === Avatar finished speaking ===
  const avatarFinishedSpeaking = () => {
    setAvatarEmotion(null);
    clearLastExpression();
    setPhase('userSpeaking');
    setIsMuted(false);
    setTranscript('');
    startSpeechRecognition();
  };

  // === Mic Toggle (send answer) ===
const handleToggleMute = async () => {
  if (phase !== 'userSpeaking') return;

  setIsMuted(true);
  setIsThinking(true);

  // Disable mic tracks immediately
  if (streamRef.current)
    streamRef.current.getAudioTracks().forEach((t) => (t.enabled = false));

  // Stop speech recognition and wait for final transcript
  const recognized = await stopSpeechRecognition();

  const combined = `${recognized} ${typedInput}`.trim();
  const expression = getDominantExpression(userExpression, true);

  // Clear input and transcript after storing
  setTypedInput('');
  setTranscript('');

  if (!combined) {
    setIsThinking(false);
    setAvatarSpeech("I didn't hear you. Could you try again?");
    setPhase('avatarSpeaking');
    // let avatar speak before user speaks again
    return setTimeout(() => avatarFinishedSpeaking(), 2500);
  }

  await sendToBackend(combined, expression);
};


  // === Send user answer to backend ===
  const sendToBackend = async (speech: string, expression: string) => {
    try {
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/interview/submit-answer`,
        { sessionId, question: speech, emotion: expression },
        { withCredentials: true }
      );

      const data = res.data;
      const aiText = data.aiQuestion || 'Interesting, could you elaborate on that?';
      const isEnd = data.endInterview || data.endNext;

      // Save user + AI messages
      setFullTranscript((prev) => [
        ...prev,
        { speaker: 'user', text: speech, expression, timestamp: new Date() },
        { speaker: 'avatar', text: aiText, emotion: data.emotion, timestamp: new Date() },
      ]);

      setAvatarEmotion(data.AIemotion || null);
      setIsThinking(false);

      if (isEnd) {
        const summaryText = data.summary || "Thank you for participating. This concludes our interview.";
        setAvatarSpeech(data.aiQuestion || summaryText);
        setAvatarEmotion('Smile');
        setPhase('avatarSpeaking');

        setFullTranscript((prev) => [
          ...prev,
          { speaker: 'avatar', text: summaryText, emotion: 'Smile', timestamp: new Date() },
        ]);

        if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());

        setFinalSummary(summaryText);
        setFinalSatisfaction(data.satisfactionRate || null);
        setShowEndModal(true);
        return;
      }

      // Continue interview
      setAvatarSpeech(aiText);
      setPhase('avatarSpeaking');
      setTimeout(() => avatarFinishedSpeaking(), calculateSpeechDuration(aiText));
    } catch (err) {
      console.error(err);
      setIsThinking(false);
      setError('Network error while sending your response.');
    }
  };

  return (
    <div className="flex bg-black min-h-screen relative">
      {/* Left: Avatar */}
      <div className="flex-1 flex flex-col relative p-6">
        <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[5, 5, 5]} intensity={1} />
          <Suspense fallback={null}>
            <InterviewAvatar speakText={avatarSpeech} reactions={avatarEmotion} />
          </Suspense>
        </Canvas>

        {/* Mic Button */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
          <button
            onClick={handleToggleMute}
            disabled={isThinking || showEndModal}
            className={`px-6 py-3 rounded-xl flex items-center gap-2 transition ${
              isMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
            } disabled:opacity-60`}
          >
            {isThinking ? (
              <Loader2 className="animate-spin text-white" />
            ) : isMuted ? (
              <MicOff className="text-white" />
            ) : (
              <Mic className="text-white" />
            )}
            <span className="text-white font-semibold">
              {isThinking ? 'Analyzing...' : isMuted ? 'Send & Mute' : 'Mic ON'}
            </span>
          </button>
        </div>


        {/* Status */}
        <div className="absolute top-4 left-4 flex items-center gap-2 text-white">
          {isListening ? (
            <>
              <MessageSquare className="text-green-400" />
              <span>Listening...</span>
              <Circle className="w-2 h-2 fill-green-500 animate-pulse" />
            </>
          ) : isThinking ? (
            <>
              <Loader2 className="animate-spin text-yellow-400" />
              <span>AI Thinking...</span>
            </>
          ) : (
            <span>Waiting for next turn</span>
          )}
        </div>

        {error && (
          <div className="absolute top-16 left-4 bg-red-600 text-white px-3 py-2 rounded-lg text-sm shadow">
            {error}
          </div>
        )}

      {/* Expression Analyzer Tile */}
  <div className="absolute bottom-4 right-4 aspect-video w-72  bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
    {/* <div className="text-center font-semibold bg-blue-600 text-white py-1">Your Expression</div> */}
    <ExpressionAnalyzerPage
      onExpressionChange={setUserExpression}
      active={phase === 'userSpeaking'}
    />
    {/* <div className="absolute bottom-2 w-full text-center text-sm text-gray-700">
      {userExpression}
    </div> */}
  </div>
      </div>

      {/* Right: Text Input + Transcript */}
      <div className="flex flex-col lg:w-2/5 bg-white border-l h-screen overflow-hidden">
        <div className="p-4 border-b bg-[/logonew.png]">
          <textarea
            className="w-full resize-none border rounded p-2 text-black focus:ring-2 focus:ring-blue-400"
            rows={16}
            value={typedInput}
            onChange={(e) => setTypedInput(e.target.value)}
            placeholder="Type your response if needed.  Denver asks question and it will open the mic. Once you are done, click 'Send & Mute' to submit your response."
            disabled={showEndModal}
          />
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <ConversationHistory fullTranscript={fullTranscript} />
        </div>
      </div>
 {showEndModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full relative shadow-lg">
            <h2 className="text-2xl font-bold mb-4">Summary</h2>
            <p className="mb-4">
              <strong>Satisfaction Rate:</strong> {finalSatisfaction ?? "N/A"} / 100
            </p>
            <p className="mb-6 whitespace-pre-line">{finalSummary}</p>
            <Link href="/interview" className='bg-[#2563EB] text-white px-4 py-2 rounded-lg hover:bg-[#1E40AF] transition'>
    Close

</Link>

          </div>
        </div>
      )}
    </div>
  );
}
