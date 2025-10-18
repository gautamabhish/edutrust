// @ts-nocheck
'use client';
import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as faceapi from 'face-api.js';

const VIDEO_WIDTH = 640;
const VIDEO_HEIGHT = 480;

let lastExpression = 'Neutral';
let lastValue = 0; // store the probability of lastExpression

export const clearLastExpression = () => {
  lastExpression = 'Neutral';
  lastValue = 0;
};

export const getDominantExpression = (
  expressions: Record<string, number>,
  prioritizeNonNeutral = false
) => {
  if (!expressions || Object.keys(expressions).length === 0) return lastExpression;

  const entries = Object.entries(expressions);

  // optionally ignore neutral
  const filtered = prioritizeNonNeutral
    ? entries.filter(([exp]) => exp.toLowerCase() !== 'neutral')
    : entries;

  if (filtered.length === 0) return lastExpression;

  const [dominantExp, dominantVal] = filtered.reduce(
    (a, b) => (a[1] > b[1] ? a : b)
  );

  // update only if the new probability is higher than the previous
  if (dominantVal > lastValue) {
    lastExpression = dominantExp.charAt(0).toUpperCase() + dominantExp.slice(1);
    lastValue = dominantVal;
  }

  return lastExpression;
};


const ExpressionAnalyzerPage = ({ onExpressionChange, active }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [userExpressions, setUserExpressions] = useState({});

  const dominantExpression = useMemo(
    () => getDominantExpression(userExpressions, active),
    [userExpressions, active]
  );

  useEffect(() => {
    if (active) onExpressionChange(dominantExpression);
  }, [dominantExpression, active, onExpressionChange]);

  // Load models
  useEffect(() => {
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
          faceapi.nets.faceExpressionNet.loadFromUri('/models'),
          faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
        ]);
        setModelLoaded(true);
        console.log('✅ Face-api models loaded');
      } catch (error) {
        console.error('❌ Error loading models:', error);
      }
    };
    loadModels();
  }, []);

  // Start webcam
  useEffect(() => {
    const startVideo = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: VIDEO_WIDTH, height: VIDEO_HEIGHT },
        });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        console.error('❌ Cannot access webcam', err);
      }
    };
    startVideo();
  }, []);

  // Expression detection loop
  useEffect(() => {
    if (!modelLoaded || !active) return;

    let interval: NodeJS.Timer;

    const detectExpressions = async () => {
      if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) return;

      try {
        const detections = await faceapi
          .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.3 }))
          .withFaceLandmarks()
          .withFaceExpressions();

        if (detections.length > 0) {
          setUserExpressions(detections[0].expressions);
        } else {
          setUserExpressions({});
        }
      } catch (err) {
        setUserExpressions({});
      }
    };

    interval = setInterval(detectExpressions, 300);
    return () => clearInterval(interval);
  }, [modelLoaded, active]);

  return (
    <div className="flex flex-col items-center justify-center overflow-hidden aspect-video">
      <video
        ref={videoRef}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        autoPlay
        muted
        playsInline
        className="rounded-lg border-4 border-blue-500 object-cover h-full w-full"
      />
    </div>
  );
};

export default ExpressionAnalyzerPage;
