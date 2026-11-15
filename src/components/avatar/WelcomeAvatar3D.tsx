import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

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
};

export function WelcomeAvatar3D({
  state,
  showPassword = false,
  className = "",
}: WelcomeAvatar3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const showPasswordRef = useRef(showPassword);
  showPasswordRef.current = showPassword;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Set up Three.js Scene, Camera, Renderer
    const scene = new THREE.Scene();

    const width = container.clientWidth || 400;
    const height = container.clientHeight || 560;

    // Portrait focal length (FOV 32) creates natural, flattering human proportions
    const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 50);
    // Positioned to frame the upper body, shoulders, and head
    camera.position.set(0, 1.48, 1.95);
    camera.lookAt(0, 1.42, 0);

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
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.3);
    scene.add(ambientLight);

    // Key Light (Soft warm sunlight)
    const keyLight = new THREE.DirectionalLight(0xfff7ed, 1.8);
    keyLight.position.set(2.5, 3.5, 3.0);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    scene.add(keyLight);

    // Fill Light (Cool subtle indigo)
    const fillLight = new THREE.DirectionalLight(0x818cf8, 1.1);
    fillLight.position.set(-2.5, 2.0, 2.5);
    scene.add(fillLight);

    // Rim Light (Neon Magenta/Purple ASLENIX brand backlight)
    const rimLight = new THREE.DirectionalLight(0xec4899, 1.8);
    rimLight.position.set(0, 2.8, -2.5);
    scene.add(rimLight);

    // Soft Bottom Bounce Light (Cyan ambient)
    const bounceLight = new THREE.DirectionalLight(0x38bdf8, 0.5);
    bounceLight.position.set(0, -2, 2);
    scene.add(bounceLight);

    // =========================================================
    // LOAD HIGH-QUALITY REALISTIC 3D HUMAN AVATAR (Ready Player Me)
    // =========================================================
    const loader = new GLTFLoader();
    const avatarRoot = new THREE.Group();
    scene.add(avatarRoot);

    // Bone References
    let headBone: THREE.Bone | null = null;
    let neckBone: THREE.Bone | null = null;
    let spineBone: THREE.Bone | null = null;
    let spine1Bone: THREE.Bone | null = null;
    let rightArmBone: THREE.Bone | null = null;
    let rightForeArmBone: THREE.Bone | null = null;
    let rightHandBone: THREE.Bone | null = null;
    let leftArmBone: THREE.Bone | null = null;
    let leftForeArmBone: THREE.Bone | null = null;
    let leftHandBone: THREE.Bone | null = null;

    // Morph Target References (Facial expressions & Blinking)
    let headMesh: THREE.SkinnedMesh | null = null;
    let smileLeftIndex = -1;
    let smileRightIndex = -1;
    let blinkLeftIndex = -1;
    let blinkRightIndex = -1;

    // Rest Rotations
    const restRot = {
      head: new THREE.Euler(),
      neck: new THREE.Euler(),
      spine: new THREE.Euler(),
      rightArm: new THREE.Euler(),
      rightForeArm: new THREE.Euler(),
      rightHand: new THREE.Euler(),
      leftArm: new THREE.Euler(),
      leftForeArm: new THREE.Euler(),
      leftHand: new THREE.Euler(),
    };

    let isModelLoaded = false;

    loader.load(
      "/models/avatar.glb",
      (gltf) => {
        const model = gltf.scene;

        // Traverse model to capture bones and blendshapes
        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }

          if (child.name === "Wolf3D_Head" && (child as THREE.SkinnedMesh).morphTargetDictionary) {
            headMesh = child as THREE.SkinnedMesh;
            const dict = headMesh.morphTargetDictionary!;
            smileLeftIndex = dict["mouthSmileLeft"] ?? dict["mouthSmile"] ?? -1;
            smileRightIndex = dict["mouthSmileRight"] ?? dict["mouthSmile"] ?? -1;
            blinkLeftIndex = dict["eyeBlinkLeft"] ?? -1;
            blinkRightIndex = dict["eyeBlinkRight"] ?? -1;
          }

          if ((child as THREE.Bone).isBone) {
            const bone = child as THREE.Bone;
            switch (bone.name) {
              case "Head":
                headBone = bone;
                restRot.head.copy(bone.rotation);
                break;
              case "Neck":
                neckBone = bone;
                restRot.neck.copy(bone.rotation);
                break;
              case "Spine":
                spineBone = bone;
                restRot.spine.copy(bone.rotation);
                break;
              case "Spine1":
                spine1Bone = bone;
                break;
              case "RightArm":
                rightArmBone = bone;
                restRot.rightArm.copy(bone.rotation);
                break;
              case "RightForeArm":
                rightForeArmBone = bone;
                restRot.rightForeArm.copy(bone.rotation);
                break;
              case "RightHand":
                rightHandBone = bone;
                restRot.rightHand.copy(bone.rotation);
                break;
              case "LeftArm":
                leftArmBone = bone;
                restRot.leftArm.copy(bone.rotation);
                break;
              case "LeftForeArm":
                leftForeArmBone = bone;
                restRot.leftForeArm.copy(bone.rotation);
                break;
              case "LeftHand":
                leftHandBone = bone;
                restRot.leftHand.copy(bone.rotation);
                break;
            }
          }
        });

        avatarRoot.add(model);
        isModelLoaded = true;
      },
      undefined,
      (error) => {
        console.error("Error loading 3D avatar:", error);
      }
    );

    // =========================================================
    // KINEMATIC ANIMATION ENGINE
    // =========================================================
    let clock = new THREE.Clock();
    let animId: number;

    // Target kinematic coordinates
    let targetRootX = -0.15;
    let targetRootY = 0;
    let targetRootZ = -0.35;
    let targetRootRotY = -0.25;

    let targetHeadRotX = 0;
    let targetHeadRotY = 0;
    let targetHeadRotZ = 0;

    let targetRightArmRotX = 0;
    let targetRightArmRotY = 0;
    let targetRightArmRotZ = 0;

    let targetRightForeArmRotX = 0;
    let targetRightForeArmRotY = 0;
    let targetRightForeArmRotZ = 0;

    let targetRightHandRotX = 0;
    let targetRightHandRotY = 0;
    let targetRightHandRotZ = 0;

    let targetLeftArmRotX = 0;
    let targetLeftArmRotY = 0;
    let targetLeftArmRotZ = 0;

    let targetLeftForeArmRotX = 0;
    let targetLeftForeArmRotY = 0;
    let targetLeftForeArmRotZ = 0;

    let targetLeftHandRotX = 0;
    let targetLeftHandRotY = 0;
    let targetLeftHandRotZ = 0;

    let targetSmile = 0.5;
    let currentSmile = 0.5;

    let blinkProgress = 0;
    let timeSinceLastBlink = 0;
    let nextBlinkInterval = 3.2;

    const lerp = (start: number, end: number, factor: number) => {
      return start + (end - start) * factor;
    };

    const animate = () => {
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();
      const currentMode = stateRef.current;
      const isShowPassword = showPasswordRef.current;

      // Natural Eye Blinking Cycle
      timeSinceLastBlink += delta;
      let blinkWeight = 0;
      if (timeSinceLastBlink > nextBlinkInterval) {
        blinkProgress += delta * 14;
        if (blinkProgress > Math.PI) {
          blinkProgress = 0;
          timeSinceLastBlink = 0;
          nextBlinkInterval = 2.5 + Math.random() * 3.5;
        } else {
          blinkWeight = Math.sin(blinkProgress);
        }
      }

      // Apply Facial Morph Targets (Eyes & Smile)
      if (headMesh && headMesh.morphTargetInfluences) {
        if (blinkLeftIndex >= 0) headMesh.morphTargetInfluences[blinkLeftIndex] = blinkWeight;
        if (blinkRightIndex >= 0) headMesh.morphTargetInfluences[blinkRightIndex] = blinkWeight;

        currentSmile = lerp(currentSmile, targetSmile, 0.08);
        if (smileLeftIndex >= 0) headMesh.morphTargetInfluences[smileLeftIndex] = currentSmile;
        if (smileRightIndex >= 0) headMesh.morphTargetInfluences[smileRightIndex] = currentSmile;
      }

      // Gentle natural breathing
      const breath = Math.sin(elapsed * 2.2) * 0.012;
      if (spineBone) {
        spineBone.rotation.x = restRot.spine.x + breath;
      }

      // =======================================================
      // KINEMATIC POSES ACCORDING TO STATE
      // =======================================================
      if (currentMode === "peek") {
        // Hiding behind the right edge of the login card, head tilted curiously
        targetRootX = -0.15;
        targetRootY = 0;
        targetRootZ = -0.35;
        targetRootRotY = -0.28;

        targetHeadRotX = 0.05;
        targetHeadRotY = -0.22;
        targetHeadRotZ = 0.22; // Curious head tilt
        targetSmile = 0.45;

        // Right hand holding/resting near card edge
        targetRightArmRotX = 0.4;
        targetRightArmRotY = -0.15;
        targetRightArmRotZ = 0.35;

        targetRightForeArmRotX = -0.8;
        targetRightForeArmRotY = -0.2;
        targetRightForeArmRotZ = 0.4;

        targetRightHandRotX = 0.2;
        targetRightHandRotY = 0;
        targetRightHandRotZ = -0.2;

        // Left arm tucked behind card
        targetLeftArmRotX = 0.1;
        targetLeftArmRotY = 0;
        targetLeftArmRotZ = -0.1;
        targetLeftForeArmRotX = -0.2;
        targetLeftForeArmRotY = 0;
        targetLeftForeArmRotZ = 0;
      } else if (currentMode === "entrance") {
        // Smoothly moving out from behind the card, upper body becoming visible
        targetRootX = 0.22;
        targetRootY = 0;
        targetRootZ = 0.0;
        targetRootRotY = -0.18;

        targetHeadRotX = 0.02;
        targetHeadRotY = -0.06;
        targetHeadRotZ = 0.03;
        targetSmile = 0.65;

        // Raising right arm into wave
        targetRightArmRotX = 0.2;
        targetRightArmRotY = -0.1;
        targetRightArmRotZ = 1.25;

        targetRightForeArmRotX = -1.0;
        targetRightForeArmRotY = 0.3;
        targetRightForeArmRotZ = 0.6;

        targetRightHandRotX = 0.1;
        targetRightHandRotY = 0.1;
        targetRightHandRotZ = 0;

        targetLeftArmRotX = 0.1;
        targetLeftArmRotY = 0;
        targetLeftArmRotZ = -0.18;
        targetLeftForeArmRotX = -0.22;
        targetLeftForeArmRotY = 0;
        targetLeftForeArmRotZ = 0;
      } else if (currentMode === "wave") {
        // Steps out from behind the card, upper body fully visible, waving hello
        targetRootX = 0.24;
        targetRootY = 0;
        targetRootZ = 0.0;
        targetRootRotY = -0.15;

        targetHeadRotX = 0.02;
        targetHeadRotY = -0.04;
        targetHeadRotZ = 0.03;
        targetSmile = 0.75;

        // Smooth natural wave animation on Right Arm
        const waveAngle = Math.sin(elapsed * 6.5) * 0.3;

        targetRightArmRotX = 0.15;
        targetRightArmRotY = -0.1;
        targetRightArmRotZ = 1.45 + waveAngle * 0.25;

        targetRightForeArmRotX = -1.15;
        targetRightForeArmRotY = 0.35;
        targetRightForeArmRotZ = 0.7 + waveAngle;

        targetRightHandRotX = 0.1;
        targetRightHandRotY = 0.15;
        targetRightHandRotZ = waveAngle * 0.65;

        // Left arm natural at side
        targetLeftArmRotX = 0.1;
        targetLeftArmRotY = 0;
        targetLeftArmRotZ = -0.18;
        targetLeftForeArmRotX = -0.25;
        targetLeftForeArmRotY = 0;
        targetLeftForeArmRotZ = 0;
      } else if (currentMode === "guidance") {
        // Points towards the login form to guide the employee
        targetRootX = 0.24;
        targetRootY = 0;
        targetRootZ = 0.0;
        targetRootRotY = -0.32; // Body turns towards form

        targetHeadRotX = 0.08;
        targetHeadRotY = -0.42; // Looking towards login inputs
        targetHeadRotZ = 0.03;
        targetSmile = 0.6;

        // Left arm points towards form
        targetLeftArmRotX = 0.55;
        targetLeftArmRotY = 0.25;
        targetLeftArmRotZ = -0.55;

        targetLeftForeArmRotX = -0.45;
        targetLeftForeArmRotY = -0.15;
        targetLeftForeArmRotZ = -0.2;

        targetLeftHandRotX = 0.2;
        targetLeftHandRotY = 0;
        targetLeftHandRotZ = 0.1;

        // Right arm relaxed at side
        targetRightArmRotX = 0.12;
        targetRightArmRotY = 0.04;
        targetRightArmRotZ = 0.18;
        targetRightForeArmRotX = -0.25;
        targetRightForeArmRotY = 0;
        targetRightForeArmRotZ = 0;
      } else if (currentMode === "look_at_form") {
        // Turns head towards the login form & points attentively
        targetRootX = 0.24;
        targetRootY = 0;
        targetRootZ = 0.02;
        targetRootRotY = -0.36;

        targetHeadRotX = 0.1;
        targetHeadRotY = -0.48; // Looking directly at username input
        targetHeadRotZ = 0.04;
        targetSmile = 0.5;

        // Left arm points towards form
        targetLeftArmRotX = 0.52;
        targetLeftArmRotY = 0.22;
        targetLeftArmRotZ = -0.52;

        targetLeftForeArmRotX = -0.42;
        targetLeftForeArmRotY = -0.15;
        targetLeftForeArmRotZ = -0.2;

        targetLeftHandRotX = 0.2;
        targetLeftHandRotY = 0;
        targetLeftHandRotZ = 0.1;

        targetRightArmRotX = 0.12;
        targetRightArmRotY = 0;
        targetRightArmRotZ = 0.18;
        targetRightForeArmRotX = -0.25;
        targetRightForeArmRotY = 0;
        targetRightForeArmRotZ = 0;
      } else if (currentMode === "cover_eyes") {
        // Playfully covers eyes with hands
        targetRootX = 0.24;
        targetRootY = 0;
        targetRootZ = 0.0;
        targetRootRotY = -0.12;

        targetHeadRotX = 0.12;
        targetHeadRotY = 0;
        targetHeadRotZ = 0;
        targetSmile = 0.4;

        if (isShowPassword) {
          // Peeking through fingers! (password revealed)
          targetRightArmRotX = 0.75;
          targetRightArmRotY = 0.15;
          targetRightArmRotZ = 0.55;

          targetRightForeArmRotX = -1.45;
          targetRightForeArmRotY = -0.15;
          targetRightForeArmRotZ = 0.85;

          targetRightHandRotX = 0.22;
          targetRightHandRotY = -0.25;
          targetRightHandRotZ = 0.15;

          targetLeftArmRotX = 0.65;
          targetLeftArmRotY = -0.35;
          targetLeftArmRotZ = -0.75;

          targetLeftForeArmRotX = -1.35;
          targetLeftForeArmRotY = 0.15;
          targetLeftForeArmRotZ = -0.6;

          targetLeftHandRotX = 0.1;
          targetLeftHandRotY = 0.2;
          targetLeftHandRotZ = -0.25;
          targetSmile = 0.7;
        } else {
          // Fully covering eyes with hands
          targetRightArmRotX = 0.9;
          targetRightArmRotY = 0.2;
          targetRightArmRotZ = 0.5;

          targetRightForeArmRotX = -1.8;
          targetRightForeArmRotY = -0.25;
          targetRightForeArmRotZ = 0.8;

          targetRightHandRotX = 0.2;
          targetRightHandRotY = 0;
          targetRightHandRotZ = 0.1;

          targetLeftArmRotX = 0.9;
          targetLeftArmRotY = -0.2;
          targetLeftArmRotZ = -0.5;

          targetLeftForeArmRotX = -1.8;
          targetLeftForeArmRotY = 0.25;
          targetLeftForeArmRotZ = -0.8;

          targetLeftHandRotX = 0.2;
          targetLeftHandRotY = 0;
          targetLeftHandRotZ = -0.1;
        }
      } else if (currentMode === "loading") {
        // Encouraging thumbs up & nod
        targetRootX = 0.24;
        targetRootY = 0;
        targetRootZ = 0.0;
        targetRootRotY = -0.15;

        const nod = Math.sin(elapsed * 5.5) * 0.07;
        targetHeadRotX = 0.06 + nod;
        targetHeadRotY = -0.08;
        targetHeadRotZ = 0;
        targetSmile = 0.65;

        // Right hand thumbs up
        targetRightArmRotX = 0.45;
        targetRightArmRotY = 0.1;
        targetRightArmRotZ = 0.4;

        targetRightForeArmRotX = -1.3;
        targetRightForeArmRotY = 0.2;
        targetRightForeArmRotZ = 0.6;

        targetRightHandRotX = 0.25;
        targetRightHandRotY = 0;
        targetRightHandRotZ = 0.2;

        targetLeftArmRotX = 0.12;
        targetLeftArmRotY = 0;
        targetLeftArmRotZ = -0.18;
        targetLeftForeArmRotX = -0.25;
        targetLeftForeArmRotY = 0;
        targetLeftForeArmRotZ = 0;
      } else if (currentMode === "celebrating") {
        // Celebratory cheer with bounce
        targetRootX = 0.24;
        targetRootY = 0;
        targetRootZ = 0.0;
        targetRootRotY = -0.08;

        const cheerBounce = Math.sin(elapsed * 7) * 0.035;
        avatarRoot.position.y = cheerBounce;

        targetHeadRotX = -0.1;
        targetHeadRotY = 0;
        targetHeadRotZ = Math.sin(elapsed * 4) * 0.05;
        targetSmile = 0.95;

        targetRightArmRotX = 0.1;
        targetRightArmRotY = 0.15;
        targetRightArmRotZ = 1.85; // Hands high in air
        targetRightForeArmRotX = -0.75;
        targetRightForeArmRotY = 0.25;
        targetRightForeArmRotZ = 0.55;

        targetLeftArmRotX = 0.1;
        targetLeftArmRotY = -0.15;
        targetLeftArmRotZ = -1.85;
        targetLeftForeArmRotX = -0.75;
        targetLeftForeArmRotY = -0.25;
        targetLeftForeArmRotZ = -0.55;
      } else if (currentMode === "error") {
        // Sympathetic head shake
        targetRootX = 0.24;
        targetRootY = 0;
        targetRootZ = 0.0;
        targetRootRotY = -0.15;

        const shake = Math.sin(elapsed * 6) * 0.08;
        targetHeadRotX = 0.1;
        targetHeadRotY = shake;
        targetHeadRotZ = 0;
        targetSmile = 0.1;

        targetRightArmRotX = 0.15;
        targetRightArmRotZ = 0.2;
        targetRightForeArmRotX = -0.3;

        targetLeftArmRotX = 0.15;
        targetLeftArmRotZ = -0.2;
        targetLeftForeArmRotX = -0.3;
      } else {
        // Idle friendly receptionist stance with subtle head sway
        targetRootX = 0.24;
        targetRootY = 0;
        targetRootZ = 0.0;
        targetRootRotY = -0.18;

        const headSway = Math.sin(elapsed * 1.5) * 0.02;
        targetHeadRotX = 0.02 + Math.cos(elapsed * 1.2) * 0.015;
        targetHeadRotY = -0.06 + headSway;
        targetHeadRotZ = 0.015;
        targetSmile = 0.5;

        targetRightArmRotX = 0.12;
        targetRightArmRotY = 0.04;
        targetRightArmRotZ = 0.2;
        targetRightForeArmRotX = -0.3;
        targetRightForeArmRotY = 0;
        targetRightForeArmRotZ = 0;

        targetLeftArmRotX = 0.12;
        targetLeftArmRotY = -0.04;
        targetLeftArmRotZ = -0.2;
        targetLeftForeArmRotX = -0.3;
        targetLeftForeArmRotY = 0;
        targetLeftForeArmRotZ = 0;
      }

      // Smooth kinematic interpolation
      const smoothFactor = prefersReducedMotion ? 0.35 : 0.08;

      avatarRoot.position.x = lerp(avatarRoot.position.x, targetRootX, smoothFactor);
      if (currentMode !== "celebrating") {
        avatarRoot.position.y = lerp(avatarRoot.position.y, targetRootY, smoothFactor);
      }
      avatarRoot.position.z = lerp(avatarRoot.position.z, targetRootZ, smoothFactor);
      avatarRoot.rotation.y = lerp(avatarRoot.rotation.y, targetRootRotY, smoothFactor);

      if (isModelLoaded) {
        if (headBone) {
          headBone.rotation.x = lerp(headBone.rotation.x, restRot.head.x + targetHeadRotX, smoothFactor);
          headBone.rotation.y = lerp(headBone.rotation.y, restRot.head.y + targetHeadRotY, smoothFactor);
          headBone.rotation.z = lerp(headBone.rotation.z, restRot.head.z + targetHeadRotZ, smoothFactor);
        }

        if (rightArmBone) {
          rightArmBone.rotation.x = lerp(rightArmBone.rotation.x, restRot.rightArm.x + targetRightArmRotX, smoothFactor);
          rightArmBone.rotation.y = lerp(rightArmBone.rotation.y, restRot.rightArm.y + targetRightArmRotY, smoothFactor);
          rightArmBone.rotation.z = lerp(rightArmBone.rotation.z, restRot.rightArm.z + targetRightArmRotZ, smoothFactor);
        }

        if (rightForeArmBone) {
          rightForeArmBone.rotation.x = lerp(rightForeArmBone.rotation.x, restRot.rightForeArm.x + targetRightForeArmRotX, smoothFactor);
          rightForeArmBone.rotation.y = lerp(rightForeArmBone.rotation.y, restRot.rightForeArm.y + targetRightForeArmRotY, smoothFactor);
          rightForeArmBone.rotation.z = lerp(rightForeArmBone.rotation.z, restRot.rightForeArm.z + targetRightForeArmRotZ, smoothFactor);
        }

        if (rightHandBone) {
          rightHandBone.rotation.x = lerp(rightHandBone.rotation.x, restRot.rightHand.x + targetRightHandRotX, smoothFactor);
          rightHandBone.rotation.y = lerp(rightHandBone.rotation.y, restRot.rightHand.y + targetRightHandRotY, smoothFactor);
          rightHandBone.rotation.z = lerp(rightHandBone.rotation.z, restRot.rightHand.z + targetRightHandRotZ, smoothFactor);
        }

        if (leftArmBone) {
          leftArmBone.rotation.x = lerp(leftArmBone.rotation.x, restRot.leftArm.x + targetLeftArmRotX, smoothFactor);
          leftArmBone.rotation.y = lerp(leftArmBone.rotation.y, restRot.leftArm.y + targetLeftArmRotY, smoothFactor);
          leftArmBone.rotation.z = lerp(leftArmBone.rotation.z, restRot.leftArm.z + targetLeftArmRotZ, smoothFactor);
        }

        if (leftForeArmBone) {
          leftForeArmBone.rotation.x = lerp(leftForeArmBone.rotation.x, restRot.leftForeArm.x + targetLeftForeArmRotX, smoothFactor);
          leftForeArmBone.rotation.y = lerp(leftForeArmBone.rotation.y, restRot.leftForeArm.y + targetLeftForeArmRotY, smoothFactor);
          leftForeArmBone.rotation.z = lerp(leftForeArmBone.rotation.z, restRot.leftForeArm.z + targetLeftForeArmRotZ, smoothFactor);
        }

        if (leftHandBone) {
          leftHandBone.rotation.x = lerp(leftHandBone.rotation.x, restRot.leftHand.x + targetLeftHandRotX, smoothFactor);
          leftHandBone.rotation.y = lerp(leftHandBone.rotation.y, restRot.leftHand.y + targetLeftHandRotY, smoothFactor);
          leftHandBone.rotation.z = lerp(leftHandBone.rotation.z, restRot.leftHand.z + targetLeftHandRotZ, smoothFactor);
        }
      }

      renderer.render(scene, camera);
      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 400;
      const h = container.clientHeight || 560;
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
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          mesh.geometry?.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose());
          } else if (mesh.material) {
            mesh.material.dispose();
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
      {/* 3D WebGL Canvas Container */}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
