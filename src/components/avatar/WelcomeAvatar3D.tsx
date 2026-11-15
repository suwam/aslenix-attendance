import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

export type AvatarAnimationState =
  | "peek"
  | "entrance"
  | "wave"
  | "guidance"
  | "idle"
  | "look_at_form"
  | "cover_eyes"
  | "peeking_eyes"
  | "loading"
  | "celebrating"
  | "error";

type WelcomeAvatar3DProps = {
  state: AvatarAnimationState;
  showPassword?: boolean;
  className?: string;
  onGreetingComplete?: () => void;
};

export function WelcomeAvatar3D({
  state,
  showPassword = false,
  className = "",
  onGreetingComplete,
}: WelcomeAvatar3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const showPasswordRef = useRef(showPassword);
  showPasswordRef.current = showPassword;

  // Speech bubble text with animated transition
  const [displaySpeechText, setDisplaySpeechText] = useState("Hi there! Welcome to ASLENIX!");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const speechVisible = true;

  const updateSpeech = (newText: string) => {
    setIsTransitioning(true);
    setTimeout(() => {
      setDisplaySpeechText(newText);
      setIsTransitioning(false);
    }, 180);
  };

  // Sync speech bubble text smoothly according to avatar animation state
  useEffect(() => {
    switch (state) {
      case "peek":
        updateSpeech("Hi there! Welcome to ASLENIX! 👋");
        break;
      case "entrance":
      case "wave":
        updateSpeech("Hi there! Welcome to ASLENIX! 👋");
        break;
      case "guidance":
      case "idle":
        updateSpeech("Ready to start your day? Sign in to check in! ✨");
        break;
      case "look_at_form":
        updateSpeech("Enter your username or email 📝");
        break;
      case "cover_eyes":
        updateSpeech("No peeking! Your password is safe 🙈");
        break;
      case "peeking_eyes":
        updateSpeech("I see you! Password revealed 👀");
        break;
      case "loading":
        updateSpeech("Verifying credentials... hang tight! 🚀");
        break;
      case "celebrating":
        updateSpeech("Welcome back! Redirecting you now 🎉");
        break;
      case "error":
        updateSpeech("Oops! Please double-check your credentials 💡");
        break;
    }
  }, [state]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Check reduced motion setting
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Set up Three.js Scene, Camera, Renderer
    const scene = new THREE.Scene();

    const width = container.clientWidth || 380;
    const height = container.clientHeight || 520;

    // Calibrated Perspective Camera with optimal FOV and clipping planes
    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 50);
    camera.position.set(0, 1.25, 4.8);
    camera.lookAt(0, 0.95, 0);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    // =========================================================
    // LIGHTING: High-Key Enterprise Reception Studio
    // =========================================================
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    // Key Light (Warm soft sunlight)
    const keyLight = new THREE.DirectionalLight(0xfff8ed, 1.8);
    keyLight.position.set(2.5, 3.8, 3.2);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    scene.add(keyLight);

    // Fill Light (Cool subtle indigo)
    const fillLight = new THREE.DirectionalLight(0x818cf8, 1.1);
    fillLight.position.set(-2.5, 2, 2.5);
    scene.add(fillLight);

    // Rim / Hair Light (Neon Magenta/Purple ASLENIX brand backlight)
    const rimLight = new THREE.DirectionalLight(0xec4899, 1.8);
    rimLight.position.set(0, 2.8, -2.5);
    scene.add(rimLight);

    // Soft Bottom Bounce Light (Cyan ambient)
    const bounceLight = new THREE.DirectionalLight(0x38bdf8, 0.5);
    bounceLight.position.set(0, -2, 2);
    scene.add(bounceLight);

    // =========================================================
    // MATERIALS
    // =========================================================
    const skinMaterial = new THREE.MeshStandardMaterial({
      color: 0xf6cbaf,
      roughness: 0.55,
      metalness: 0.05,
    });

    const blushMaterial = new THREE.MeshStandardMaterial({
      color: 0xf472b6,
      roughness: 0.7,
      transparent: true,
      opacity: 0.35,
    });

    const hairMaterial = new THREE.MeshStandardMaterial({
      color: 0x271e1b,
      roughness: 0.35,
      metalness: 0.15,
    });

    // ASLENIX Smart-Casual Navy/Purple Blazer
    const blazerMaterial = new THREE.MeshStandardMaterial({
      color: 0x1e1b4b, // Deep navy
      roughness: 0.75,
      metalness: 0.1,
    });

    const blazerLapelMaterial = new THREE.MeshStandardMaterial({
      color: 0x312e81, // Indigo/Purple lapel
      roughness: 0.6,
      metalness: 0.2,
    });

    // Crisp White Shirt
    const shirtMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.85,
    });

    // ASLENIX Gradient Accent Pin
    const badgeMaterial = new THREE.MeshStandardMaterial({
      color: 0xec4899,
      emissive: 0x6366f1,
      emissiveIntensity: 0.35,
      metalness: 0.8,
      roughness: 0.2,
    });

    const scleraMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.2,
    });

    const irisMaterial = new THREE.MeshStandardMaterial({
      color: 0x3b82f6, // Vibrant Hazel-Blue
      roughness: 0.3,
      metalness: 0.1,
    });

    const pupilMaterial = new THREE.MeshBasicMaterial({
      color: 0x09090b,
    });

    const eyeHighlightMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
    });

    const mouthMaterial = new THREE.MeshStandardMaterial({
      color: 0xbe123c, // Rose Red
      roughness: 0.5,
    });

    const toothMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.3,
    });

    // =========================================================
    // HIERARCHICAL RIGGED AVATAR MESH (Scaled Proportions)
    // =========================================================
    const avatarRoot = new THREE.Group();
    // Balanced scale: visually pleasant, secondary to form, never clipped
    avatarRoot.scale.set(0.78, 0.78, 0.78);
    avatarRoot.position.set(-0.28, -0.42, -0.45); // Starts peeking behind the card
    scene.add(avatarRoot);

    // Torso Group
    const torsoGroup = new THREE.Group();
    avatarRoot.add(torsoGroup);

    // Blazer / Upper Body (Chest & Shoulders)
    const bodyGeometry = new THREE.CylinderGeometry(0.55, 0.48, 0.95, 24);
    const bodyMesh = new THREE.Mesh(bodyGeometry, blazerMaterial);
    bodyMesh.position.y = 0.48;
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    torsoGroup.add(bodyMesh);

    // Shirt Insert (White V-neck opening)
    const shirtGeometry = new THREE.CylinderGeometry(
      0.32,
      0.1,
      0.45,
      16,
      1,
      false,
      Math.PI * 0.75,
      Math.PI * 0.5
    );
    const shirtMesh = new THREE.Mesh(shirtGeometry, shirtMaterial);
    shirtMesh.position.set(0, 0.72, 0.28);
    shirtMesh.rotation.y = Math.PI;
    torsoGroup.add(shirtMesh);

    // Collar
    const collarGeom = new THREE.TorusGeometry(0.24, 0.04, 12, 24, Math.PI);
    const collarMesh = new THREE.Mesh(collarGeom, shirtMaterial);
    collarMesh.position.set(0, 0.92, 0.08);
    collarMesh.rotation.x = -Math.PI * 0.45;
    torsoGroup.add(collarMesh);

    // Lapels (Left and Right)
    const lapelGeom = new THREE.BoxGeometry(0.12, 0.45, 0.04);
    const leftLapel = new THREE.Mesh(lapelGeom, blazerLapelMaterial);
    leftLapel.position.set(-0.18, 0.68, 0.28);
    leftLapel.rotation.z = 0.22;
    torsoGroup.add(leftLapel);

    const rightLapel = new THREE.Mesh(lapelGeom, blazerLapelMaterial);
    rightLapel.position.set(0.18, 0.68, 0.28);
    rightLapel.rotation.z = -0.22;
    torsoGroup.add(rightLapel);

    // ASLENIX Branded Lapel Pin
    const pinGeom = new THREE.ConeGeometry(0.045, 0.09, 3);
    const pinMesh = new THREE.Mesh(pinGeom, badgeMaterial);
    pinMesh.position.set(-0.25, 0.72, 0.32);
    pinMesh.rotation.z = Math.PI * 0.1;
    torsoGroup.add(pinMesh);

    // Neck
    const neckGeom = new THREE.CylinderGeometry(0.14, 0.16, 0.22, 16);
    const neckMesh = new THREE.Mesh(neckGeom, skinMaterial);
    neckMesh.position.y = 1.0;
    neckMesh.castShadow = true;
    torsoGroup.add(neckMesh);

    // =========================================================
    // HEAD GROUP (With Hair, Eyes, Eyebrows, Mouth, Headset)
    // =========================================================
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.32, 0.02);
    torsoGroup.add(headGroup);

    // Stylized Head Mesh
    const headGeom = new THREE.SphereGeometry(0.38, 32, 32);
    headGeom.scale(1, 1.14, 1.02);
    const headMesh = new THREE.Mesh(headGeom, skinMaterial);
    headMesh.castShadow = true;
    headGroup.add(headMesh);

    // Cheek Blushes
    const blushGeom = new THREE.SphereGeometry(0.07, 16, 16);
    blushGeom.scale(1.4, 0.7, 0.3);
    const leftBlush = new THREE.Mesh(blushGeom, blushMaterial);
    leftBlush.position.set(-0.24, -0.06, 0.33);
    headGroup.add(leftBlush);

    const rightBlush = new THREE.Mesh(blushGeom, blushMaterial);
    rightBlush.position.set(0.24, -0.06, 0.33);
    headGroup.add(rightBlush);

    // Nose
    const noseGeom = new THREE.ConeGeometry(0.045, 0.12, 16);
    const noseMesh = new THREE.Mesh(noseGeom, skinMaterial);
    noseMesh.position.set(0, -0.01, 0.4);
    noseMesh.rotation.x = Math.PI * 0.55;
    headGroup.add(noseMesh);

    // Modern Stylized Hair
    const hairTopGeom = new THREE.SphereGeometry(0.41, 24, 24, 0, Math.PI * 2, 0, Math.PI * 0.55);
    const hairTopMesh = new THREE.Mesh(hairTopGeom, hairMaterial);
    hairTopMesh.position.set(0, 0.08, -0.02);
    headGroup.add(hairTopMesh);

    // Hair Side-part Fringe
    const fringeGeom = new THREE.CylinderGeometry(0.12, 0.28, 0.42, 16);
    const fringeMesh = new THREE.Mesh(fringeGeom, hairMaterial);
    fringeMesh.position.set(-0.16, 0.32, 0.22);
    fringeMesh.rotation.set(0.4, -0.4, 1.35);
    headGroup.add(fringeMesh);

    // Back Hair Volume
    const backHairGeom = new THREE.SphereGeometry(
      0.38,
      20,
      20,
      0,
      Math.PI * 2,
      Math.PI * 0.3,
      Math.PI * 0.5
    );
    const backHairMesh = new THREE.Mesh(backHairGeom, hairMaterial);
    backHairMesh.position.set(0, 0, -0.08);
    headGroup.add(backHairMesh);

    // Eyes Helper
    const createEye = (isLeft: boolean) => {
      const eyeGroup = new THREE.Group();
      eyeGroup.position.set(isLeft ? -0.14 : 0.14, 0.05, 0.34);

      // Sclera (White)
      const eyeWhiteGeom = new THREE.SphereGeometry(0.075, 16, 16);
      eyeWhiteGeom.scale(1, 0.95, 0.6);
      const eyeWhite = new THREE.Mesh(eyeWhiteGeom, scleraMaterial);
      eyeGroup.add(eyeWhite);

      // Iris
      const irisGeom = new THREE.CircleGeometry(0.042, 16);
      const iris = new THREE.Mesh(irisGeom, irisMaterial);
      iris.position.set(0, 0, 0.045);
      eyeGroup.add(iris);

      // Pupil
      const pupilGeom = new THREE.CircleGeometry(0.024, 16);
      const pupil = new THREE.Mesh(pupilGeom, pupilMaterial);
      pupil.position.set(0, 0, 0.046);
      eyeGroup.add(pupil);

      // Specular Highlight Dot
      const lightDotGeom = new THREE.CircleGeometry(0.012, 12);
      const lightDot = new THREE.Mesh(lightDotGeom, eyeHighlightMaterial);
      lightDot.position.set(0.014, 0.014, 0.047);
      eyeGroup.add(lightDot);

      // Eyelid for Blinking
      const eyelidGeom = new THREE.SphereGeometry(0.078, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.5);
      eyelidGeom.scale(1, 1, 0.7);
      const eyelid = new THREE.Mesh(eyelidGeom, skinMaterial);
      eyelid.position.set(0, 0.02, 0.01);
      eyelid.rotation.x = -Math.PI * 0.55; // Open by default
      eyeGroup.add(eyelid);

      return { eyeGroup, iris, eyelid };
    };

    const leftEye = createEye(true);
    const rightEye = createEye(false);
    headGroup.add(leftEye.eyeGroup);
    headGroup.add(rightEye.eyeGroup);

    // Eyebrows
    const eyebrowGeom = new THREE.BoxGeometry(0.12, 0.025, 0.02);
    const leftEyebrow = new THREE.Mesh(eyebrowGeom, hairMaterial);
    leftEyebrow.position.set(-0.14, 0.17, 0.36);
    leftEyebrow.rotation.z = 0.08;
    headGroup.add(leftEyebrow);

    const rightEyebrow = new THREE.Mesh(eyebrowGeom, hairMaterial);
    rightEyebrow.position.set(0.14, 0.17, 0.36);
    rightEyebrow.rotation.z = -0.08;
    headGroup.add(rightEyebrow);

    // Expressive Smile
    const mouthGroup = new THREE.Group();
    mouthGroup.position.set(0, -0.17, 0.36);
    headGroup.add(mouthGroup);

    const mouthBackGeom = new THREE.CylinderGeometry(0.1, 0.06, 0.04, 16, 1, false, 0, Math.PI);
    const mouthMesh = new THREE.Mesh(mouthBackGeom, mouthMaterial);
    mouthMesh.rotation.x = Math.PI * 0.5;
    mouthGroup.add(mouthMesh);

    const teethGeom = new THREE.BoxGeometry(0.12, 0.025, 0.02);
    const teethMesh = new THREE.Mesh(teethGeom, toothMaterial);
    teethMesh.position.set(0, 0.01, 0.02);
    mouthGroup.add(teethMesh);

    // Professional Receptionist Headset (Earpiece with Glowing Cyan ASLENIX Mic)
    const headsetBandGeom = new THREE.TorusGeometry(0.4, 0.015, 12, 32, Math.PI * 0.85);
    const headsetBand = new THREE.Mesh(headsetBandGeom, blazerLapelMaterial);
    headsetBand.position.set(0, 0.06, 0);
    headsetBand.rotation.set(-0.15, 0, -Math.PI * 0.42);
    headGroup.add(headsetBand);

    const earpieceGeom = new THREE.CylinderGeometry(0.06, 0.06, 0.04, 16);
    const earpiece = new THREE.Mesh(earpieceGeom, blazerMaterial);
    earpiece.position.set(0.39, 0.04, 0.05);
    earpiece.rotation.z = Math.PI * 0.5;
    headGroup.add(earpiece);

    // Mic Boom
    const micBoomGeom = new THREE.CylinderGeometry(0.008, 0.008, 0.28, 8);
    const micBoom = new THREE.Mesh(micBoomGeom, blazerMaterial);
    micBoom.position.set(0.35, -0.08, 0.2);
    micBoom.rotation.set(0.7, 0.4, -0.4);
    headGroup.add(micBoom);

    const micTipGeom = new THREE.SphereGeometry(0.022, 12, 12);
    const micTipMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8, // Glowing Cyan LED
      emissive: 0x38bdf8,
      emissiveIntensity: 0.9,
    });
    const micTip = new THREE.Mesh(micTipGeom, micTipMat);
    micTip.position.set(0.24, -0.17, 0.32);
    headGroup.add(micTip);

    // =========================================================
    // ARMS & HANDS (Rigged for Waving, Eye-Covering, Pointing)
    // =========================================================
    // RIGHT ARM (Waving hand & Eye covering)
    const rightShoulder = new THREE.Group();
    rightShoulder.position.set(0.56, 0.82, 0);
    torsoGroup.add(rightShoulder);

    const rightUpperArmGeom = new THREE.CylinderGeometry(0.09, 0.08, 0.42, 16);
    const rightUpperArmMesh = new THREE.Mesh(rightUpperArmGeom, blazerMaterial);
    rightUpperArmMesh.position.y = -0.21;
    rightShoulder.add(rightUpperArmMesh);

    const rightElbow = new THREE.Group();
    rightElbow.position.set(0, -0.42, 0);
    rightShoulder.add(rightElbow);

    const rightForearmGeom = new THREE.CylinderGeometry(0.075, 0.065, 0.4, 16);
    const rightForearmMesh = new THREE.Mesh(rightForearmGeom, skinMaterial);
    rightForearmMesh.position.y = -0.2;
    rightElbow.add(rightForearmMesh);

    const rightWrist = new THREE.Group();
    rightWrist.position.set(0, -0.4, 0);
    rightElbow.add(rightWrist);

    // Right Hand (Palm & Fingers)
    const handGeom = new THREE.BoxGeometry(0.08, 0.12, 0.04);
    const rightHandMesh = new THREE.Mesh(handGeom, skinMaterial);
    rightHandMesh.position.y = -0.06;
    rightWrist.add(rightHandMesh);

    // Thumb & Fingers
    const thumbGeom = new THREE.CylinderGeometry(0.02, 0.018, 0.06, 8);
    const rightThumb = new THREE.Mesh(thumbGeom, skinMaterial);
    rightThumb.position.set(-0.045, -0.04, 0.015);
    rightThumb.rotation.z = -0.6;
    rightWrist.add(rightThumb);

    // LEFT ARM (Card gripping, Eye covering, Pointing)
    const leftShoulder = new THREE.Group();
    leftShoulder.position.set(-0.56, 0.82, 0);
    torsoGroup.add(leftShoulder);

    const leftUpperArmGeom = new THREE.CylinderGeometry(0.09, 0.08, 0.42, 16);
    const leftUpperArmMesh = new THREE.Mesh(leftUpperArmGeom, blazerMaterial);
    leftUpperArmMesh.position.y = -0.21;
    leftShoulder.add(leftUpperArmMesh);

    const leftElbow = new THREE.Group();
    leftElbow.position.set(0, -0.42, 0);
    leftShoulder.add(leftElbow);

    const leftForearmGeom = new THREE.CylinderGeometry(0.075, 0.065, 0.4, 16);
    const leftForearmMesh = new THREE.Mesh(leftForearmGeom, skinMaterial);
    leftForearmMesh.position.y = -0.2;
    leftElbow.add(leftForearmMesh);

    const leftWrist = new THREE.Group();
    leftWrist.position.set(0, -0.4, 0);
    leftElbow.add(leftWrist);

    const leftHandMesh = new THREE.Mesh(handGeom, skinMaterial);
    leftHandMesh.position.y = -0.06;
    leftWrist.add(leftHandMesh);

    const leftThumb = new THREE.Mesh(thumbGeom, skinMaterial);
    leftThumb.position.set(0.045, -0.04, 0.015);
    leftThumb.rotation.z = 0.6;
    leftWrist.add(leftThumb);

    // Index finger for pointing towards form
    const indexFingerGeom = new THREE.CylinderGeometry(0.016, 0.014, 0.1, 8);
    const leftIndexFinger = new THREE.Mesh(indexFingerGeom, skinMaterial);
    leftIndexFinger.position.set(-0.02, -0.14, 0.02);
    leftIndexFinger.visible = false;
    leftWrist.add(leftIndexFinger);

    // =========================================================
    // ANIMATION & KINEMATIC STATE ENGINE
    // =========================================================
    let clock = new THREE.Clock();
    let animId: number;

    // Kinematic Target Positions (Centered inside view frustum)
    let targetRootX = -0.28;
    let targetRootY = -0.42;
    let targetRootZ = -0.45;
    let targetRootRotY = -0.25;

    let targetHeadRotX = 0;
    let targetHeadRotY = 0;
    let targetHeadRotZ = 0;

    let targetRightShoulderRotX = 0;
    let targetRightShoulderRotY = 0;
    let targetRightShoulderRotZ = 0;

    let targetRightElbowRotX = 0;
    let targetRightElbowRotY = 0;
    let targetRightElbowRotZ = 0;

    let targetRightWristRotX = 0;
    let targetRightWristRotY = 0;
    let targetRightWristRotZ = 0;

    let targetLeftShoulderRotX = 0;
    let targetLeftShoulderRotY = 0;
    let targetLeftShoulderRotZ = 0;

    let targetLeftElbowRotX = 0;
    let targetLeftElbowRotY = 0;
    let targetLeftElbowRotZ = 0;

    let targetLeftWristRotX = 0;
    let targetLeftWristRotY = 0;
    let targetLeftWristRotZ = 0;

    let blinkProgress = 0;
    let timeSinceLastBlink = 0;
    let nextBlinkInterval = 3.5;

    // Helper: Linear Interpolation for Angles
    const lerp = (start: number, end: number, factor: number) => {
      return start + (end - start) * factor;
    };

    const animate = () => {
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();
      const currentMode = stateRef.current;
      const isShowPassword = showPasswordRef.current;

      // Handle Blinking
      timeSinceLastBlink += delta;
      if (timeSinceLastBlink > nextBlinkInterval) {
        blinkProgress += delta * 14;
        if (blinkProgress > Math.PI) {
          blinkProgress = 0;
          timeSinceLastBlink = 0;
          nextBlinkInterval = 2.5 + Math.random() * 3.5;
        }
      }
      const blinkAngle = Math.sin(blinkProgress) * (Math.PI * 0.5);
      leftEye.eyelid.rotation.x = -Math.PI * 0.55 + blinkAngle;
      rightEye.eyelid.rotation.x = -Math.PI * 0.55 + blinkAngle;

      // Gentle natural breathing
      const breath = Math.sin(elapsed * 2.2) * 0.015;
      torsoGroup.position.y = breath;

      // =======================================================
      // KINEMATIC POSES ACCORDING TO STATE
      // =======================================================
      if (currentMode === "peek") {
        // Hiding behind the card, peeking head and hand out from the right edge
        targetRootX = -0.28;
        targetRootY = -0.42;
        targetRootZ = -0.45;
        targetRootRotY = -0.28;

        targetHeadRotX = 0.06;
        targetHeadRotY = -0.22;
        targetHeadRotZ = 0.22; // Curious head tilt

        // Right hand holding card edge
        targetRightShoulderRotX = 0.35;
        targetRightShoulderRotY = -0.15;
        targetRightShoulderRotZ = 0.5;

        targetRightElbowRotX = -0.85;
        targetRightElbowRotY = -0.3;
        targetRightElbowRotZ = 0.55;

        targetRightWristRotX = 0.25;
        targetRightWristRotY = 0;
        targetRightWristRotZ = -0.3;

        // Left arm hidden behind card
        targetLeftShoulderRotX = 0.1;
        targetLeftShoulderRotY = 0;
        targetLeftShoulderRotZ = -0.1;
        targetLeftElbowRotX = -0.2;
        targetLeftElbowRotY = 0;
        targetLeftElbowRotZ = 0;

        leftIndexFinger.visible = false;
      } else if (currentMode === "entrance") {
        // Smoothly moving out from behind the card, upper body becoming visible
        targetRootX = 0.12;
        targetRootY = -0.36;
        targetRootZ = 0.0;
        targetRootRotY = -0.18;

        targetHeadRotX = 0.02;
        targetHeadRotY = -0.06;
        targetHeadRotZ = 0.03;

        // Lifting right arm into wave
        targetRightShoulderRotX = 0.1;
        targetRightShoulderRotY = -0.1;
        targetRightShoulderRotZ = 1.35;

        targetRightElbowRotX = -1.1;
        targetRightElbowRotY = 0.3;
        targetRightElbowRotZ = 0.65;

        targetRightWristRotX = 0.1;
        targetRightWristRotY = 0.1;
        targetRightWristRotZ = 0;

        targetLeftShoulderRotX = 0.1;
        targetLeftShoulderRotY = 0;
        targetLeftShoulderRotZ = -0.18;
        targetLeftElbowRotX = -0.22;
        targetLeftElbowRotY = 0;
        targetLeftElbowRotZ = 0;

        leftIndexFinger.visible = false;
      } else if (currentMode === "wave") {
        // Steps out from behind the card, upper body fully visible, waving hello
        targetRootX = 0.14;
        targetRootY = -0.36;
        targetRootZ = 0.0;
        targetRootRotY = -0.15;

        targetHeadRotX = 0.02;
        targetHeadRotY = -0.04;
        targetHeadRotZ = 0.03;

        // Wave animation on Right Arm (comfortably inside camera frustum)
        const waveAngle = Math.sin(elapsed * 7.0) * 0.32;

        targetRightShoulderRotX = 0.1;
        targetRightShoulderRotY = -0.1;
        targetRightShoulderRotZ = 1.5 + waveAngle * 0.25;

        targetRightElbowRotX = -1.15;
        targetRightElbowRotY = 0.35;
        targetRightElbowRotZ = 0.75 + waveAngle;

        targetRightWristRotX = 0.1;
        targetRightWristRotY = 0.15;
        targetRightWristRotZ = waveAngle * 0.7;

        // Left arm natural at side
        targetLeftShoulderRotX = 0.1;
        targetLeftShoulderRotY = 0;
        targetLeftShoulderRotZ = -0.18;
        targetLeftElbowRotX = -0.25;
        targetLeftElbowRotY = 0;
        targetLeftElbowRotZ = 0;

        leftIndexFinger.visible = false;
      } else if (currentMode === "guidance") {
        // Points towards the login form to guide the employee
        targetRootX = 0.12;
        targetRootY = -0.36;
        targetRootZ = 0.0;
        targetRootRotY = -0.35; // Turning towards form

        targetHeadRotX = 0.08;
        targetHeadRotY = -0.42; // Looking towards the login card
        targetHeadRotZ = 0.03;

        // Left arm points towards form
        targetLeftShoulderRotX = 0.55;
        targetLeftShoulderRotY = 0.25;
        targetLeftShoulderRotZ = -0.58;

        targetLeftElbowRotX = -0.45;
        targetLeftElbowRotY = -0.15;
        targetLeftElbowRotZ = -0.2;

        targetLeftWristRotX = 0.2;
        targetLeftWristRotY = 0;
        targetLeftWristRotZ = 0.1;

        leftIndexFinger.visible = true;

        // Right arm relaxed at side
        targetRightShoulderRotX = 0.12;
        targetRightShoulderRotY = 0.04;
        targetRightShoulderRotZ = 0.18;
        targetRightElbowRotX = -0.25;
        targetRightElbowRotY = 0;
        targetRightElbowRotZ = 0;
      } else if (currentMode === "look_at_form") {
        // Turns head towards the login form & points attentively
        targetRootX = 0.1;
        targetRootY = -0.36;
        targetRootZ = 0.02;
        targetRootRotY = -0.38;

        targetHeadRotX = 0.1;
        targetHeadRotY = -0.5; // Looking directly at username input
        targetHeadRotZ = 0.04;

        // Left arm points towards form
        targetLeftShoulderRotX = 0.52;
        targetLeftShoulderRotY = 0.22;
        targetLeftShoulderRotZ = -0.55;

        targetLeftElbowRotX = -0.42;
        targetLeftElbowRotY = -0.15;
        targetLeftElbowRotZ = -0.2;

        targetLeftWristRotX = 0.2;
        targetLeftWristRotY = 0;
        targetLeftWristRotZ = 0.1;

        leftIndexFinger.visible = true;

        // Right arm relaxed
        targetRightShoulderRotX = 0.12;
        targetRightShoulderRotY = 0;
        targetRightShoulderRotZ = 0.18;
        targetRightElbowRotX = -0.25;
        targetRightElbowRotY = 0;
        targetRightElbowRotZ = 0;
      } else if (currentMode === "cover_eyes") {
        // Playfully covers eyes with hands
        targetRootX = 0.12;
        targetRootY = -0.36;
        targetRootZ = 0.0;
        targetRootRotY = -0.12;

        targetHeadRotX = 0.12;
        targetHeadRotY = 0;
        targetHeadRotZ = 0;

        if (isShowPassword) {
          // Peeking through fingers! (password revealed)
          targetRightShoulderRotX = 0.75;
          targetRightShoulderRotY = 0.15;
          targetRightShoulderRotZ = 0.55;

          targetRightElbowRotX = -1.5;
          targetRightElbowRotY = -0.15;
          targetRightElbowRotZ = 0.85;

          targetRightWristRotX = 0.22;
          targetRightWristRotY = -0.25;
          targetRightWristRotZ = 0.15;

          // Left hand parts slightly away from eye
          targetLeftShoulderRotX = 0.65;
          targetLeftShoulderRotY = -0.35;
          targetLeftShoulderRotZ = -0.75;

          targetLeftElbowRotX = -1.35;
          targetLeftElbowRotY = 0.15;
          targetLeftElbowRotZ = -0.6;

          targetLeftWristRotX = 0.1;
          targetLeftWristRotY = 0.2;
          targetLeftWristRotZ = -0.25;
        } else {
          // Fully covering both eyes with palms
          targetRightShoulderRotX = 0.9;
          targetRightShoulderRotY = 0.2;
          targetRightShoulderRotZ = 0.5;

          targetRightElbowRotX = -1.8;
          targetRightElbowRotY = -0.25;
          targetRightElbowRotZ = 0.8;

          targetRightWristRotX = 0.2;
          targetRightWristRotY = 0;
          targetRightWristRotZ = 0.1;

          targetLeftShoulderRotX = 0.9;
          targetLeftShoulderRotY = -0.2;
          targetLeftShoulderRotZ = -0.5;

          targetLeftElbowRotX = -1.8;
          targetLeftElbowRotY = 0.25;
          targetLeftElbowRotZ = -0.8;

          targetLeftWristRotX = 0.2;
          targetLeftWristRotY = 0;
          targetLeftWristRotZ = -0.1;
        }

        leftIndexFinger.visible = false;
      } else if (currentMode === "loading") {
        // Encouraging thumbs up & nod
        targetRootX = 0.12;
        targetRootY = -0.36;
        targetRootZ = 0.0;
        targetRootRotY = -0.15;

        const nod = Math.sin(elapsed * 5.5) * 0.07;
        targetHeadRotX = 0.06 + nod;
        targetHeadRotY = -0.08;
        targetHeadRotZ = 0;

        // Right hand thumbs up
        targetRightShoulderRotX = 0.45;
        targetRightShoulderRotY = 0.1;
        targetRightShoulderRotZ = 0.4;

        targetRightElbowRotX = -1.3;
        targetRightElbowRotY = 0.2;
        targetRightElbowRotZ = 0.6;

        targetRightWristRotX = 0.25;
        targetRightWristRotY = 0;
        targetRightWristRotZ = 0.2;

        targetLeftShoulderRotX = 0.12;
        targetLeftShoulderRotY = 0;
        targetLeftShoulderRotZ = -0.18;
        targetLeftElbowRotX = -0.25;
        targetLeftElbowRotY = 0;
        targetLeftElbowRotZ = 0;

        leftIndexFinger.visible = false;
      } else if (currentMode === "celebrating") {
        // Celebratory cheer with bounce
        targetRootX = 0.12;
        targetRootY = -0.36;
        targetRootZ = 0.0;
        targetRootRotY = -0.08;

        const cheerBounce = Math.sin(elapsed * 7) * 0.035;
        torsoGroup.position.y += cheerBounce;

        targetHeadRotX = -0.1;
        targetHeadRotY = 0;
        targetHeadRotZ = Math.sin(elapsed * 4) * 0.05;

        targetRightShoulderRotX = 0.1;
        targetRightShoulderRotY = 0.15;
        targetRightShoulderRotZ = 1.85; // Hands high in air
        targetRightElbowRotX = -0.75;
        targetRightElbowRotY = 0.25;
        targetRightElbowRotZ = 0.55;

        targetLeftShoulderRotX = 0.1;
        targetLeftShoulderRotY = -0.15;
        targetLeftShoulderRotZ = -1.85;
        targetLeftElbowRotX = -0.75;
        targetLeftElbowRotY = -0.25;
        targetLeftElbowRotZ = -0.55;

        leftIndexFinger.visible = false;
      } else if (currentMode === "error") {
        // Sympathetic head shake
        targetRootX = 0.12;
        targetRootY = -0.36;
        targetRootZ = 0.0;
        targetRootRotY = -0.15;

        const shake = Math.sin(elapsed * 6) * 0.08;
        targetHeadRotX = 0.1;
        targetHeadRotY = shake;
        targetHeadRotZ = 0;

        targetRightShoulderRotX = 0.15;
        targetRightShoulderRotZ = 0.2;
        targetRightElbowRotX = -0.3;

        targetLeftShoulderRotX = 0.15;
        targetLeftShoulderRotZ = -0.2;
        targetLeftElbowRotX = -0.3;

        leftIndexFinger.visible = false;
      } else {
        // Idle friendly receptionist stance with subtle head sway
        targetRootX = 0.12;
        targetRootY = -0.36;
        targetRootZ = 0.0;
        targetRootRotY = -0.18;

        const headSway = Math.sin(elapsed * 1.5) * 0.02;
        targetHeadRotX = 0.02 + Math.cos(elapsed * 1.2) * 0.015;
        targetHeadRotY = -0.06 + headSway;
        targetHeadRotZ = 0.015;

        targetRightShoulderRotX = 0.12;
        targetRightShoulderRotY = 0.04;
        targetRightShoulderRotZ = 0.2;
        targetRightElbowRotX = -0.3;
        targetRightElbowRotY = 0;
        targetRightElbowRotZ = 0;

        targetLeftShoulderRotX = 0.12;
        targetLeftShoulderRotY = -0.04;
        targetLeftShoulderRotZ = -0.2;
        targetLeftElbowRotX = -0.3;
        targetLeftElbowRotY = 0;
        targetLeftElbowRotZ = 0;

        leftIndexFinger.visible = false;
      }

      // Smooth kinematic interpolation
      const smoothFactor = prefersReducedMotion ? 0.35 : 0.08;

      avatarRoot.position.x = lerp(avatarRoot.position.x, targetRootX, smoothFactor);
      avatarRoot.position.y = lerp(avatarRoot.position.y, targetRootY, smoothFactor);
      avatarRoot.position.z = lerp(avatarRoot.position.z, targetRootZ, smoothFactor);
      avatarRoot.rotation.y = lerp(avatarRoot.rotation.y, targetRootRotY, smoothFactor);

      headGroup.rotation.x = lerp(headGroup.rotation.x, targetHeadRotX, smoothFactor);
      headGroup.rotation.y = lerp(headGroup.rotation.y, targetHeadRotY, smoothFactor);
      headGroup.rotation.z = lerp(headGroup.rotation.z, targetHeadRotZ, smoothFactor);

      rightShoulder.rotation.x = lerp(rightShoulder.rotation.x, targetRightShoulderRotX, smoothFactor);
      rightShoulder.rotation.y = lerp(rightShoulder.rotation.y, targetRightShoulderRotY, smoothFactor);
      rightShoulder.rotation.z = lerp(rightShoulder.rotation.z, targetRightShoulderRotZ, smoothFactor);

      rightElbow.rotation.x = lerp(rightElbow.rotation.x, targetRightElbowRotX, smoothFactor);
      rightElbow.rotation.y = lerp(rightElbow.rotation.y, targetRightElbowRotY, smoothFactor);
      rightElbow.rotation.z = lerp(rightElbow.rotation.z, targetRightElbowRotZ, smoothFactor);

      rightWrist.rotation.x = lerp(rightWrist.rotation.x, targetRightWristRotX, smoothFactor);
      rightWrist.rotation.y = lerp(rightWrist.rotation.y, targetRightWristRotY, smoothFactor);
      rightWrist.rotation.z = lerp(rightWrist.rotation.z, targetRightWristRotZ, smoothFactor);

      leftShoulder.rotation.x = lerp(leftShoulder.rotation.x, targetLeftShoulderRotX, smoothFactor);
      leftShoulder.rotation.y = lerp(leftShoulder.rotation.y, targetLeftShoulderRotY, smoothFactor);
      leftShoulder.rotation.z = lerp(leftShoulder.rotation.z, targetLeftShoulderRotZ, smoothFactor);

      leftElbow.rotation.x = lerp(leftElbow.rotation.x, targetLeftElbowRotX, smoothFactor);
      leftElbow.rotation.y = lerp(leftElbow.rotation.y, targetLeftElbowRotY, smoothFactor);
      leftElbow.rotation.z = lerp(leftElbow.rotation.z, targetLeftElbowRotZ, smoothFactor);

      leftWrist.rotation.x = lerp(leftWrist.rotation.x, targetLeftWristRotX, smoothFactor);
      leftWrist.rotation.y = lerp(leftWrist.rotation.y, targetLeftWristRotY, smoothFactor);
      leftWrist.rotation.z = lerp(leftWrist.rotation.z, targetLeftWristRotZ, smoothFactor);

      renderer.render(scene, camera);
      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 380;
      const h = container.clientHeight || 520;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className={`relative w-full h-full pointer-events-none select-none ${className}`}>
      {/* Speech Bubble Floating Elegantly Above and Beside the Avatar's Head */}
      {speechVisible && (
        <div
          className={`absolute z-30 pointer-events-auto transition-all duration-300 ease-out
            top-3 sm:top-5 left-3 sm:left-6
            max-w-[210px] sm:max-w-[245px]
            ${
              isTransitioning
                ? "opacity-0 -translate-y-1 scale-95"
                : "opacity-100 translate-y-0 scale-100"
            }
          `}
        >
          <div className="relative rounded-2xl px-3.5 py-2.5 sm:px-4 sm:py-3 bg-slate-900/95 text-white border border-indigo-500/35 shadow-xl shadow-slate-950/40 backdrop-blur-md">
            <p className="text-xs sm:text-[13px] font-semibold leading-snug text-slate-100 tracking-tight">
              {displaySpeechText}
            </p>
            {/* Pointer directed toward avatar's head (bottom-right) */}
            <div
              aria-hidden
              className="absolute -bottom-1.5 right-8 w-3 h-3 bg-slate-900/95 border-r border-b border-indigo-500/35 transform rotate-45"
            />
          </div>
        </div>
      )}

      {/* 3D WebGL Canvas Container */}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
