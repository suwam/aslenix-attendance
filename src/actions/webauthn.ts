import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  generateRegistrationOptions as generateRegOptions,
  verifyRegistrationResponse as verifyRegResponse,
  generateAuthenticationOptions as generateAuthOptions,
  verifyAuthenticationResponse as verifyAuthResponse,
} from "@simplewebauthn/server";

// Standard RP details
const rpName = "ASLENIX Attendance";

export const generateRegistrationOptions = createServerFn({ method: "POST" })
  .validator((d: { userId: string; deviceFingerprint: string; rpID: string; username: string }) => d)
  .handler(async ({ data }) => {
    const { userId, deviceFingerprint, rpID, username } = data;

    // Check if device passkey already exists
    const { data: existing } = await supabaseAdmin
      .from("device_passkeys")
      .select("id")
      .eq("employee_id", userId)
      .eq("device_fingerprint", deviceFingerprint)
      .maybeSingle();

    if (existing) {
      throw new Error("Device already has a registered passkey.");
    }

    const options = await generateRegOptions({
      rpName,
      rpID,
      userID: new TextEncoder().encode(userId),
      userName: username,
      timeout: 60000,
      attestationType: "none",
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
    });

    // Store the challenge
    await supabaseAdmin.from("webauthn_challenges").insert({
      employee_id: userId,
      device_fingerprint: deviceFingerprint,
      challenge: options.challenge,
    });

    return options;
  });

export const verifyRegistrationResponse = createServerFn({ method: "POST" })
  .validator((d: { userId: string; deviceFingerprint: string; rpID: string; response: any }) => d)
  .handler(async ({ data }) => {
    const { userId, deviceFingerprint, rpID, response } = data;

    // Get the stored challenge
    const { data: storedChallenge, error: challengeError } = await supabaseAdmin
      .from("webauthn_challenges")
      .select("challenge")
      .eq("employee_id", userId)
      .eq("device_fingerprint", deviceFingerprint)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (challengeError || !storedChallenge) {
      throw new Error("No active registration challenge found or it has expired.");
    }

    // Clean up all challenges for this device/user
    await supabaseAdmin
      .from("webauthn_challenges")
      .delete()
      .eq("employee_id", userId)
      .eq("device_fingerprint", deviceFingerprint);

    const expectedChallenge = storedChallenge.challenge;

    const verification = await verifyRegResponse({
      response,
      expectedChallenge,
      expectedOrigin: ["http://localhost:5173", "http://localhost:3000", `https://${rpID}`],
      expectedRPID: rpID,
      requireUserVerification: false,
    });

    if (verification.verified && verification.registrationInfo) {
      const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

      // Base64 encode the public key so it can be safely stored in TEXT/BYTEA
      const publicKeyBase64 = Buffer.from(credential.publicKey).toString("base64");

      const { error: insertError } = await supabaseAdmin.from("device_passkeys").insert({
        employee_id: userId,
        device_fingerprint: deviceFingerprint,
        credential_id: credential.id,
        public_key: publicKeyBase64,
        counter: credential.counter,
        transports: credential.transports || [],
      });

      if (insertError) {
        throw new Error("Failed to store credential: " + insertError.message);
      }

      return { verified: true };
    }

    return { verified: false };
  });

export const generateAuthenticationOptions = createServerFn({ method: "POST" })
  .validator((d: { userId: string; deviceFingerprint: string; rpID: string }) => d)
  .handler(async ({ data }) => {
    const { userId, deviceFingerprint, rpID } = data;

    const { data: passkey } = await supabaseAdmin
      .from("device_passkeys")
      .select("*")
      .eq("employee_id", userId)
      .eq("device_fingerprint", deviceFingerprint)
      .maybeSingle();

    if (!passkey) {
      throw new Error("No passkey found for this device.");
    }

    const options = await generateAuthOptions({
      rpID,
      timeout: 60000,
      allowCredentials: [
        {
          id: passkey.credential_id,
          transports: passkey.transports as any,
        },
      ],
      userVerification: "preferred",
    });

    await supabaseAdmin.from("webauthn_challenges").insert({
      employee_id: userId,
      device_fingerprint: deviceFingerprint,
      challenge: options.challenge,
    });

    return options;
  });

export const verifyAuthenticationResponse = createServerFn({ method: "POST" })
  .validator((d: { userId: string; deviceFingerprint: string; rpID: string; response: any }) => d)
  .handler(async ({ data }) => {
    const { userId, deviceFingerprint, rpID, response } = data;

    const { data: passkey } = await supabaseAdmin
      .from("device_passkeys")
      .select("*")
      .eq("employee_id", userId)
      .eq("device_fingerprint", deviceFingerprint)
      .maybeSingle();

    if (!passkey) throw new Error("Passkey not found.");

    const { data: storedChallenge } = await supabaseAdmin
      .from("webauthn_challenges")
      .select("challenge")
      .eq("employee_id", userId)
      .eq("device_fingerprint", deviceFingerprint)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!storedChallenge) {
      throw new Error("No active authentication challenge found.");
    }

    await supabaseAdmin
      .from("webauthn_challenges")
      .delete()
      .eq("employee_id", userId)
      .eq("device_fingerprint", deviceFingerprint);

    const publicKeyBytes = Buffer.from(passkey.public_key, "base64");

    const verification = await verifyAuthResponse({
      response,
      expectedChallenge: storedChallenge.challenge,
      expectedOrigin: ["http://localhost:5173", "http://localhost:3000", `https://${rpID}`],
      expectedRPID: rpID,
      requireUserVerification: false,
      credential: {
        id: passkey.credential_id,
        publicKey: publicKeyBytes,
        counter: Number(passkey.counter),
        transports: passkey.transports as any,
      },
    });

    if (verification.verified) {
      await supabaseAdmin
        .from("device_passkeys")
        .update({ counter: verification.authenticationInfo.newCounter })
        .eq("id", passkey.id);
      
      return { verified: true };
    }

    return { verified: false };
  });
