// @ts-nocheck
'use client';
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import NavbarLogged from '@/components/ui/globals/NavbarLogged';
import { InterviewAvatar } from '@/components/meta/InterviewAvatar';
import { ToggleLeft, Zap } from 'lucide-react';
import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';

export default function InterviewLandingPage() {
  const [role, setRole] = useState('');
  const [expectations, setExpectations] = useState('');
  const [resume, setResume] = useState('');
  const [tokensLeft, setTokensLeft] = useState<number | null>(null);
  const [loadingTokens, setLoadingTokens] = useState(true);
  const [starting, setStarting] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [personName, setName] = useState('');

  const MAX_TOKENS = 1e5;
  const startSpeech = "Hello! I'm Denver, your AI interviewer. Let's get started with your interview. Please fill in the details.";

  useEffect(() => {
    async function fetchTokens() {
      try {
        setLoadingTokens(true);
        const res = await axios.get(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/interview/token-left`, {
          withCredentials: true,
        });
        setTokensLeft(typeof res.data?.tokensLeft === 'number' ? res.data.tokensLeft : 0);
      } catch (err) {
        console.error('Failed to fetch tokens', err);
        setTokensLeft(0);
      } finally {
        setLoadingTokens(false);
      }
    }
    fetchTokens();
  }, []);

  const estimatedTokens = Math.max(
    0,
    Math.ceil((role.length + expectations.length + resume.length) / 4)
  );
 
  const percent = Math.min(100, Math.round((tokensLeft / MAX_TOKENS) * 100));
  const tokenBg =
    percent > 50 ? 'bg-emerald-500' : percent > 25 ? 'bg-yellow-500' : 'bg-rose-500';

  // Load Razorpay script dynamically
  function loadRazorpayScript(): Promise<boolean> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined') return resolve(false);
      if ((window as any).Razorpay) return resolve(true);

      const s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.async = true;
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.body.appendChild(s);
    });
  }

  // Open Razorpay Checkout with server-created order
  async function openRazorpayCheckout(order: any) {
    const ok = await loadRazorpayScript();
    if (!ok) {
      setErrorMessage('Unable to load payment gateway. Try again later.');
      return;
    }

    const options: any = {
      key: process.env.NEXT_PUBLIC_KEYID,
      amount: Math.round(order.amount * 100),
      currency: order.currency || 'INR',
      name: order.name || 'Interview Studio',
        image: "/logonew.png",
      description: order.description || '20,000 STUDIO CHIPS',
      order_id: order.orderId || order.id || order.order_id,
      prefill: order.prefill || {},
      theme: { color: '#155efc' },
      handler: async function (paymentResponse: any) {
        try {
          // Verify payment on server and create session
          const verifyRes = await axios.post(
            `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/interview/purchase-verify`,
            { ...paymentResponse, orderId: options.order_id },
            { withCredentials: true }
          );

         alert('Payment successful!');
        } catch (err) {
          console.error('Payment verification error', err);
          setErrorMessage('Payment verification failed. Please contact support.');
        }
      },
      modal: {
        ondismiss: function () {
          // user closed checkout
        },
      },
    };

    try {
      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error('Razorpay open failed', err);
      setErrorMessage('Payment UI failed to open. Try again.');
    }
  }

  // Trigger purchase flow if session creation is blocked (403)
  async function createInterviewOrderAndPay() {
    try {
      const purchase = await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/interview/purchase`,
        {},
        { withCredentials: true }
      );
      if (purchase.status === 200 && purchase.data) {
        await openRazorpayCheckout(purchase.data.ok);
      } else {
        setErrorMessage('Unable to create purchase order.');
      }
    } catch (pErr) {
      console.error('Purchase creation failed', pErr);
      setErrorMessage('Failed to create purchase order. Try again.');
    }
  }

  // Start interview session
  async function startSession() {
    if (!role.trim() || !expectations.trim() || !resume.trim()) {
      setErrorMessage('Please fill all fields to start the interview.');
      return;
    }

    setErrorMessage(null);
    setStarting(true);

    try {
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/interview/start`,
        { role, expectations, resume },
        { withCredentials: true }
      );
      if (res.status === 200 && res.data?.sessionId) {
           const sessionEntry = await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/interview/submit-answer`,
        { sessionId: res.data.sessionId, question: personName, role: role, personName: personName, expectations: expectations, resume: resume },
        { withCredentials: true }
      );

        window.location.href = `/interview/session/${res.data.sessionId}`;
        return;
      }
      
      if (res.status === 403 || res.data?.code === 403) {
     
        await createInterviewOrderAndPay();
        return;
      }
         const sessionEntry = await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/interview/submit-answer`,
        { sessionId: res.data.sessionId, question: personName, role: role, personName: personName, expectations: expectations, resume: resume },
        { withCredentials: true }
      );

      setErrorMessage('Unexpected server response. Try again.');
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 403) {
        await createInterviewOrderAndPay();
        return;
      }
      console.error('Start session error', err);
      setErrorMessage('Failed to start session. Try again later.');
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f7fafc] to-white text-slate-900">
      <NavbarLogged />

      <main className="max-w-6xl mx-auto px-6 py-8 flex flex-col lg:flex-row items-stretch gap-8">
        {/* Left: Interviewer Intro */}
        <section className="lg:w-1/2 bg-slate-900 text-white rounded-2xl shadow-md relative overflow-hidden flex flex-col justify-between">
          <div className="p-6">
            <h2 className="text-2xl font-semibold mb-2"> Meet Denver</h2>
            <p className="text-slate-300 mb-6 text-sm">
              I'm your AI    interviewer. This will feel like a real interview — I'll ask some
              questions, assess your responses, and adapt dynamically to your answers.
            </p>
          </div>

          <div className="flex-1 relative">
           <Canvas camera={{ position: [0, 0, 5], fov: 45 }} className="w-full h-full">
                    <ambientLight intensity={0.5} />
                    <directionalLight position={[5, 5, 5]} intensity={1} />
                    <pointLight position={[-5, 5, -5]} intensity={0.5} />
                    <Suspense fallback={null}>
                      <InterviewAvatar speakText={startSpeech} />
                    </Suspense>
                  </Canvas>

          
          </div>

          <div className="absolute top-4 right-4 bg-white/10 px-3 py-1 rounded-full text-xs">
            Tokens left:{' '}
            {loadingTokens ? '...' : (
              <span className={`font-semibold ${tokenBg === 'bg-rose-500' ? 'text-rose-300' : 'text-emerald-300'}`}>
                {tokensLeft}
              </span>
            )}
          </div>
        </section>

        {/* Right: Information Form */}
        <aside className="lg:w-1/2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-xl font-semibold mb-2">Creation</h3>
            <p className="text-sm text-slate-500 mb-6">
              Provide a few quick details — I’ll personalize your interview accordingly.
            </p>

            <label className="block text-xs font-medium text-slate-700 mb-1">Name</label>
            <input
              value={personName}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              className="w-full mb-4 px-3 py-2 rounded-md border border-gray-100 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-indigo-300 text-sm"
            />
             <label className="block text-xs font-medium text-slate-700 mb-1">Role</label>
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Software Development Engineer"
              className="w-full mb-4 px-3 py-2 rounded-md border border-gray-100 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-indigo-300 text-sm"
            />


            <label className="block text-xs font-medium text-slate-700 mb-1">Expectations</label>
            <textarea
              value={expectations}
              onChange={(e) => setExpectations(e.target.value)}
              rows={3}
              placeholder="Key responsibilities and required skills (e.g. Node.js, microservices)"
              className="w-full mb-4 px-3 py-2 rounded-md border border-gray-100 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-indigo-300 text-sm resize-none"
            />

            <label className="block text-xs font-medium text-slate-700 mb-1">Resume / Highlights</label>
            <textarea
              value={resume}
              onChange={(e) => setResume(e.target.value)}
              rows={4}
              placeholder="Paste resume or key highlights"
              className="w-full mb-4 px-3 py-2 rounded-md border border-gray-100 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-indigo-300 text-sm resize-none font-mono"
            />

            {errorMessage && (
              <div className="mb-3 text-xs text-rose-700 bg-rose-50 p-2 rounded">{errorMessage}</div>
            )}
          </div>

          <div>
            <button
              onClick={startSession}
              disabled={starting || !role.trim() || !expectations.trim() || !resume.trim()}
              className={`w-full py-3 rounded-md text-white font-semibold transition ${
                starting || !role.trim() || !expectations.trim() || !resume.trim()
                  ? 'bg-slate-300 cursor-not-allowed text-slate-600'
                  : 'bg-gradient-to-r from-indigo-600 to-sky-500 hover:from-sky-500'
              }`}
            >
              {starting ? 'Starting…' : 'Start Interview'}
            </button>

            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
              <Zap className="w-4 h-4 text-indigo-400" />
              <span>Tip: Keep inputs short to save tokens.</span>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
