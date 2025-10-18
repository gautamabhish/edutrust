// @ts-nocheck
import React, { useEffect, useRef } from "react";
import { useLoader } from "@react-three/fiber";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

function getMaleVoices() {
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return [];
  return voices.filter((voice) => /Prabhat|male en|uk/i.test(voice.name));
}

const InterviewAvatar = ({ speakText, onLoaded, reactions }) => {
  const gltf = useLoader(GLTFLoader, "/man_v1.glb");
  const rafRef = useRef(null);
  const blinkingStateRef = useRef({ animating: false, start: 0, phase: 0 });
  const speakingRef = useRef(false);
  const testLoopRef = useRef(null);

  const mouthMesh = gltf.scene?.children[0]?.children[1];
  const blinkMesh = gltf.scene?.children[0]?.children[2];

  const mouthIndex = mouthMesh?.morphTargetDictionary["Mouth Open"];
  const blinkIndex = blinkMesh?.morphTargetDictionary["Blink"];

  // Call onLoaded after GLTF is ready
  useEffect(() => {
    if (onLoaded) onLoaded();
  }, [onLoaded]);

  // Handle speech synthesis
  useEffect(() => {
    if (!speakText || typeof window === "undefined" || !("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(speakText);
    utterance.rate = 0.9;
    utterance.pitch = 0.5;

    window.speechSynthesis.onvoiceschanged = () => {
      const maleVoices = getMaleVoices();
      if (maleVoices.length > 0) utterance.voice = maleVoices[0];
    };

    utterance.onstart = () => (speakingRef.current = true);
    utterance.onend = () => (speakingRef.current = false);
    utterance.onerror = () => (speakingRef.current = false);

    window.speechSynthesis.speak(utterance);
  }, [speakText]);

  // Handle emotion reactions
  useEffect(() => {
    if (!reactions || !mouthMesh?.morphTargetDictionary) return;

    const targetIndex = mouthMesh.morphTargetDictionary[reactions];
    if (targetIndex == null) return;

    // Apply strong emotion immediately
    mouthMesh.morphTargetInfluences[targetIndex] = 0.5;

    // Clear previous timeout
    if (testLoopRef.current) clearTimeout(testLoopRef.current);

    // Fade out after 1s
    testLoopRef.current = setTimeout(() => {
      if (mouthMesh?.morphTargetInfluences) {
        mouthMesh.morphTargetInfluences[targetIndex] = 0;
      }
    }, 1000);
  }, [reactions, mouthMesh]);

  // Animation loop (mouth + blink)
  useEffect(() => {
    let running = true;

    const animate = () => {
      if (!running) return;
      const now = performance.now();

      // MOUTH movement
      if (mouthMesh && mouthIndex != null) {
        const current = mouthMesh.morphTargetInfluences[mouthIndex] ?? 0;
        if (speakingRef.current) {
          const osc = 0.35 * Math.abs(Math.sin(now / 250));
          const jitter = (Math.random() - 0.5) * 0.05;
          const target = Math.min(0.8, Math.max(0.1, 0.2 + osc + jitter));
          mouthMesh.morphTargetInfluences[mouthIndex] = current + (target - current) * 0.2;
        } else {
          mouthMesh.morphTargetInfluences[mouthIndex] = current * 0.8;
        }
      }

      // BLINK
      if (blinkMesh && blinkIndex != null) {
        const blinkState = blinkingStateRef.current;
        if (!blinkState.animating) {
          if (!blinkState.next) blinkState.next = now + 2000 + Math.random() * 2000;
          else if (now >= blinkState.next) {
            blinkState.animating = true;
            blinkState.phase = 1;
            blinkState.start = now;
          }
        } else {
          const elapsed = now - blinkState.start;
          if (blinkState.phase === 1) {
            const durClose = 80;
            const tphase = Math.min(1, elapsed / durClose);
            blinkMesh.morphTargetInfluences[blinkIndex] = tphase;
            if (tphase >= 1) {
              blinkState.phase = 2;
              blinkState.start = now;
            }
          } else if (blinkState.phase === 2) {
            const hold = 40 + Math.random() * 60;
            if (elapsed >= hold) {
              blinkState.phase = 3;
              blinkState.start = now;
            }
          } else if (blinkState.phase === 3) {
            const durOpen = 120;
            const tphase = Math.min(1, elapsed / durOpen);
            blinkMesh.morphTargetInfluences[blinkIndex] = 1 - tphase;
            if (tphase >= 1) {
              blinkMesh.morphTargetInfluences[blinkIndex] = 0;
              blinkState.animating = false;
              blinkState.phase = 0;
              blinkState.next = now + 2500 + Math.random() * 4000;
            }
          }
        }
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      running = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (testLoopRef.current) clearTimeout(testLoopRef.current);
    };
  }, [mouthMesh, mouthIndex, blinkMesh, blinkIndex]);

  return <primitive object={gltf.scene} scale={8} position={[0, -1.8, 0]} />;
};

export { InterviewAvatar };
